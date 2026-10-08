# CodeCircle: Implementation Plan (v1)

> **Audience:** a coding agent implementing this repo, supervised by the owner (Kshitij).
> **Owner's rule:** the owner makes and must be able to defend every architecture decision. Do not silently change anything under **Section 2A (Decided)**. If something blocks you, write it down in `docs/decisions.md` and pick the safest option from Section 2B. Do not invent a new design.
> **Current implementation status:** Google sign-in and a responsive, data-backed profile are working. The Friends and Compare pages are still unimplemented. See the Context section below for the current architecture and verified status.

## Context

This section is the project handoff: it records the product intent, current implementation, verified integrations, known limitations, and the owner's latest priorities. Keep it current as implementation changes. The detailed architecture and requirements remain in the sections below.

### Product and decisions

- CodeCircle is a competitive-programming profile app. A signed-in user connects platform handles, sees combined progress, and will eventually be able to view friends' activity and compare profiles.
- The v1 platform set is Codeforces, LeetCode, CodeChef, and AtCoder. Feed, handle-ownership verification, mutual friend acceptance, notifications, canonical tag-to-pattern mapping, mobile apps, and cron/scheduled sync are out of scope.
- Postgres is the database; the live database is hosted on Neon. The stack uses a React + Vite + Tailwind frontend and an ESM Node/Express API with hand-written SQL, `pg`, and `node-pg-migrate`.
- Google Identity Services uses a popup/token flow: the frontend sends Google's ID token to `POST /api/auth/google`; the server verifies it, upserts the user, and issues an HTTP-only `cc_session` JWT cookie. Do not use a redirect callback URL for this flow.
- Platform data is shared by handle in `platform_accounts`; a user's private links are in `user_accounts`. Friends will be private, one-way named groups of handles and do not need CodeCircle accounts.
- No upstream handle ownership is verified in v1. Upstream platform data is public; do not fabricate fields that a platform does not provide.

### Current implementation

- Google sign-in, session restoration, protected frontend routes, sign-out, and user identity display are implemented. The user's Google identity details are stored in Neon `users`.
- The Profile page accepts platform handles, fetches platform profiles, displays the available profile data, and can restore the latest saved profile via the authenticated `GET /api/profile` endpoint.
- Authenticated `POST /api/platform-profiles/fetch` fetches supplied handles and persists platform links and snapshots in Neon. Persistence includes snapshot summaries, rating history, topic counts where available, daily activity where available, and Codeforces solved-problem rows.
- The current latest-snapshot read path also stores the normalized adapter result in `account_snapshots.raw_meta`. Review the payload size and align this with the plan's normalized-data-only storage default before scaling.
- Migrations `001` through `010` are applied to the hosted Neon database. Migration `010` expands the supported platform constraint to include CodeChef and AtCoder.
- On 2026-10-08, the signed-in user's four platform links and latest snapshots were verified in Neon. The authenticated profile endpoint returned all four profiles. Codeforces had 140 persisted distinct solved-problem rows at that verification; this count reflects that fetch and may change on a later sync.
- A previously observed Codeforces discrepancy remains unresolved: the profile page for `kshitij_21` showed 156 solved, while API submissions yielded 150 accepted submissions across 140 distinct problem keys. The adapter counts distinct accepted problem keys.
- These fetches currently happen synchronously on demand and save their results. The planned shared 15-minute cooldown, background queue/worker, retry pipeline, and stale-while-revalidate behavior are **not implemented** and are intentionally deferred until the core product works.
- Profile is the active screen. Friends and Compare currently have empty frontend pages and placeholder API routes; the friends schema and partial repository exist. Feed remains out of v1.

### Platform data coverage and limitations

| Platform | Available profile data | Known gaps |
|----------|------------------------|------------|
| Codeforces | Rating/rank, contest history, accepted distinct problems, problem tags, activity, attempted and solved counts by day | API totals can differ from the platform's displayed solved count; the adapter counts distinct accepted problems from submissions |
| LeetCode | Difficulty totals, contest rating/history, global ranking, tag counts, submission calendar and streak | Public data does not provide a per-problem solved list; calendar activity is submission counts, not distinct attempted/solved questions |
| CodeChef | Profile rating, solved count when available, contest history | Public profile data used here does not provide topic tags or daily submission activity |
| AtCoder | Rating/history, accepted distinct problems, activity via AtCoder Problems | Topic tags are unavailable; attempted/solved per-day details are derived from available submissions |

The profile heatmap combines daily submission activity for platforms that expose it, using UTC dates. Topic counts can overlap because one solved problem may have multiple tags. Missing data should remain unavailable/null rather than be guessed.

### Today's implementation priority

Build a working product before adding refresh optimizations. Prioritize the end-to-end user flows: persist and display the user's data, implement friend management and friend activity, and then implement profile comparison. Move the 15-minute refresh cooldown, shared refresh gate, queues/workers, retries, and related concurrency/staleness optimization to the **final hardening/optimization phase**. The cooldown remains a desired eventual behavior; it is deferred, not removed.

### Validation and working conventions

- Recent validation passed: server ESLint, focused frontend ESLint, frontend production build, authenticated profile endpoint smoke test, and direct checks of the hosted Neon rows.
- Be careful with this repository's dirty worktree: inspect the exact files to stage. Never stage `.env` or secrets. Do not push until the owner explicitly says to push the day's work.
- Preserve the existing UI appearance unless the owner asks for a visual redesign. Frontend values are displayed as integers.
- The owner wants to review and understand architecture decisions. Ask rather than silently changing open decisions in Section 2C.

---

## 1. Product summary

CodeCircle aggregates a person's competitive-programming stats from several platforms, turns them into a tag-based skill score, and lets them quietly compare themselves with friends to see how consistent and how strong those friends are.

**v1 screens:** Login, Profile (dashboard), Friends, Compare. **Feed is cut from v1.**
**v1 platforms:** Codeforces, LeetCode, CodeChef, and AtCoder (each behind a common adapter).
CodeChef profile statistics and contest history come from its public profile page. AtCoder contest history comes from AtCoder, while submissions come from the AtCoder Problems API. Topic tags are not currently available for CodeChef or AtCoder; CodeChef does not expose submission activity in its public profile data. The profile activity heatmap combines available platform submissions by UTC day and offers the current calendar year or trailing 365 days.

**Design philosophy:** do no work nobody asked for. No cron. Data is stored once per handle and shared. When an upstream platform is down, serve old data instead of failing.

### Out of scope for v1
Feed page, handle ownership verification, mutual friendships/acceptance, notifications, any cron/scheduled refresh, tag-to-pattern canonical mapping, percentile "top X%" badge, mobile app.

---

## 2. Decisions

### 2A. DECIDED by the owner (do not change)

| # | Decision | Reason (owner's words, condensed) |
|---|----------|-----------------------------------|
| D1 | **Postgres** is the database. | Owner is learning Postgres; data is relational. |
| D2 | **Refresh is on-demand only. No cron anywhere.** | Reduces load on us and on the platforms we fetch from. |
| D3 | The user's own **Refresh button eventually has a cooldown of at least 15 minutes. Implementation is deferred to final hardening/optimization, after the core product flows work.** | Avoid delaying a working product for an optimization; still limit upstream load when the refresh pipeline is built. |
| D4 | **Friends are one-way.** You add a friend and can keep viewing them. No acceptance flow. May become mutual later. | People don't publicly compare themselves; purpose is to see how consistent/strong a friend is. |
| D5 | **A friend does not need a CodeCircle account.** The user creates a friend by entering a **name** and then **all that friend's handles**. | No app-based dependency. |
| D6 | **A "friend" = one name grouping several platform handles.** The friend view must show **how many questions they attempt per day**. | Owner's stated use case. |
| D7 | **Freshness for friends' data = stale-while-revalidate.** Show the last stored snapshot instantly; if it is stale, trigger a background refresh. | Best UX, no wasted work. |
| D8 | **Failed platform fetch is retried automatically (by the app). The failed attempt STILL consumes the cooldown.** | Prevents hammering a failing upstream. |
| D9 | **Availability over consistency.** If one platform fails, keep its previous snapshot, mark it stale, and keep the rest of the app working (graceful degradation). | User can still use other features. |
| D10 | **Score = tag-based technical score, plus contest performance as an optional add-on the user opts into.** | Pattern recognition + problems per pattern show technical ability. |
| D11 | **Apple-to-apple comparison.** A platform where a user has no data contributes **0** to the composite. Platforms' own published tiers are used to normalise contest ratings. A difficulty weight is applied to solved problems. | Fair per-platform comparison. |
| D12 | **v1 compares by raw platform tags.** Mapping tags to canonical "patterns" is a later task. | Defer complexity. |
| D13 | **No handle-ownership verification in v1.** Friend handles can never be verified anyway. Add a nullable `verified_at` column now as a v2 hook. | Fake handles are the faker's problem. |
| D14 | **Feed is cut from v1.** | Scope. |

### 2B. DEFAULTS chosen by this plan (the owner has NOT confirmed these; use them, but record them in `docs/decisions.md` as "default, pending owner confirmation")

| # | Default | Alternative |
|---|---------|-------------|
| P1 | **Shared data per handle** (`platform_accounts` stored once; users keep private lists pointing to it). | Per-user copies. Rejected: duplicates upstream fetches and breaks the cooldown. |
| P2 | `STALE_AFTER_MINUTES = 360` (6 h) for friend data. Stats move slowly. | Shorter, e.g. 60. Configurable by env. |
| P3 | **Deferred optimization:** one shared refresh gate per `platform_accounts` row (cooldown 15 min), used by both manual and automatic refreshes. Implement in final hardening, after core product flows. | Separate rules per trigger. |
| P4 | **JavaScript (ESM)** with JSDoc types, `pg` + hand-written SQL + `node-pg-migrate`. No ORM. | TypeScript/Drizzle. Owner wants to practise SQL, so raw SQL stays. |
| P5 | **BullMQ + Redis** for the job queue. | `pg-boss` (Postgres-only queue, one fewer service). Keep queue code behind `queue/` so it can be swapped. |
| P6 | Store **normalized data only** (no raw API payloads). Small `raw_meta` jsonb for debugging. | Store raw payloads. Rejected: large, and not needed. |
| P7 | Day boundaries in **UTC** for daily activity. | User timezone later. |
| P8 | Scoring formula in Section 8 (a proposal; the owner will finalise it later). All constants live in one config file. | Any other formula. |

### 2C. STILL OPEN (do not decide; build so each is easy to change)
1. Final scoring formula and weights (Section 8).
2. How LeetCode Easy/Medium/Hard map onto Codeforces-style numeric difficulty.
3. Tag to pattern mapping.
4. Whether the composite should penalise users with fewer connected platforms.
5. Final staleness threshold.

---

## 3. Architecture

Two processes from one codebase: **api** (HTTP) and **worker** (jobs). Config flag `WORKER_MODE=separate|inline` lets the worker run inside the API process for free hosting tiers.

```
 Browser (React)
     |  same-origin /api/*  (Vercel rewrite -> backend, so cookies are first-party)
     v
 API (Express)  -- reads --> Postgres  (users, accounts, snapshots, activity ...)
     |
     |  user clicks Refresh / views a stale friend
     v
 REFRESH GATE (one atomic SQL UPDATE)
     |  allowed? --no--> skip (someone already refreshed within 15 min)
     |  yes
     v
 Queue (BullMQ on Redis), one queue per platform, rate limited
     |
     v
 Worker -> Platform adapter -> upstream API (Codeforces / LeetCode / CodeChef / AtCoder)
     |            on failure: retry with backoff (3 attempts)
     v
 Normalize -> Score (pure function) -> write snapshot, tag stats, daily activity
     |                              -> update platform_accounts status
     v
 Frontend polls status endpoint until idle -> re-fetches profile
```

### Layering (enforce)
`routes` (URL + validation) -> `controllers` (HTTP in/out) -> `services` (business rules) -> `repositories` (SQL only). No SQL outside repositories. No HTTP objects inside services.

### Repo layout (backend)
```
server/
  src/
    app.js                 # builds the express app (no listen) - used by tests
    server.js              # API entrypoint
    worker.js              # worker entrypoint
    config/env.js          # zod-validated env, fail fast on boot
    config/scoring.js      # ALL scoring constants
    db/pool.js
    db/migrations/         # node-pg-migrate files (SQL)
    repositories/          # users, platformAccounts, snapshots, friends, activity ...
    services/              # auth, account, refresh, profile, friend, compare, verdict
    controllers/
    routes/
    adapters/              # codeforces.js, leetcode.js, index.js, types.js
    scoring/               # skill.js, contest.js, index.js (pure functions)
    queue/                 # queues.js, processors.js
    middleware/            # auth, error, rateLimit, validate, requestId
    lib/                   # logger (pino), httpClient (timeout + UA), time helpers
  test/                    # unit, integration, fixtures
docs/                      # decisions.md, architecture.md, query-notes.md
```

---

## 4. Environment variables

| Name | Default | Notes |
|------|---------|-------|
| `NODE_ENV` | development | |
| `PORT` | 3000 | |
| `DATABASE_URL` | | Postgres |
| `REDIS_URL` | | BullMQ + rate limiter |
| `JWT_SECRET` | | min 32 chars |
| `GOOGLE_CLIENT_ID` | | audience for ID token verification |
| `CORS_ORIGIN` | http://localhost:5173 | dev only; prod is same-origin |
| `REFRESH_COOLDOWN_MINUTES` | 15 | D3 |
| `STALE_AFTER_MINUTES` | 360 | P2 |
| `SYNC_JOB_ATTEMPTS` | 3 | D8 |
| `STUCK_JOB_MINUTES` | 10 | watchdog, see 7.4 |
| `MAX_FRIENDS_PER_USER` | 50 | |
| `WORKER_MODE` | separate | `inline` runs worker inside API |
| `ANTHROPIC_API_KEY` | | only for verdicts (Phase 8) |

Validate all with zod in `config/env.js`; crash on boot if invalid.

---

## 5. Database schema (Postgres 16)

Write as migrations with `node-pg-migrate` (plain SQL). Timestamps are `timestamptz`. IDs are `uuid` (`gen_random_uuid()`) except high-volume tables.

```sql
-- 001_users
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub       text NOT NULL UNIQUE,
  email            text NOT NULL,
  name             text NOT NULL,
  avatar_url       text,
  include_contests boolean NOT NULL DEFAULT false,   -- D10 opt-in
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_login_at    timestamptz NOT NULL DEFAULT now()
);

-- 002_platform_accounts  (one row per platform handle, shared by everyone, P1)
CREATE TABLE platform_accounts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform                text NOT NULL CHECK (platform IN ('codeforces','leetcode')),
  handle                  text NOT NULL,        -- canonical: lower-cased, trimmed
  display_handle          text NOT NULL,        -- as the platform returns it; USE THIS for upstream calls
  status                  text NOT NULL DEFAULT 'idle'
                          CHECK (status IN ('idle','queued','fetching','failed')),
  status_updated_at       timestamptz NOT NULL DEFAULT now(),
  next_refresh_allowed_at timestamptz NOT NULL DEFAULT now(),   -- the gate (D3, D8)
  last_attempt_at         timestamptz,
  last_synced_at          timestamptz,          -- last SUCCESSFUL sync
  consecutive_failures    int NOT NULL DEFAULT 0,
  last_error              text,
  latest_snapshot_id      bigint,               -- FK added below (denormalised for O(1) reads)
  verified_at             timestamptz,          -- D13 v2 hook, unused in v1
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

-- 003_snapshots  (time series of summary stats; one row per successful sync)
CREATE TABLE account_snapshots (
  id                  bigserial PRIMARY KEY,
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  rating              int,                      -- contest rating, null if never rated
  max_rating          int,
  rank_title          text,                     -- e.g. 'expert', 'knight'
  contests_count      int NOT NULL DEFAULT 0,
  problems_solved     int NOT NULL DEFAULT 0,
  solved_by_bucket    jsonb,                    -- {"easy":n,"medium":n,"hard":n} (LC) or rating bands (CF)
  skill_score         numeric(5,2),             -- 0..100, see Section 8
  contest_score       numeric(5,2),             -- 0..100 or null
  score_version       smallint NOT NULL,        -- bump when the formula changes
  raw_meta            jsonb
);
CREATE INDEX idx_snapshots_account_time ON account_snapshots (platform_account_id, fetched_at DESC);
ALTER TABLE platform_accounts
  ADD CONSTRAINT fk_latest_snapshot FOREIGN KEY (latest_snapshot_id)
  REFERENCES account_snapshots(id) ON DELETE SET NULL;

-- 004_tag_stats  (per snapshot, per tag; same shape for CF and LC)
CREATE TABLE snapshot_tag_stats (
  snapshot_id     bigint NOT NULL REFERENCES account_snapshots(id) ON DELETE CASCADE,
  tag             text   NOT NULL,              -- raw platform tag, lower-cased slug (D12)
  solved_count    int    NOT NULL,
  weighted_points numeric(10,2) NOT NULL,       -- difficulty-weighted, see Section 8
  PRIMARY KEY (snapshot_id, tag)
);

-- 005_solved_problems  (Codeforces only: per-problem data is available)
CREATE TABLE solved_problems (
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  problem_key         text NOT NULL,            -- 'cf:1700:A'
  name                text NOT NULL,
  difficulty_rating   int,                      -- null if unrated
  tags                text[] NOT NULL DEFAULT '{}',
  first_solved_at     timestamptz NOT NULL,
  PRIMARY KEY (platform_account_id, problem_key)
);
CREATE INDEX idx_solved_tags ON solved_problems USING gin (tags);

-- 006_daily_activity  (powers "questions attempted per day" + heatmap, D6)
CREATE TABLE daily_activity (
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  day                 date NOT NULL,            -- UTC (P7)
  submissions         int NOT NULL DEFAULT 0,
  problems_attempted  int,                      -- distinct problems with >=1 submission; NULL if the platform can't tell us
  problems_solved     int,                      -- distinct problems first-accepted that day; NULL if unknown
  PRIMARY KEY (platform_account_id, day)
);

-- 007_rating_history  (contest rating chart)
CREATE TABLE rating_history (
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  contest_id          text NOT NULL,
  contest_name        text NOT NULL,
  rated_at            timestamptz NOT NULL,
  old_rating          int,
  new_rating          int NOT NULL,
  contest_rank        int,
  PRIMARY KEY (platform_account_id, contest_id)
);
CREATE INDEX idx_rating_hist_time ON rating_history (platform_account_id, rated_at);

-- 008_user_lists  (private lists pointing at the shared accounts)
CREATE TABLE user_accounts (                    -- the user's OWN handles
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            text NOT NULL,
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
  PRIMARY KEY (user_id, platform)               -- one handle per platform per user
);

CREATE TABLE friends (                          -- D4/D5/D6: private to the owner
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, display_name)
);
CREATE INDEX idx_friends_owner ON friends (owner_user_id);

CREATE TABLE friend_handles (
  friend_id           uuid NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  platform            text NOT NULL,
  platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
  PRIMARY KEY (friend_id, platform)             -- one handle per platform per friend
);

-- 009_verdicts  (cache for LLM comparison text, Phase 8)
CREATE TABLE comparison_verdicts (
  cache_key   text PRIMARY KEY,                 -- sha256(sorted snapshot ids + include_contests + prompt_version)
  verdict     text NOT NULL,
  model       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**Why there is no `follows` table:** friends are private entries owned by one user (D4/D5), so follow = a row in `friends`. If a friend later signs up, their user links their own handles to the same `platform_accounts` rows, so nothing needs merging.

**Normalising handles:** `handle = lower(trim(input))`. Reject anything not matching `^[A-Za-z0-9_.-]{1,40}$`. Always use `display_handle` for upstream calls (LeetCode may be case-sensitive; verify during Phase 3).

---

## 6. Platform adapters

Common interface (`adapters/types.js`, JSDoc):

```js
/**
 * @typedef {Object} NormalizedSync
 * @property {{rating:number|null,maxRating:number|null,rankTitle:string|null,contestsCount:number,problemsSolved:number,solvedByBucket:object|null}} profile
 * @property {Array<{contestId:string,contestName:string,ratedAt:Date,oldRating:number|null,newRating:number,rank:number|null}>} ratingHistory
 * @property {Array<{problemKey:string,name:string,difficultyRating:number|null,tags:string[],firstSolvedAt:Date}>|null} solvedProblems  // null if platform can't provide per-problem data
 * @property {Array<{tag:string,solved:number}>|null} tagAggregates                                                        // used when solvedProblems is null
 * @property {Array<{day:string,submissions:number,attempted:number|null,solved:number|null}>} daily
 */
// Every adapter exports:
//   platform: 'codeforces' | 'leetcode'
//   validateHandle(handle): string                     // throws ValidationError
//   fetchPreview(displayHandle): Promise<{exists:boolean,displayHandle:string,rating:number|null,rankTitle:string|null,avatarUrl:string|null}>
//   sync(displayHandle, { sinceTs }): Promise<NormalizedSync>
```

Errors must be typed: `NotFoundError` (handle doesn't exist, do not retry), `UpstreamError` (5xx/timeouts/rate limit, retry), `ParseError` (shape changed, do not retry, log loudly).

### 6.1 Codeforces (refactor existing `codeforcesService.js`)
Public API: `user.info?handles=`, `user.rating?handle=`, `user.status?handle=&from=&count=`.
- **Hard limit: 1 request / 2 seconds per IP.** Enforce with the queue limiter (Section 7.3) plus a small in-process delay between pages.
- First sync: page `user.status` with `count=1000`, increasing `from`, until a short page. Later syncs: incremental, newest first (the API returns newest first); only fetch submissions with `creationTimeSeconds >= startOfUtcDay(last_synced_at) - 1 day` so partially counted days are rebuilt completely.
- A submission counts as solved if `verdict === "OK"`. Dedupe by problem key `cf:{contestId}:{index}`; `first_solved_at` = earliest OK submission.
- Problem difficulty = `problem.rating` (may be missing -> `null`); tags = `problem.tags`.
- `daily`: group ALL submissions by UTC day -> `submissions`, `attempted` = distinct problems, `solved` = distinct problems first-solved that day.
- `ratingHistory` from `user.rating`.
- `profile.problemsSolved` = distinct OK problems (include all synced history).

### 6.2 LeetCode (new; unofficial GraphQL at `https://leetcode.com/graphql`)
No auth. The API is unofficial and can change, so: keep every query string in one file, add fixtures + contract tests, and degrade gracefully (D9). **Verify field names against the live schema before coding.** Expected useful queries:
- `matchedUser(username)` -> `profile { ranking }`, `submitStats.acSubmissionNum [{difficulty,count}]`, `tagProblemCounts { advanced|intermediate|fundamental { tagName tagSlug problemsSolved } }`, `submissionCalendar` (JSON string: unix day -> submission count, last year).
- `userContestRanking(username)` -> `rating`, `attendedContestsCount`, `globalRanking`, `topPercentage`.
- `userContestRankingHistory(username)` -> per-contest rating history.

Limits you must handle:
- LeetCode gives **no per-problem solved list** without auth, so `solvedProblems = null` and `tagAggregates` is filled from `tagProblemCounts`. Tag points use the user's Easy/Medium/Hard mix (Section 8.2).
- `daily` comes from `submissionCalendar`: set `submissions`; `attempted` and `solved` are **null** (UI shows submissions only for LeetCode days).
- Treat a missing user or null `matchedUser` as `NotFoundError`.

### 6.3 HTTP client rules (`lib/httpClient.js`)
10 s timeout, a descriptive `User-Agent`, max response size, no redirects to other hosts, log upstream status + duration.

---

## 7. Refresh pipeline (deferred optimization)

This section describes the eventual refresh architecture, not a prerequisite for making the v1 product usable. The owner explicitly moved the 15-minute cooldown, queues/workers, automatic retries, and associated concurrency/staleness work to final hardening. Until then, prioritize the working profile, friends, and comparison flows; do not block those flows on this optimization.

### 7.1 State machine (per `platform_accounts` row)
```
idle --(gate opens, job enqueued)--> queued --(worker picks)--> fetching
fetching --success--> idle  (last_synced_at = now, failures = 0, new snapshot)
fetching --attempt fails--> (BullMQ retries; status stays 'fetching'/'queued')
fetching --all attempts fail--> failed (old snapshot kept, last_error set)
failed / idle --(gate opens again)--> queued
```
Stale display rule: `stale = last_synced_at IS NULL OR now() - last_synced_at > STALE_AFTER_MINUTES`.

### 7.2 The refresh gate (the thundering-herd answer; D2, D3, D8, P3)
One atomic statement decides whether a refresh may start. Cooldown is stored **on the account**, so 50 people viewing the same friend cause at most one fetch per window.

```sql
UPDATE platform_accounts
SET next_refresh_allowed_at = now() + make_interval(mins => $2),   -- consumed even if the fetch later fails (D8)
    status = 'queued', status_updated_at = now(), last_attempt_at = now()
WHERE id = $1
  AND next_refresh_allowed_at <= now()
  AND (status NOT IN ('queued','fetching')
       OR status_updated_at < now() - make_interval(mins => $3))     -- watchdog: ignore stuck states (7.4)
RETURNING id;
```
- Row returned -> enqueue the job. No row -> skip silently (already fresh, queued or cooling down).
- If the enqueue call to Redis throws, run a compensating `UPDATE` that sets `status='idle'` and `next_refresh_allowed_at = now()`, then rethrow.
- Job id = `sync:{accountId}` so a duplicate job can never exist.

### 7.3 Queue and worker
- BullMQ, **one queue per platform**: `sync-codeforces`, `sync-leetcode`.
- Worker limiter: Codeforces `{ max: 1, duration: 2000 }`; LeetCode `{ max: 2, duration: 1000 }` (tune).
- Job options: `attempts: SYNC_JOB_ATTEMPTS (3)`, custom backoff delays 5 s, 30 s, 2 min. `removeOnComplete: true`, `removeOnFail: 100`.
- Processor steps:
  1. Set `status='fetching'`.
  2. `adapter.sync(display_handle, { sinceTs })`.
  3. Compute scores (Section 8).
  4. **One DB transaction:** upsert `solved_problems` (`ON CONFLICT DO NOTHING`), replace `daily_activity` rows for the affected days, upsert `rating_history`, insert `account_snapshots` + `snapshot_tag_stats`, then update the account (`latest_snapshot_id`, `last_synced_at=now()`, `status='idle'`, `consecutive_failures=0`, `last_error=NULL`).
  5. On final failure (all attempts used): `status='failed'`, `consecutive_failures+1`, `last_error`. Keep the old snapshot. `NotFoundError` / `ParseError` fail immediately without retry.
- Do NOT reset `next_refresh_allowed_at` on failure (D8).

### 7.4 Stuck-job watchdog (no cron)
A crashed worker could leave `queued/fetching` forever. The gate query (7.2) already treats a state older than `STUCK_JOB_MINUTES` as stale, so the next request just re-opens it. No scheduled job is needed.

### 7.5 Triggers
| Trigger | Behaviour |
|---------|-----------|
| `POST /api/profile/refresh` (own handles) | Run the gate for each of the user's accounts. Return `{ started: [...], skipped: [{platform, retryAfter}] }`. The button is disabled only when every account is gated. |
| `GET /api/friends/:id` and `GET /api/compare` | Return the stored snapshots immediately. For each account where `stale`, run the gate and enqueue if allowed (D7). Never block the response on a fetch. |
| Adding a handle (own or friend) | After the user confirms the preview, create the account row, run the gate, enqueue the first sync. |

### 7.6 Frontend polling
While any account in the response has `status` in (`queued`, `fetching`), poll the same endpoint every 3 s (max ~90 s), then stop. Show "updating..." per platform and "updated 3h ago" from `last_synced_at`.

---

## 8. Scoring engine (proposal P8; pure functions, no I/O)

All constants in `config/scoring.js`. Functions take plain objects and return numbers, which makes them unit-testable. Every stored score carries `score_version`.

### 8.1 Idea
Technical ability = how well you know each **tag** (pattern), which depends on **how many problems** you solved in it and **how hard** they were. Early problems in a tag help a lot; the 500th easy one helps little (diminishing returns).

### 8.2 Per-tag points
```
weight(r)        = (clamp(r, 800, 3500) / 800) ^ 2          // 800->1.0, 1200->2.25, 1600->4, 2000->6.25, 2400->9
CF problem       : r = problem.rating ?? 1200 (unrated default)
LC difficulty    : Easy r=900, Medium r=1500, Hard r=2100    // OPEN decision 2, tunable

points[tag]      = sum over solved problems with that tag of weight(r)
```
LeetCode only provides per-tag counts, not per-problem difficulty, so approximate with the user's overall mix:
```
avgWeight   = (easy*w(900) + medium*w(1500) + hard*w(2100)) / (easy + medium + hard)
points[tag] = solved_in_tag * avgWeight
```
Document this approximation in the UI tooltip and README.

### 8.3 Mastery per tag, then skill score
```
mastery[tag] = 100 * (1 - exp(-points[tag] / S))            // S = 150, saturating curve, 0..100

skill_score  = sum(importance[t] * mastery[t] for t in CORE_TAGS[platform]) / sum(importance[t])
```
- `CORE_TAGS` per platform is a config list of about 12 tags with `importance` default 1. A missing tag counts as 0, so breadth matters automatically.
  - Codeforces: `greedy, dp, math, implementation, constructive algorithms, binary search, graphs, trees, dfs and similar, data structures, strings, two pointers`
  - LeetCode (slugs): `array, string, hash-table, dynamic-programming, math, greedy, sorting, binary-search, tree, depth-first-search, graph, two-pointers` (verify slugs against the live API)
- Sanity targets for the unit tests: 30 problems at rating 1200 in one tag gives mastery of about 36; 100 problems at 1600 gives about 93; 10 problems at 800 gives about 6.

### 8.4 Optional contest score (D10, user opt-in via `users.include_contests`)
Map rating to 0..100 with **piecewise-linear interpolation** over per-platform tier anchors (placeholders, tune later):
```
CF anchors: (800,0) (1200,15) (1400,30) (1600,45) (1900,65) (2100,78) (2400,90) (3000,100)
LC anchors: (1200,0) (1500,20) (1700,40) (1850,60) (2150,85) (2500,100)
contest_score = null if the user has no contest rating on that platform
```
These follow the platforms' own published rank tiers (Codeforces rank colours, LeetCode Knight/Guardian thresholds).

### 8.5 Per-platform final score and composite (D11)
```
platform_score = includeContests && contest_score != null
                   ? 0.7*skill_score + 0.3*contest_score
                   : skill_score
composite      = mean(platform_score over [codeforces, leetcode]), missing platform = 0   // decided rule D11
```
Flag in the UI whenever a platform is missing so a 0 isn't read as "bad". The "top X%" badge from the mock UI is removed in v1 (no population to rank against).

### 8.6 Derived insights (deterministic, no LLM)
- **Consistency** (from `daily_activity`, summed across a friend's handles): active days in last 30 and 90 days, current streak, problems per week for the last 12 weeks.
- **Gap analysis** for Compare: for each core tag where the friend's mastery is higher, `pointsNeeded = -S * ln(1 - friendMastery/100) - myPoints`, then `problemsNeeded ~ ceil(pointsNeeded / weight(myMedianSolvedRating))`. Show the top 5 gaps ("to match Rahul in DP you need about 18 more problems at your level"). This serves the owner's goal of knowing the work needed to match a friend.

### 8.7 Tests (required)
Boundary cases (0 problems, one tag only, unrated problems, LC approximation), monotonicity (more/harder problems never lowers the score), interpolation anchors, composite with a missing platform, and a snapshot test pinned to `score_version`.

---

## 9. API specification

Base `/api`. JSON only. Errors: `{ "error": { "code": "STRING", "message": "human readable" } }` with proper status codes (400 validation, 401, 403, 404, 409, 429, 502). Validate every body/query/param with zod. Authenticated routes use `requireAuth` (JWT in the httpOnly cookie `cc_session`).

### Auth
| Method + path | Body | Behaviour |
|---------------|------|-----------|
| `POST /auth/google` | `{ idToken }` | Verify with `google-auth-library` (`audience = GOOGLE_CLIENT_ID`). Upsert user by `sub`. Issue JWT (HS256, 7 d) in cookie: `httpOnly; Secure (prod); SameSite=Lax; Path=/`. Returns the user. |
| `POST /auth/logout` | | Clear cookie. |
| `GET /me` | | Current user + their connected accounts. |
| `PATCH /me/settings` | `{ includeContests: boolean }` | D10 toggle. |

Delete the sketched Passport-style `/auth/google/callback` routes. The frontend uses Google Identity Services (`@react-oauth/google`'s `GoogleLogin`) to get the ID token and sends it to `/auth/google`.

### Own handles
| Method + path | Behaviour |
|---------------|-----------|
| `POST /accounts/preview` `{ platform, handle }` | Validate, call `adapter.fetchPreview`, return `{ exists, displayHandle, rating, rankTitle, avatarUrl }`. Cache 10 min in Redis. Rate limit 20/min/user. Does not write to the DB. |
| `PUT /me/accounts/:platform` `{ handle }` | Upsert `platform_accounts`, link in `user_accounts`, run the gate, enqueue first sync. |
| `DELETE /me/accounts/:platform` | Remove the link only. Never delete the shared account row. |

### Profile
| Method + path | Behaviour |
|---------------|-----------|
| `GET /profile` | Aggregated dashboard payload: per-platform latest snapshot (stats, scores), composite, tag mastery bars, platform contribution, 365-day activity, consistency block, per-account freshness (`status`, `lastSyncedAt`, `stale`, `refreshAllowedAt`, `lastError`). |
| `GET /profile/rating-history?range=1M\|3M\|6M\|12M\|ALL` | From `rating_history`. |
| `POST /profile/refresh` | See 7.5. |

### Friends
| Method + path | Behaviour |
|---------------|-----------|
| `GET /friends` | List with name, platforms, latest scores, freshness. Avoid N+1: one query joining `friends`, `friend_handles`, `platform_accounts`, `account_snapshots` via `latest_snapshot_id`. |
| `POST /friends` `{ displayName, handles: [{platform, handle}] }` | Max `MAX_FRIENDS_PER_USER`, 1 handle per platform, 409 on duplicate name. Upsert accounts, enqueue first syncs through the gate. |
| `PATCH /friends/:id` | Rename; add/remove handles. |
| `DELETE /friends/:id` | Delete the friend and their handle links only. |
| `GET /friends/:id` | Stored snapshots + tag mastery + consistency block. Triggers stale-while-revalidate (7.5). Only the owner may read (check `owner_user_id`). |
| `GET /friends/:id/activity?days=90` | Daily series summed across the friend's handles: `{ day, submissions, attempted, solved }`. Where a platform returns null for attempted/solved, report those fields as null for that platform's contribution and include `partial: true`. |

### Compare
| Method + path | Behaviour |
|---------------|-----------|
| `GET /compare?friendId=&includeContests=` | Side by side **per platform** (apple to apple): stats, skill/contest/platform scores, tag mastery for the union of core tags, composite (missing = 0, flagged), consistency for both, gap analysis (8.6). Same stale-while-revalidate behaviour for both sides. `includeContests` defaults to the user's setting. |
| `GET /compare/verdict?friendId=` | Phase 8. Cache-first LLM text (Section 11). |

### Ops
`GET /healthz` (process up), `GET /readyz` (Postgres + Redis ping).

### Rate limiting (inbound)
`express-rate-limit` with a Redis store: 100 req/min/IP global, 10/min on `/auth/*`, 20/min on `/accounts/preview`. Also set `helmet`, JSON body limit 100 kb, and `trust proxy` correctly for the host.

---

## 10. Frontend plan

Keep the existing look. Do not redesign.
- Add **TanStack Query** for data + polling, **react-router** guard (`/` login redirects to `/profile` when authenticated, others redirect to `/` when not).
- **Remove the Feed route and nav link.** Delete the superseded prototype components (`RatingChart`, `HeatMap`, `ProgressBar`, `PlatformDonuts`, `StatsDiagramBox`, `StatsBox`, `InputComponent`) only after confirming by search that nothing imports them.
- **LoginPage:** wire `GoogleLogin` -> `POST /auth/google` -> redirect. Logout in NavBar calls `/auth/logout`.
- **ProfilePage:** replace every mock with `GET /profile`. Keep all current widgets (header, handles inputs with preview-and-confirm, stats row, donut, topic bars, heatmap, rating chart with range selector, insight card). Refresh button: disabled with a live countdown from `refreshAllowedAt`; per-platform freshness badge ("updated 3h ago", "stale", "failed, showing old data"); "include contests" toggle. Replace the "top X%" badge with the score.
- **FriendsPage:** list of friend cards; "Add friend" modal: name, then one row per platform handle with a **preview** step ("Is this who you meant?" shows handle, rating, avatar from `/accounts/preview`); detail panel with the daily attempted/solved chart (bar chart, 90 days), consistency numbers, tag bars. Show "submissions only" for LeetCode days.
- **ComparePage:** pick a friend; per-platform columns; tag mastery grouped bars (Recharts); gap-analysis list; consistency comparison; composite with a banner when a platform is missing; contests toggle; verdict card (Phase 8).
- UX: skeleton loaders, empty states, error toasts using the API's error codes, never block on a refresh.
- Env: `VITE_GOOGLE_CLIENT_ID`. In production call `/api/*` same-origin through the Vercel rewrite.

---

## 11. LLM verdict (Phase 8, last)

- Input to the model: only structured numbers (scores, tag mastery, consistency, top gaps). Never raw user text.
- Prompt returns 3 short paragraphs: where you lead, where the friend leads, what to practise next. Version the prompt (`PROMPT_VERSION`).
- Cache key = `sha256(sorted snapshot ids + includeContests + PROMPT_VERSION)` in `comparison_verdicts`. Regenerate only when snapshots change.
- Rate limit 10/hour/user. Model name from env. If the call fails, the Compare page still works without the card.

---

## 12. Testing and quality

- **Unit:** scoring (8.7), handle normalisation, gate SQL, adapters against recorded fixtures (`nock` or `msw`).
- **Integration (supertest + real Postgres/Redis in docker):** auth flow, friends CRUD authorisation (user B cannot read user A's friend), refresh endpoints.
- **Concurrency test (headline test):** fire 50 parallel `GET /friends/:id` for one stale friend, assert **exactly one** job is enqueued and exactly one upstream fetch is attempted.
- **Failure test:** upstream returns 500 -> status `failed`, old snapshot still served, cooldown still consumed, retry count honoured.
- **Contract tests** for each adapter so schema changes in unofficial APIs fail loudly.
- **Lint/format:** ESLint + Prettier. **Logging:** `pino` with request ids; log job start/finish/duration/attempt.
- **CI (GitHub Actions):** Postgres + Redis services, run migrations, lint, test on every push.

---

## 13. Deployment

### Confirmed hosting stack (owner decision)
| Layer | Service | Tier |
|-------|---------|------|
| Database | **Neon** (Postgres 16, serverless) | Free |
| Backend API + Worker | **Render** (Node web service) | Free |
| Frontend | **Vercel** | Free |
| Redis | **Render Redis** (or Upstash — see note below) | Free |

> **Redis note:** BullMQ polls Redis frequently. Upstash's free tier limits commands/day and
> will run out quickly. Render's free Redis instance (same platform as the API) has no
> command limit but sleeps after inactivity. Use Render Redis for now; switch to a paid
> Upstash plan if you need more reliability later.

> **Cold starts:** Render's free web service sleeps after 15 min of inactivity. The first
> request after sleep takes ~30 s. During active use or placement season, upgrade to the
> $7/month "Starter" tier to keep it always-on, or add an uptime pinger (e.g. UptimeRobot)
> hitting `/healthz` every 14 min.

---

### How the three services connect (architecture)

```
Browser (Vercel)
    |
    |  All API calls go to /api/* on the SAME Vercel domain
    |  Vercel rewrites /api/(.*)  →  https://your-render-app.onrender.com/$1
    |  Cookies are set on the Vercel domain → first-party, no CORS needed in prod
    v
Render (Node API + Worker)
    |          |
    |          └── reads/writes → Neon Postgres (DATABASE_URL)
    |          └── queues/locks → Render Redis   (REDIS_URL)
    |
    └── fetches upstream APIs (Codeforces, LeetCode, CodeChef, AtCoder) from the worker
```

The Vercel rewrite is the key. Without it:
- The frontend is on `<your Vercel project URL>` and the API is on `<your Render service URL>`
- These are different origins → the browser blocks cookies (cross-origin `httpOnly` cookies
  require `SameSite=None; Secure`, which is fragile and requires CORS config)
- With the rewrite, the browser thinks it is talking to its own domain, so cookies work
  exactly like they do in development

---

### Step-by-step setup

#### Step 1 — Neon (Postgres)

1. Go to **neon.tech** → sign up → create a new project called `codecircle`.
2. Neon creates a default database called `neondb`. Rename it to `codecircle`
   (Settings → Database → rename), or just use `neondb` — either works.
3. In the project dashboard, click **"Connection string"** → select **Node.js** →
   copy the connection string. It looks like:
   ```
   postgres://<user>:<password>@<neon-host>/<database>?sslmode=require
   ```
4. Note the `?sslmode=require` at the end — Neon requires SSL. Your `pg` pool must
   pass `ssl: { rejectUnauthorized: false }` when `NODE_ENV=production` (handled in
   Phase 1's `db/pool.js`).
5. Save this string as `DATABASE_URL` in Render's environment variables (Step 3).
6. **Branching (optional but useful):** Neon supports database branches like Git branches.
   Create a `dev` branch for local dev and keep `main` for production. This way running
   migrations locally never touches production data.

#### Step 2 — Render (Backend API)

**2a. Create the web service**
1. Go to **render.com** → sign up → New → **Web Service**.
2. Connect your GitHub repo. Set root directory to `server`.
3. Settings:
   | Field | Value |
   |-------|-------|
   | Name | `codecircle-api` |
   | Runtime | Node |
   | Build command | `npm install` |
   | Start command | `node src/server.js` |
   | Instance type | Free |

4. Under **Environment** → add every variable from `.env.example`:
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<paste Neon connection string>
   REDIS_URL=<paste Render Redis URL — get this in step 2b>
   JWT_SECRET=<generate: openssl rand -hex 32>
   GOOGLE_CLIENT_ID=<from Google Cloud Console — Phase 2>
   CORS_ORIGIN=https://your-app.vercel.app
   REFRESH_COOLDOWN_MINUTES=15
   STALE_AFTER_MINUTES=360
   SYNC_JOB_ATTEMPTS=3
   STUCK_JOB_MINUTES=10
   MAX_FRIENDS_PER_USER=50
   WORKER_MODE=inline
   ```
   > Set `WORKER_MODE=inline` on the free tier — this runs the BullMQ worker inside
   > the same process as the API so you don't need a second Render service.
   > When you upgrade to a paid tier, set it to `separate` and create a second
   > Render Background Worker service running `node src/worker.js`.

5. Under **Deploy** → add a **pre-deploy command** (Phase 1 onwards):
   ```
   npm run migrate up
   ```
   This runs migrations automatically on every deploy before the new code goes live.

**2b. Create the Redis instance**
1. Render dashboard → New → **Redis**.
2. Name it `codecircle-redis`. Free tier.
3. Copy the **Internal Redis URL** (starts with `redis://`). Use the internal URL
   (not the external one) so traffic stays within Render's network — faster and free.
4. Paste it as `REDIS_URL` in the web service's environment variables.

**2c. Get your Render URL**
Use the backend URL assigned by Render in the Vercel rewrite (`client/frontend/vercel.json`).

#### Step 3 — Vercel (Frontend)

**3a. Deploy the frontend**
1. Go to **vercel.com** → sign up → New Project → import your GitHub repo.
2. Set root directory to `client/frontend`.
3. Vercel auto-detects Vite. Build settings:
   | Field | Value |
   |-------|-------|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Output directory | `dist` |
4. Under **Environment Variables** → add:
   ```
   VITE_GOOGLE_CLIENT_ID=<same Google Client ID from Phase 2>
   ```
5. Deploy. Vercel gives you a project URL; use that URL in Google Cloud's authorised JavaScript origins.

**3b. Add the API rewrite (the critical step)**

Create `client/frontend/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_RENDER_SERVICE.onrender.com/api/:path*"
    }
  ]
}
```

This tells Vercel: any request to your Vercel project's `/api/...` path should be
silently proxied to your Render backend. The browser never knows — it thinks the API
is on the same domain.

After adding this file, redeploy on Vercel (push to main or trigger manually).

**3c. Update CORS_ORIGIN on Render**
Go back to Render → Environment → set:
```
CORS_ORIGIN=<your Vercel project URL>
```
(Even though CORS is not needed in prod for the API calls, it's good practice to set
the correct origin for the CORS middleware to use if it ever runs.)

#### Step 4 — Google OAuth (Phase 2)

When you reach Phase 2, you'll need to configure Google:
1. Go to **console.cloud.google.com** → New project → `codecircle`.
2. APIs & Services → Credentials → Create → **OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. Authorised JavaScript origins (for the frontend Google Identity button):
   ```
   http://localhost:5173
   <your Vercel project URL>
   ```
5. Authorised redirect URIs: not needed (we use the ID token flow, not the redirect flow).
6. Copy the **Client ID** → add it to:
   - Render env: `GOOGLE_CLIENT_ID=...`
   - Vercel env: `VITE_GOOGLE_CLIENT_ID=...`

#### Step 5 — Verify end-to-end

Once all three services are deployed:
```
# 1. Check the backend is alive
curl https://YOUR_RENDER_SERVICE.onrender.com/healthz
# → {"status":"ok"}

# 2. Check the Vercel rewrite is working
curl <your Vercel project URL>/api/healthz
# → same {"status":"ok"} — the rewrite is proxying correctly

# 3. Open the frontend in a browser
# → your Vercel project URL
```

---

### Local dev vs production — what changes

| Thing | Local dev | Production |
|-------|-----------|------------|
| Postgres | docker-compose `localhost:5432` | Neon `ep-xxx.neon.tech` (SSL required) |
| Redis | docker-compose `localhost:6379` | Render Redis internal URL |
| CORS | Enabled (`localhost:5173`) | Disabled (same-origin via Vercel rewrite) |
| Worker | Runs inline or separate process | `WORKER_MODE=inline` on free Render |
| Cookies | `SameSite=Lax`, no `Secure` flag | `SameSite=Lax`, `Secure` (HTTPS) |
| Frontend API calls | `http://localhost:3000/api/...` | `/api/...` (Vercel proxies to Render) |

The frontend should never hardcode `http://localhost:3000`. Instead, use a relative path
`/api/...` everywhere — it works in both local dev (Vite proxies it in `vite.config.js`)
and production (Vercel proxies it via `vercel.json`).

Add this to `client/frontend/vite.config.js` (Phase 2):
```js
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

---

### Files to create (when reached)
| File | Phase | Purpose |
|------|-------|---------|
| `server/Dockerfile` | Phase 9 | Multi-stage build, non-root user, for Render deploy |
| `client/frontend/vercel.json` | Phase 2 | API rewrite to Render |
| `server/src/db/pool.js` | Phase 1 | pg Pool with SSL for Neon |
| `scripts/seed.js` | Phase 9 | Demo account with preloaded public handles |

---

## 14. Build order and acceptance criteria

Deploy a skeleton after Phase 2, not at the end.

| Phase | Work | Done when |
|-------|------|-----------|
| 0 | Repo hygiene: app factory, env validation, docker-compose, lint, CI skeleton, `/healthz`, remove broken placeholder routes and Feed | `npm run dev` boots api + worker; CI green |
| 1 | Migrations (Section 5), repositories, seed script | Schema applies on a fresh DB; repository tests pass |
| 2 | Auth (Google ID token -> JWT cookie), `/me`, settings, frontend login wiring, **first deploy** | A real Google login works on the hosted URL |
| 3 | Adapters: Codeforces, LeetCode, CodeChef, and AtCoder, fixtures, contract tests | Supported adapters return normalized data; errors typed |
| 4 | Working profile flow: fetch platform data on demand, persist snapshots, restore saved profile | A signed-in user can fetch data and reload it from Neon |
| 5 | Scoring engine + tests; tag stats written on each sync | Section 8.7 tests pass; scores stored with `score_version` |
| 6 | Complete Profile API and wire ProfilePage to saved data | No mock data remains on Profile; persistence and reload are covered |
| 7 | Friends API + FriendsPage (add/edit/remove handles, activity view) | A user can manage a friend and inspect supported activity |
| 8 | Compare API + ComparePage + gap analysis; then optional LLM verdict | Compare works for a friend with only one platform; verdict is cached if implemented |
| 9 | Final hardening/optimization: 15-minute cooldown, shared refresh gate, queues/workers, retries, stale-while-revalidate, rate limits, error pages, logging, README, query notes | Core product flows work first; refresh concurrency/failure tests pass before release |

### Query optimisation notes (owner is practising Postgres; do this in Phase 9)
In `docs/query-notes.md`, record for each of these: the query, the index it uses, and `EXPLAIN (ANALYZE, BUFFERS)` output on a seeded dataset (e.g., 10k users, 100 snapshots each):
1. Friend list with latest scores (join through `latest_snapshot_id`; compare against a `DISTINCT ON` alternative).
2. Daily activity range for 90 days (PK range scan).
3. Rating history by range (`idx_rating_hist_time`).
4. Tag aggregation from `solved_problems` using the GIN index on `tags`.

---

## 15. Rules for the agent
1. Never change Section 2A. Anything in 2B is a default: implement it, but keep it easy to change and log it in `docs/decisions.md` with a one-line reason.
2. Keep all scoring constants in `config/scoring.js`. No magic numbers elsewhere.
3. No cron, no `setInterval` refresh loops, no scheduled jobs, ever (D2).
4. The gate and queue are the eventual refresh design in Section 7. They are deliberately deferred until final hardening; do not add the 15-minute cooldown as a blocker to the core product flows.
5. Every platform failure must degrade gracefully (D9): the page loads with old data and a warning.
6. Unofficial APIs (LeetCode, and scraping-style sources) change without notice: isolate, fixture, and contract-test them.
7. Write small commits per task; each phase ends with passing tests and a short note in `docs/decisions.md`.
8. Ask the owner (do not guess) about anything in 2C.
