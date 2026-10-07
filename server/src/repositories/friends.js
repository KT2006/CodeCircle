/**
 * repositories/friends.js
 *
 * All SQL that touches `friends` and `friend_handles`.
 *
 * Key design points (plan D4/D5/D6):
 *  - Friends are private to their owner (owner_user_id).
 *  - A friend is just a named group of platform handles — they don't need
 *    a CodeCircle account.
 *  - Authorization (only the owner can read/modify) is enforced by including
 *    owner_user_id = $userId in every WHERE clause, not just by ID.
 */

import pool from '../db/pool.js'

/**
 * List all friends for a user, with each friend's platform accounts joined in.
 * Uses the denormalised latest_snapshot_id for O(1) snapshot reads.
 *
 * Returns an array of friend rows, each with a nested `handles` array.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function listByOwner(userId) {
  // One query, no N+1: join friends → friend_handles → platform_accounts → latest snapshot
  const { rows } = await pool.query(
    `SELECT
       f.id, f.display_name, f.created_at,
       json_agg(json_build_object(
         'platform',          pa.platform,
         'handle',            pa.display_handle,
         'status',            pa.status,
         'lastSyncedAt',      pa.last_synced_at,
         'latestSnapshotId',  pa.latest_snapshot_id
       ) ORDER BY pa.platform) AS handles
     FROM friends f
     JOIN friend_handles fh ON fh.friend_id = f.id
     JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     WHERE f.owner_user_id = $1
     GROUP BY f.id
     ORDER BY f.created_at DESC`,
    [userId],
  )
  return rows
}

/**
 * Get a single friend by ID, asserting ownership.
 * Returns null if not found or if the caller doesn't own it.
 *
 * @param {string} friendId
 * @param {string} ownerUserId
 * @returns {Promise<object|null>}
 */
export async function findByIdAndOwner(friendId, ownerUserId) {
  const { rows } = await pool.query(
    `SELECT f.*, json_agg(json_build_object(
       'platform',             pa.platform,
       'handle',               pa.display_handle,
       'platformAccountId',    pa.id,
       'status',               pa.status,
       'lastSyncedAt',         pa.last_synced_at,
       'nextRefreshAllowedAt', pa.next_refresh_allowed_at,
       'latestSnapshotId',     pa.latest_snapshot_id,
       'lastError',            pa.last_error
     ) ORDER BY pa.platform) AS handles
     FROM friends f
     JOIN friend_handles fh ON fh.friend_id = f.id
     JOIN platform_accounts pa ON pa.id = fh.platform_account_id
     WHERE f.id = $1 AND f.owner_user_id = $2
     GROUP BY f.id`,
    [friendId, ownerUserId],
  )
  return rows[0] ?? null
}

/**
 * Count how many friends a user has.
 * Used to enforce MAX_FRIENDS_PER_USER before inserting.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countByOwner(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM friends WHERE owner_user_id = $1',
    [userId],
  )
  return parseInt(rows[0].count, 10)
}

/**
 * Insert a new friend row.
 *
 * @param {string} ownerUserId
 * @param {string} displayName
 * @returns {Promise<object>}  the new friend row
 */
export async function create(ownerUserId, displayName) {
  const { rows } = await pool.query(
    `INSERT INTO friends (owner_user_id, display_name)
     VALUES ($1, $2)
     RETURNING *`,
    [ownerUserId, displayName],
  )
  return rows[0]
}

/**
 * Rename a friend. Only works if the caller owns the friend.
 *
 * @param {string} friendId
 * @param {string} ownerUserId
 * @param {string} displayName
 * @returns {Promise<object|null>}
 */
export async function rename(friendId, ownerUserId, displayName) {
  const { rows } = await pool.query(
    `UPDATE friends SET display_name = $3
     WHERE id = $1 AND owner_user_id = $2
     RETURNING *`,
    [friendId, ownerUserId, displayName],
  )
  return rows[0] ?? null
}

/**
 * Delete a friend and all their handle links (CASCADE handles the latter).
 * Only deletes if the caller owns the friend.
 *
 * @param {string} friendId
 * @param {string} ownerUserId
 * @returns {Promise<boolean>}  true if deleted, false if not found / not owner
 */
export async function remove(friendId, ownerUserId) {
  const { rowCount } = await pool.query(
    'DELETE FROM friends WHERE id = $1 AND owner_user_id = $2',
    [friendId, ownerUserId],
  )
  return rowCount > 0
}

/**
 * Add a platform handle to a friend.
 * Upserts: if the friend already has a handle for this platform, replace it.
 *
 * @param {string} friendId
 * @param {string} platform
 * @param {string} platformAccountId
 */
export async function upsertHandle(friendId, platform, platformAccountId) {
  await pool.query(
    `INSERT INTO friend_handles (friend_id, platform, platform_account_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (friend_id, platform) DO UPDATE SET
       platform_account_id = EXCLUDED.platform_account_id`,
    [friendId, platform, platformAccountId],
  )
}

/**
 * Remove a specific platform handle from a friend.
 *
 * @param {string} friendId
 * @param {string} platform
 */
export async function removeHandle(friendId, platform) {
  await pool.query(
    'DELETE FROM friend_handles WHERE friend_id = $1 AND platform = $2',
    [friendId, platform],
  )
}
