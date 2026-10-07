/**
 * routes/friends.js
 *
 * Friends management routes — Phase 0 stubs.
 *
 * Final shape (Phase 7):
 *   GET    /api/friends                        — list with name, platforms, latest scores, freshness
 *                                                One query joining friends, friend_handles,
 *                                                platform_accounts, account_snapshots via latest_snapshot_id
 *   POST   /api/friends                        — { displayName, handles: [{platform, handle}] }
 *                                                Max MAX_FRIENDS_PER_USER. 409 on duplicate name.
 *                                                Upsert accounts, enqueue first syncs.
 *   PATCH  /api/friends/:id                    — rename; add/remove handles
 *   DELETE /api/friends/:id                    — delete friend and their handle links only
 *   GET    /api/friends/:id                    — stored snapshots + tag mastery + consistency
 *                                                Triggers stale-while-revalidate (plan §7.5)
 *   GET    /api/friends/:id/activity?days=90   — daily series summed across friend's handles
 *
 * All routes require authentication.
 * Only the owner (owner_user_id) may read/modify their own friends (enforced in Phase 7).
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// GET /api/friends
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

// POST /api/friends
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

// PATCH /api/friends/:id
router.patch('/:id', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

// DELETE /api/friends/:id
router.delete('/:id', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

// GET /api/friends/:id
router.get('/:id', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

// GET /api/friends/:id/activity
router.get('/:id/activity', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 7' } })
})

export default router
