/**
 * routes/profile.js
 *
 * Profile / dashboard routes — Phase 0 stubs.
 *
 * Final shape (Phase 6):
 *   GET  /api/profile                       — aggregated dashboard payload:
 *                                             per-platform latest snapshot, composite score,
 *                                             tag mastery, 365-day activity, consistency,
 *                                             per-account freshness (status, lastSyncedAt, stale)
 *   GET  /api/profile/rating-history        — query param: range=1M|3M|6M|12M|ALL
 *                                             reads from rating_history table
 *   POST /api/profile/refresh               — runs the refresh gate for each of the user's
 *                                             accounts; returns { started: [...], skipped: [...] }
 *
 * All routes require authentication.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// GET /api/profile
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 6' } })
})

// GET /api/profile/rating-history?range=6M
router.get('/rating-history', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 6' } })
})

// POST /api/profile/refresh
router.post('/refresh', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 4' } })
})

export default router
