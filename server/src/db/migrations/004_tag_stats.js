// 004_tag_stats
// Per-snapshot per-tag breakdown. Powers Topic Strength bars on the profile.
// weighted_points: difficulty-weighted score for this tag (plan §8.2)

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE snapshot_tag_stats (
      snapshot_id     bigint        NOT NULL
                      REFERENCES account_snapshots(id) ON DELETE CASCADE,
      tag             text          NOT NULL,
      solved_count    int           NOT NULL,
      weighted_points numeric(10,2) NOT NULL,
      PRIMARY KEY (snapshot_id, tag)
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS snapshot_tag_stats;`)
}
