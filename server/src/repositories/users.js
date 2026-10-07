/**
 * repositories/users.js
 *
 * All SQL that touches the `users` table lives here.
 * No SQL anywhere else — controllers and services call these functions.
 *
 * Why this layering?
 * If you ever need to change a query (add a column, fix an index hint),
 * there's exactly one place to look. Services stay clean and testable.
 *
 * Pattern used throughout:
 *   - Parameterised queries ($1, $2, ...) — NEVER string-concatenate user input
 *     into a query. That's how SQL injection attacks happen.
 *   - pool.query() for single statements
 *   - pass a `client` for transactions (see pool.js for the transaction pattern)
 */

import pool from '../db/pool.js'

/**
 * Find a user by their Google subject ID.
 * Returns null if not found (not an error — used to detect first login).
 *
 * @param {string} googleSub
 * @returns {Promise<object|null>}
 */
export async function findByGoogleSub(googleSub) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE google_sub = $1',
    [googleSub],
  )
  return rows[0] ?? null
}

/**
 * Find a user by their internal UUID.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id],
  )
  return rows[0] ?? null
}

/**
 * Upsert a user on Google login.
 * If the google_sub already exists, update name/email/avatar and last_login_at.
 * If not, insert a new row.
 * Returns the full user row either way.
 *
 * @param {{ googleSub: string, email: string, name: string, avatarUrl: string|null }} data
 * @returns {Promise<object>}
 */
export async function upsertFromGoogle({ googleSub, email, name, avatarUrl }) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_sub, email, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE SET
       email          = EXCLUDED.email,
       name           = EXCLUDED.name,
       avatar_url     = EXCLUDED.avatar_url,
       last_login_at  = now()
     RETURNING *`,
    [googleSub, email, name, avatarUrl ?? null],
  )
  return rows[0]
}

/**
 * Update the user's include_contests preference (plan D10).
 *
 * @param {string} id
 * @param {boolean} includeContests
 * @returns {Promise<object>}
 */
export async function updateSettings(id, includeContests) {
  const { rows } = await pool.query(
    `UPDATE users SET include_contests = $2 WHERE id = $1 RETURNING *`,
    [id, includeContests],
  )
  return rows[0]
}
