import { NotFoundError, ParseError, UpstreamError } from './errors.js'
import { getText } from '../lib/httpClient.js'

const PROFILE_URL = 'https://www.codechef.com/users'
const HANDLE_PATTERN = /^[A-Za-z0-9_.-]{1,50}$/

export function validateHandle(raw) {
  const handle = (raw ?? '').trim()
  if (!HANDLE_PATTERN.test(handle)) {
    const error = new Error('Invalid CodeChef username')
    error.status = 400
    error.code = 'INVALID_HANDLE'
    throw error
  }
  return handle
}

const parseDrupalSettings = (html) => {
  const marker = 'jQuery.extend(Drupal.settings,'
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) {
    throw new ParseError('CodeChef profile is missing its rating data')
  }

  const objectStart = html.indexOf('{', markerIndex + marker.length)
  if (objectStart === -1) {
    throw new ParseError('CodeChef profile contains invalid rating data')
  }

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = objectStart; index < html.length; index += 1) {
    const character = html[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(objectStart, index + 1))
        } catch {
          throw new ParseError('CodeChef profile contains invalid rating data')
        }
      }
    }
  }

  throw new ParseError('CodeChef profile contains incomplete rating data')
}

const parseRating = (html) => {
  const match = html.match(/<div\b[^>]*class=["'][^"']*\brating-number\b[^"']*["'][^>]*>\s*([^<]+)/i)
  if (!match) return undefined
  const rating = Number(match?.[1]?.trim())
  return Number.isFinite(rating) ? rating : null
}

const parseSolvedCount = (html) => {
  const match = html.match(/Total Problems Solved:\s*([\d,]+)/i)
  if (!match) return null
  const solved = Number(match[1].replaceAll(',', ''))
  return Number.isSafeInteger(solved) && solved >= 0 ? solved : null
}

const toIsoDate = (dateString) => {
  const date = new Date(dateString.replace(' ', 'T') + 'Z')
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export async function fetchProfile(rawHandle) {
  const handle = validateHandle(rawHandle)
  let html
  try {
    html = await getText(`${PROFILE_URL}/${encodeURIComponent(handle)}`)
  } catch (error) {
    if (error instanceof UpstreamError && error.upstreamStatus === 404) {
      throw new NotFoundError(`CodeChef user "${handle}" not found`)
    }
    throw error
  }

  const settings = parseDrupalSettings(html)
  const username = settings.currentUser
  if (typeof username !== 'string' || username.toLowerCase() !== handle.toLowerCase()) {
    throw new NotFoundError(`CodeChef user "${handle}" not found`)
  }

  const contestRecords = settings.date_versus_rating?.all
  if (!Array.isArray(contestRecords)) {
    throw new ParseError('CodeChef profile is missing contest history')
  }
  const contestHistory = contestRecords
    .filter((record) => record.rating !== null && record.rating !== undefined && record.rating !== '')
    .map((record) => ({
      contestName: record.name,
      date: toIsoDate(record.end_date ?? ''),
      rating: Number(record.rating),
      ranking: Number(record.rank) || null,
    }))
    .filter((record) => record.date && Number.isFinite(record.rating))
  const rating = parseRating(html)
  const starCount = [...(html.match(/<div class=["']rating-star["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '').matchAll(/&#9733;|★/g)].length

  if (rating === undefined) {
    throw new ParseError('CodeChef profile is missing its current rating')
  }

  // Build activityByDate from contest participation dates.
  // CodeChef does not expose a per-day submission heatmap via public HTML,
  // so we use contest dates as the activity signal (1 per contest day).
  const activityByDate = {}
  for (const contest of contestHistory) {
    if (!contest.date) continue
    const day = contest.date.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      activityByDate[day] = (activityByDate[day] ?? 0) + 1
    }
  }

  // Compute streak from the derived activity map
  function computeStreak(map) {
    const today = new Date()
    const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString().slice(0, 10)
    const yday = new Date(`${todayKey}T00:00:00.000Z`)
    yday.setUTCDate(yday.getUTCDate() - 1)
    let key = map[todayKey] ? todayKey : yday.toISOString().slice(0, 10)
    let streak = 0
    while (map[key]) {
      streak++
      const prev = new Date(`${key}T00:00:00.000Z`)
      prev.setUTCDate(prev.getUTCDate() - 1)
      key = prev.toISOString().slice(0, 10)
    }
    return streak
  }

  return {
    platform: 'codechef',
    username,
    rating,
    maxRating: contestHistory.reduce((highest, contest) => Math.max(highest, contest.rating), 0) || null,
    rankTitle: starCount > 0 ? `${starCount} star` : null,
    problemsSolved: parseSolvedCount(html),
    contestsAttended: contestRecords.length,
    contestHistory,
    topics: [],
    activityByDate,
    activityAvailable: Object.keys(activityByDate).length > 0,
    currentStreak: computeStreak(activityByDate),
  }
}
