/**
 * src/server.js  — HTTP server entrypoint
 *
 * This is the only file that calls app.listen().
 * It imports the app factory, binds it to a port, and handles
 * graceful shutdown so in-flight requests finish before the process exits.
 *
 * Graceful shutdown:
 * - SIGTERM is sent by Docker / Railway / Render when they want to stop the process
 * - We stop accepting new connections, let current ones finish, then exit cleanly
 * - Without this, users mid-request would see a connection reset error
 */

import app from './app.js'
import env from './config/env.js'
import logger from './lib/logger.js'

// ── Start listening ───────────────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `CodeCircle API started`,
  )
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing server...')

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server close')
      process.exit(1)
    }
    logger.info('Server closed. Exiting.')
    process.exit(0)
  })

  // Force exit after 10 s if connections don't close naturally
  setTimeout(() => {
    logger.warn('Forced exit after timeout')
    process.exit(1)
  }, 10_000).unref() // .unref() so this timer doesn't keep the process alive on its own
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))   // Ctrl+C in the terminal

// ── Catch unhandled promise rejections ────────────────────────────────────────
// These happen when you await a promise but don't have a try/catch.
// Without this handler Node prints a warning and may exit silently in future versions.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection')
  // Don't crash in development; do crash in production so the process manager restarts
  if (env.NODE_ENV === 'production') process.exit(1)
})
