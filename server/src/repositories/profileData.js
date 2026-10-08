import pool from '../db/pool.js'

const toInteger = (value) => {
  if (value === null || value === undefined || value === '') return null
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null
}

async function saveProfile(profile, linkedUserId = null) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const username = profile.username.trim()
    const { rows: accountRows } = await client.query(
      `INSERT INTO platform_accounts (platform, handle, display_handle)
       VALUES ($1, $2, $3)
       ON CONFLICT (platform, handle) DO UPDATE SET
         display_handle = EXCLUDED.display_handle
       RETURNING id`,
      [profile.platform, username.toLowerCase(), username],
    )
    const accountId = accountRows[0].id

    if (linkedUserId) {
      await client.query(
        `INSERT INTO user_accounts (user_id, platform, platform_account_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, platform) DO UPDATE SET
           platform_account_id = EXCLUDED.platform_account_id`,
        [linkedUserId, profile.platform, accountId],
      )
    }

    const { rows: snapshotRows } = await client.query(
      `INSERT INTO account_snapshots (
         platform_account_id, rating, max_rating, rank_title, contests_count,
         problems_solved, solved_by_bucket, score_version, raw_meta
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
       RETURNING id`,
      [
        accountId,
        toInteger(profile.rating ?? profile.contestRating),
        toInteger(profile.maxRating),
        profile.rankTitle ?? null,
        toInteger(profile.contestsAttended) ?? 0,
        toInteger(profile.problemsSolved) ?? 0,
        profile.solvedByBucket || profile.solvedByDifficulty
          ? JSON.stringify(profile.solvedByBucket ?? profile.solvedByDifficulty)
          : null,
        JSON.stringify(profile),
      ],
    )
    const snapshotId = snapshotRows[0].id

    const topics = (profile.topics ?? [])
      .filter((topic) => typeof topic.slug === 'string' && Number.isFinite(Number(topic.problemsSolved)))
    if (topics.length > 0) {
      const values = []
      const params = []
      topics.forEach((topic, index) => {
        const offset = index * 4
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`)
        params.push(snapshotId, topic.slug, Math.round(Number(topic.problemsSolved)), Number(topic.problemsSolved))
      })
      await client.query(
        `INSERT INTO snapshot_tag_stats (snapshot_id, tag, solved_count, weighted_points)
         VALUES ${values.join(', ')}
         ON CONFLICT (snapshot_id, tag) DO UPDATE SET
           solved_count = EXCLUDED.solved_count,
           weighted_points = EXCLUDED.weighted_points`,
        params,
      )
    }

    const activityDetails = profile.activityDetailsByDate ?? Object.fromEntries(
      Object.entries(profile.activityByDate ?? {}).map(([day, submissions]) => [
        day,
        { submissions, attempted: null, solved: null },
      ]),
    )
    const activity = Object.entries(activityDetails)
      .filter(([day, details]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        Number.isSafeInteger(Number(details.submissions)) &&
        Number(details.submissions) > 0,
      )
    if (activity.length > 0) {
      const values = []
      const params = []
      activity.forEach(([day, details], index) => {
        const offset = index * 5
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`)
        params.push(
          accountId,
          day,
          Number(details.submissions),
          toInteger(details.attempted),
          toInteger(details.solved),
        )
      })
      await client.query(
        `INSERT INTO daily_activity (
           platform_account_id, day, submissions, problems_attempted, problems_solved
         )
         VALUES ${values.join(', ')}
         ON CONFLICT (platform_account_id, day) DO UPDATE SET
           submissions = EXCLUDED.submissions,
           problems_attempted = EXCLUDED.problems_attempted,
           problems_solved = EXCLUDED.problems_solved`,
        params,
      )
    }

    const solvedProblems = (profile.solvedProblems ?? [])
      .filter((problem) =>
        typeof problem.problemKey === 'string' &&
        typeof problem.name === 'string' &&
        Number.isFinite(Date.parse(problem.firstSolvedAt)),
      )
    if (solvedProblems.length > 0) {
      const values = []
      const params = []
      solvedProblems.forEach((problem, index) => {
        const offset = index * 6
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
        )
        params.push(
          accountId,
          problem.problemKey,
          problem.name,
          toInteger(problem.difficultyRating),
          Array.isArray(problem.tags) ? problem.tags : [],
          problem.firstSolvedAt,
        )
      })
      await client.query(
        `INSERT INTO solved_problems (
           platform_account_id, problem_key, name, difficulty_rating, tags, first_solved_at
         )
         VALUES ${values.join(', ')}
         ON CONFLICT (platform_account_id, problem_key) DO UPDATE SET
           name = EXCLUDED.name,
           difficulty_rating = EXCLUDED.difficulty_rating,
           tags = EXCLUDED.tags`,
        params,
      )
    }

    const contests = (profile.contestHistory ?? [])
      .filter((contest) =>
        typeof contest.contestName === 'string' &&
        Number.isFinite(Date.parse(contest.date)) &&
        Number.isFinite(Number(contest.rating)),
      )
    if (contests.length > 0) {
      const values = []
      const params = []
      contests.forEach((contest, index) => {
        const offset = index * 7
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`,
        )
        params.push(
          accountId,
          `${contest.date}:${contest.contestName}`,
          contest.contestName,
          contest.date,
          toInteger(contest.oldRating),
          toInteger(contest.rating),
          toInteger(contest.ranking),
        )
      })
      await client.query(
        `INSERT INTO rating_history (
           platform_account_id, contest_id, contest_name, rated_at,
           old_rating, new_rating, contest_rank
         )
         VALUES ${values.join(', ')}
         ON CONFLICT (platform_account_id, contest_id) DO UPDATE SET
           contest_name = EXCLUDED.contest_name,
           rated_at = EXCLUDED.rated_at,
           old_rating = EXCLUDED.old_rating,
           new_rating = EXCLUDED.new_rating,
           contest_rank = EXCLUDED.contest_rank`,
        params,
      )
    }

    await client.query(
      `UPDATE platform_accounts
       SET latest_snapshot_id = $2,
           last_synced_at = now(),
           status = 'idle',
           status_updated_at = now(),
           consecutive_failures = 0,
           last_error = NULL
       WHERE id = $1`,
      [accountId, snapshotId],
    )

    await client.query('COMMIT')
    return snapshotId
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function saveFetchedProfile(userId, profile) {
  return saveProfile(profile, userId)
}

export async function saveFriendProfile(profile) {
  return saveProfile(profile)
}

export async function getSavedProfiles(userId) {
  const { rows } = await pool.query(
    `SELECT pa.platform, pa.display_handle, pa.last_synced_at, s.raw_meta
     FROM user_accounts ua
     JOIN platform_accounts pa ON pa.id = ua.platform_account_id
     JOIN account_snapshots s ON s.id = pa.latest_snapshot_id
     WHERE ua.user_id = $1
     ORDER BY pa.platform`,
    [userId],
  )

  return Object.fromEntries(rows.map((row) => [
    row.platform,
    {
      ...row.raw_meta,
      username: row.display_handle,
      platform: row.platform,
      lastSyncedAt: row.last_synced_at,
    },
  ]))
}
