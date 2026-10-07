import { Router } from 'express'
import { z } from 'zod'
import { fetchPlatformProfiles } from '../services/platformProfiles.js'

const router = Router()

const requestSchema = z.object({
  handles: z.object({
    leetcode: z.string().trim().max(50).optional(),
    codeforces: z.string().trim().max(40).optional(),
    codechef: z.string().trim().max(50).optional(),
    atcoder: z.string().trim().max(16).optional(),
  }).strict(),
}).strict().superRefine(({ handles }, context) => {
  if (!handles.leetcode && !handles.codeforces && !handles.codechef && !handles.atcoder) {
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
  const allFailed = Object.keys(result.profiles).length === 0

  res.status(allFailed ? 502 : 200).json(result)
})

export default router
