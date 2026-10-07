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
    activityByDate: {},
    activityAvailable: false,
    currentStreak: null,
  }
}
