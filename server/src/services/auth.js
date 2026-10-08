import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import * as users from '../repositories/users.js'

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID)
const SESSION_ISSUER = 'codecircle'
const SESSION_AUDIENCE = 'codecircle-web'
export const SESSION_COOKIE_NAME = 'cc_session'
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_MS,
}

export class AuthenticationError extends Error {
  constructor(message = 'Google sign-in could not be verified. Please try again.') {
    super(message)
    this.name = 'AuthenticationError'
    this.status = 401
    this.code = 'INVALID_GOOGLE_TOKEN'
  }
}

export async function signInWithGoogle(idToken) {
  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch {
    throw new AuthenticationError()
  }

  if (
    !payload ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    payload.email_verified !== true
  ) {
    throw new AuthenticationError('Use a Google account with a verified email address.')
  }

  const name = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : payload.email
  const avatarUrl = typeof payload.picture === 'string' ? payload.picture : null
  const user = await users.upsertFromGoogle({
    googleSub: payload.sub,
    email: payload.email,
    name,
    avatarUrl,
  })

  return { user, token: createSessionToken(user.id) }
}

export function createSessionToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    expiresIn: '7d',
  })
}

export function toPublicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    includeContests: user.include_contests,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  }
}
