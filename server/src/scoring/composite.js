/**
 * src/scoring/composite.js
 *
 * Platform composite score blending (Plan §8.5) and gap analysis (Plan §8.6).
 */

import { ALL_SUPPORTED_PLATFORMS, BLEND_WEIGHTS } from '../config/scoring.js'
import { calculatePointsFromMastery } from './mastery.js'
import { normalizeTag } from './skill.js'

/**
 * Computes a platform's final composite score blending skill and contest.
 *
 * @param {object} params
 * @param {number} params.skillScore - 0..100
 * @param {number|null} [params.contestScore=null] - 0..100 or null
 * @param {boolean} [params.includeContests=false] - opt-in toggle (D10)
 * @returns {number} final platform score in range [0, 100]
 */
export function computePlatformScore({
  skillScore = 0,
  contestScore = null,
  includeContests = false,
} = {}) {
  const skill = Math.max(0, Math.min(100, Number(skillScore) || 0))

  if (includeContests && typeof contestScore === 'number' && Number.isFinite(contestScore)) {
    const contest = Math.max(0, Math.min(100, contestScore))
    const { SKILL, CONTEST } = BLEND_WEIGHTS.WITH_CONTEST
    const blended = skill * SKILL + contest * CONTEST
    return Number(blended.toFixed(2))
  }

  return Number(skill.toFixed(2))
}

/**
 * Computes composite score across all platforms following Rule D11 (Zero penalty approach):
 * Missing platforms contribute 0.
 *
 * @param {Record<string, number>} platformScores - e.g. { leetcode: 80, codeforces: 65 }
 * @param {string[]} [supportedPlatforms=ALL_SUPPORTED_PLATFORMS]
 * @returns {{
 *   compositeScore: number,
 *   connectedScore: number,
 *   connectedCount: number,
 *   totalSupported: number,
 *   platformBreakdown: Record<string, number>,
 *   missingPlatforms: string[],
 * }}
 */
export function computeCompositeScore(
  platformScores = {},
  supportedPlatforms = ALL_SUPPORTED_PLATFORMS,
) {
  const platformBreakdown = {}
  let totalScoreD11 = 0
  let totalConnectedScore = 0
  let connectedCount = 0
  const missingPlatforms = []

  for (const plat of supportedPlatforms) {
    const scoreVal = platformScores[plat]
    if (typeof scoreVal === 'number' && Number.isFinite(scoreVal) && scoreVal >= 0) {
      const clamped = Math.max(0, Math.min(100, scoreVal))
      platformBreakdown[plat] = clamped
      totalScoreD11 += clamped
      totalConnectedScore += clamped
      connectedCount += 1
    } else {
      platformBreakdown[plat] = 0
      missingPlatforms.push(plat)
    }
  }

  const denominator = supportedPlatforms.length > 0 ? supportedPlatforms.length : 1
  const compositeScore = Number((totalScoreD11 / denominator).toFixed(2))
  const connectedScore = connectedCount > 0
    ? Number((totalConnectedScore / connectedCount).toFixed(2))
    : 0

  return {
    compositeScore,
    connectedScore,
    connectedCount,
    totalSupported: supportedPlatforms.length,
    platformBreakdown,
    missingPlatforms,
  }
}

/**
 * Computes deterministic gap analysis between user and friend.
 * Identifies core topic gaps and calculates the approximate number of problems needed
 * to match or exceed the friend's level (Plan §8.6).
 *
 * Formula:
 * pointsNeeded = -S * ln(1 - friendMastery/100) - myPoints
 * problemsNeeded = ceil(pointsNeeded / myAverageWeight)
 *
 * @param {object} mySkillResult - output of computePlatformSkill or combined topicMastery
 * @param {object} friendSkillResult
 * @param {number} [myAvgWeight=1.0]
 * @returns {Array<{
 *   tag: string,
 *   name: string,
 *   myMastery: number,
 *   friendMastery: number,
 *   gap: number,
 *   pointsNeeded: number,
 *   problemsNeeded: number,
 * }>}
 */
export function computeGapAnalysis(mySkillResult = {}, friendSkillResult = {}, myAvgWeight = 1.0) {
  const myMasteryMap = mySkillResult.topicMastery ?? {}
  const friendMasteryMap = friendSkillResult.topicMastery ?? {}

  const allTags = new Set([
    ...Object.keys(myMasteryMap),
    ...Object.keys(friendMasteryMap),
  ])

  const gaps = []
  const weight = Math.max(0.5, Number(myAvgWeight) || 1.0)

  for (const rawTag of allTags) {
    const tag = normalizeTag(rawTag)
    const myData = myMasteryMap[tag] ?? { points: 0, mastery: 0 }
    const friendData = friendMasteryMap[tag] ?? { points: 0, mastery: 0 }

    const myMastery = myData.mastery ?? 0
    const friendMastery = friendData.mastery ?? 0

    if (friendMastery > myMastery) {
      const gap = Number((friendMastery - myMastery).toFixed(2))
      const targetPoints = calculatePointsFromMastery(friendMastery)
      const pointsNeeded = Number(Math.max(0, targetPoints - (myData.points ?? 0)).toFixed(2))
      const problemsNeeded = Math.ceil(pointsNeeded / weight)

      gaps.push({
        tag,
        name: tag.replace(/(^|-)[a-z0-9]/g, (m) => m.toUpperCase()).replaceAll('-', ' '),
        myMastery,
        friendMastery,
        gap,
        pointsNeeded,
        problemsNeeded: Math.max(1, problemsNeeded),
      })
    }
  }

  // Sort by largest gap descending
  return gaps.sort((a, b) => b.gap - a.gap)
}
