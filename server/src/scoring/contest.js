/**
 * src/scoring/contest.js
 *
 * Piecewise-linear interpolation for contest and volume tiers (Plan §8.4).
 */

import { CONTEST_RATING_ANCHORS, VOLUME_ANCHORS } from '../config/scoring.js'

/**
 * Performs piecewise-linear interpolation over anchor points.
 * Anchors must be an array of [x, y] tuples sorted by x ascending.
 *
 * @param {number} value
 * @param {Array<[number, number]>} anchors
 * @returns {number} interpolated score clamped to anchor range
 */
export function interpolateAnchors(value, anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  if (value <= anchors[0][0]) return anchors[0][1]
  const last = anchors[anchors.length - 1]
  if (value >= last[0]) return last[1]

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i]
    const [x1, y1] = anchors[i + 1]

    if (value >= x0 && value <= x1) {
      if (x1 === x0) return y0
      const fraction = (value - x0) / (x1 - x0)
      const result = y0 + fraction * (y1 - y0)
      return Number(Math.min(100, Math.max(0, result)).toFixed(2))
    }
  }

  return 0
}

/**
 * Calculates a normalized contest score (0..100) from platform rating.
 * Returns null if the user has no rating or is unrated.
 *
 * @param {string} platform
 * @param {number|null|undefined} rating
 * @returns {number|null}
 */
export function calculateContestScore(platform, rating) {
  if (rating === null || rating === undefined || !Number.isFinite(Number(rating))) {
    return null
  }

  const numRating = Number(rating)
  const anchors = CONTEST_RATING_ANCHORS[platform]
  if (!anchors) return null

  return interpolateAnchors(numRating, anchors)
}

/**
 * Calculates a volume score (0..100) for platforms without granular topics
 * (CodeChef & AtCoder under Option B).
 *
 * @param {string} platform
 * @param {number|null|undefined} solvedCount
 * @returns {number}
 */
export function calculateVolumeScore(platform, solvedCount) {
  const count = Math.max(0, Number(solvedCount) || 0)
  const anchors = VOLUME_ANCHORS[platform] ?? VOLUME_ANCHORS.codechef
  return interpolateAnchors(count, anchors)
}
