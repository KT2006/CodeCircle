/**
 * src/scoring/weights.js
 *
 * Difficulty weighting calculations (Plan §8.2).
 */

import { DIFFICULTY_CONFIG } from '../config/scoring.js'

/**
 * Calculates difficulty weight for a numeric rating.
 * Formula: weight(r) = (clamp(r, 800, 3500) / 800) ^ 2
 *
 * @param {number|null|undefined} rating
 * @returns {number} difficulty multiplier (minimum 1.0)
 */
export function getRatingWeight(rating) {
  const { BASE_RATING, MIN_CLAMP_RATING, MAX_CLAMP_RATING, UNRATED_CF_DEFAULT } = DIFFICULTY_CONFIG

  const numeric = typeof rating === 'number' && Number.isFinite(rating)
    ? rating
    : UNRATED_CF_DEFAULT

  const clamped = Math.max(MIN_CLAMP_RATING, Math.min(MAX_CLAMP_RATING, numeric))
  const ratio = clamped / BASE_RATING
  return Number((ratio * ratio).toFixed(4))
}

/**
 * Calculates average difficulty weight based on a user's difficulty distribution.
 * Used for platforms (LeetCode, GFG) that report per-topic counts but not per-problem ratings.
 *
 * Formula (Plan §8.2):
 * avgWeight = sum(count_i * weight(rating_i)) / sum(count_i)
 *
 * @param {object} bucketCounts - e.g. { easy: 50, medium: 30, hard: 10 }
 * @param {'leetcode'|'geeksforgeeks'} platform
 * @returns {number}
 */
export function getAverageDifficultyWeight(bucketCounts = {}, platform = 'leetcode') {
  if (!bucketCounts || typeof bucketCounts !== 'object') {
    return 1.0
  }

  const ratingsMap = platform === 'geeksforgeeks'
    ? DIFFICULTY_CONFIG.GEEKSFORGEEKS
    : DIFFICULTY_CONFIG.LEETCODE

  let totalWeight = 0
  let totalProblems = 0

  for (const [bucket, countVal] of Object.entries(bucketCounts)) {
    const count = Number(countVal) || 0
    if (count <= 0) continue

    const key = bucket.toLowerCase().trim()
    const rating = ratingsMap[key]
    if (typeof rating === 'number') {
      const w = getRatingWeight(rating)
      totalWeight += count * w
      totalProblems += count
    }
  }

  if (totalProblems <= 0) {
    // Default fallback weight when no bucket info exists
    const defaultRating = platform === 'geeksforgeeks'
      ? DIFFICULTY_CONFIG.GEEKSFORGEEKS.easy
      : DIFFICULTY_CONFIG.LEETCODE.medium
    return getRatingWeight(defaultRating)
  }

  return Number((totalWeight / totalProblems).toFixed(4))
}
