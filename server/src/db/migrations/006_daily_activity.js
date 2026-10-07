// 006_daily_activity
// One row per (platform_account, UTC day). Powers heatmap + "questions per day" (D6).
// problems_attempted/solved are nullable — LeetCode can't provide them (plan §6.2).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE daily_activity (
      platform_account_id uuid NOT NULL
                          REFERENCES platform_accounts(id) ON DELETE CASCADE,
      day                 date NOT NULL,
      submissions         int  NOT NULL DEFAULT 0,
      problems_attempted  int,
      problems_solved     int,
      PRIMARY KEY (platform_account_id, day)
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS daily_activity;`)
}
