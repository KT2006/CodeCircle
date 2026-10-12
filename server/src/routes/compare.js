/**
 * routes/compare.js  — Phase 8
 *
 * GET /api/compare?friendId=<uuid>
 *   Returns a fully computed comparison object: "you" side from your saved
 *   profiles + "friend" side from the friend's latest snapshots.
 *   Topics come from snapshot_tag_stats (proper DB table).
 *   Rating sparkline comes from rating_history.
 *   Activity comes from daily_activity.
 *
 * GET /api/compare/friends
 *   Returns the list of friends (id + displayName) so the frontend can
 *   populate the friend-selector dropdown.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'
import { getSavedProfiles } from '../repositories/profileData.js'
import { getTagsForSnapshot, getRatingSparkline } from '../repositories/snapshots.js'
import { scoreProfile, computeCompositeScore, computeGapAnalysis } from '../scoring/index.js'
import pool from '../db/pool.js'

const router = Router()
router.use(requireAuth)

// ── constants ─────────────────────────────────────────────────────────────────

const PLATFORM_ORDER = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'geeksforgeeks']
const PLATFORM_LABEL = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', atcoder: 'AtCoder', geeksforgeeks: 'GeeksForGeeks' }
const PLATFORM_COLOR = { leetcode: '#7C3AED', codeforces: '#22C55E', codechef: '#FB923C', atcoder: '#3B82F6', geeksforgeeks: '#2DBD6E' }
const TOPIC_COLORS   = ['#8B5CF6', '#22C55E', '#FB923C', '#3B82F6', '#FF5B7F', '#F59E0B']

const CF_TIERS = [
  { label: 'Newbie\n0',              value: 0    },
  { label: 'Pupil\n800',             value: 800  },
  { label: 'Specialist\n1400',       value: 1400 },
  { label: 'Expert\n2000',           value: 2000 },
  { label: 'Cand. Master\n2400',     value: 2400 },
  { label: 'Master\n3000+',          value: 3000 },
]

// ── GET /api/compare/friends ──────────────────────────────────────────────────

router.get('/friends', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.id, f.display_name,
            json_agg(json_build_object('platform', pa.platform, 'handle', pa.display_handle)
                     ORDER BY pa.platform) AS handles
     FROM friends f
     JOIN friend_handles fh ON fh.friend_id = f.id
     JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     WHERE f.owner_user_id = $1
     GROUP BY f.id
     ORDER BY f.display_name`,
    [req.user.id],
  )
  res.json({ friends: rows.map(r => ({ id: r.id, displayName: r.display_name, handles: r.handles })) })
})

// ── GET /api/compare?friendId= ────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { friendId } = req.query
  if (!friendId) {
    return res.status(400).json({ error: { code: 'MISSING_PARAM', message: '`friendId` is required.' } })
  }

  // ── Load "you" side ──────────────────────────────────────────────────────
  const myProfiles = await getSavedProfiles(req.user.id)
  if (Object.keys(myProfiles).length === 0) {
    return res.status(422).json({
      error: { code: 'NO_PROFILE', message: 'You have not connected any platform accounts yet.' },
    })
  }

  // ── Load friend side ──────────────────────────────────────────────────────
  const { rows: friendRows } = await pool.query(
    `SELECT
       f.id, f.display_name,
       json_agg(json_build_object(
         'platform',           pa.platform,
         'handle',             pa.display_handle,
         'platformAccountId',  pa.id,
         'lastSyncedAt',       pa.last_synced_at,
         'snapshotId',         s.id,
         'rating',             s.rating,
         'maxRating',          s.max_rating,
         'rankTitle',          s.rank_title,
         'contestsCount',      s.contests_count,
         'problemsSolved',     s.problems_solved,
         'solvedByBucket',     s.solved_by_bucket
       ) ORDER BY pa.platform) AS handles
     FROM friends f
     JOIN friend_handles fh ON fh.friend_id = f.id
     JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     LEFT JOIN account_snapshots s ON s.id = pa.latest_snapshot_id
     WHERE f.id = $1 AND f.owner_user_id = $2
     GROUP BY f.id`,
    [friendId, req.user.id],
  )
  if (friendRows.length === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend not found.' } })
  }

  const friendRow     = friendRows[0]
  const friendHandles = (friendRow.handles ?? []).filter(h => h?.platform)

  // ── Enrich friend handles with tags + sparkline from proper tables ────────
  const enrichedFriendHandles = await Promise.all(
    friendHandles.map(async (h) => {
      const [tags, sparkline] = await Promise.all([
        getTagsForSnapshot(h.snapshotId),
        getRatingSparkline(h.platformAccountId),
      ])
      return { ...h, tags, sparkline }
    }),
  )

  // ── Enrich "you" side: get platform account ids + snapshot ids ────────────
  // getSavedProfiles returns raw_meta — we need the account ids to query tag stats
  const { rows: myAccountRows } = await pool.query(
    `SELECT pa.platform, pa.id AS platform_account_id, pa.last_synced_at,
            pa.latest_snapshot_id AS snapshot_id
     FROM user_accounts ua
     JOIN platform_accounts pa ON pa.id = ua.platform_account_id
     WHERE ua.user_id = $1`,
    [req.user.id],
  )

  // Build enriched "you" handles (merge raw_meta with DB tag stats + sparkline)
  const enrichedMyHandles = await Promise.all(
    myAccountRows.map(async (row) => {
      const rawProfile = myProfiles[row.platform] ?? {}
      const [tags, sparkline] = await Promise.all([
        getTagsForSnapshot(row.snapshot_id),
        getRatingSparkline(row.platform_account_id),
      ])
      return {
        platform:          row.platform,
        handle:            rawProfile.username ?? '',
        platformAccountId: row.platform_account_id,
        lastSyncedAt:      row.last_synced_at,
        snapshotId:        row.snapshot_id,
        rating:            rawProfile.rating ?? rawProfile.contestRating ?? null,
        maxRating:         rawProfile.maxRating ?? null,
        rankTitle:         rawProfile.rankTitle ?? null,
        contestsCount:     rawProfile.contestsAttended ?? 0,
        problemsSolved:    rawProfile.problemsSolved ?? 0,
        // Activity from raw_meta (daily_activity table is populated but reading
        // through raw_meta is fine for streak — full table read is Phase 9)
        activityByDate:    rawProfile.activityByDate ?? {},
        // Contest history from raw_meta (rating_history table is source of truth
        // but raw_meta.contestHistory is already shaped correctly here)
        contestHistory:    rawProfile.contestHistory ?? [],
        tags,
        sparkline,
      }
    }),
  )

  // ── Build side objects ────────────────────────────────────────────────────
  const rawIncludeContests = req.query.includeContests
  const includeContests = rawIncludeContests === 'true' || (rawIncludeContests === undefined && Boolean(req.user.include_contests))

  const youSide    = buildSide(enrichedMyHandles,    req.user.name ?? req.user.email ?? 'You',    true,  includeContests)
  const friendSide = buildSide(enrichedFriendHandles, friendRow.display_name, false, includeContests)

  // ── Mathematical Gap Analysis (Plan §8.6) ─────────────────────────────────
  const gapAnalysis = computeGapAnalysis(youSide.skillData, friendSide.skillData, youSide.avgWeight)

  // ── Determine overall winner ──────────────────────────────────────────────
  const winner = determineWinner(youSide, friendSide)

  // ── Shared topic union (from DB tag stats) ────────────────────────────────
  const topicSet = new Map()
  for (const [list, side] of [[youSide.topicsRaw, 'you'], [friendSide.topicsRaw, 'friend']]) {
    for (const t of list) {
      if (!topicSet.has(t.name)) topicSet.set(t.name, { name: t.name, you: 0, friend: 0 })
      topicSet.get(t.name)[side] = t.count
    }
  }
  const topicComparison = [...topicSet.values()]
    .sort((a, b) => (b.you + b.friend) - (a.you + a.friend))
    .slice(0, 8)
    .map((t, i) => ({ ...t, color: TOPIC_COLORS[i % TOPIC_COLORS.length] }))

  // ── Derive insights & plan ────────────────────────────────────────────────
  const insights = deriveInsights(youSide, friendSide, gapAnalysis)
  const plan     = derivePlan(youSide, friendSide, gapAnalysis)

  res.json({
    you:             youSide,
    friend:          friendSide,
    topicComparison,
    insights,
    plan,
    gapAnalysis,
    winner,
    cfTiers:         CF_TIERS,
  })
})

// ── buildSide ─────────────────────────────────────────────────────────────────
// Takes enriched handle objects (with .tags array from snapshot_tag_stats)

function buildSide(handles, displayName, isYou, includeContests = false) {
  // ── Activity & streak ─────────────────────────────────────────────────────
  const combinedActivity = {}
  for (const h of handles) {
    for (const [day, count] of Object.entries(h.activityByDate ?? {})) {
      combinedActivity[day] = (combinedActivity[day] ?? 0) + count
    }
  }
  const streak     = getCurrentStreak(combinedActivity)
  const activeDays = Object.values(combinedActivity).filter(c => c > 0).length

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalSolved   = handles.reduce((s, h) => s + (Number(h.problemsSolved) || 0), 0)
  const totalContests = handles.reduce((s, h) => s + (Number(h.contestsCount)   || 0), 0)

  // ── CF-specific ───────────────────────────────────────────────────────────
  const cfHandle   = handles.find(h => h.platform === 'codeforces')
  const cfRating   = cfHandle?.rating    ?? null
  const cfMaxRating = cfHandle?.maxRating ?? null
  const cfRankTitle = cfHandle?.rankTitle ?? null

  // ── Rating sparkline (from rating_history via DB) ─────────────────────────
  const sparklineSource = cfHandle ?? handles.find(h => h.sparkline?.length > 0)
  const ratingSparkline = (sparklineSource?.sparkline ?? []).map(r => r.new_rating ?? r)

  // ── Scoring Engine: Per-platform & Composite Scores ───────────────────────
  const platformScores = {}
  const allTopicMastery = {}
  let totalWeight = 0
  let weightedHandles = 0

  for (const h of handles) {
    const profileData = {
      ...h,
      topics: (h.tags ?? []).map(t => ({
        slug: t.tag,
        name: t.tag,
        problemsSolved: Number(t.solved_count) || 0,
      })),
      solvedByBucket: h.solvedByBucket ?? h.solved_by_bucket ?? null,
      rating: h.rating,
      problemsSolved: h.problemsSolved,
    }
    const scored = scoreProfile(h.platform, profileData, { includeContests })
    platformScores[h.platform] = scored.platformScore
    totalWeight += scored.avgWeight
    weightedHandles += 1
    Object.assign(allTopicMastery, scored.topicMastery)
  }

  const composite = computeCompositeScore(platformScores)
  const avgWeight = weightedHandles > 0 ? Number((totalWeight / weightedHandles).toFixed(4)) : 1.0

  // ── Platform solved breakdown ─────────────────────────────────────────────
  const platformSolved = PLATFORM_ORDER
    .map(id => {
      const h = handles.find(h => h.platform === id)
      if (!h) return null
      return {
        key:   id,
        label: PLATFORM_LABEL[id],
        count: Number(h.problemsSolved) || 0,
        score: platformScores[id] ?? 0,
        color: PLATFORM_COLOR[id],
      }
    })
    .filter(Boolean)

  // ── Contest history — monthly bucket (last 6 months) ─────────────────────
  const allContestDates = []
  for (const h of handles) {
    for (const c of h.contestHistory ?? []) {
      if (c.date) allContestDates.push(c.date)
    }
  }
  const contestHistory = buildMonthlyBuckets(allContestDates)

  // ── Topics from snapshot_tag_stats (proper DB source) ────────────────────
  const topicMap = new Map()
  for (const h of handles) {
    for (const t of h.tags ?? []) {
      const name = formatTagName(t.tag)
      const existing = topicMap.get(name) ?? 0
      topicMap.set(name, existing + (Number(t.solved_count) || 0))
    }
  }
  const topicsRaw = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // ── Staleness ─────────────────────────────────────────────────────────────
  const syncDates = handles
    .map(h => h.lastSyncedAt ? new Date(h.lastSyncedAt) : null)
    .filter(Boolean)
  const lastSyncedAt = syncDates.length > 0
    ? syncDates.sort((a, b) => b - a)[0]
    : null

  // ── Identity ──────────────────────────────────────────────────────────────
  const primaryHandle =
    cfHandle?.handle ??
    handles.find(h => h.platform === 'leetcode')?.handle ??
    handles[0]?.handle ??
    displayName

  const bio = cfRankTitle
    ? `${cfRankTitle} · ${primaryHandle}`
    : primaryHandle

  return {
    displayName,
    handle:       primaryHandle,
    initials:     displayName.charAt(0).toUpperCase(),
    avatarColor:  isYou ? '#7C3AED' : '#2563EB',
    bio,
    status:       'Active',
    streak,
    problems:     totalSolved,
    contests:     totalContests,
    activeDays,
    cfRating,
    cfMaxRating,
    cfRankTitle,
    hasCF:        Boolean(cfHandle),
    ratingSparkline,
    platformSolved,
    contestHistory,
    topicsRaw,
    platforms:    handles.map(h => h.platform),
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    platformScores,
    compositeScore:   composite.compositeScore,
    connectedScore:   composite.connectedScore,
    missingPlatforms: composite.missingPlatforms,
    avgWeight,
    skillData: { topicMastery: allTopicMastery },
  }
}

// ── determineWinner ───────────────────────────────────────────────────────────

function determineWinner(you, friend) {
  // Score each side across multiple dimensions
  // Each dimension awards 1 point to the leader; tied dimensions award 0.5 each
  const dimensions = [
    { label: 'Composite Score', you: you.compositeScore ?? 0, friend: friend.compositeScore ?? 0 },
    { label: 'Problems Solved', you: you.problems,            friend: friend.problems            },
    { label: 'Contests',        you: you.contests,            friend: friend.contests            },
    { label: 'Active Days',     you: you.activeDays,          friend: friend.activeDays          },
    { label: 'Streak',          you: you.streak,              friend: friend.streak              },
    { label: 'CF Rating',       you: you.cfRating ?? 0,       friend: friend.cfRating ?? 0       },
    { label: 'Topics Coverage', you: you.topicsRaw.length,    friend: friend.topicsRaw.length    },
  ]

  let youScore    = 0
  let friendScore = 0
  const breakdown = []

  for (const d of dimensions) {
    if (d.you > d.friend) {
      youScore += 1
      breakdown.push({ label: d.label, winner: 'you' })
    } else if (d.friend > d.you) {
      friendScore += 1
      breakdown.push({ label: d.label, winner: 'friend' })
    } else {
      youScore    += 0.5
      friendScore += 0.5
      breakdown.push({ label: d.label, winner: 'tie' })
    }
  }

  const overall =
    youScore > friendScore ? 'you' :
    friendScore > youScore ? 'friend' :
    'tie'

  return { overall, youScore, friendScore, total: dimensions.length, breakdown }
}

// ── deriveInsights ────────────────────────────────────────────────────────────

function deriveInsights(you, friend, gapAnalysis = []) {
  const insights = []

  // Mathematical topic gaps from scoring engine
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    for (const g of gapAnalysis.slice(0, 3)) {
      insights.push({
        id: `gap-${g.tag}`,
        type: 'gap',
        title: `Gap in ${g.name}`,
        detail: `${friend.displayName} has ${Math.round(g.friendMastery)}% mastery vs your ${Math.round(g.myMastery)}%. You need ~${g.problemsNeeded} more problems to match.`,
      })
    }
  }

  // CF Rating
  if (you.cfRating !== null && friend.cfRating !== null) {
    const diff = friend.cfRating - you.cfRating
    if (diff > 0) {
      insights.push({
        id: 'cf-rating', type: 'behind',
        title: `${diff} rating points behind`,
        detail: `${friend.displayName} has CF rating ${friend.cfRating} vs your ${you.cfRating}.`,
      })
    } else if (diff < 0) {
      insights.push({
        id: 'cf-rating', type: 'ahead',
        title: `${Math.abs(diff)} rating points ahead on Codeforces`,
        detail: `Your CF rating ${you.cfRating} beats ${friend.displayName}'s ${friend.cfRating}.`,
      })
    }
  }

  // Problems solved
  const probDiff = friend.problems - you.problems
  if (probDiff > 20) {
    insights.push({
      id: 'problems', type: 'behind',
      title: `${probDiff} more problems to match`,
      detail: `${friend.displayName} has solved ${friend.problems} problems vs your ${you.problems}.`,
    })
  } else if (probDiff < -20) {
    insights.push({
      id: 'problems', type: 'ahead',
      title: `You've solved ${Math.abs(probDiff)} more problems`,
      detail: `You lead in total problems solved (${you.problems} vs ${friend.problems}).`,
    })
  }

  // Streak
  if (friend.streak > you.streak + 3) {
    insights.push({
      id: 'streak', type: 'gap',
      title: `Streak gap: ${friend.streak - you.streak} days`,
      detail: `${friend.displayName}'s streak is ${friend.streak} days vs your ${you.streak}.`,
    })
  } else if (you.streak > friend.streak + 3) {
    insights.push({
      id: 'streak', type: 'ahead',
      title: `Your streak is ${you.streak - friend.streak} days longer`,
      detail: `You have a ${you.streak}-day streak. Keep it up!`,
    })
  }

  return insights.slice(0, 6)
}

// ── derivePlan ────────────────────────────────────────────────────────────────

function derivePlan(you, friend, gapAnalysis = []) {
  const plan = []

  // Concrete topic targets from mathematical gap analysis (Plan §8.6)
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    for (const g of gapAnalysis.slice(0, 2)) {
      plan.push({
        id: `gap-plan-${g.tag}`, icon: 'topics',
        title: `Catch up in ${g.name}`,
        detail: `Solve ~${g.problemsNeeded} problems at your level (${Math.round(g.myMastery)}% → ${Math.round(g.friendMastery)}% mastery)`,
      })
    }
  }

  const probGap = friend.problems - you.problems
  if (probGap > 0) {
    plan.push({
      id: 'p1', icon: 'problems',
      title: `Solve ${probGap} more problems`,
      detail: `~${Math.ceil(probGap / 90)} problems/day over 3 months`,
    })
  }

  const cfGap = (friend.cfRating ?? 0) - (you.cfRating ?? 0)
  if (cfGap > 0 && you.hasCF && friend.hasCF) {
    plan.push({
      id: 'p2', icon: 'rating',
      title: `Gain ${cfGap} Codeforces rating`,
      detail: `Estimated ${Math.ceil(cfGap / 40)}–${Math.ceil(cfGap / 25)} more contests`,
    })
  }

  const contestGap = friend.contests - you.contests
  if (contestGap > 0) {
    plan.push({
      id: 'p3', icon: 'contests',
      title: `Attend ${contestGap} more contests`,
      detail: `~1 contest every 2 weeks to close the gap`,
    })
  }

  return plan.slice(0, 4)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getCurrentStreak(activityByDate = {}) {
  const today    = new Date()
  const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString().slice(0, 10)
  const yday = new Date(`${todayKey}T00:00:00.000Z`)
  yday.setUTCDate(yday.getUTCDate() - 1)
  let key    = activityByDate[todayKey] ? todayKey : yday.toISOString().slice(0, 10)
  let streak = 0
  while (activityByDate[key]) {
    streak++
    const prev = new Date(`${key}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    key = prev.toISOString().slice(0, 10)
  }
  return streak
}

function buildMonthlyBuckets(dates) {
  const counts = new Map()
  const now    = new Date()
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    counts.set(label, 0)
  }
  for (const dateStr of dates) {
    if (!dateStr) continue
    const d     = new Date(dateStr)
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    if (counts.has(label)) counts.set(label, counts.get(label) + 1)
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }))
}

function formatTagName(tag = '') {
  // "dynamic programming" -> "Dynamic Programming"
  return tag
    .split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default router
