// 009_verdicts
// Cache for LLM-generated comparison text (Phase 8). Empty in v1.
// cache_key: sha256(sorted snapshot IDs + includeContests + PROMPT_VERSION)

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE comparison_verdicts (
      cache_key   text        PRIMARY KEY,
      verdict     text        NOT NULL,
      model       text        NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS comparison_verdicts;`)
}
