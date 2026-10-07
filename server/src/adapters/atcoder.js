import { NotFoundError, ParseError, UpstreamError } from './errors.js'
import { getJson, getText } from '../lib/httpClient.js'

const PROFILE_URL = 'https://atcoder.jp/users'
const SUBMISSIONS_URL = 'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions'
const SUBMISSIONS_PER_PAGE = 500

export function validateHandle(raw) {
  const handle = (raw ?? '').trim()
  if (!/^[A-Za-z0-9_]{1,16}$/.test(handle)) {
    const error = new Error('Invalid AtCoder username')
    error.status = 400
    error.code = 'INVALID_HANDLE'
    throw error
  }
  return handle
}

const getRatingTitle = (rating) => {
  if (rating === null || rating <= 0) return 'Unrated'
  if (rating < 400) return 'Gray'
  if (rating < 800) return 'Brown'
  if (rating < 1200) return 'Green'
  if (rating < 1600) return 'Cyan'
  if (rating < 2000) return 'Blue'
  if (rating < 2400) return 'Yellow'
  if (rating < 2800) return 'Orange'
  return 'Red'
}

const fetchUserSubmissions = async (handle) => {
  const submissions = []
  const seenSubmissionIds = new Set()
  let fromSecond = 0

  while (true) {
    const url = new URL(SUBMISSIONS_URL)
    url.searchParams.set('user', handle)
    url.searchParams.set('from_second', String(fromSecond))
    const page = await getJson(url.toString())
    if (!Array.isArray(page)) {
      throw new ParseError('AtCoder Problems returned invalid submission data')
    }

    for (const submission of page) {
      if (
        !Number.isSafeInteger(Number(submission.id)) ||
        !Number.isSafeInteger(Number(submission.epoch_second))
      ) {
        throw new ParseError('AtCoder Problems returned a submission without a valid ID or timestamp')
      }
    }

    const newSubmissions = page.filter((submission) => {
      const id = Number(submission.id)
      if (seenSubmissionIds.has(id)) return false
      seenSubmissionIds.add(id)
      return true
    })
    submissions.push(...newSubmissions)
    if (page.length < SUBMISSIONS_PER_PAGE) break

    const latestTimestamp = Math.max(...page.map((submission) => Number(submission.epoch_second)))
    if (!Number.isSafeInteger(latestTimestamp) || latestTimestamp < fromSecond) {
      throw new ParseError('AtCoder Problems returned invalid submission timestamps')
    }
    if (newSubmissions.length === 0) {
      throw new ParseError('AtCoder Problems submission pagination stopped progressing')
    }
    fromSecond = latestTimestamp
  }

  return submissions
}

export async function fetchProfile(rawHandle) {
  const handle = validateHandle(rawHandle)
  try {
    await getText(`${PROFILE_URL}/${encodeURIComponent(handle)}`)
  } catch (error) {
    if (error instanceof UpstreamError && error.upstreamStatus === 404) {
      throw new NotFoundError(`AtCoder user "${handle}" not found`)
    }
    throw error
  }

  let ratingHistory
  try {
    ratingHistory = await getJson(`${PROFILE_URL}/${encodeURIComponent(handle)}/history/json`)
  } catch (error) {
    if (error instanceof UpstreamError && error.upstreamStatus === 404) {
      throw new NotFoundError(`AtCoder user "${handle}" not found`)
    }
    throw error
  }
  if (!Array.isArray(ratingHistory)) {
    throw new ParseError('AtCoder returned invalid contest history')
  }

  const contestHistory = ratingHistory
    .filter((contest) =>
      contest.IsRated &&
      contest.NewRating !== null &&
      contest.NewRating !== undefined &&
      Number.isFinite(Number(contest.NewRating)) &&
      contest.EndTime,
    )
    .map((contest) => {
      const date = new Date(contest.EndTime)
      return {
        contestName: contest.ContestName,
        date: Number.isFinite(date.getTime()) ? date.toISOString() : null,
        rating: Number(contest.NewRating),
        ranking: Number(contest.Place) || null,
      }
    })
    .filter((contest) => contest.date)
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
  const rating = contestHistory.at(-1)?.rating ?? null
  const maxRating = contestHistory.reduce((highest, contest) => Math.max(highest, contest.rating), 0) || null
  const submissions = await fetchUserSubmissions(handle)
  const solvedProblemIds = new Set()
  const activityByDate = {}
  for (const submission of submissions) {
    const timestamp = Number(submission.epoch_second)
    const date = new Date(timestamp * 1000)
    if (!Number.isFinite(timestamp) || !Number.isFinite(date.getTime())) continue
    const dateKey = date.toISOString().slice(0, 10)
    activityByDate[dateKey] = (activityByDate[dateKey] ?? 0) + 1
    if (submission.result === 'AC' && typeof submission.problem_id === 'string') {
      solvedProblemIds.add(submission.problem_id)
    }
  }

  return {
    platform: 'atcoder',
    username: handle,
    rating,
    maxRating,
    rankTitle: getRatingTitle(rating),
    problemsSolved: solvedProblemIds.size,
    contestsAttended: ratingHistory.length,
    contestHistory,
    topics: [],
    activityByDate,
    activityAvailable: true,
    currentStreak: null,
  }
}
