/**
 * routes/compare.js  — Phase 8
 *
 * GET /api/compare?friendId=<uuid>
 *   Returns a fully computed comparison object: "you" side from your saved
 *   profiles + "friend" side from the friend's latest snapshots.
 *   All computation happens here — the frontend just renders.
 *
 * GET /api/compare/friends
 *   Returns the list of friends (id + displayName) so the frontend can
 *   populate the friend-selector dropdown without an extra /api/friends call.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'
import { getSavedProfiles } from '../repositories/profileData.js'
import pool from '../db/pool.js'

const router = Router()
router.use(requireAuth)

// ── constants ─────────────────────────────────────────────────────────────────

const PLATFORM_ORDER = ['leetcode', 'codeforces', 'codechef', 'atcoder']
const PLATFORM_LABEL = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', atcoder: 'AtCoder' }
const PLATFORM_COLOR = { leetcode: '#7C3AED', codeforces: '#22C55E', codechef: '#FB923C', atcoder: '#3B82F6' }
const TOPIC_COLORS   = ['#8B5CF6', '#22C55E', '#FB923C', '#3B82F6', '#FF5B7F', '#F59E0B']

const CF_TIERS = [
  { label: 'Newbie\n0',                 value: 0    },
  { label: 'Pupil\n800',                value: 800  },
  { label: 'Specialist\n1400',          value: 1400 },
  { label: 'Expert\n2000',              value: 2000 },
  { label: 'Candidate Master\n2400',    value: 2400 },
  { label: 'Master\n3000+',             value: 3000 },
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

  // ── Load "you" ──
  const myProfiles = await getSavedProfiles(req.user.id)
  if (Object.keys(myProfiles).length === 0) {
    return res.status(422).json({
      error: { code: 'NO_PROFILE', message: 'You have not connected any platform accounts yet.' },
    })
  }

  // ── Load friend ──
  const { rows: friendRows } = await pool.query(
    `SELECT
       f.id, f.display_name,
       json_agg(json_build_object(
         'platform',    pa.platform,
         'handle',      pa.display_handle,
         'snapshot',    to_json(s)
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

  // Build friend profiles map from snapshot raw_meta
  const friendProfiles = {}
  for (const h of friendHandles) {
    const raw = h.snapshot?.raw_meta
    if (!raw) continue
    friendProfiles[h.platform] = {
      ...raw,
      username:        h.handle,
      platform:        h.platform,
      rating:          h.snapshot.rating ?? raw.rating ?? raw.contestRating ?? null,
      maxRating:       h.snapshot.max_rating ?? raw.maxRating ?? null,
      rankTitle:       h.snapshot.rank_title ?? raw.rankTitle ?? null,
      problemsSolved:  h.snapshot.problems_solved ?? raw.problemsSolved ?? 0,
      contestsAttended: raw.contestsAttended ?? 0,
    }
  }

  // ── Build side objects ────────────────────────────────────────────────────
  const youSide    = buildSide(myProfiles,    req.user.name ?? req.user.email ?? 'You',    true)
  const friendSide = buildSide(friendProfiles, friendRow.display_name, false)

  // ── Derive insights & plan ────────────────────────────────────────────────
  const insights = deriveInsights(youSide, friendSide)
  const plan     = derivePlan(youSide, friendSide)

  // ── Shared topic list (union, sorted by max) ──────────────────────────────
  const topicSet = new Map()
  for (const [list, side] of [[youSide.topicsRaw, 'you'], [friendSide.topicsRaw, 'friend']]) {
    for (const t of list) {
      if (!topicSet.has(t.name)) topicSet.set(t.name, { name: t.name, you: 0, friend: 0 })
      topicSet.get(t.name)[side] = t.count
    }
  }
  const topicComparison = [...topicSet.values()]
    .sort((a, b) => (b.you + b.friend) - (a.you + a.friend))
    .slice(0, 6)
    .map((t, i) => ({ ...t, color: TOPIC_COLORS[i] }))

  res.json({
    you:             youSide,
    friend:          friendSide,
    topicComparison,
    insights,
    plan,
    cfTiers:         CF_TIERS,
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSide(profiles, displayName, isYou) {
  const profileList = Object.values(profiles).filter(Boolean)

  // Combined activityByDate for streak + activeDays
  const combinedActivity = {}
  for (const p of profileList) {
    for (const [day, count] of Object.entries(p.activityByDate ?? {})) {
      combinedActivity[day] = (combinedActivity[day] ?? 0) + count
    }
  }

  const streak     = getCurrentStreak(combinedActivity)
  const activeDays = Object.values(combinedActivity).filter(c => c > 0).length
  const totalSolved   = profileList.reduce((s, p) => s + (p.problemsSolved ?? 0), 0)
  const totalContests = profileList.reduce((s, p) => s + (p.contestsAttended ?? 0), 0)

  // CF rating
  const cfProfile  = profiles.codeforces
  const cfRating   = cfProfile?.rating ?? null
  const cfMaxRating = cfProfile?.maxRating ?? null

  // Sparkline from contest history
  const ratingSparkline = (cfProfile?.contestHistory ?? [])
    .filter(c => c.date && c.rating !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-10)
    .map(c => c.rating)

  // Platform solved breakdown
  const platformSolved = PLATFORM_ORDER
    .filter(id => profiles[id])
    .map(id => ({
      key:   id,
      label: PLATFORM_LABEL[id],
      count: profiles[id]?.problemsSolved ?? 0,
      color: PLATFORM_COLOR[id],
    }))
  const maxSolved = Math.max(...platformSolved.map(p => p.count), 1)
  for (const p of platformSolved) p.pct = Math.round((p.count / maxSolved) * 100)

  // Contest history — monthly bucket (last 6 months)
  const allContests = []
  for (const p of profileList) {
    for (const c of p.contestHistory ?? []) {
      if (c.date) allContests.push(c.date)
    }
  }
  const contestHistory = buildMonthlyBuckets(allContests)

  // Topics (top 6)
  const topicMap = new Map()
  for (const p of profileList) {
    for (const t of p.topics ?? []) {
      const name = t.name ?? t.slug ?? ''
      if (name) topicMap.set(name, (topicMap.get(name) ?? 0) + (t.problemsSolved ?? t.count ?? 0))
    }
  }
  const topicsRaw = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }))

  // Username / initials
  const primaryUsername = cfProfile?.username
    ?? profiles.leetcode?.username
    ?? profiles.codechef?.username
    ?? profiles.atcoder?.username
    ?? displayName
  const initials = (isYou ? displayName : displayName).charAt(0).toUpperCase()

  // Rank
  const rankTitle = cfProfile?.rankTitle ?? profiles.leetcode?.rankTitle ?? null

  return {
    displayName,
    handle:      primaryUsername,
    initials,
    avatarColor: isYou ? '#7C3AED' : '#2563EB',
    bio:         rankTitle ? `${rankTitle} · ${primaryUsername}` : primaryUsername,
    status:      'Active',
    streak,
    problems:    totalSolved,
    contests:    totalContests,
    activeDays,
    cfRating,
    cfMaxRating,
    cfRankTitle: cfProfile?.rankTitle ?? null,
    ratingSparkline,
    platformSolved,
    contestHistory,
    topicsRaw,
    platforms:   Object.keys(profiles),
  }
}

function getCurrentStreak(activityByDate = {}) {
  const today = new Date()
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
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
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

function deriveInsights(you, friend) {
  const insights = []

  // CF Rating
  if (you.cfRating !== null && friend.cfRating !== null) {
    const diff = friend.cfRating - you.cfRating
    if (diff > 0) {
      insights.push({
        id: 'cf-rating', type: 'behind',
        title: `You are ${diff} rating points behind`,
        detail: `${friend.displayName} has CF rating ${friend.cfRating} vs your ${you.cfRating}.`,
      })
    } else if (diff < 0) {
      insights.push({
        id: 'cf-rating', type: 'ahead',
        title: `You are ${Math.abs(diff)} rating points ahead`,
        detail: `Your CF rating ${you.cfRating} beats ${friend.displayName}'s ${friend.cfRating}.`,
      })
    }
  }

  // Problems
  const probDiff = friend.problems - you.problems
  if (probDiff > 50) {
    insights.push({
      id: 'problems', type: 'behind',
      title: `${probDiff} more problems to match`,
      detail: `${friend.displayName} has solved ${friend.problems} problems vs your ${you.problems}.`,
    })
  } else if (probDiff < -50) {
    insights.push({
      id: 'problems', type: 'ahead',
      title: `You've solved ${Math.abs(probDiff)} more problems`,
      detail: `You lead in total problems solved.`,
    })
  }

  // Streak
  if (friend.streak > you.streak + 5) {
    insights.push({
      id: 'streak', type: 'gap',
      title: `Streak gap: ${friend.streak - you.streak} days`,
      detail: `${friend.displayName}'s streak is ${friend.streak} days vs your ${you.streak}.`,
    })
  } else if (you.streak > friend.streak + 5) {
    insights.push({
      id: 'streak', type: 'ahead',
      title: `Your streak is ${you.streak - friend.streak} days longer`,
      detail: `Great consistency! Keep it up.`,
    })
  }

  // Topic gaps (find where friend is significantly ahead)
  const youTopicMap    = new Map(you.topicsRaw.map(t => [t.name, t.count]))
  const friendTopicMap = new Map(friend.topicsRaw.map(t => [t.name, t.count]))
  for (const [name, fCount] of friendTopicMap) {
    const yCount = youTopicMap.get(name) ?? 0
    if (fCount - yCount > 30) {
      insights.push({
        id:   `topic-${name}`, type: 'gap',
        title: `Gap in ${name}`,
        detail: `${friend.displayName} has solved ${fCount - yCount} more ${name} problems.`,
      })
      if (insights.length >= 5) break
    }
  }

  // Topic where you're ahead
  for (const [name, yCount] of youTopicMap) {
    const fCount = friendTopicMap.get(name) ?? 0
    if (yCount - fCount > 20) {
      insights.push({
        id:   `ahead-${name}`, type: 'ahead',
        title: `You're ahead in ${name}`,
        detail: `You've solved ${yCount - fCount} more ${name} problems.`,
      })
      if (insights.length >= 6) break
    }
  }

  return insights.slice(0, 5)
}

function derivePlan(you, friend) {
  const plan = []

  const probGap = friend.problems - you.problems
  if (probGap > 0) {
    plan.push({
      id: 'p1', icon: 'problems',
      title: `Solve ${probGap} more problems`,
      detail: `~${Math.ceil(probGap / 90)} problems/day over 3 months`,
    })
  }

  const cfGap = (friend.cfRating ?? 0) - (you.cfRating ?? 0)
  if (cfGap > 0) {
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
      detail: `~1 contest every 2 weeks`,
    })
  }

  // Weak topics
  const weakTopics = friend.topicsRaw
    .filter(ft => {
      const yt = you.topicsRaw.find(t => t.name === ft.name)
      return (ft.count - (yt?.count ?? 0)) > 20
    })
    .slice(0, 3)
    .map(t => t.name)
  if (weakTopics.length > 0) {
    plan.push({
      id: 'p4', icon: 'topics',
      title: 'Improve in key topics',
      detail: `Focus on: ${weakTopics.join(', ')}`,
    })
  }

  return plan.slice(0, 4)
}

export default router
