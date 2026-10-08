// 010_expand_platform_accounts
// The profile fetchers support all four platforms, so account storage must too.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

    ALTER TABLE platform_accounts
      ADD CONSTRAINT platform_accounts_platform_check
      CHECK (platform IN ('codeforces', 'leetcode', 'codechef', 'atcoder'));
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

    ALTER TABLE platform_accounts
      ADD CONSTRAINT platform_accounts_platform_check
      CHECK (platform IN ('codeforces', 'leetcode'));
  `)
}
