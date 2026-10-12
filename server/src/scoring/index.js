/**
 * src/scoring/index.js
 *
 * Scoring engine entry point (Plan §8).
 * Pure functions, zero I/O, unit-testable.
 */

import { SCORE_VERSION } from '../config/scoring.js'
import { calculateContestScore } from './contest.js'
import { computePlatformSkill } from './skill.js'
import { computePlatformScore } from './composite.js'

export * from '../config/scoring.js'
export * from './weights.js'
export * from './mastery.js'
export * from './contest.js'
export * from './skill.js'
export * from './composite.js'

/**
 * High-level function that computes all scores for a platform profile.
 *
 * @param {string} platform
 * @param {object} profileData
 * @param {object} [options]
 * @param {boolean} [options.includeContests=false]
 * @returns {{
 *   scoreVersion: number,
 *   skillScore: number,
 *   contestScore: number|null,
 *   platformScore: number,
 *   topicMastery: Record<string, { tag: string, solvedCount: number, points: number, mastery: number }>,
 *   coreTopicMastery: Record<string, number>,
 *   avgWeight: number,
 * }}
 */
export function scoreProfile(platform, profileData = {}, { includeContests = false } = {}) {
  const normPlatform = (platform || '').toLowerCase().trim()

  // 1. Compute skill score & tag masteries
  const skillResult = computePlatformSkill(normPlatform, profileData)

  // 2. Compute contest score (if rated)
  const contestRating = profileData.rating ?? profileData.contestRating ?? null
  const contestScore = calculateContestScore(normPlatform, contestRating)

  // 3. Blend into final platform score
  const platformScore = computePlatformScore({
    skillScore: skillResult.skillScore,
    contestScore,
    includeContests,
  })

  return {
    scoreVersion: SCORE_VERSION,
    skillScore: skillResult.skillScore,
    contestScore,
    platformScore,
    topicMastery: skillResult.topicMastery,
    coreTopicMastery: skillResult.coreTopicMastery,
    avgWeight: skillResult.avgWeight,
  }
}
