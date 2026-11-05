// 013_longest_streak
// Adds a persistent high-watermark longest_streak column to platform_accounts.
//
// Why on platform_accounts rather than account_snapshots?
//   - platform adapters only return a limited activity window (e.g. LeetCode returns
//     only 2 calendar years). Recomputing longest streak from raw_meta will always
//     undercount if the true longest run happened outside that window.
//   - Storing it on platform_accounts as a running MAX means it only ever grows:
//     every sync compares the newly-computed streak against the stored value and
//     keeps whichever is larger. Past records are never lost.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      ADD COLUMN IF NOT EXISTS longest_streak int NOT NULL DEFAULT 0;
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      DROP COLUMN IF EXISTS longest_streak;
  `)
}
