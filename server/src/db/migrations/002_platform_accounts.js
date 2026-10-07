// 002_platform_accounts
// One row per (platform, handle) — shared across all users (plan P1).
// handle: canonical lower-cased for deduplication
// display_handle: original casing — always use this for upstream API calls
// latest_snapshot_id FK is added in migration 003 (snapshots table must exist first)

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE platform_accounts (
      id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      platform                text        NOT NULL
                              CHECK (platform IN ('codeforces', 'leetcode')),
      handle                  text        NOT NULL,
      display_handle          text        NOT NULL,
      status                  text        NOT NULL DEFAULT 'idle'
                              CHECK (status IN ('idle', 'queued', 'fetching', 'failed')),
      status_updated_at       timestamptz NOT NULL DEFAULT now(),
      next_refresh_allowed_at timestamptz NOT NULL DEFAULT now(),
      last_attempt_at         timestamptz,
      last_synced_at          timestamptz,
      consecutive_failures    int         NOT NULL DEFAULT 0,
      last_error              text,
      latest_snapshot_id      bigint,
      verified_at             timestamptz,
      created_at              timestamptz NOT NULL DEFAULT now(),
      UNIQUE (platform, handle)
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS platform_accounts;`)
}
