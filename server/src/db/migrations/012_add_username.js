// 012_add_username
// Adds a unique, human-readable username to each user (e.g. /u/kshitij).
// - Nullable on creation: existing users choose their username via the picker modal on next login.
// - Unique index enforces global uniqueness case-insensitively via citext-style lower() approach.
// - 3–20 chars, lowercase letters/digits/underscores only (enforced in app layer + DB check).

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN username text UNIQUE;

    ALTER TABLE users
      ADD CONSTRAINT users_username_format
        CHECK (username ~ '^[a-z0-9_]{3,20}$');

    -- Partial unique index so two NULL rows don't conflict
    CREATE UNIQUE INDEX users_username_unique
      ON users (lower(username))
      WHERE username IS NOT NULL;
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS users_username_unique;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_format;
    ALTER TABLE users DROP COLUMN IF EXISTS username;
  `)
}
