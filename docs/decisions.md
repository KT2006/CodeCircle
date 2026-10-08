# docs/decisions.md

This file logs every architectural decision made during the build.
Format: `[Phase X]` tag, decision label, one-line reason.
Any item from `plan.md §2B` (defaults pending owner confirmation) is marked **DEFAULT**.

---

## Phase 0 — Repo hygiene

### ESM (ECMAScript Modules) instead of CommonJS
`type: "module"` in `package.json`. All files use `import`/`export`.
**Reason:** CommonJS (`require`) is the old Node module system. ESM is the standard.
Switching now avoids a painful migration later; the whole plan already assumes ESM.

### app.js as a factory, server.js as the entrypoint
`app.js` builds and exports the Express app. `server.js` imports it and calls `app.listen()`.
**Reason:** tests can import the app and drive it with `supertest` without binding to a port.
This is the standard pattern for testable Express apps.

### Zod for env validation in config/env.js
`safeParse` at startup, `process.exit(1)` on failure.
**Reason:** fail-fast. A missing `JWT_SECRET` or wrong `DATABASE_URL` should crash loudly
on boot rather than cause mysterious runtime errors.

### Pino for structured logging
JSON logs in production, pino-pretty in development.
**Reason:** structured logs (JSON) are machine-readable by log aggregators.
`console.log` is fine for scripts but not for a production service.

### Request IDs via `crypto.randomUUID()`
Each request gets a UUID attached to `req.id` and echoed as `X-Request-Id`.
`req.log` is a pino child logger with the ID bound, so every log line for a request
carries the same ID — makes debugging concurrent traffic much easier.

### Feed route removed
`feedRoutes` deleted per `plan.md §1` (Feed is cut from v1, D14).

### `/healthz` and `/readyz` added
`/healthz` — process alive (no auth, no DB). Used by load balancers.
`/readyz` — ready to serve (will check DB + Redis in Phase 1).

### docker-compose.yml at repo root
Runs `postgres:16-alpine` and `redis:7-alpine` locally.
**Reason:** reproducible local dev without installing Postgres/Redis natively.

---

## Defaults pending owner confirmation (plan §2B)

| ID | Default | Where |
|----|---------|-------|
| P1 | Shared `platform_accounts` per handle | Phase 1 schema |
| P2 | `STALE_AFTER_MINUTES=360` (6 h) | `config/env.js` |
| P3 | One refresh gate per `platform_accounts` row | Phase 4 |
| P4 | ESM, `pg` + hand-written SQL + node-pg-migrate | Phase 1 |
| P5 | BullMQ + Redis for the job queue | Phase 4 |
| P6 | Normalised data only, small `raw_meta` jsonb | Phase 1 schema |
| P7 | UTC day boundaries for daily activity | Phase 1 schema |
| P8 | Scoring formula (Section 8) | Phase 5 |
