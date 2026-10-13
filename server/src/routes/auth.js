/**
 * Google Identity Services sends an ID token to this API. The token is verified
 * server-side before the Google account is upserted and a session cookie issued.
 */

import { Router } from 'express'
import { z } from 'zod'
import env from '../config/env.js'
import requireAuth from '../middleware/requireAuth.js'
import { findById, updateSettings, checkUsernameAvailable, setUsername } from '../repositories/users.js'
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signInWithGoogle,
  toPublicUser,
} from '../services/auth.js'

const router = Router()

// ── Validation schemas ────────────────────────────────────────────────────────

const googleSignInSchema = z.object({
  idToken: z.string().min(1).max(8192),
}).strict()

const settingsSchema = z.object({
  includeContests: z.boolean(),
}).strict()

// Username: 3–20 chars, lowercase letters/digits/underscores only
const USERNAME_RE = /^[a-z0-9_]{3,20}$/
const usernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username must be at most 20 characters.')
    .regex(USERNAME_RE, 'Only lowercase letters, numbers, and underscores are allowed.'),
}).strict()

// ── Public config ─────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID })
})

// ── Google sign-in ────────────────────────────────────────────────────────────

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

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS)
  res.status(200).json({ ok: true })
})

// ── /me ───────────────────────────────────────────────────────────────────────

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

// ── Settings ──────────────────────────────────────────────────────────────────

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

// ── Username availability check (unauthenticated, debounce on frontend) ───────
// GET /api/auth/check-username?u=kshitij

router.get('/check-username', async (req, res) => {
  const raw = String(req.query.u ?? '').trim().toLowerCase()
  if (!USERNAME_RE.test(raw)) {
    return res.json({ available: false, reason: 'invalid_format' })
  }
  const available = await checkUsernameAvailable(raw)
  return res.json({ available, reason: available ? null : 'taken' })
})

// ── Set / update username (authenticated) ────────────────────────────────────
// PATCH /api/auth/me/username  { username: "kshitij" }

router.patch('/me/username', requireAuth, async (req, res) => {
  const parsed = usernameSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid username.' },
    })
  }

  const username = parsed.data.username.toLowerCase()

  // Check availability (exclude self so user can "confirm" their current username)
  const available = await checkUsernameAvailable(username, req.user.id)
  if (!available) {
    return res.status(409).json({
      error: { code: 'USERNAME_TAKEN', message: `"${username}" is already taken. Try another.` },
    })
  }

  try {
    const user = await setUsername(req.user.id, username)
    return res.json({ user: toPublicUser(user) })
  } catch (err) {
    // Race condition: another request snuck in between the check and the update
    if (err.code === '23505') {
      return res.status(409).json({
        error: { code: 'USERNAME_TAKEN', message: `"${username}" was just taken. Try another.` },
      })
    }
    throw err
  }
})

export default router
