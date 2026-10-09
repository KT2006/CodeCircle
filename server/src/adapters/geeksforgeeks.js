/**
 * src/adapters/geeksforgeeks.js
 *
 * Fetches GeeksForGeeks profile data via the gfg-stats.tashif.codes public API.
 * No auth required. All requests are unauthenticated GET requests.
 *
 * Endpoints used:
 *   GET /{username}/stats    — solved counts by difficulty + topic analysis
 *   GET /{username}/heatmap  — daily contributions, streaks
 *   GET /{username}          — summary (totalSolved, rating, rank, totalContests)
 *
 * GFG does NOT expose individual contest rating history for most users, so:
 *   - contestHistory is always []
 *   - ratingHistory is always []
 *   - rating/maxRating comes from the summary endpoint (currentRating/maxRating)
 *     but is null for the vast majority of users
 *
 * Return shape matches the NormalizedSync adapter contract used by other adapters:
 * {
 *   platform, username, rating, maxRating, rankTitle,
 *   problemsSolved, contestsAttended, contestHistory,
 *   topics, activityByDate, activityAvailable, currentStreak
 * }
 */

import { NotFoundError, ParseError, UpstreamError } from './errors.js'
import { getJson } from '../lib/httpClient.js'

const BASE_URL = 'https://gfg-stats.tashif.codes'

// GFG usernames: alphanumeric + underscore, 3–50 chars
const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,50}$/

// ── Handle validation ─────────────────────────────────────────────────────────

export function validateHandle(raw) {
  const handle = (raw ?? '').trim()
  if (!HANDLE_PATTERN.test(handle)) {
    const error = new Error(
      'Invalid GeeksForGeeks username — must be 3–50 alphanumeric characters or underscores',
    )
    error.status = 400
    error.code = 'INVALID_HANDLE'
    throw error
  }
  return handle
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Check whether a JSON response is a GFG "not found" error.
 * The API returns HTTP 200 but with { error: true } for unknown users.
 */
function isNotFound(body) {
  return body?.error === true
}

/**
 * Fetch one GFG endpoint. Throws typed errors so callers don't need to handle raw fetch failures.
 */
async function gfgGet(path) {
  let body
  try {
    body = await getJson(`${BASE_URL}${path}`)
  } catch (err) {
    // getJson throws UpstreamError on non-2xx responses.
    // The gfg-stats API returns HTTP 404 for unknown users — convert to NotFoundError.
    if (err instanceof UpstreamError && err.upstreamStatus === 404) {
      throw new NotFoundError(`GeeksForGeeks user not found`)
    }
    throw err
  }

  if (isNotFound(body)) {
    // Belt-and-suspenders: also handle the { error: true } envelope pattern
    throw new NotFoundError(`GeeksForGeeks user not found`)
  }

  // Validate the envelope — every successful response has a `data` field
  if (!body || typeof body.data === 'undefined') {
    throw new ParseError(`GeeksForGeeks API returned unexpected shape for ${path}`)
  }

  return body.data
}

// ── Public adapter ────────────────────────────────────────────────────────────

/**
 * Fetch a GeeksForGeeks profile and normalise it to the common adapter shape.
 *
 * @param {string} rawHandle  — the user-supplied handle (will be validated)
 * @returns {Promise<object>}  — normalised profile object
 */
export async function fetchProfile(rawHandle) {
  const handle = validateHandle(rawHandle)

  // Fetch the three endpoints in parallel for speed.
  // We tolerate partial failure: stats and heatmap individually failing return
  // degraded data rather than erroring the entire fetch — but a 404 on summary
  // bubbles up immediately as NotFoundError.
  let summary, stats, heatmap

  // Summary is the canonical "does this user exist?" check.
  // If it fails, the user does not exist or the service is down.
  try {
    summary = await gfgGet(`/${encodeURIComponent(handle)}`)
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new NotFoundError(`GeeksForGeeks user "${handle}" not found`)
    }
    throw err
  }

  // Stats and heatmap: degrade gracefully if they fail
  const [statsResult, heatmapResult] = await Promise.allSettled([
    gfgGet(`/${encodeURIComponent(handle)}/stats`),
    gfgGet(`/${encodeURIComponent(handle)}/heatmap`),
  ])

  if (statsResult.status === 'fulfilled') {
    stats = statsResult.value
  } else {
    // Log the failure but don't abort — we can still return solved count from summary
    const err = statsResult.reason
    if (err instanceof NotFoundError) throw new NotFoundError(`GeeksForGeeks user "${handle}" not found`)
    // UpstreamError / ParseError: degrade
    stats = null
  }

  if (heatmapResult.status === 'fulfilled') {
    heatmap = heatmapResult.value
  } else {
    const err = heatmapResult.reason
    if (err instanceof NotFoundError) throw new NotFoundError(`GeeksForGeeks user "${handle}" not found`)
    heatmap = null
  }

  // ── Normalise solved counts ───────────────────────────────────────────────
  // Prefer stats.totalSolved (detailed), fall back to summary.totalSolved
  const problemsSolved = stats?.totalSolved ?? summary?.totalSolved ?? 0

  // ── Solved by difficulty bucket ───────────────────────────────────────────
  // GFG uses: school, basic, easy, medium, hard
  // Map to a shape similar to LeetCode's easy/medium/hard
  const byDiff = stats?.byDifficulty ?? null
  const solvedByBucket = byDiff
    ? {
        school: byDiff.school ?? 0,
        basic:  byDiff.basic  ?? 0,
        easy:   byDiff.easy   ?? 0,
        medium: byDiff.medium ?? 0,
        hard:   byDiff.hard   ?? 0,
      }
    : null

  // ── Topics ────────────────────────────────────────────────────────────────
  // stats.topicAnalysis is [ { topic: "Arrays", count: 35 }, ... ]
  // Normalise to the shape other adapters use: { name, slug, problemsSolved }
  const topics = (stats?.topicAnalysis ?? [])
    .filter(t => t.topic && typeof t.count === 'number')
    .map(t => ({
      name:          t.topic,
      slug:          t.topic.toLowerCase().replace(/\s+/g, '-'),
      problemsSolved: t.count,
    }))
    .sort((a, b) => b.problemsSolved - a.problemsSolved)

  // ── Activity ──────────────────────────────────────────────────────────────
  // heatmap.dailyContributions is [ { date: "2024-01-03", count: 3, level: 1 }, ... ]
  const activityByDate = {}
  if (heatmap?.dailyContributions) {
    for (const entry of heatmap.dailyContributions) {
      if (entry.date && typeof entry.count === 'number') {
        activityByDate[entry.date] = entry.count
      }
    }
  }
  const activityAvailable = heatmap !== null

  // ── Streaks ───────────────────────────────────────────────────────────────
  // Use the value from the heatmap endpoint if available, else compute ourselves
  const currentStreak = heatmap?.currentStreak ?? computeStreak(activityByDate)

  // ── Contest / rating data ─────────────────────────────────────────────────
  // GFG does expose a "currentRating" and "rank" in the summary for users with
  // contest activity, but contest history itself is empty for almost all users.
  const rating    = typeof summary?.currentRating === 'number' ? summary.currentRating : null
  const maxRating = typeof summary?.maxRating     === 'number' ? summary.maxRating     : null
  const rankTitle = summary?.rank ?? null

  // totalContests from summary — note: this is usually 0 for most GFG users
  const contestsAttended = summary?.totalContests ?? 0

  return {
    platform:        'geeksforgeeks',
    username:        handle,
    rating,
    maxRating,
    rankTitle,
    problemsSolved,
    solvedByBucket,
    contestsAttended,
    contestHistory:  [],     // GFG does not expose per-contest rating history
    topics,
    activityByDate,
    activityAvailable,
    currentStreak,
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Compute the current streak from an activityByDate map when the heatmap endpoint
 * doesn't provide it. Identical to the streak logic in other parts of the codebase.
 */
function computeStreak(activityByDate = {}) {
  const today    = new Date()
  const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10)
  const yday     = new Date(`${todayKey}T00:00:00.000Z`)
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
