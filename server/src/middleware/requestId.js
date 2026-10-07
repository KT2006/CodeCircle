/**
 * middleware/requestId.js
 *
 * Attaches a unique ID to every incoming request.
 *
 * Why?
 * When you have hundreds of log lines from concurrent requests, you need a way
 * to filter all lines that belong to ONE request. The requestId is that filter key.
 *
 * How it works:
 * 1. Check if the caller sent an `X-Request-Id` header (useful for distributed tracing
 *    where a proxy or the frontend passes its own trace ID).
 * 2. If not, generate a random one using crypto.randomUUID() (built into Node 15+).
 * 3. Attach the ID to req.id and a child pino logger to req.log.
 * 4. Echo the ID back in the response header so clients can correlate errors.
 */

import { randomUUID } from 'crypto'
import { createRequestLogger } from '../lib/logger.js'

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] ?? randomUUID()
  req.id = id
  req.log = createRequestLogger(id)
  res.setHeader('X-Request-Id', id)
  next()
}

export default requestId
