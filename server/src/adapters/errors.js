/**
 * src/adapters/errors.js
 *
 * Typed errors for the platform adapters.
 *
 * Why typed errors instead of just throwing new Error()?
 * The worker needs to decide whether to RETRY a failed job or give up:
 *
 *   NotFoundError  → the handle doesn't exist. Retrying won't help. Give up immediately.
 *   UpstreamError  → network issue, 5xx, rate limit. Might succeed if we try again. Retry.
 *   ParseError     → the API response shape changed (unofficial APIs break). Don't retry,
 *                    but log loudly so we know to fix the adapter.
 *
 * Each error class extends the built-in Error so:
 *   - err instanceof NotFoundError works
 *   - err.stack is still populated
 *   - err.message works as normal
 */

export class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NotFoundError'
    // HTTP status to use if this bubbles up to an API response
    this.status = 404
    this.code = 'HANDLE_NOT_FOUND'
  }
}

export class UpstreamError extends Error {
  /**
   * @param {string} message
   * @param {number} [httpStatus]  the upstream HTTP status code, if available
   */
  constructor(message, httpStatus) {
    super(message)
    this.name = 'UpstreamError'
    this.status = 502
    this.code = 'UPSTREAM_ERROR'
    this.upstreamStatus = httpStatus ?? null
  }
}

export class ParseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ParseError'
    this.status = 502
    this.code = 'PARSE_ERROR'
  }
}
