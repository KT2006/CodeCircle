/**
 * repositories/snapshots.js
 *
 * All SQL that touches `account_snapshots`, `snapshot_tag_stats`,
 * `solved_problems`, `daily_activity`, and `rating_history`.
 *
 * The worker calls these (inside a transaction) after a successful sync.
 * The profile/friends/compare services call the read functions.
 */

import pool from '../db/pool.js'

/**
 * Get the latest snapshot for a platform account.
 * Uses the denormalised latest_snapshot_id on platform_accounts for O(1) lookup
 * instead of MAX(fetched_at) which would require a full index scan.
 *
 * @param {string} platformAccountId
 * @returns {Promise<object|null>}
 */
export async function getLatest(platformAccountId) {
  const { rows } = await pool.query(
    `SELECT s.*
     FROM account_snapshots s
     JOIN platform_accounts pa ON pa.latest_snapshot_id = s.id
     WHERE pa.id = $1`,
    [platformAccountId],
  )
  return rows[0] ?? null
}

/**
 * Insert a new snapshot row.
 * Returns the new row (including the auto-generated bigserial id).
 * Called inside a transaction in the worker.
 *
 * @param {object} data
 * @param {object} [client]  pass a transaction client, or use the pool
 * @returns {Promise<object>}
 */
export async function insertSnapshot(data, client = pool) {
  const {
    platformAccountId,
    rating,
    maxRating,
    rankTitle,
    contestsCount,
    problemsSolved,
    solvedByBucket,
    skillScore,
    contestScore,
    scoreVersion,
    rawMeta,
  } = data

  const { rows } = await client.query(
    `INSERT INTO account_snapshots (
       platform_account_id, rating, max_rating, rank_title,
       contests_count, problems_solved, solved_by_bucket,
       skill_score, contest_score, score_version, raw_meta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      platformAccountId, rating ?? null, maxRating ?? null, rankTitle ?? null,
      contestsCount, problemsSolved, solvedByBucket ? JSON.stringify(solvedByBucket) : null,
      skillScore ?? null, contestScore ?? null, scoreVersion, rawMeta ? JSON.stringify(rawMeta) : null,
    ],
  )
  return rows[0]
}

/**
 * Bulk-insert tag stats for a snapshot.
 * Uses a VALUES list for efficiency (one round-trip for all tags).
 *
 * @param {bigint} snapshotId
 * @param {Array<{ tag: string, solvedCount: number, weightedPoints: number }>} tags
 * @param {object} [client]
 */
export async function insertTagStats(snapshotId, tags, client = pool) {
  if (tags.length === 0) return

  // Build: ($1,$2,$3), ($4,$5,$6), ...
  const values = []
  const params = []
  tags.forEach(({ tag, solvedCount, weightedPoints }, i) => {
    const base = i * 3
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`)
    params.push(snapshotId, tag, solvedCount, weightedPoints)
  })

  // Rebuild with 4 params per row
  const values4 = []
  const params4 = []
  tags.forEach(({ tag, solvedCount, weightedPoints }, i) => {
    const base = i * 4
    values4.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`)
    params4.push(snapshotId, tag, solvedCount, weightedPoints)
  })

  await client.query(
    `INSERT INTO snapshot_tag_stats (snapshot_id, tag, solved_count, weighted_points)
     VALUES ${values4.join(', ')}
     ON CONFLICT (snapshot_id, tag) DO UPDATE SET
       solved_count    = EXCLUDED.solved_count,
       weighted_points = EXCLUDED.weighted_points`,
    params4,
  )
}

/**
 * Upsert daily activity rows for a platform account.
 * ON CONFLICT DO UPDATE replaces the row so partial-day data gets refreshed.
 *
 * @param {string} platformAccountId
 * @param {Array<{ day: string, submissions: number, attempted: number|null, solved: number|null }>} days
 * @param {object} [client]
 */
export async function upsertDailyActivity(platformAccountId, days, client = pool) {
  if (days.length === 0) return

  const values = []
  const params = []
  days.forEach(({ day, submissions, attempted, solved }, i) => {
    const base = i * 5
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`)
    params.push(platformAccountId, day, submissions, attempted ?? null, solved ?? null)
  })

  await client.query(
    `INSERT INTO daily_activity (platform_account_id, day, submissions, problems_attempted, problems_solved)
     VALUES ${values.join(', ')}
     ON CONFLICT (platform_account_id, day) DO UPDATE SET
       submissions        = EXCLUDED.submissions,
       problems_attempted = EXCLUDED.problems_attempted,
       problems_solved    = EXCLUDED.problems_solved`,
    params,
  )
}

/**
 * Get daily activity for a platform account over a date range.
 *
 * @param {string} platformAccountId
 * @param {number} days  how many days back from today
 * @returns {Promise<object[]>}
 */
export async function getDailyActivity(platformAccountId, days = 365) {
  const { rows } = await pool.query(
    `SELECT day, submissions, problems_attempted, problems_solved
     FROM daily_activity
     WHERE platform_account_id = $1
       AND day >= CURRENT_DATE - $2::int
     ORDER BY day ASC`,
    [platformAccountId, days],
  )
  return rows
}

/**
 * Upsert rating history entries. ON CONFLICT DO NOTHING — once a contest
 * result is stored, it never changes.
 *
 * @param {string} platformAccountId
 * @param {Array<object>} entries
 * @param {object} [client]
 */
export async function upsertRatingHistory(platformAccountId, entries, client = pool) {
  if (entries.length === 0) return

  const values = []
  const params = []
  entries.forEach(({ contestId, contestName, ratedAt, oldRating, newRating, contestRank }, i) => {
    const base = i * 7
    values.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`)
    params.push(platformAccountId, contestId, contestName, ratedAt, oldRating ?? null, newRating, contestRank ?? null)
  })

  await client.query(
    `INSERT INTO rating_history
       (platform_account_id, contest_id, contest_name, rated_at, old_rating, new_rating, contest_rank)
     VALUES ${values.join(', ')}
     ON CONFLICT (platform_account_id, contest_id) DO NOTHING`,
    params,
  )
}

/**
 * Get rating history for a platform account, filtered by time range.
 *
 * @param {string} platformAccountId
 * @param {Date|null} since  if null, returns all history
 * @returns {Promise<object[]>}
 */
export async function getRatingHistory(platformAccountId, since = null) {
  if (since) {
    const { rows } = await pool.query(
      `SELECT * FROM rating_history
       WHERE platform_account_id = $1 AND rated_at >= $2
       ORDER BY rated_at ASC`,
      [platformAccountId, since],
    )
    return rows
  }
  const { rows } = await pool.query(
    `SELECT * FROM rating_history
     WHERE platform_account_id = $1
     ORDER BY rated_at ASC`,
    [platformAccountId],
  )
  return rows
}

/**
 * Upsert solved problems (Codeforces only).
 * ON CONFLICT DO NOTHING — first_solved_at never changes after initial insert.
 *
 * @param {string} platformAccountId
 * @param {Array<object>} problems
 * @param {object} [client]
 */
export async function upsertSolvedProblems(platformAccountId, problems, client = pool) {
  if (problems.length === 0) return

  const values = []
  const params = []
  problems.forEach(({ problemKey, name, difficultyRating, tags, firstSolvedAt }, i) => {
    const base = i * 6
    values.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6})`)
    params.push(platformAccountId, problemKey, name, difficultyRating ?? null, tags, firstSolvedAt)
  })

  await client.query(
    `INSERT INTO solved_problems
       (platform_account_id, problem_key, name, difficulty_rating, tags, first_solved_at)
     VALUES ${values.join(', ')}
     ON CONFLICT (platform_account_id, problem_key) DO NOTHING`,
    params,
  )
}
