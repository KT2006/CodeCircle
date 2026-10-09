import { Router } from 'express'
import { z } from 'zod'
import { fetchPlatformProfiles } from '../services/platformProfiles.js'
import requireAuth from '../middleware/requireAuth.js'
import { saveFetchedProfile } from '../repositories/profileData.js'

const router = Router()
router.use(requireAuth)

const requestSchema = z.object({
  handles: z.object({
    leetcode:      z.string().trim().max(50).optional(),
    codeforces:    z.string().trim().max(40).optional(),
    codechef:      z.string().trim().max(50).optional(),
    atcoder:       z.string().trim().max(16).optional(),
    geeksforgeeks: z.string().trim().max(50).optional(),
  }).strict(),
}).strict().superRefine(({ handles }, context) => {
  if (!handles.leetcode && !handles.codeforces && !handles.codechef && !handles.atcoder && !handles.geeksforgeeks) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['handles'],
      message: 'Enter at least one platform username.',
    })
  }
})

router.post('/fetch', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid platform handles.',
      },
    })
  }

  const handles = Object.fromEntries(
    Object.entries(parsed.data.handles)
      .map(([platform, handle]) => [platform, handle || undefined])
      .filter(([, handle]) => handle),
  )
  const result = await fetchPlatformProfiles(handles)
  await Promise.all(
    Object.values(result.profiles).map((profile) =>
      saveFetchedProfile(req.user.id, profile),
    ),
  )
  const allFailed = Object.keys(result.profiles).length === 0

  res.status(allFailed ? 502 : 200).json(result)
})

export default router
