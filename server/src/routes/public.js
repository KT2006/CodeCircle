/**
 * routes/public.js
 *
 * Unauthenticated public profile endpoint.
 *
 * GET /api/public/:username
 *   Returns a full coding-portfolio payload for the given username.
 *   No auth required — safe to share as a link.
 *   Strips all PII (email, internal IDs, Google sub).
 */

import { Router } from 'express'
import { findByUsername } from '../repositories/users.js'
import { getSavedProfiles } from '../repositories/profileData.js'
import { getTagsForSnapshot, getRatingSparkline, getDailyActivity } from '../repositories/snapshots.js'
import pool from '../db/pool.js'

const router = Router()

const PLATFORM_LABEL = {
  leetcode:      'LeetCode',
  codeforces:    'Codeforces',
  codechef:      'CodeChef',
  atcoder:       'AtCoder',
  geeksforgeeks: 'GeeksForGeeks',
}

const PLATFORM_ORDER = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'geeksforgeeks']

// ── GET /api/public/:username ──────────────────────────────────────────────────

router.get('/:username', async (req, res) => {
  const raw = (req.params.username ?? '').trim().toLowerCase()

  // Basic format guard — avoids hitting the DB with garbage
  if (!/^[a-z0-9_]{3,20}$/.test(raw)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } })
  }

  // 1. Resolve user
  const user = await findByUsername(raw)
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } })
  }

  // 2. Load saved platform profiles (raw_meta from latest snapshots)
  const profiles = await getSavedProfiles(user.id)
  if (Object.keys(profiles).length === 0) {
    // User exists but hasn't connected any platforms yet
    return res.json({
      username: user.username,
      displayName: user.username,
      avatarUrl: user.avatar_url ?? null,
      joinedAt: user.created_at,
      platforms: [],
      stats: { totalSolved: 0, activeDays: 0, totalContests: 0 },
      activityByDate: {},
      topics: [],
      recentContests: [],
    })
  }

  // 3. Load platform account rows for enrichment (tags, sparkline, activity)
  const { rows: accountRows } = await pool.query(
    `SELECT pa.platform, pa.id AS platform_account_id, pa.display_handle,
            pa.last_synced_at, pa.latest_snapshot_id AS snapshot_id
     FROM user_accounts ua
     JOIN platform_accounts pa ON pa.id = ua.platform_account_id
     WHERE ua.user_id = $1`,
    [user.id],
  )

  // 4. Enrich each platform with tags + activity + sparkline
  const enrichedPlatforms = await Promise.all(
    accountRows.map(async (row) => {
      const rawProfile = profiles[row.platform] ?? {}
      let activityByDate = rawProfile.activityByDate ?? {}

      const [tags, sparkline, dailyRows] = await Promise.all([
        getTagsForSnapshot(row.snapshot_id),
        getRatingSparkline(row.platform_account_id),
        Object.keys(activityByDate).length === 0
          ? getDailyActivity(row.platform_account_id, 365)
          : Promise.resolve(null),
      ])

      if (dailyRows?.length > 0) {
        activityByDate = Object.fromEntries(
          dailyRows.map(r => {
            const day = r.day instanceof Date
              ? r.day.toISOString().slice(0, 10)
              : String(r.day).slice(0, 10)
            return [day, Number(r.submissions) || 0]
          })
        )
      }

      const contestHistory = (rawProfile.contestHistory ?? [])
        .filter(c => c.date && Number.isFinite(Number(c.rating)))
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 10)
        .map(c => ({
          name: c.contestName ?? c.name ?? 'Contest',
          date: c.date,
          rating: Math.round(Number(c.rating)),
          oldRating: c.oldRating != null ? Math.round(Number(c.oldRating)) : null,
          rank: c.ranking ?? null,
        }))

      return {
        platform: row.platform,
        label: PLATFORM_LABEL[row.platform] ?? row.platform,
        handle: row.display_handle,
        lastSyncedAt: row.last_synced_at,
        // Core stats
        problemsSolved: rawProfile.problemsSolved ?? 0,
        rating: rawProfile.rating ?? rawProfile.contestRating ?? null,
        maxRating: rawProfile.maxRating ?? null,
        rankTitle: rawProfile.rankTitle ?? null,
        contestsAttended: rawProfile.contestsAttended ?? 0,
        solvedByDifficulty: rawProfile.solvedByDifficulty ?? rawProfile.solvedByBucket ?? null,
        // Enriched
        topics: tags.map(t => ({ name: t.tag, count: Number(t.solved_count) || 0 })),
        sparkline: sparkline.map(r => r.new_rating ?? r),
        activityByDate,
        contestHistory,
      }
    })
  )

  // Sort by platform order
  enrichedPlatforms.sort((a, b) =>
    (PLATFORM_ORDER.indexOf(a.platform) + 1 || 99) - (PLATFORM_ORDER.indexOf(b.platform) + 1 || 99)
  )

  // 5. Aggregate stats
  const totalSolved   = enrichedPlatforms.reduce((s, p) => s + (p.problemsSolved ?? 0), 0)
  const totalContests = enrichedPlatforms.reduce((s, p) => s + (p.contestsAttended ?? 0), 0)

  // Combined activity heatmap
  const activityByDate = {}
  for (const p of enrichedPlatforms) {
    for (const [day, count] of Object.entries(p.activityByDate ?? {})) {
      activityByDate[day] = (activityByDate[day] ?? 0) + count
    }
  }
  const activeDays = Object.values(activityByDate).filter(v => v > 0).length

  // Current streak
  const todayKey = new Date().toISOString().slice(0, 10)
  const yday = new Date(`${todayKey}T00:00:00Z`)
  yday.setUTCDate(yday.getUTCDate() - 1)
  let streakKey = activityByDate[todayKey] ? todayKey : yday.toISOString().slice(0, 10)
  let currentStreak = 0
  while (activityByDate[streakKey]) {
    currentStreak++
    const prev = new Date(`${streakKey}T00:00:00Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    streakKey = prev.toISOString().slice(0, 10)
  }

  // Merged topics across platforms (sum by tag name)
  const topicMap = new Map()
  for (const p of enrichedPlatforms) {
    for (const t of p.topics) {
      const key = t.name.toLowerCase()
      topicMap.set(key, { name: t.name, count: (topicMap.get(key)?.count ?? 0) + t.count })
    }
  }
  const topics = [...topicMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // Recent contests across platforms
  const recentContests = enrichedPlatforms
    .flatMap(p => p.contestHistory.map(c => ({ ...c, platform: p.platform, platformLabel: p.label })))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 15)

  // 6. Strip activity detail from per-platform (already merged into activityByDate above)
  //    to keep the payload lean
  const platformPayload = enrichedPlatforms.map(p => ({
    platform: p.platform,
    label: p.label,
    handle: p.handle,
    lastSyncedAt: p.lastSyncedAt,
    problemsSolved: p.problemsSolved,
    rating: p.rating,
    maxRating: p.maxRating,
    rankTitle: p.rankTitle,
    contestsAttended: p.contestsAttended,
    solvedByDifficulty: p.solvedByDifficulty,
    topics: p.topics.slice(0, 8),
    sparkline: p.sparkline,
    recentContests: p.contestHistory,
  }))

  return res.json({
    username: user.username,
    displayName: user.username,
    avatarUrl: user.avatar_url ?? null,
    joinedAt: user.created_at,
    platforms: platformPayload,
    stats: {
      totalSolved,
      activeDays,
      totalContests,
      currentStreak,
    },
    activityByDate,
    topics,
    recentContests,
  })
})

export default router
