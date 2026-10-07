/**
 * routes/auth.js
 *
 * Auth routes — Phase 0 stubs.
 *
 * Final shape (Phase 2):
 *   POST /api/auth/google   — receive Google ID token, verify, issue JWT cookie
 *   POST /api/auth/logout   — clear the cookie
 *   GET  /api/auth/me       — return current user + their connected accounts
 *   PATCH /api/auth/me/settings — toggle includeContests (D10)
 *
 * Note: the old /auth/google/callback (Passport-style redirect flow) is removed.
 * We use Google Identity Services on the frontend to get the ID token directly,
 * then send it to POST /auth/google. No redirect dance needed.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

// POST /api/auth/google
// Receives: { idToken: string }
// Phase 2: verify with google-auth-library, upsert user, set httpOnly JWT cookie
router.post('/google', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } })
})

// POST /api/auth/logout
// Phase 2: clear the cc_session cookie
router.post('/logout', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } })
})

// GET /api/auth/me  — requires auth
// Phase 2: return req.user + their connected platform accounts
router.get('/me', requireAuth, (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } })
})

// PATCH /api/auth/me/settings  — requires auth
// Body: { includeContests: boolean }
router.patch('/me/settings', requireAuth, (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } })
})

export default router
