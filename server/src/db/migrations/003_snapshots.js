// 003_snapshots
// Time-series of sync results. bigserial (not uuid) because this table has many rows.
// Also adds the FK from platform_accounts.latest_snapshot_id → account_snapshots.id
// (couldn't be added in 002 since this table didn't exist yet).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE account_snapshots (
      id                  bigserial   PRIMARY KEY,
      platform_account_id uuid        NOT NULL
                          REFERENCES platform_accounts(id) ON DELETE CASCADE,
      fetched_at          timestamptz NOT NULL DEFAULT now(),
      rating              int,
      max_rating          int,
      rank_title          text,
      contests_count      int         NOT NULL DEFAULT 0,
      problems_solved     int         NOT NULL DEFAULT 0,
      solved_by_bucket    jsonb,
      skill_score         numeric(5,2),
      contest_score       numeric(5,2),
      score_version       smallint    NOT NULL,
      raw_meta            jsonb
    );

    CREATE INDEX idx_snapshots_account_time
      ON account_snapshots (platform_account_id, fetched_at DESC);

    ALTER TABLE platform_accounts
      ADD CONSTRAINT fk_latest_snapshot
      FOREIGN KEY (latest_snapshot_id)
      REFERENCES account_snapshots(id)
      ON DELETE SET NULL;
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS fk_latest_snapshot;
    DROP TABLE IF EXISTS account_snapshots;
  `)
}
