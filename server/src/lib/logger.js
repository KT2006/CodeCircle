/**
 * lib/logger.js
 *
 * A structured JSON logger built on pino.
 *
 * Why pino?
 * - Writes newline-delimited JSON — easy to pipe into log aggregators (Datadog, Loki, etc.)
 * - Much faster than console.log or winston
 * - In development, pino-pretty formats the same JSON into readable coloured lines
 *
 * Request ID support:
 * - Every incoming HTTP request should get a unique ID (e.g. a UUID)
 * - Attach it once in a middleware, then pass req.log everywhere
 * - All log lines for that request carry the same requestId, making debugging easy
 *
 * Usage:
 *   import logger from './lib/logger.js'
 *   logger.info('Server started')
 *   logger.error({ err }, 'Something went wrong')
 *
 *   // Inside a route handler, use the request-scoped child logger:
 *   req.log.info({ userId }, 'User fetched profile')
 */

import pino from 'pino'
import env from '../config/env.js'

// ── Transport (how logs are written) ─────────────────────────────────────────
// In development: pipe through pino-pretty for human-readable coloured output
// In production: write raw JSON to stdout (let the platform collect it)

const transport =
  env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,        // coloured level labels
          translateTime: 'HH:MM:ss', // short timestamp in the terminal
          ignore: 'pid,hostname',    // less noise
        },
      }
    : undefined // raw JSON to stdout

// ── Root logger ───────────────────────────────────────────────────────────────
const logger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info', // silence during tests
    // redact hides sensitive fields from every log line automatically
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
  transport ? pino.transport(transport) : undefined,
)

export default logger

// ── Request-scoped child logger factory ───────────────────────────────────────
// Call this in the requestId middleware to attach a child logger to req.log
// A child logger inherits all parent bindings and adds its own (requestId here)

/**
 * Creates a child logger with the request ID bound.
 * @param {string} requestId
 * @returns {import('pino').Logger}
 */
export function createRequestLogger(requestId) {
  return logger.child({ requestId })
}
