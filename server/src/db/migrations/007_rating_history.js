// 007_rating_history
// Contest rating history. Powers the Rating Trend chart.
// PK (platform_account_id, contest_id) prevents duplicates on re-sync.
// Index on rated_at supports range queries like "last 6 months".

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE rating_history (
      platform_account_id uuid        NOT NULL
                          REFERENCES platform_accounts(id) ON DELETE CASCADE,
      contest_id          text        NOT NULL,
      contest_name        text        NOT NULL,
      rated_at            timestamptz NOT NULL,
      old_rating          int,
      new_rating          int         NOT NULL,
      contest_rank        int,
      PRIMARY KEY (platform_account_id, contest_id)
    );

    CREATE INDEX idx_rating_hist_time
      ON rating_history (platform_account_id, rated_at);
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS rating_history;`)
}
