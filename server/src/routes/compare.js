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
import { getTagsForSnapshot, getRatingSparkline, getDailyActivity, getRatingHistory } from '../repositories/snapshots.js'
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
         'solvedByBucket',     s.solved_by_bucket,
         'rawMeta',            s.raw_meta
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

  // ── Enrich friend handles with tags + sparkline + activity from DB ────────
  const enrichedFriendHandles = await Promise.all(
    friendHandles.map(async (h) => {
      let activityByDate = h.rawMeta?.activityByDate ?? {}
      let contestHistory = h.rawMeta?.contestHistory ?? []

      const [tags, sparkline, dailyRows, ratingRows] = await Promise.all([
        getTagsForSnapshot(h.snapshotId),
        getRatingSparkline(h.platformAccountId),
        // If activityByDate is empty, fetch from daily_activity table
        (Object.keys(activityByDate).length === 0 && h.platformAccountId)
          ? getDailyActivity(h.platformAccountId, 365)
          : Promise.resolve(null),
        // If contestHistory is empty, fetch from rating_history table
        (contestHistory.length === 0 && h.platformAccountId)
          ? getRatingHistory(h.platformAccountId)
          : Promise.resolve(null),
      ])

      if (dailyRows && dailyRows.length > 0) {
        activityByDate = Object.fromEntries(
          dailyRows.map(r => {
            const dayStr = r.day instanceof Date
              ? r.day.toISOString().slice(0, 10)
              : String(r.day).slice(0, 10)
            return [dayStr, Number(r.submissions) || 0]
          })
        )
      }

      if (ratingRows && ratingRows.length > 0) {
        contestHistory = ratingRows.map(r => ({
          contestName: r.contest_name,
          date: r.rated_at instanceof Date ? r.rated_at.toISOString() : (r.rated_at ? String(r.rated_at) : null),
          rating: r.new_rating,
          oldRating: r.old_rating,
          ranking: r.contest_rank,
        }))
      }

      return {
        ...h,
        tags,
        sparkline,
        activityByDate,
        contestHistory,
      }
    }),
  )

  // ── Enrich "you" side: get platform account ids + snapshot ids ────────────
  const { rows: myAccountRows } = await pool.query(
    `SELECT pa.platform, pa.id AS platform_account_id, pa.last_synced_at,
            pa.latest_snapshot_id AS snapshot_id
     FROM user_accounts ua
     JOIN platform_accounts pa ON pa.id = ua.platform_account_id
     WHERE ua.user_id = $1`,
    [req.user.id],
  )

  // Build enriched "you" handles (merge raw_meta with DB tag stats, activity, and sparkline)
  const enrichedMyHandles = await Promise.all(
    myAccountRows.map(async (row) => {
      const rawProfile = myProfiles[row.platform] ?? {}
      let activityByDate = rawProfile.activityByDate ?? {}
      let contestHistory = rawProfile.contestHistory ?? []

      const [tags, sparkline, dailyRows, ratingRows] = await Promise.all([
        getTagsForSnapshot(row.snapshot_id),
        getRatingSparkline(row.platform_account_id),
        (Object.keys(activityByDate).length === 0 && row.platform_account_id)
          ? getDailyActivity(row.platform_account_id, 365)
          : Promise.resolve(null),
        (contestHistory.length === 0 && row.platform_account_id)
          ? getRatingHistory(row.platform_account_id)
          : Promise.resolve(null),
      ])

      if (dailyRows && dailyRows.length > 0) {
        activityByDate = Object.fromEntries(
          dailyRows.map(r => {
            const dayStr = r.day instanceof Date
              ? r.day.toISOString().slice(0, 10)
              : String(r.day).slice(0, 10)
            return [dayStr, Number(r.submissions) || 0]
          })
        )
      }

      if (ratingRows && ratingRows.length > 0) {
        contestHistory = ratingRows.map(r => ({
          contestName: r.contest_name,
          date: r.rated_at instanceof Date ? r.rated_at.toISOString() : (r.rated_at ? String(r.rated_at) : null),
          rating: r.new_rating,
          oldRating: r.old_rating,
          ranking: r.contest_rank,
        }))
      }

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
        activityByDate,
        contestHistory,
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
  const platformScoreDetails = {}
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

    const topTopics = Object.values(scored.topicMastery)
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 5)

    platformScoreDetails[h.platform] = {
      platform: h.platform,
      skillScore: scored.skillScore,
      contestScore: scored.contestScore,
      platformScore: scored.platformScore,
      blendedWithContest: includeContests && typeof scored.contestScore === 'number',
      skillWeight: (includeContests && typeof scored.contestScore === 'number') ? 0.7 : 1.0,
      contestWeight: (includeContests && typeof scored.contestScore === 'number') ? 0.3 : 0.0,
      coreTopicMastery: scored.coreTopicMastery,
      topTopics,
      avgWeight: scored.avgWeight,
    }
  }

  const composite = computeCompositeScore(platformScores)
  const avgWeight = weightedHandles > 0 ? Number((totalWeight / weightedHandles).toFixed(4)) : 1.0

  // ── Transparent Score Breakdown ───────────────────────────────────────────
  const scoreBreakdown = {
    compositeScore: composite.compositeScore,
    connectedScore: composite.connectedScore,
    connectedCount: composite.connectedCount,
    totalSupported: composite.totalSupported,
    includeContests,
    formulaSummary: `(${PLATFORM_ORDER.map(p => (platformScores[p] ?? 0).toFixed(1)).join(' + ')}) ÷ ${PLATFORM_ORDER.length} = ${composite.compositeScore.toFixed(1)}`,
    penaltyNotice: composite.missingPlatforms.length > 0
      ? `${composite.missingPlatforms.length} unconnected platform${composite.missingPlatforms.length > 1 ? 's' : ''} (${composite.missingPlatforms.map(p => PLATFORM_LABEL[p] || p).join(', ')}) contribute 0 points to the 5-platform composite.`
      : null,
    platforms: PLATFORM_ORDER.map(id => {
      const h = handles.find(h => h.platform === id)
      const isConnected = Boolean(h)
      const details = platformScoreDetails[id]
      return {
        key: id,
        label: PLATFORM_LABEL[id],
        color: PLATFORM_COLOR[id],
        connected: isConnected,
        handle: h?.handle || null,
        problemsSolved: Number(h?.problemsSolved) || 0,
        rating: h?.rating ?? null,
        rankTitle: h?.rankTitle ?? null,
        skillScore: details?.skillScore ?? 0,
        contestScore: details?.contestScore ?? null,
        platformScore: details?.platformScore ?? 0,
        blendedWithContest: details?.blendedWithContest ?? false,
        skillWeight: details?.skillWeight ?? (includeContests ? 0.7 : 1.0),
        contestWeight: details?.contestWeight ?? (includeContests ? 0.3 : 0.0),
        avgWeight: details?.avgWeight ?? 1.0,
        calculationText: isConnected
          ? (details?.contestScore !== null && includeContests
              ? `70% Skill (${details.skillScore.toFixed(1)}) + 30% Contest (${details.contestScore.toFixed(1)}) = ${details.platformScore.toFixed(1)}`
              : `100% Skill (${(details?.skillScore ?? 0).toFixed(1)}) = ${(details?.platformScore ?? 0).toFixed(1)}`)
          : 'Not connected (contributes 0)',
        coreTopicMastery: details?.coreTopicMastery ?? {},
        topTopics: details?.topTopics ?? [],
      }
    }),
  }

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

  // ── Dynamic Status ────────────────────────────────────────────────────────
  let status = 'Active'
  if (streak >= 7) {
    status = `🔥 ${streak}-day streak`
  } else if (streak >= 1) {
    status = `${streak}-day streak`
  } else if (activeDays > 0) {
    status = `${activeDays} active days`
  } else if (lastSyncedAt) {
    const hoursAgo = Math.floor((Date.now() - lastSyncedAt.getTime()) / (1000 * 60 * 60))
    status = hoursAgo < 24 ? 'Active today' : `Updated ${Math.floor(hoursAgo / 24)}d ago`
  } else {
    status = 'New member'
  }

  // ── Identity & Dynamic Bio ────────────────────────────────────────────────
  const primaryHandle =
    cfHandle?.handle ??
    handles.find(h => h.platform === 'leetcode')?.handle ??
    handles[0]?.handle ??
    displayName

  let bio = primaryHandle
  if (cfRankTitle && cfRating) {
    bio = `${cfRankTitle} (${cfRating}) · ${primaryHandle}`
  } else if (cfRankTitle) {
    bio = `${cfRankTitle} · ${primaryHandle}`
  } else {
    const lcHandle = handles.find(h => h.platform === 'leetcode')
    if (lcHandle && lcHandle.problemsSolved > 0) {
      bio = `${lcHandle.problemsSolved} solved on LeetCode · ${primaryHandle}`
    } else if (totalSolved > 0) {
      bio = `${totalSolved} problems solved · ${primaryHandle}`
    }
  }

  return {
    displayName,
    handle:       primaryHandle,
    initials:     displayName.charAt(0).toUpperCase(),
    avatarColor:  isYou ? '#7C3AED' : '#2563EB',
    bio,
    status,
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
    scoreBreakdown,
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

  // 1. Composite Score comparison & key driver
  const compDiff = Number((you.compositeScore - friend.compositeScore).toFixed(1))
  if (compDiff > 0) {
    insights.push({
      id: 'composite-lead',
      type: 'ahead',
      isYou: true,
      title: `You lead by ${compDiff} composite points`,
      detail: `Your composite score of ${you.compositeScore.toFixed(1)} beats ${friend.displayName}'s ${friend.compositeScore.toFixed(1)} (${you.scoreBreakdown?.connectedCount} connected platforms vs ${friend.scoreBreakdown?.connectedCount}).`,
    })
  } else if (compDiff < 0) {
    insights.push({
      id: 'composite-gap',
      type: 'behind',
      isYou: false,
      title: `${Math.abs(compDiff)} composite points behind`,
      detail: `${friend.displayName} leads with ${friend.compositeScore.toFixed(1)} vs your ${you.compositeScore.toFixed(1)}. Connecting unconnected platforms or increasing topic breadth will raise this.`,
    })
  }

  // 2. Unconnected platform opportunity
  const friendConnectedMissing = (you.missingPlatforms || []).filter(p => (friend.platforms || []).includes(p))
  if (friendConnectedMissing.length > 0) {
    const targetPlat = friendConnectedMissing[0]
    const friendPlatScore = friend.platformScores?.[targetPlat] ?? 0
    insights.push({
      id: `missing-plat-${targetPlat}`,
      type: 'gap',
      isYou: false,
      title: `Opportunity: Connect ${PLATFORM_LABEL[targetPlat]}`,
      detail: `${friend.displayName} earns ${friendPlatScore.toFixed(1)} pts on ${PLATFORM_LABEL[targetPlat]}. Connecting your handle adds directly to your 5-platform composite.`,
    })
  }

  // 3. Mathematical topic gaps from scoring engine
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    for (const g of gapAnalysis.slice(0, 2)) {
      insights.push({
        id: `gap-${g.tag}`,
        type: 'gap',
        isYou: false,
        title: `Gap in ${g.name}`,
        detail: `${friend.displayName} has ${Math.round(g.friendMastery)}% mastery vs your ${Math.round(g.myMastery)}%. You need ~${g.problemsNeeded} more problems to match.`,
      })
    }
  }

  // 4. CF Rating
  if (you.cfRating !== null && friend.cfRating !== null) {
    const diff = friend.cfRating - you.cfRating
    if (diff > 0) {
      insights.push({
        id: 'cf-rating',
        type: 'behind',
        isYou: false,
        title: `${diff} rating points behind on Codeforces`,
        detail: `${friend.displayName} has CF rating ${friend.cfRating} vs your ${you.cfRating}.`,
      })
    } else if (diff < 0) {
      insights.push({
        id: 'cf-rating',
        type: 'ahead',
        isYou: true,
        title: `${Math.abs(diff)} rating points ahead on Codeforces`,
        detail: `Your CF rating ${you.cfRating} beats ${friend.displayName}'s ${friend.cfRating}.`,
      })
    }
  }

  // 5. Problems solved
  const probDiff = friend.problems - you.problems
  if (probDiff > 20) {
    const pace = Math.max(1, Math.ceil(probDiff / 60))
    insights.push({
      id: 'problems',
      type: 'behind',
      isYou: false,
      title: `${probDiff} more problems to match`,
      detail: `${friend.displayName} has solved ${friend.problems} problems vs your ${you.problems} (~${pace} problems/day over 2 months to close).`,
    })
  } else if (probDiff < -20) {
    insights.push({
      id: 'problems',
      type: 'ahead',
      isYou: true,
      title: `You've solved ${Math.abs(probDiff)} more problems`,
      detail: `You lead in total problems solved across platforms (${you.problems} vs ${friend.problems}).`,
    })
  }

  // 6. Streak
  if (friend.streak > you.streak + 2) {
    insights.push({
      id: 'streak',
      type: 'gap',
      isYou: false,
      title: `Streak gap: ${friend.streak - you.streak} days`,
      detail: `${friend.displayName}'s streak is ${friend.streak} days vs your ${you.streak}.`,
    })
  } else if (you.streak > friend.streak + 2) {
    insights.push({
      id: 'streak',
      type: 'ahead',
      isYou: true,
      title: `Your streak is ${you.streak - friend.streak} days longer`,
      detail: `You have an active ${you.streak}-day streak. Keep your momentum going!`,
    })
  }

  return insights.slice(0, 6)
}

// ── derivePlan ────────────────────────────────────────────────────────────────

function derivePlan(you, friend, gapAnalysis = []) {
  const plan = []

  // 1. Missing platforms (immediate composite score boost)
  const friendConnectedMissing = (you.missingPlatforms || []).filter(p => (friend.platforms || []).includes(p))
  if (friendConnectedMissing.length > 0) {
    const targetPlat = friendConnectedMissing[0]
    plan.push({
      id: `connect-${targetPlat}`,
      icon: 'platform',
      title: `Connect your ${PLATFORM_LABEL[targetPlat]} account`,
      detail: `Unconnected platforms contribute 0 under Rule D11. Adding ${PLATFORM_LABEL[targetPlat]} can boost your composite by up to +20 points.`,
    })
  }

  // 2. Concrete topic targets from mathematical gap analysis (Plan §8.6)
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    for (const g of gapAnalysis.slice(0, 2)) {
      const perWeek = Math.max(1, Math.ceil(g.problemsNeeded / 4))
      plan.push({
        id: `gap-plan-${g.tag}`,
        icon: 'topics',
        title: `Master ${g.name} (~${g.problemsNeeded} problems)`,
        detail: `Solve ~${perWeek} problems/week over 4 weeks to boost mastery from ${Math.round(g.myMastery)}% to ${Math.round(g.friendMastery)}%.`,
      })
    }
  }

  // 3. Streak / consistency target
  if (you.streak === 0) {
    plan.push({
      id: 'start-streak',
      icon: 'streak',
      title: 'Solve 1 problem today to start a streak',
      detail: 'Consistent daily problem-solving builds long-term algorithmic recall.',
    })
  } else if (friend.streak > you.streak) {
    plan.push({
      id: 'streak-target',
      icon: 'streak',
      title: `Extend streak to ${friend.streak + 1} days`,
      detail: `Maintain daily activity for ${friend.streak - you.streak + 1} more days to overtake ${friend.displayName}.`,
    })
  }

  // 4. Problems gap target
  const probGap = friend.problems - you.problems
  if (probGap > 0 && plan.length < 4) {
    const targetPerDay = Math.max(1, Math.ceil(probGap / 60))
    plan.push({
      id: 'p1',
      icon: 'problems',
      title: `Solve ${probGap} more problems`,
      detail: `Target ~${targetPerDay} problem${targetPerDay > 1 ? 's' : ''}/day to catch up in 2 months.`,
    })
  }

  // 5. Codeforces rating target
  const cfGap = (friend.cfRating ?? 0) - (you.cfRating ?? 0)
  if (cfGap > 0 && you.hasCF && friend.hasCF && plan.length < 4) {
    plan.push({
      id: 'p2',
      icon: 'rating',
      title: `Gain ${cfGap} Codeforces rating points`,
      detail: `Target ~${Math.ceil(cfGap / 35)} strong rated contests to bridge the rating gap.`,
    })
  }

  // 6. Contest participation target
  const contestGap = friend.contests - you.contests
  if (contestGap > 0 && plan.length < 4) {
    const monthlyRate = Math.max(1, Math.ceil(contestGap / 3))
    plan.push({
      id: 'p3',
      icon: 'contests',
      title: `Participate in ${contestGap} more contests`,
      detail: `Target ~${monthlyRate} contest${monthlyRate > 1 ? 's' : ''}/month to match ${friend.displayName}'s contest experience.`,
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
