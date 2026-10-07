/**
 * src/adapters/codeforces.js
 *
 * Codeforces platform adapter.
 * Exports: platform, validateHandle, fetchPreview, sync
 *
 * Codeforces public API base: https://codeforces.com/api/
 * Requests are serialized and spaced at least 2 seconds apart per process,
 * including requests made while paginating submissions.
 *
 * Data we fetch:
 *   user.info    → profile (rating, maxRating, rank, avatar)
 *   user.rating  → full contest history
 *   user.status  → all submissions (paginated, 1000 per page)
 */

import { getJson } from '../lib/httpClient.js'
import { NotFoundError, UpstreamError, ParseError } from './errors.js'

export const platform = 'codeforces'

const BASE = 'https://codeforces.com/api'
const MIN_REQUEST_INTERVAL_MS = 2000
let requestChain = Promise.resolve()
let lastRequestStartedAt = 0

async function getCodeforcesJson(url) {
  const previousRequest = requestChain
  let releaseRequest
  requestChain = new Promise((resolve) => {
    releaseRequest = resolve
  })

  await previousRequest
  try {
    const waitMs = Math.max(
      0,
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt),
    )
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    lastRequestStartedAt = Date.now()
    return await getJson(url)
  } finally {
    releaseRequest()
  }
}

// Codeforces rank title → a cleaner display label
const RANK_LABELS = {
  newbie: 'Newbie',
  pupil: 'Pupil',
  specialist: 'Specialist',
  expert: 'Expert',
  'candidate master': 'Candidate Master',
  master: 'Master',
  'international master': 'International Master',
  grandmaster: 'Grandmaster',
  'international grandmaster': 'International Grandmaster',
  'legendary grandmaster': 'Legendary Grandmaster',
}

// ── Handle validation ──────────────────────────────────────────────────────────

/**
 * Validates and canonicalises a Codeforces handle.
 * Codeforces handles: letters, digits, underscores, hyphens, 3–24 chars.
 * Returns the lower-cased handle for storage, throws on invalid input.
 *
 * @param {string} raw
 * @returns {string} canonical handle
 */
export function validateHandle(raw) {
  const trimmed = (raw ?? '').trim()
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(trimmed)) {
    const err = new Error(`Invalid Codeforces handle: "${trimmed}"`)
    err.status = 400
    err.code = 'INVALID_HANDLE'
    throw err
  }
  return trimmed.toLowerCase()
}

// ── fetchPreview ───────────────────────────────────────────────────────────────

/**
 * Quick lookup — used by the "Add handle" preview step.
 * Calls only user.info (one request, fast).
 * Returns { exists, displayHandle, rating, rankTitle, avatarUrl }.
 *
 * @param {string} displayHandle  the handle as the user typed it
 * @returns {Promise<{ exists: boolean, displayHandle: string, rating: number|null, rankTitle: string|null, avatarUrl: string|null }>}
 */
export async function fetchPreview(displayHandle) {
  let data
  try {
    data = await getCodeforcesJson(`${BASE}/user.info?handles=${encodeURIComponent(displayHandle)}`)
  } catch (err) {
    if (err instanceof UpstreamError && err.upstreamStatus === 400) {
      // CF returns 400 when the handle doesn't exist
      return { exists: false, displayHandle, rating: null, rankTitle: null, avatarUrl: null }
    }
    throw err
  }

  if (data.status !== 'OK' || !Array.isArray(data.result) || data.result.length === 0) {
    return { exists: false, displayHandle, rating: null, rankTitle: null, avatarUrl: null }
  }

  const user = data.result[0]
  return {
    exists: true,
    displayHandle: user.handle,           // use CF's casing
    rating: user.rating ?? null,
    rankTitle: RANK_LABELS[user.rank] ?? user.rank ?? null,
    avatarUrl: user.titlePhoto ?? null,
  }
}

// ── sync ───────────────────────────────────────────────────────────────────────

/**
 * Full data sync. Fetches profile + all submissions + contest history.
 * Returns a NormalizedSync object (plan §6 types.js).
 *
 * @param {string} displayHandle
 * @param {{ sinceTs?: Date }} [options]
 *   sinceTs: if provided, only fetch submissions newer than this date
 *            (incremental sync). If absent, fetches everything (first sync).
 * @returns {Promise<import('./types.js').NormalizedSync>}
 */
export async function sync(displayHandle, { sinceTs } = {}) {
  // ── Step 1: user profile ────────────────────────────────────────────────────
  let infoData
  try {
    infoData = await getCodeforcesJson(`${BASE}/user.info?handles=${encodeURIComponent(displayHandle)}`)
  } catch (err) {
    if (err instanceof UpstreamError && err.upstreamStatus === 400) {
      throw new NotFoundError(`Codeforces user "${displayHandle}" not found`)
    }
    throw err
  }

  if (infoData.status !== 'OK') {
    if (infoData.comment?.toLowerCase().includes('not found')) {
      throw new NotFoundError(`Codeforces user "${displayHandle}" not found`)
    }
    throw new UpstreamError(`user.info failed: ${infoData.comment ?? 'unknown error'}`)
  }

  if (!Array.isArray(infoData.result) || infoData.result.length === 0) {
    throw new ParseError('user.info returned OK but result array is empty')
  }

  const userInfo = infoData.result[0]

  // ── Step 2: contest rating history ─────────────────────────────────────────
  const ratingData = await getCodeforcesJson(`${BASE}/user.rating?handle=${encodeURIComponent(displayHandle)}`)

  if (ratingData.status !== 'OK') {
    // Some users have never been rated — that's fine, not an error
    if (ratingData.comment?.toLowerCase().includes('unrated')) {
      ratingData.result = []
    } else {
      throw new UpstreamError(`user.rating failed: ${ratingData.comment ?? 'unknown'}`)
    }
  }

  // ── Step 3: paginate submissions ────────────────────────────────────────────
  // CF API returns newest first; count=1000 per page.
  // For incremental syncs, stop when we hit submissions older than sinceTs.
  // We go one extra UTC day back so partially-counted days get fully rebuilt.
  const sinceCutoff = sinceTs
    ? Math.floor(startOfUtcDay(sinceTs).getTime() / 1000) - 86400
    : 0

  const allSubmissions = []
  let from = 1
  const pageSize = 1000

  // Paginate until we get a short page or hit the sinceTs cutoff
  while (true) {
    const url = `${BASE}/user.status?handle=${encodeURIComponent(displayHandle)}&from=${from}&count=${pageSize}`
    const page = await getCodeforcesJson(url)

    if (page.status !== 'OK') {
      throw new UpstreamError(`user.status failed: ${page.comment ?? 'unknown'}`)
    }

    if (!Array.isArray(page.result) || page.result.length === 0) break

    let reachedCutoff = false
    for (const sub of page.result) {
      if (sinceCutoff > 0 && sub.creationTimeSeconds < sinceCutoff) {
        reachedCutoff = true
        break
      }
      allSubmissions.push(sub)
    }

    if (reachedCutoff || page.result.length < pageSize) break

    from += pageSize
  }

  // ── Step 4: normalise ───────────────────────────────────────────────────────
  const ratingHistory = normaliseRatingHistory(ratingData.result ?? [])
  const { solvedProblems, daily } = normaliseSubmissions(allSubmissions)

  const profile = {
    handle: userInfo.handle,
    rating: userInfo.rating ?? null,
    maxRating: userInfo.maxRating ?? null,
    rankTitle: RANK_LABELS[userInfo.rank] ?? userInfo.rank ?? null,
    contestsCount: ratingHistory.length,
    problemsSolved: solvedProblems.length,
    solvedByBucket: buildRatingBuckets(solvedProblems),
  }

  return { profile, ratingHistory, solvedProblems, tagAggregates: null, daily }
}

// ── Normalisers ────────────────────────────────────────────────────────────────

/**
 * @param {object[]} contests  raw CF user.rating result
 */
function normaliseRatingHistory(contests) {
  return contests.map((c) => ({
    contestId: String(c.contestId),
    contestName: c.contestName,
    ratedAt: new Date(c.ratingUpdateTimeSeconds * 1000),
    oldRating: c.oldRating ?? null,
    newRating: c.newRating,
    rank: c.rank ?? null,
  }))
}

/**
 * Process raw CF submissions into:
 *   solvedProblems — deduplicated list of AC problems
 *   daily          — per-UTC-day activity
 *
 * @param {object[]} submissions  raw CF user.status result
 */
function normaliseSubmissions(submissions) {
  // Track first-solved time per problem key
  const solvedMap = new Map()   // problemKey → { name, difficulty, tags, firstSolvedAt }
  const dailyMap  = new Map()   // 'YYYY-MM-DD' → { submissions, attempted: Set, solvedToday: Set }

  for (const sub of submissions) {
    const day = utcDayKey(new Date(sub.creationTimeSeconds * 1000))
    const problemKey = `cf:${sub.problem.contestId ?? 'gym'}:${sub.problem.index}`

    // Daily activity — every submission counts
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { submissions: 0, attempted: new Set(), solvedToday: new Set() })
    }
    const dayEntry = dailyMap.get(day)
    dayEntry.submissions += 1
    dayEntry.attempted.add(problemKey)

    // Only AC submissions count as solved
    if (sub.verdict === 'OK') {
      const existingFirstSolve = solvedMap.get(problemKey)?.firstSolvedAt
      const thisTime = new Date(sub.creationTimeSeconds * 1000)

      if (!existingFirstSolve || thisTime < existingFirstSolve) {
        solvedMap.set(problemKey, {
          problemKey,
          name: sub.problem.name,
          difficultyRating: sub.problem.rating ?? null,
          tags: (sub.problem.tags ?? []).map((t) => t.toLowerCase()),
          firstSolvedAt: thisTime,
        })
      }

      // Track which problems were FIRST solved on this day (for daily.solved count)
      // We'll compute this properly after the loop once we know first-solve times
    }
  }

  // Build solvedProblems array
  const solvedProblems = Array.from(solvedMap.values())

  // Now compute daily.solved (problems whose first_solved_at falls on that day)
  for (const sp of solvedProblems) {
    const day = utcDayKey(sp.firstSolvedAt)
    const entry = dailyMap.get(day)
    if (entry) entry.solvedToday.add(sp.problemKey)
  }

  // Build daily array
  const daily = Array.from(dailyMap.entries()).map(([day, entry]) => ({
    day,
    submissions: entry.submissions,
    attempted: entry.attempted.size,
    solved: entry.solvedToday.size,
  }))

  return { solvedProblems, tagAggregates: null, daily }
}

/**
 * Group solved problems into Codeforces rating bands for solved_by_bucket.
 * Bands: <1200, 1200-1599, 1600-1999, 2000-2399, 2400+, unrated
 */
function buildRatingBuckets(solvedProblems) {
  const buckets = { unrated: 0, '<1200': 0, '1200': 0, '1600': 0, '2000': 0, '2400+': 0 }
  for (const p of solvedProblems) {
    const r = p.difficultyRating
    if (r === null || r === undefined) { buckets.unrated++; continue }
    if (r < 1200)  { buckets['<1200']++; continue }
    if (r < 1600)  { buckets['1200']++; continue }
    if (r < 2000)  { buckets['1600']++; continue }
    if (r < 2400)  { buckets['2000']++; continue }
    buckets['2400+']++
  }
  return buckets
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for a date in UTC */
function utcDayKey(date) {
  return date.toISOString().slice(0, 10)
}

/** Returns a Date set to 00:00:00 UTC for the given date's UTC day */
function startOfUtcDay(date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
