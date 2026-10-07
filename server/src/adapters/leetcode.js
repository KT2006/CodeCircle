import { NotFoundError, ParseError, UpstreamError } from './errors.js'
import { postJson } from '../lib/httpClient.js'

export const platform = 'leetcode'

const GRAPHQL_URL = 'https://leetcode.com/graphql'

const PROFILE_QUERY = `
  query userPublicProfile($username: String!, $currentYear: Int!, $previousYear: Int!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      tagProblemCounts {
        advanced { tagName tagSlug problemsSolved }
        intermediate { tagName tagSlug problemsSolved }
        fundamental { tagName tagSlug problemsSolved }
      }
      userCalendar(year: $currentYear) {
        streak
        submissionCalendar
      }
      previousCalendar: userCalendar(year: $previousYear) {
        submissionCalendar
      }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
    }
    userContestRankingHistory(username: $username) {
      attended
      rating
      ranking
      contest {
        title
        startTime
      }
    }
  }
`

/**
 * Validate and trim a LeetCode username.
 *
 * @param {string} raw
 * @returns {string}
 */
export function validateHandle(raw) {
  const handle = (raw ?? '').trim()
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(handle)) {
    const error = new Error('Invalid LeetCode username')
    error.status = 400
    error.code = 'INVALID_HANDLE'
    throw error
  }
  return handle
}

/**
 * Fetch and normalize publicly available LeetCode profile statistics.
 *
 * @param {string} rawHandle
 * @returns {Promise<object>}
 */
export async function fetchProfile(rawHandle) {
  const handle = validateHandle(rawHandle)
  const currentYear = new Date().getUTCFullYear()
  const payload = await postJson(GRAPHQL_URL, {
    query: PROFILE_QUERY,
    variables: { username: handle, currentYear, previousYear: currentYear - 1 },
  })

  if (!payload || typeof payload !== 'object') {
    throw new ParseError('LeetCode returned an invalid response')
  }
  const graphQLErrors = Array.isArray(payload.errors) ? payload.errors : []
  if (graphQLErrors.some((error) => /user (does not exist|not found)/i.test(error.message ?? ''))) {
    throw new NotFoundError(`LeetCode user "${handle}" not found`)
  }
  if (graphQLErrors.length > 0) {
    throw new UpstreamError(`LeetCode GraphQL request failed: ${graphQLErrors[0].message ?? 'unknown error'}`)
  }

  if (!payload.data || typeof payload.data !== 'object') {
    throw new ParseError('LeetCode response is missing profile data')
  }

  const matchedUser = payload.data.matchedUser
  if (!matchedUser) {
    throw new NotFoundError(`LeetCode user "${handle}" not found`)
  }

  const acceptedSubmissions = matchedUser.submitStats?.acSubmissionNum
  if (!Array.isArray(acceptedSubmissions)) {
    throw new ParseError('LeetCode profile is missing accepted submission statistics')
  }

  const countFor = (difficulty) => {
    const entry = acceptedSubmissions.find((item) => item.difficulty?.toLowerCase() === difficulty.toLowerCase())
    const count = Number(entry?.count ?? 0)
    return Number.isFinite(count) ? count : 0
  }
  const all = countFor('All')
  const easy = countFor('Easy')
  const medium = countFor('Medium')
  const hard = countFor('Hard')
  const contestRanking = payload.data.userContestRanking
  const tagsBySlug = new Map()
  for (const tags of Object.values(matchedUser.tagProblemCounts ?? {})) {
    if (!Array.isArray(tags)) continue
    for (const tag of tags) {
      if (!tag?.tagSlug || !tag.tagName || !Number.isFinite(Number(tag.problemsSolved))) continue
      const current = tagsBySlug.get(tag.tagSlug)
      if (!current || Number(tag.problemsSolved) > current.problemsSolved) {
        tagsBySlug.set(tag.tagSlug, {
          name: tag.tagName,
          slug: tag.tagSlug,
          problemsSolved: Number(tag.problemsSolved),
        })
      }
    }
  }

  const activityByDate = new Map()
  for (const calendar of [matchedUser.userCalendar, matchedUser.previousCalendar]) {
    if (!calendar?.submissionCalendar) continue
    let submissionsByTimestamp
    try {
      submissionsByTimestamp = JSON.parse(calendar.submissionCalendar)
    } catch {
      throw new ParseError('LeetCode returned an invalid submission calendar')
    }
    if (!submissionsByTimestamp || typeof submissionsByTimestamp !== 'object' || Array.isArray(submissionsByTimestamp)) {
      throw new ParseError('LeetCode returned an invalid submission calendar')
    }
    for (const [timestamp, rawCount] of Object.entries(submissionsByTimestamp)) {
      const count = Number(rawCount)
      const date = new Date(Number(timestamp) * 1000)
      if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(date.getTime())) continue
      const dateKey = date.toISOString().slice(0, 10)
      activityByDate.set(dateKey, (activityByDate.get(dateKey) ?? 0) + count)
    }
  }

  const contestHistory = Array.isArray(payload.data.userContestRankingHistory)
    ? payload.data.userContestRankingHistory
      .filter((entry) =>
        entry.attended &&
        entry.contest &&
        entry.rating !== null &&
        entry.rating !== undefined &&
        Number.isFinite(Number(entry.rating)) &&
        Number.isFinite(Number(entry.contest.startTime)),
      )
      .map((entry) => {
        const timestamp = Number(entry.contest.startTime) * 1000
        const date = new Date(timestamp)
        return {
          contestName: entry.contest.title,
          date: Number.isFinite(date.getTime()) ? date.toISOString() : null,
          rating: Number(entry.rating),
          ranking: Number(entry.ranking) || null,
        }
      })
      .filter((entry) => entry.date && Number.isFinite(Date.parse(entry.date)))
    : []

  return {
    platform,
    username: matchedUser.username,
    globalRanking: Number(matchedUser.profile?.ranking) || null,
    problemsSolved: all || easy + medium + hard,
    solvedByDifficulty: { all: all || easy + medium + hard, easy, medium, hard },
    contestsAttended: Number(contestRanking?.attendedContestsCount) || 0,
    contestRating:
      contestRanking?.rating !== null &&
      contestRanking?.rating !== undefined &&
      Number.isFinite(Number(contestRanking.rating))
      ? Number(contestRanking.rating)
      : null,
    contestGlobalRanking: Number(contestRanking?.globalRanking) || null,
    contestHistory,
    currentStreak: matchedUser.userCalendar
      ? Number(matchedUser.userCalendar.streak) || 0
      : null,
    activityAvailable: Boolean(
      matchedUser.userCalendar?.submissionCalendar ||
      matchedUser.previousCalendar?.submissionCalendar,
    ),
    activityByDate: Object.fromEntries(activityByDate),
    topics: [...tagsBySlug.values()].sort((left, right) => right.problemsSolved - left.problemsSolved),
  }
}
