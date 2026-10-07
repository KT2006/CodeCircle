/**
 * routes/compare.js
 *
 * Compare routes — Phase 0 stubs.
 *
 * Final shape (Phase 8):
 *   GET /api/compare?friendId=&includeContests=
 *     Side-by-side per platform: stats, skill/contest/platform scores,
 *     tag mastery for the union of core tags, composite (missing = 0, flagged),
 *     consistency for both, gap analysis (plan §8.6).
 *     Same stale-while-revalidate behaviour as /friends/:id.
 *     includeContests defaults to the user's stored setting.
 *
 *   GET /api/compare/verdict?friendId=
 *     Phase 8: LLM-generated comparison text.
 *     Cache-first: reads comparison_verdicts by sha256 cache key.
 *     Rate limited 10/hour/user.
 *
 * All routes require authentication.
 */

import { Router } from 'express'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// GET /api/compare?friendId=&includeContests=
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 8' } })
})

// GET /api/compare/verdict?friendId=
router.get('/verdict', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Phase 8' } })
})

export default router
