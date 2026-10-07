/**
 * middleware/errorHandler.js
 *
 * Global error-handling middleware for Express.
 *
 * Express recognises a 4-argument middleware (err, req, res, next) as an
 * error handler. You register it LAST, after all routes, and it catches any
 * error passed to next(err) or thrown inside an async route (Express 5 does
 * this automatically for async functions).
 *
 * Error shape (matches the API spec in plan.md §9):
 *   { "error": { "code": "STRING", "message": "human readable" } }
 *
 * This keeps error handling in one place instead of try/catch in every route.
 */

import logger from '../lib/logger.js'

/**
 * @param {Error & { status?: number; code?: string }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next  // must be declared even if unused
 */
function errorHandler(err, req, res, _next) {
  // Use the logger attached to this request (has requestId) if available,
  // otherwise fall back to the root logger
  const log = req.log ?? logger

  // Determine status code:
  // - err.status lets specific errors set their own HTTP status (e.g. 404, 422)
  // - unknown errors become 500
  const status = err.status ?? 500

  if (status >= 500) {
    // Log the full error stack for server errors — these are bugs we need to fix
    log.error({ err }, 'Unhandled error')
  } else {
    // 4xx errors are expected (bad input, auth failures) — log at warn
    log.warn({ err, status }, err.message)
  }

  res.status(status).json({
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message:
        // In production, don't leak internal error details to clients
        status >= 500 && process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
  })
}

export default errorHandler
