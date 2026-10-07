// 005_solved_problems
// Codeforces only — per-problem data. LeetCode uses tag_stats instead.
// problem_key: 'cf:{contestId}:{index}' e.g. 'cf:1700:A'
// GIN index on tags[] allows: WHERE tags @> ARRAY['dp']

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE solved_problems (
      platform_account_id uuid        NOT NULL
                          REFERENCES platform_accounts(id) ON DELETE CASCADE,
      problem_key         text        NOT NULL,
      name                text        NOT NULL,
      difficulty_rating   int,
      tags                text[]      NOT NULL DEFAULT '{}',
      first_solved_at     timestamptz NOT NULL,
      PRIMARY KEY (platform_account_id, problem_key)
    );

    CREATE INDEX idx_solved_tags ON solved_problems USING gin (tags);
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS solved_problems;`)
}
