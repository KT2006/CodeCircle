/**
 * src/db/pool.js
 *
 * Creates and exports a single shared pg connection pool.
 *
 * Why a pool and not a single client?
 * A Pool keeps several database connections open and reuses them across
 * requests. Opening a new TCP connection to Postgres for every HTTP request
 * would be slow (~50-100 ms each). With a pool, connections are already open
 * and a query just borrows one from the pool and returns it when done.
 *
 * Why SSL for Neon?
 * Neon is a cloud-hosted database. All traffic to it must be encrypted (SSL).
 * The connection string from Neon already contains `?sslmode=require`.
 * We also pass `ssl: { rejectUnauthorized: false }` in production because
 * Neon uses a certificate that Node.js doesn't trust by default (it's signed
 * by a CA that isn't in Node's built-in CA bundle). This is safe for Neon —
 * it still encrypts the connection, it just skips certificate chain validation.
 * In local dev (docker-compose Postgres) SSL is not used at all.
 *
 * Usage:
 *   import pool from '../db/pool.js'
 *   const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
 *
 *   // For transactions (multiple queries that must all succeed or all fail):
 *   const client = await pool.connect()
 *   try {
 *     await client.query('BEGIN')
 *     await client.query('INSERT ...')
 *     await client.query('UPDATE ...')
 *     await client.query('COMMIT')
 *   } catch (err) {
 *     await client.query('ROLLBACK')
 *     throw err
 *   } finally {
 *     client.release()   // ALWAYS release back to the pool
 *   }
 */

import pg from 'pg'
import env from '../config/env.js'
import logger from '../lib/logger.js'

const { Pool } = pg

// ── SSL configuration ─────────────────────────────────────────────────────────
// Neon requires SSL. Local docker-compose does not.
const ssl =
  env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false

// ── Create pool ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl,
  // Maximum connections in the pool. Free Neon tier allows ~100 concurrent
  // connections, but keep this low on the free tier to avoid exhausting it.
  max: env.NODE_ENV === 'production' ? 10 : 5,
  // How long (ms) to wait for a connection from the pool before throwing
  connectionTimeoutMillis: 10_000,
  // How long (ms) a client can sit idle before being closed and removed
  idleTimeoutMillis: 30_000,
})

// ── Log connection events ─────────────────────────────────────────────────────
pool.on('connect', () => {
  logger.debug('New DB client connected to pool')
})

pool.on('error', (err) => {
  // This fires when an idle client encounters an unexpected error (e.g. Neon
  // closed the connection after a period of inactivity).
  // pg will remove the broken client and create a new one automatically.
  logger.error({ err }, 'Unexpected error on idle DB client')
})

// ── Health ping helper ────────────────────────────────────────────────────────
/**
 * Sends a lightweight query to verify the DB is reachable.
 * Used by the /readyz endpoint.
 * @returns {Promise<void>}
 */
export async function pingDb() {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

export default pool
