import { sync as syncCodeforces, validateHandle as validateCodeforcesHandle } from '../adapters/codeforces.js'
import { fetchProfile as fetchLeetCodeProfile } from '../adapters/leetcode.js'
import { fetchProfile as fetchCodeChefProfile } from '../adapters/codechef.js'
import { fetchProfile as fetchAtCoderProfile } from '../adapters/atcoder.js'

const getCurrentStreak = (activityByDate) => {
  const today = new Date()
  const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10)
  const yesterday = new Date(`${todayKey}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  let dateKey = activityByDate[todayKey] ? todayKey : yesterday.toISOString().slice(0, 10)
  let streak = 0

  while (activityByDate[dateKey]) {
    streak += 1
    const previousDay = new Date(`${dateKey}T00:00:00.000Z`)
    previousDay.setUTCDate(previousDay.getUTCDate() - 1)
    dateKey = previousDay.toISOString().slice(0, 10)
  }

  return streak
}

const normalizeCodeforcesProfile = (normalized) => {
  const topicProblems = new Map()
  for (const problem of normalized.solvedProblems) {
    for (const tag of new Set(problem.tags)) {
      if (!topicProblems.has(tag)) topicProblems.set(tag, new Set())
      topicProblems.get(tag).add(problem.problemKey)
    }
  }

  const activityByDate = Object.fromEntries(
    normalized.daily.map(({ day, submissions }) => [day, submissions]),
  )

  return {
    platform: 'codeforces',
    username: normalized.profile.handle,
    rating: normalized.profile.rating,
    maxRating: normalized.profile.maxRating,
    rankTitle: normalized.profile.rankTitle,
    problemsSolved: normalized.profile.problemsSolved,
    solvedByBucket: normalized.profile.solvedByBucket,
    contestsAttended: normalized.profile.contestsCount,
    contestHistory: normalized.ratingHistory.map((contest) => ({
      contestName: contest.contestName,
      date: contest.ratedAt.toISOString(),
      rating: contest.newRating,
      ranking: contest.rank,
    })),
    topics: [...topicProblems.entries()]
      .map(([slug, problemKeys]) => ({
        name: slug.replace(/(^|-)[a-z0-9]/g, (match) => match.toUpperCase()).replaceAll('-', ' '),
        slug,
        problemsSolved: problemKeys.size,
      }))
      .sort((left, right) => right.problemsSolved - left.problemsSolved),
    activityByDate,
    activityAvailable: true,
    currentStreak: getCurrentStreak(activityByDate),
  }
}

export async function fetchCodeforcesProfile(rawHandle) {
  const handle = validateCodeforcesHandle(rawHandle)
  const normalized = await syncCodeforces(handle)
  return normalizeCodeforcesProfile(normalized)
}

const PLATFORM_FETCHERS = {
  leetcode: fetchLeetCodeProfile,
  codeforces: fetchCodeforcesProfile,
  codechef: fetchCodeChefProfile,
  atcoder: fetchAtCoderProfile,
}

/**
 * Fetch all supplied platform profiles independently so one upstream failure
 * does not discard successful data from another platform.
 *
 * @param {{ leetcode?: string, codeforces?: string, codechef?: string, atcoder?: string }} handles
 * @returns {Promise<{ profiles: Record<string, object>, errors: Record<string, { code: string, message: string }> }>}
 */
export async function fetchPlatformProfiles(handles) {
  const requests = Object.entries(handles).filter(([, handle]) => Boolean(handle))
  const results = await Promise.allSettled(
    requests.map(async ([platform, handle]) => [
      platform,
      await PLATFORM_FETCHERS[platform](handle),
    ]),
  )
  const profiles = {}
  const errors = {}

  results.forEach((result, index) => {
    const [platform] = requests[index]
    if (result.status === 'fulfilled') {
      const [, profile] = result.value
      profiles[platform] = profile
    } else {
      errors[platform] = {
        code: result.reason?.code ?? 'UPSTREAM_ERROR',
        message: result.reason instanceof Error ? result.reason.message : 'Unable to fetch profile',
      }
    }
  })

  return { profiles, errors }
}
