/**
 * middleware/requireAuth.js
 *
 * Protects routes that require a logged-in user.
 *
 * Phase 0 status: STUB — always returns 401.
 * Phase 2 will:
 *   1. Read the httpOnly cookie `cc_session`
 *   2. Verify it as a JWT (using the JWT_SECRET from env)
 *   3. Attach the decoded payload to req.user
 *   4. Call next() if valid, or send 401 if not
 *
 * Why httpOnly cookies instead of localStorage?
 *   JavaScript cannot read httpOnly cookies, so an XSS attack on the frontend
 *   cannot steal the session token. This is the standard approach for web apps.
 */

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, _next) {
  // TODO (Phase 2): verify JWT from httpOnly cookie `cc_session`
  // For now, every protected route returns 401 so the app boots without crashing.
  res.status(401).json({
    error: {
      code: 'UNAUTHENTICATED',
      message: 'Authentication not yet implemented (Phase 2)',
    },
  })
}

export default requireAuth
