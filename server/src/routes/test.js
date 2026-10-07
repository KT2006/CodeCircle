/**
 * routes/test.js — temporary dev-only routes to test adapters end-to-end.
 * Gated to NODE_ENV !== 'production' in app.js.
 *
 * GET /api/test/codeforces/:handle/preview  — quick profile lookup (1 API call)
 * GET /api/test/codeforces/:handle          — full sync (all submissions + contests)
 */

import { Router } from 'express'
import { fetchPreview } from '../adapters/codeforces.js'
import { fetchProfile as fetchLeetCodeProfile } from '../adapters/leetcode.js'
import { fetchCodeforcesProfile } from '../services/platformProfiles.js'

const router = Router()

// NOTE: more-specific routes MUST come before parameterised ones.
// If /:handle came first, Express would match "preview" as the handle value.

// GET /api/test/codeforces/:handle/preview
router.get('/codeforces/:handle/preview', async (req, res, next) => {
  try {
    const preview = await fetchPreview(req.params.handle)
    res.json(preview)
  } catch (err) {
    next(err)
  }
})

// GET /api/test/codeforces/:handle  — full sync
router.get('/codeforces/:handle', async (req, res, next) => {
  try {
    res.json(await fetchCodeforcesProfile(req.params.handle))
  } catch (err) {
    next(err)
  }
})

// GET /api/test/leetcode/:handle — fetch public profile and contest statistics
router.get('/leetcode/:handle', async (req, res, next) => {
  try {
    res.json(await fetchLeetCodeProfile(req.params.handle))
  } catch (err) {
    next(err)
  }
})

export default router
