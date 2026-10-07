/**
 * routes/accounts.js
 *
 * Own platform handle management — Phase 0 stubs.
 *
 * Final shape (Phase 3+):
 *   POST   /api/accounts/preview         — validate handle, call adapter.fetchPreview,
 *                                          return { exists, displayHandle, rating, rankTitle, avatarUrl }
 *                                          Cached 10 min in Redis. Rate limited 20/min/user.
 *   PUT    /api/me/accounts/:platform    — upsert platform_accounts, link in user_accounts,
 *                                          run the refresh gate, enqueue first sync
 *   DELETE /api/me/accounts/:platform    — remove the link only (never delete shared account row)
 *
 * All routes here require authentication.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

// All account routes require the user to be logged in
router.use(requireAuth)

// POST /api/accounts/preview
// Body: { platform: 'codeforces' | 'leetcode', handle: string }
router.post('/preview', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 3' } })
})

// PUT /api/me/accounts/:platform
// Body: { handle: string }
router.put('/me/:platform', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 3' } })
})

// DELETE /api/me/accounts/:platform
router.delete('/me/:platform', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 3' } })
})

export default router
