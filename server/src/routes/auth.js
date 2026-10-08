/**
 * Google Identity Services sends an ID token to this API. The token is verified
 * server-side before the Google account is upserted and a session cookie issued.
 */

import { Router } from 'express'
import { z } from 'zod'
import env from '../config/env.js'
import requireAuth from '../middleware/requireAuth.js'
import { findById, updateSettings } from '../repositories/users.js'
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signInWithGoogle,
  toPublicUser,
} from '../services/auth.js'

const router = Router()

const googleSignInSchema = z.object({
  idToken: z.string().min(1).max(8192),
}).strict()

const settingsSchema = z.object({
  includeContests: z.boolean(),
}).strict()

router.get('/config', (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID })
})

router.post('/google', async (req, res, next) => {
  const parsed = googleSignInSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'A valid Google credential is required.' },
    })
  }

  try {
    const { user, token } = await signInWithGoogle(parsed.data.idToken)
    res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)
    return res.json({ user: toPublicUser(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS)
  res.status(200).json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await findById(req.user.id)
  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS)
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'This account no longer exists. Sign in again.' },
    })
  }
  return res.json({ user: toPublicUser(user) })
})

router.patch('/me/settings', requireAuth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'includeContests must be a boolean.' },
    })
  }
  const user = await updateSettings(req.user.id, parsed.data.includeContests)
  if (!user) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'The signed-in user could not be found.' },
    })
  }
  return res.json({ user: toPublicUser(user) })
})

export default router
