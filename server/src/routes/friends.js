/**
 * routes/friends.js  — Friends management (Phase 7)
 *
 * GET    /api/friends          — list friends with latest snapshot data
 * POST   /api/friends          — add friend; fetch platform profiles immediately
 * DELETE /api/friends/:id      — remove friend
 * GET    /api/friends/:id      — rich profile for a single friend
 */

import { Router } from 'express'
import { z } from 'zod'
import requireAuth from '../middleware/requireAuth.js'
import * as friendsRepo from '../repositories/friends.js'
import * as platformAccountsRepo from '../repositories/platformAccounts.js'
import { fetchPlatformProfiles, streamPlatformProfiles } from '../services/platformProfiles.js'
import { saveFriendProfile } from '../repositories/profileData.js'
import pool from '../db/pool.js'

const router = Router()
router.use(requireAuth)

const MAX_FRIENDS = 50

// ── Validation schemas ────────────────────────────────────────────────────────

const addFriendSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  handles: z.object({
    leetcode:      z.string().trim().max(50).optional(),
    codeforces:    z.string().trim().max(40).optional(),
    codechef:      z.string().trim().max(50).optional(),
    atcoder:       z.string().trim().max(16).optional(),
    geeksforgeeks: z.string().trim().max(50).optional(),
  }).refine(
    (h) => Object.values(h).some(v => v && v.trim()),
    { message: 'At least one platform handle is required.' },
  ),
}).strict()

// ── Helper: build a normalised friend object from DB rows + snapshots ─────────

function buildFriendSummary(row) {
  // row.handles is a json_agg array of { platform, handle, status, lastSyncedAt, latestSnapshotId, snapshot? }
  const handles = (row.handles ?? []).filter(h => h && h.platform)

  // Derive "last seen" from the most recent lastSyncedAt across handles
  const syncDates = handles
    .map(h => h.lastSyncedAt ? new Date(h.lastSyncedAt) : null)
    .filter(Boolean)
  const lastSyncedAt = syncDates.length > 0
    ? syncDates.sort((a, b) => b - a)[0]
    : null

  const lastFetchedLabel = lastSyncedAt ? relativeTime(lastSyncedAt) : 'Never synced'

  // Determine online status from lastSyncedAt
  const minutesAgo = lastSyncedAt ? (Date.now() - lastSyncedAt.getTime()) / 60000 : Infinity
  const status =
    minutesAgo < 60  ? 'active_recent'
    : minutesAgo < 1440 ? 'active_today'
    : 'inactive'

  // Aggregate solved counts from snapshots
  const platforms = {}
  let totalSolved = 0
  for (const h of handles) {
    const snap = h.snapshot
    if (!snap) continue
    const solved = snap.problems_solved ?? 0
    totalSolved += solved
    platforms[h.platform] = {
      delta: null,
      total: solved,
      rating: snap.rating ?? null,
      ratingDelta: null,
    }
  }

  // streak: derive from combined activity_by_date in raw_meta if available
  const streak = handles.reduce((best, h) => {
    const raw = h.snapshot?.raw_meta
    if (!raw) return best
    const s = raw.currentStreak ?? 0
    return s > best ? s : best
  }, 0)

  // sparkline: use the first handle that has contestHistory
  const sparklineSource = handles.find(h => Array.isArray(h.snapshot?.raw_meta?.contestHistory))
  const sparkline = sparklineSource
    ? sparklineSource.snapshot.raw_meta.contestHistory
        .slice(-10)
        .map(c => c.rating)
        .filter(r => r !== null)
    : []

  // lastActivity from raw_meta activityByDate — most recent day with > 0
  let lastActivity = null
  for (const h of handles) {
    const activity = h.snapshot?.raw_meta?.activityByDate ?? {}
    const days = Object.entries(activity)
      .filter(([, c]) => c > 0)
      .sort(([a], [b]) => b.localeCompare(a))
    if (days.length > 0) {
      const [day, count] = days[0]
      const timeAgo = relativeTime(new Date(day + 'T12:00:00Z'))
      lastActivity = {
        platform: h.platform,
        text: `${count} submission${count === 1 ? '' : 's'} on ${platformLabel(h.platform)}`,
        timeAgo,
      }
      break
    }
  }

  return {
    id:            row.id,
    displayName:   row.display_name,
    handle:        handles.length ? handles.map(h => `@${h.handle}`).join(', ') : 'No linked platform handles',
    initials:      row.display_name.charAt(0).toUpperCase(),
    avatarColor:   avatarColor(row.id),
    status,
    lastSeenLabel: lastFetchedLabel,
    streak,
    platforms,
    totalSolved,
    sparkline,
    lastActivity,
    handles:       handles.map(h => ({ platform: h.platform, handle: h.handle })),
    lastSyncedAt:  lastSyncedAt?.toISOString() ?? null,
  }
}

// ── GET /api/friends ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  // Join with latest snapshots in one query
  const { rows } = await pool.query(
    `SELECT
       f.id, f.display_name, f.created_at,
       COALESCE(json_agg(json_build_object(
         'platform',         pa.platform,
         'handle',           pa.display_handle,
         'status',           pa.status,
         'lastSyncedAt',     pa.last_synced_at,
         'snapshot',         to_json(s)
       ) ORDER BY pa.platform) FILTER (WHERE pa.id IS NOT NULL), '[]'::json) AS handles
     FROM friends f
     LEFT JOIN friend_handles fh ON fh.friend_id = f.id
     LEFT JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     LEFT JOIN account_snapshots s ON s.id = pa.latest_snapshot_id
     WHERE f.owner_user_id = $1
     GROUP BY f.id
     ORDER BY f.created_at DESC`,
    [req.user.id],
  )

  const friends = rows.map(buildFriendSummary)
  res.json({ friends })
})

// ── POST /api/friends ─────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const parsed = addFriendSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid request.',
      },
    })
  }

  const { displayName, handles } = parsed.data

  if (await friendsRepo.existsByDisplayName(req.user.id, displayName)) {
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: `You already have a friend named "${displayName}".` },
    })
  }

  // Enforce friend limit
  const count = await friendsRepo.countByOwner(req.user.id)
  if (count >= MAX_FRIENDS) {
    return res.status(422).json({
      error: { code: 'LIMIT_EXCEEDED', message: `You can have at most ${MAX_FRIENDS} friends.` },
    })
  }

  // Fetch platform profiles immediately
  const toFetch = Object.fromEntries(
    Object.entries(handles).filter(([, v]) => v && v.trim())
  )
  const result = await fetchPlatformProfiles(toFetch)
  const fetchedProfiles = result.profiles ?? {}
  if (Object.keys(fetchedProfiles).length === 0) {
    return res.status(422).json({
      error: {
        code: 'NO_PROFILES_FETCHED',
        message: 'We could not fetch any platform profiles. Check the handles and try again.',
      },
      errors: result.errors ?? {},
    })
  }

  // Store shared public profile data without linking friend handles to user_accounts.
  await Promise.all(
    Object.values(fetchedProfiles).map(p =>
      saveFriendProfile(p)
    )
  )

  const linkedHandles = []
  for (const [platform, handle] of Object.entries(toFetch)) {
    const canonical = handle.trim().toLowerCase()
    const account = await platformAccountsRepo.findByHandle(platform, canonical)
    if (account) {
      linkedHandles.push({ platform, platformAccountId: account.id })
    }
  }

  // Create the friend and all handle links atomically.
  let friend
  try {
    friend = await friendsRepo.create(req.user.id, displayName, linkedHandles)
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: { code: 'DUPLICATE', message: `You already have a friend named "${displayName}".` },
      })
    }
    throw err
  }

  // Re-fetch the friend with handles for response
  const fullFriend = await friendsRepo.findByIdAndOwner(friend.id, req.user.id)

  res.status(201).json({
    friend: buildFriendSummary({
      ...fullFriend,
      handles: (fullFriend.handles ?? []).map(h => ({
        ...h,
        snapshot: fetchedProfiles[h.platform]
          ? {
              problems_solved: fetchedProfiles[h.platform].problemsSolved ?? 0,
              rating: fetchedProfiles[h.platform].rating ?? fetchedProfiles[h.platform].contestRating ?? null,
              raw_meta: fetchedProfiles[h.platform],
            }
          : null,
      })),
    }),
    errors: result.errors ?? {},
  })
})

// ── PUT /api/friends/:id ────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  const friend = await friendsRepo.findByIdAndOwner(req.params.id, req.user.id)
  if (!friend) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend not found.' } })
  }

  const { displayName, handles } = req.body || {}

  if (displayName && displayName.trim() && displayName.trim() !== friend.display_name) {
    if (await friendsRepo.existsByDisplayName(req.user.id, displayName.trim())) {
      return res.status(409).json({
        error: { code: 'DUPLICATE', message: `You already have a friend named "${displayName.trim()}".` },
      })
    }
    await friendsRepo.rename(friend.id, req.user.id, displayName.trim())
  }

  if (handles && typeof handles === 'object') {
    const toFetch = Object.fromEntries(
      Object.entries(handles).filter(([, v]) => v && v.trim())
    )

    let fetchedProfiles = {}
    if (Object.keys(toFetch).length > 0) {
      const result = await fetchPlatformProfiles(toFetch)
      fetchedProfiles = result.profiles ?? {}
      if (Object.keys(fetchedProfiles).length === 0) {
        return res.status(422).json({
          error: {
            code: 'NO_PROFILES_FETCHED',
            message: 'We could not fetch any platform profiles. Check the handles and try again.',
          },
          errors: result.errors ?? {},
        })
      }
      await Promise.all(
        Object.values(fetchedProfiles).map(p => saveFriendProfile(p))
      )
    }

    const currentHandles = friend.handles ?? []
    const currentPlatforms = currentHandles.map(h => h.platform)

    // Remove platforms that were unlinked or cleared
    for (const plat of currentPlatforms) {
      if (!toFetch[plat]) {
        await friendsRepo.removeHandle(friend.id, plat)
      }
    }

    // Upsert linked platform accounts
    for (const [platform, handle] of Object.entries(toFetch)) {
      const canonical = handle.trim().toLowerCase()
      const account = await platformAccountsRepo.findByHandle(platform, canonical)
      if (account) {
        await friendsRepo.upsertHandle(friend.id, platform, account.id)
      }
    }
  }

  res.json({ ok: true })
})

// ── DELETE /api/friends/:id ───────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const deleted = await friendsRepo.remove(req.params.id, req.user.id)
  if (!deleted) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend not found.' } })
  }
  res.json({ ok: true })
})

// ── POST /api/friends/:id/sync-stream ─────────────────────────────────────────

router.post('/:id/sync-stream', async (req, res) => {
  const friend = await friendsRepo.findByIdAndOwner(req.params.id, req.user.id)
  if (!friend) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend not found.' } })
  }

  const { displayName, handles } = req.body || {}

  if (displayName && displayName.trim() && displayName.trim() !== friend.display_name) {
    if (await friendsRepo.existsByDisplayName(req.user.id, displayName.trim())) {
      return res.status(409).json({
        error: { code: 'DUPLICATE', message: `You already have a friend named "${displayName.trim()}".` },
      })
    }
    await friendsRepo.rename(friend.id, req.user.id, displayName.trim())
  }

  const toFetch = Object.fromEntries(
    Object.entries(handles || {}).filter(([, v]) => v && v.trim())
  )

  // Configure SSE response headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Remove platforms that were unlinked
  const currentHandles = friend.handles ?? []
  for (const h of currentHandles) {
    if (!toFetch[h.platform]) {
      await friendsRepo.removeHandle(friend.id, h.platform)
    }
  }

  if (Object.keys(toFetch).length === 0) {
    sendEvent('complete', { total: 0, succeeded: 0, failed: 0, errors: {} })
    return res.end()
  }

  try {
    await streamPlatformProfiles(toFetch, {
      onStart: (info) => {
        sendEvent('start', info)
      },
      onProgress: async (event) => {
        if (event.type === 'platform_success' && event.profile) {
          try {
            await saveFriendProfile(event.profile)
            const canonical = event.profile.username.trim().toLowerCase()
            const account = await platformAccountsRepo.findByHandle(event.platform, canonical)
            if (account) {
              await friendsRepo.upsertHandle(friend.id, event.platform, account.id)
            }
          } catch (dbErr) {
            console.error('Failed to save friend profile snapshot:', dbErr)
          }
        }
        sendEvent(event.type, event)
      },
      onComplete: (results) => {
        sendEvent('complete', {
          total: Object.keys(toFetch).length,
          succeeded: Object.keys(results.profiles).length,
          failed: Object.keys(results.errors).length,
          errors: results.errors,
        })
        res.end()
      },
    })
  } catch (err) {
    sendEvent('error', { message: err.message })
    res.end()
  }
})

// ── GET /api/friends/:id ──────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       f.id, f.display_name, f.created_at,
       COALESCE(json_agg(json_build_object(
         'platform',         pa.platform,
         'handle',           pa.display_handle,
         'status',           pa.status,
         'lastSyncedAt',     pa.last_synced_at,
         'snapshot',         to_json(s)
       ) ORDER BY pa.platform) FILTER (WHERE pa.id IS NOT NULL), '[]'::json) AS handles
     FROM friends f
     LEFT JOIN friend_handles fh ON fh.friend_id = f.id
     LEFT JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     LEFT JOIN account_snapshots s ON s.id = pa.latest_snapshot_id
     WHERE f.id = $1 AND f.owner_user_id = $2
     GROUP BY f.id`,
    [req.params.id, req.user.id],
  )

  if (rows.length === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend not found.' } })
  }

  const row = rows[0]
  const handles = (row.handles ?? []).filter(h => h && h.platform)

  // Build per-platform profile objects from raw_meta
  const profiles = {}
  for (const h of handles) {
    const raw = h.snapshot?.raw_meta
    if (!raw) continue
    profiles[h.platform] = {
      ...raw,
      username: h.handle,
      platform: h.platform,
      lastSyncedAt: h.lastSyncedAt,
      // Ensure snapshot-level fields are present
      rating: h.snapshot.rating ?? raw.rating ?? raw.contestRating ?? null,
      maxRating: h.snapshot.max_rating ?? raw.maxRating ?? null,
      rankTitle: h.snapshot.rank_title ?? raw.rankTitle ?? null,
      problemsSolved: h.snapshot.problems_solved ?? raw.problemsSolved ?? 0,
      contestsAttended: raw.contestsAttended ?? 0,
    }
  }

  // Build headline stats
  const cfProfile = profiles.codeforces
  const totalSolved = Object.values(profiles).reduce((s, p) => s + (p.problemsSolved ?? 0), 0)
  const totalContests = Object.values(profiles).reduce((s, p) => s + (p.contestsAttended ?? 0), 0)

  // Streak from activity
  const combinedActivity = {}
  for (const p of Object.values(profiles)) {
    for (const [day, count] of Object.entries(p.activityByDate ?? {})) {
      combinedActivity[day] = (combinedActivity[day] ?? 0) + count
    }
  }

  // Recent contests (latest 3 across all platforms)
  const allContests = []
  for (const p of Object.values(profiles)) {
    for (const c of p.contestHistory ?? []) {
      if (c.date) allContests.push({ ...c, platform: p.platform })
    }
  }
  allContests.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const recentContests = allContests.slice(0, 3).map(c => ({
    platform: c.platform,
    name: c.contestName,
    rank: c.ranking ? `#${c.ranking}` : '—',
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(c.date)),
    ratingDelta: (c.oldRating !== null && c.rating !== null) ? c.rating - c.oldRating : null,
  }))

  // Today's activity
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayActivity = []
  for (const p of Object.values(profiles)) {
    const count = (p.activityByDate ?? {})[todayKey] ?? 0
    if (count > 0) {
      todayActivity.push({
        platform: p.platform,
        text: `${count} submission${count === 1 ? '' : 's'} on ${platformLabel(p.platform)}`,
        timeAgo: 'today',
      })
    }
  }

  // Topics (top 5 across platforms)
  const topicMap = new Map()
  const TOPIC_COLORS = ['#8B5CF6', '#22C55E', '#FB923C', '#3B82F6', '#FF5B7F']
  for (const p of Object.values(profiles)) {
    for (const t of p.topics ?? []) {
      const name = t.name ?? t.slug ?? ''
      if (name) topicMap.set(name, (topicMap.get(name) ?? 0) + (t.problemsSolved ?? 0))
    }
  }
  const topics = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({ name, count, color: TOPIC_COLORS[i] }))

  // Platform solved cards
  const PLATFORM_ORDER = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'geeksforgeeks']
  const PLATFORM_LABELS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', atcoder: 'AtCoder', geeksforgeeks: 'GeeksForGeeks' }
  const platformSolved = PLATFORM_ORDER.map(id => ({
    key: id,
    label: PLATFORM_LABELS[id],
    solved: profiles[id]?.problemsSolved ?? null,
    weekDelta: null,
  }))

  // Rating history per platform
  const ratingHistory = {}
  for (const [platform, p] of Object.entries(profiles)) {
    ratingHistory[platform] = (p.contestHistory ?? [])
      .filter(c => c.date && c.rating !== null)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .map(c => ({
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(c.date)),
        rating: c.rating,
      }))
  }

  // Submission activity (last 30 days from combined activityByDate)
  const subActivity = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    subActivity.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: combinedActivity[key] ?? 0 })
  }

  const lastFetched = handles
    .map(h => h.lastSyncedAt ? new Date(h.lastSyncedAt) : null)
    .filter(Boolean)
    .sort((a, b) => b - a)[0]

  res.json({
    id:          row.id,
    displayName: row.display_name,
    initials:    row.display_name.charAt(0).toUpperCase(),
    avatarColor: avatarColor(row.id),
    handles:     handles.map(h => ({ platform: h.platform, handle: h.handle })),
    lastFetchedLabel: lastFetched ? relativeTime(lastFetched) : 'Never synced',
    status: 'active_recent',
    bio: `Competitive programmer · ${Object.keys(profiles).map(p => PLATFORM_LABELS[p]).join(', ')}`,
    bioTag: '#CodeCircle',
    headline: {
      cfRating:         { value: cfProfile?.rating ?? null,      delta: null },
      problemsSolved:   { value: totalSolved,                    delta: null },
      contestsAttended: { value: totalContests,                  sub: null   },
      currentStreak:    { value: cfProfile?.currentStreak ?? 0,  best: null  },
    },
    platformSolved,
    ratingHistory,
    activityByDate: combinedActivity,
    topics,
    submissionActivity: subActivity,
    statsSnapshot: {
      problemsSolved:    totalSolved,
      ratingChange:      cfProfile?.rating ?? 0,
      contestsAttended:  totalContests,
      activeDays: Object.values(combinedActivity).filter(c => c > 0).length,
    },
    todayActivity,
    recentContests,
    profiles,
  })
})

// ── Utilities ─────────────────────────────────────────────────────────────────

function relativeTime(date) {
  const ms  = Date.now() - new Date(date).getTime()
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1)  return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr  < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const d  = Math.round(hr / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#DB2777', '#059669', '#D97706', '#0891B2', '#DC2626', '#7C3AED']
function avatarColor(id = '') {
  // Stable colour from UUID — sum first 8 char codes
  const sum = [...id.slice(0, 8)].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

const PLATFORM_LABEL_MAP = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', atcoder: 'AtCoder', geeksforgeeks: 'GeeksForGeeks' }
function platformLabel(p) { return PLATFORM_LABEL_MAP[p] ?? p }

export default router
