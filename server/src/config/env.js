/**
 * config/env.js
 *
 * Validates all environment variables with zod at startup.
 * If any required variable is missing or wrong, the process crashes immediately
 * with a clear error message — "fail fast" instead of silently misbehaving later.
 *
 * Usage: import env from './config/env.js'
 *        env.PORT, env.DATABASE_URL, etc.
 */

import { z } from 'zod'
import dotenv from 'dotenv'

// Load .env file before we validate (no-op in production where vars are set directly)
dotenv.config()

// ── Schema ────────────────────────────────────────────────────────────────────
// z.coerce.number() converts the string "3000" -> number 3000 (env vars are always strings)
// .default() fills in a value when the variable is absent entirely

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  // Database — required in all environments
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),

  // Redis — optional until the worker/rate-limiter phase uses it
  REDIS_URL: z
    .string()
    .optional()
    .default('redis://localhost:6379'),

  // Auth — required (no default; app must not start without these)
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),

  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, 'GOOGLE_CLIENT_ID is required'),

  // CORS — only used in development; in prod the frontend is same-origin
  CORS_ORIGIN: z
    .string()
    .url()
    .default('http://localhost:5173'),

  // Refresh / staleness tunables
  REFRESH_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(15),
  STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(360),
  SYNC_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  STUCK_JOB_MINUTES: z.coerce.number().int().positive().default(10),

  // Feature limits
  MAX_FRIENDS_PER_USER: z.coerce.number().int().positive().default(50),

  // Worker mode: 'inline' runs the worker inside the API process (handy for free hosting)
  WORKER_MODE: z.enum(['separate', 'inline']).default('separate'),

  // LLM — optional until Phase 8
  ANTHROPIC_API_KEY: z.string().optional(),
})

// ── Parse and crash on failure ────────────────────────────────────────────────
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // Format zod errors into readable lines, e.g.:
  //   ✗ JWT_SECRET: must be at least 32 characters long
  const lines = parsed.error.issues.map(
    (issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`,
  )
  console.error('\n[env] Invalid environment variables:\n' + lines.join('\n') + '\n')
  process.exit(1)
}

const env = parsed.data
export default env
