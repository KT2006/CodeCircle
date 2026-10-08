/**
 * middleware/requireAuth.js
 *
 * Protects routes that require a logged-in user.
 *
 * Why httpOnly cookies instead of localStorage?
 *   JavaScript cannot read httpOnly cookies, so an XSS attack on the frontend
 *   cannot steal the session token. This is the standard approach for web apps.
 */

import jwt from 'jsonwebtoken'
import env from '../config/env.js'

const COOKIE_NAME = 'cc_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
    })
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'codecircle-web',
      issuer: 'codecircle',
    })
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Your session is invalid. Sign in again.' },
      })
    }

    req.user = { id: payload.sub }
    return next()
  } catch {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Sign in again.' },
    })
  }
}

export default requireAuth
