// 011_add_geeksforgeeks_platform
// Extends the platform CHECK constraint in platform_accounts to include GeeksForGeeks.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

    ALTER TABLE platform_accounts
      ADD CONSTRAINT platform_accounts_platform_check
      CHECK (platform IN ('codeforces', 'leetcode', 'codechef', 'atcoder', 'geeksforgeeks'));
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE platform_accounts
      DROP CONSTRAINT IF EXISTS platform_accounts_platform_check;

    ALTER TABLE platform_accounts
      ADD CONSTRAINT platform_accounts_platform_check
      CHECK (platform IN ('codeforces', 'leetcode', 'codechef', 'atcoder'));
  `)
}
