/**
 * repositories/platformAccounts.js
 *
 * All SQL that touches `platform_accounts`, `user_accounts`, and `friend_handles`.
 * The refresh gate SQL (plan §7.2) also lives here — it's the most important
 * query in the entire app.
 */

import pool from '../db/pool.js'

/**
 * Find a platform account by platform + canonical handle.
 * Returns null if not found.
 *
 * @param {string} platform  'codeforces' | 'leetcode'
 * @param {string} handle    canonical (lower-cased, trimmed)
 * @returns {Promise<object|null>}
 */
export async function findByHandle(platform, handle) {
  const { rows } = await pool.query(
    'SELECT * FROM platform_accounts WHERE platform = $1 AND handle = $2',
    [platform, handle],
  )
  return rows[0] ?? null
}

/**
 * Find a platform account by its UUID.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM platform_accounts WHERE id = $1',
    [id],
  )
  return rows[0] ?? null
}

/**
 * Upsert a platform account.
 * If (platform, handle) already exists, return the existing row — do not
 * overwrite status or sync data.
 * If it's new, insert with status='idle' and next_refresh_allowed_at=now()
 * (so it can be refreshed immediately on first add).
 *
 * @param {{ platform: string, handle: string, displayHandle: string }} data
 * @returns {Promise<object>}
 */
export async function upsert({ platform, handle, displayHandle }) {
  const { rows } = await pool.query(
    `INSERT INTO platform_accounts (platform, handle, display_handle)
     VALUES ($1, $2, $3)
     ON CONFLICT (platform, handle) DO UPDATE SET
       display_handle = EXCLUDED.display_handle
     RETURNING *`,
    [platform, handle, displayHandle],
  )
  return rows[0]
}

/**
 * Link a platform account to a user's own account list.
 * ON CONFLICT DO NOTHING: if the user already has a handle for this platform,
 * this is a no-op (the PUT /me/accounts/:platform handler calls upsert first
 * to update the account, then calls this).
 *
 * @param {string} userId
 * @param {string} platform
 * @param {string} platformAccountId
 */
export async function linkToUser(userId, platform, platformAccountId) {
  await pool.query(
    `INSERT INTO user_accounts (user_id, platform, platform_account_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, platform) DO UPDATE SET
       platform_account_id = EXCLUDED.platform_account_id`,
    [userId, platform, platformAccountId],
  )
}

/**
 * Remove a user's link to a platform account.
 * Never deletes the shared platform_accounts row.
 *
 * @param {string} userId
 * @param {string} platform
 */
export async function unlinkFromUser(userId, platform) {
  await pool.query(
    'DELETE FROM user_accounts WHERE user_id = $1 AND platform = $2',
    [userId, platform],
  )
}

/**
 * Get all platform accounts linked to a user (their own handles).
 * Joins through user_accounts to get the full account row.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function findByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT pa.*
     FROM platform_accounts pa
     JOIN user_accounts ua ON ua.platform_account_id = pa.id
     WHERE ua.user_id = $1`,
    [userId],
  )
  return rows
}

/**
 * THE REFRESH GATE (plan §7.2)
 *
 * Atomically claims the right to refresh a platform account.
 * Returns the account row if the gate opened (refresh allowed),
 * or null if the account is still in cooldown / already being refreshed.
 *
 * How it works:
 *   The UPDATE only fires if:
 *   1. next_refresh_allowed_at <= now()  — the cooldown has passed
 *   2. status is NOT 'queued' or 'fetching'  — nobody else is already refreshing it
 *      UNLESS the status has been stuck for longer than STUCK_JOB_MINUTES
 *      (the watchdog escape hatch for crashed workers)
 *
 *   If the UPDATE fires, it immediately sets next_refresh_allowed_at to
 *   now() + cooldownMinutes — consuming the cooldown even before the fetch starts.
 *   This is plan D8: a failed fetch still eats the cooldown.
 *
 *   RETURNING id — if we get a row back, we won the gate and should enqueue.
 *   If 0 rows updated, someone else got there first (or it's still cooling down).
 *
 * @param {string} id                  platform_accounts.id
 * @param {number} cooldownMinutes     from env.REFRESH_COOLDOWN_MINUTES
 * @param {number} stuckJobMinutes     from env.STUCK_JOB_MINUTES
 * @returns {Promise<object|null>}     the account row, or null if gate is closed
 */
export async function tryClaimRefresh(id, cooldownMinutes, stuckJobMinutes) {
  const { rows } = await pool.query(
    `UPDATE platform_accounts
     SET
       next_refresh_allowed_at = now() + make_interval(mins => $2),
       status                  = 'queued',
       status_updated_at       = now(),
       last_attempt_at         = now()
     WHERE id = $1
       AND next_refresh_allowed_at <= now()
       AND (
         status NOT IN ('queued', 'fetching')
         OR status_updated_at < now() - make_interval(mins => $3)
       )
     RETURNING *`,
    [id, cooldownMinutes, stuckJobMinutes],
  )
  return rows[0] ?? null
}

/**
 * Update a platform account's status (used by the worker).
 *
 * @param {string} id
 * @param {string} status  'idle' | 'queued' | 'fetching' | 'failed'
 */
export async function setStatus(id, status) {
  await pool.query(
    `UPDATE platform_accounts
     SET status = $2, status_updated_at = now()
     WHERE id = $1`,
    [id, status],
  )
}

/**
 * Mark a sync as successful: update status, last_synced_at, latest_snapshot_id,
 * reset failure count and error.
 * Called inside the worker's DB transaction after all data is written.
 *
 * @param {string} id
 * @param {bigint} latestSnapshotId
 */
export async function markSyncSuccess(id, latestSnapshotId) {
  await pool.query(
    `UPDATE platform_accounts SET
       status               = 'idle',
       status_updated_at    = now(),
       last_synced_at       = now(),
       latest_snapshot_id   = $2,
       consecutive_failures = 0,
       last_error           = NULL
     WHERE id = $1`,
    [id, latestSnapshotId],
  )
}

/**
 * Mark a sync as failed: increment failure counter, store error message.
 * next_refresh_allowed_at was already consumed by the gate — do NOT reset it (D8).
 *
 * @param {string} id
 * @param {string} errorMessage
 */
export async function markSyncFailure(id, errorMessage) {
  await pool.query(
    `UPDATE platform_accounts SET
       status               = 'failed',
       status_updated_at    = now(),
       consecutive_failures = consecutive_failures + 1,
       last_error           = $2
     WHERE id = $1`,
    [id, errorMessage],
  )
}
