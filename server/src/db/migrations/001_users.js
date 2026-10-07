// 001_users
// google_sub: Google's stable unique ID for the user (never changes, even if email changes)
// include_contests: opt-in toggle for contest score weighting (plan D10)

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      google_sub       text        NOT NULL UNIQUE,
      email            text        NOT NULL,
      name             text        NOT NULL,
      avatar_url       text,
      include_contests boolean     NOT NULL DEFAULT false,
      created_at       timestamptz NOT NULL DEFAULT now(),
      last_login_at    timestamptz NOT NULL DEFAULT now()
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS users;`)
}
