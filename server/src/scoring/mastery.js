/**
 * src/scoring/mastery.js
 *
 * Diminishing returns curve for tag mastery (Plan §8.3).
 * Formula: mastery[tag] = 100 * (1 - exp(-points[tag] / S))
 */

import { SATURATION_CONSTANT } from '../config/scoring.js'

/**
 * Calculates weighted points from solved count and difficulty weight.
 *
 * @param {number} solvedCount
 * @param {number} weight
 * @returns {number}
 */
export function calculatePoints(solvedCount, weight = 1.0) {
  const count = Math.max(0, Number(solvedCount) || 0)
  const w = Math.max(0, Number(weight) || 0)
  return Number((count * w).toFixed(2))
}

/**
 * Computes 0..100 mastery from points using the saturating exponential curve.
 *
 * @param {number} points
 * @param {number} [saturation=SATURATION_CONSTANT]
 * @returns {number} mastery score in range [0, 100] rounded to 2 decimal places
 */
export function calculateMastery(points, saturation = SATURATION_CONSTANT) {
  const p = Math.max(0, Number(points) || 0)
  if (p === 0) return 0

  const S = Math.max(1, Number(saturation) || SATURATION_CONSTANT)
  const val = 100 * (1 - Math.exp(-p / S))
  return Number(Math.min(100, Math.max(0, val)).toFixed(2))
}

/**
 * Inverse mastery function: computes the points needed to reach a target mastery.
 * Used for gap analysis (Plan §8.6).
 *
 * Formula: points = -S * ln(1 - targetMastery / 100)
 *
 * @param {number} masteryTarget - target between 0 and 100
 * @param {number} [saturation=SATURATION_CONSTANT]
 * @returns {number} points required
 */
export function calculatePointsFromMastery(masteryTarget, saturation = SATURATION_CONSTANT) {
  const S = Math.max(1, Number(saturation) || SATURATION_CONSTANT)
  // Clamp target below 100 to avoid ln(0) = -Infinity
  const clampedTarget = Math.max(0, Math.min(99.9, Number(masteryTarget) || 0))
  if (clampedTarget <= 0) return 0

  const points = -S * Math.log(1 - clampedTarget / 100)
  return Number(Math.max(0, points).toFixed(2))
}
