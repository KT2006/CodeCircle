// 008_user_lists
// Wires users to the shared platform_accounts table.
// user_accounts: the user's own handles (one per platform).
// friends: a named group owned by one user (D4/D5) — no mutual acceptance.
// friend_handles: maps each friend to their platform accounts.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE user_accounts (
      user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform            text NOT NULL,
      platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
      PRIMARY KEY (user_id, platform)
    );

    CREATE TABLE friends (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name  text        NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_user_id, display_name)
    );

    CREATE INDEX idx_friends_owner ON friends (owner_user_id);

    CREATE TABLE friend_handles (
      friend_id           uuid NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
      platform            text NOT NULL,
      platform_account_id uuid NOT NULL REFERENCES platform_accounts(id),
      PRIMARY KEY (friend_id, platform)
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS friend_handles;
    DROP TABLE IF EXISTS friends;
    DROP TABLE IF EXISTS user_accounts;
  `)
}
