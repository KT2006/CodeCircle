/**
 * src/app.js  — Express application factory
 *
 * This file builds and configures the Express app but does NOT start
 * the HTTP server (no app.listen here). Keeping them separate is important:
 *
 * 1. Tests can import the app and run supertest against it without binding
 *    to a port, so tests run fast and don't conflict with each other.
 * 2. server.js does the actual listen — one clean entry point.
 * 3. worker.js can import shared config without accidentally starting a server.
 *
 * Middleware order matters in Express — they run top-to-bottom:
 *   requestId → cors → json body parser → routes → 404 handler → error handler
 */

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import env from './config/env.js'
import logger from './lib/logger.js'
import { pingDb } from './db/pool.js'

import requestId from './middleware/requestId.js'
import errorHandler from './middleware/errorHandler.js'

import authRoutes from './routes/auth.js'
import accountsRoutes from './routes/accounts.js'
import profileRoutes from './routes/profile.js'
import friendsRoutes from './routes/friends.js'
import compareRoutes from './routes/compare.js'
import platformProfilesRoutes from './routes/platformProfiles.js'
import testRoutes from './routes/test.js'

// ── Build the app ─────────────────────────────────────────────────────────────
const app = express()

// Trust the first proxy (needed when running behind Render/Railway/Vercel so
// that express-rate-limit sees the real client IP, not the proxy IP)
app.set('trust proxy', 1)

// ── Global middleware ─────────────────────────────────────────────────────────

// 1. Attach a unique request ID and a child pino logger to every request
app.use(requestId)

// 2. CORS — only needed in development (in prod, frontend is same-origin via Vercel rewrite)
if (env.NODE_ENV !== 'production') {
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  logger.info({ corsOrigin: env.CORS_ORIGIN }, 'CORS enabled for development')
}

// 3. Parse JSON bodies; limit 100 kb (plan §9) to prevent payload-flooding attacks
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// ── Health check endpoints ────────────────────────────────────────────────────
// GET /healthz — is the process alive? (load balancer uses this)
// Always returns 200 as long as the process is running.
// No auth, no DB — intentionally lightweight.
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// GET /readyz — is the app ready to serve traffic?
// Pings Postgres. Returns 503 if the DB is unreachable so the load balancer
// can stop routing traffic to a broken instance.
app.get('/readyz', async (req, res) => {
  try {
    await pingDb()
    res.status(200).json({ status: 'ok', db: 'ok', redis: 'not checked' })
  } catch (err) {
    logger.error({ err }, '/readyz DB ping failed')
    res.status(503).json({ status: 'error', db: 'unreachable', redis: 'not checked' })
  }
})

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountsRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/friends', friendsRoutes)
app.use('/api/compare', compareRoutes)
app.use('/api/platform-profiles', platformProfilesRoutes)

// Temporary test routes — only in development
if (env.NODE_ENV !== 'production') {
  app.use('/api/test', testRoutes)
  logger.info('Test routes enabled (development only)')
}

// ── 404 catch-all ─────────────────────────────────────────────────────────────
// Any request that didn't match a route above falls here.
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} does not exist`,
    },
  })
})

// ── Global error handler ──────────────────────────────────────────────────────
// Must be registered LAST. Catches anything passed to next(err) or thrown
// inside an async route handler (Express 5 auto-catches async throws).
app.use(errorHandler)

export default app
