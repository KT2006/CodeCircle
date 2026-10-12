/**
 * src/scoring/skill.js
 *
 * Per-platform skill score and tag mastery calculations (Plan §8.3).
 */

import { CORE_TAGS, TAG_SYNONYMS } from '../config/scoring.js'
import { getRatingWeight, getAverageDifficultyWeight } from './weights.js'
import { calculatePoints, calculateMastery } from './mastery.js'
import { calculateVolumeScore } from './contest.js'

/**
 * Normalises a tag string to a consistent canonical slug.
 *
 * @param {string} rawTag
 * @returns {string}
 */
export function normalizeTag(rawTag) {
  if (!rawTag || typeof rawTag !== 'string') return ''
  const trimmed = rawTag.trim().toLowerCase()
  return TAG_SYNONYMS[trimmed] ?? trimmed
}

/**
 * Computes tag mastery and aggregate skill score for a platform profile.
 *
 * @param {string} platform - 'codeforces' | 'leetcode' | 'codechef' | 'atcoder' | 'geeksforgeeks'
 * @param {object} profileData - normalized profile object
 * @returns {{
 *   skillScore: number,
 *   topicMastery: Record<string, { tag: string, solvedCount: number, points: number, mastery: number }>,
 *   coreTopicMastery: Record<string, number>,
 *   avgWeight: number,
 * }}
 */
export function computePlatformSkill(platform, profileData = {}) {
  const normPlatform = (platform || '').toLowerCase().trim()

  // ── Untagged platforms (CodeChef, AtCoder) — Option B: volume-based ──────
  if (normPlatform === 'codechef' || normPlatform === 'atcoder') {
    const solved = profileData.problemsSolved ?? 0
    const volumeScore = calculateVolumeScore(normPlatform, solved)

    return {
      skillScore: volumeScore,
      topicMastery: {},
      coreTopicMastery: {},
      avgWeight: 1.0,
    }
  }

  // ── Tagged platforms (Codeforces, LeetCode, GeeksForGeeks) ───────────────
  const pointsByTag = {}
  const countsByTag = {}
  let avgWeight = 1.0

  if (normPlatform === 'codeforces') {
    // If granular solvedProblems exist, sum exact weights per problem
    if (Array.isArray(profileData.solvedProblems) && profileData.solvedProblems.length > 0) {
      for (const p of profileData.solvedProblems) {
        const rating = p.difficultyRating ?? p.difficulty_rating ?? null
        const w = getRatingWeight(rating)
        const tags = Array.isArray(p.tags) ? p.tags : []

        for (const rawTag of tags) {
          const t = normalizeTag(rawTag)
          if (!t) continue
          pointsByTag[t] = (pointsByTag[t] ?? 0) + w
          countsByTag[t] = (countsByTag[t] ?? 0) + 1
        }
      }
    } else {
      // Fallback: use topic aggregates with default CF rating weight
      avgWeight = getRatingWeight(profileData.rating ?? null)
      const topics = profileData.topics ?? []
      for (const t of topics) {
        const name = normalizeTag(t.slug ?? t.name)
        const count = Number(t.problemsSolved ?? t.count ?? 0)
        if (name && count > 0) {
          pointsByTag[name] = calculatePoints(count, avgWeight)
          countsByTag[name] = count
        }
      }
    }
  } else if (normPlatform === 'leetcode') {
    const buckets = profileData.solvedByBucket ?? profileData.solvedByDifficulty ?? {}
    avgWeight = getAverageDifficultyWeight(buckets, 'leetcode')

    const topics = profileData.topics ?? []
    for (const t of topics) {
      const name = normalizeTag(t.slug ?? t.name)
      const count = Number(t.problemsSolved ?? t.count ?? 0)
      if (name && count > 0) {
        pointsByTag[name] = calculatePoints(count, avgWeight)
        countsByTag[name] = count
      }
    }
  } else if (normPlatform === 'geeksforgeeks') {
    const buckets = profileData.solvedByBucket ?? profileData.byDifficulty ?? {}
    avgWeight = getAverageDifficultyWeight(buckets, 'geeksforgeeks')

    const topics = profileData.topics ?? []
    for (const t of topics) {
      const name = normalizeTag(t.slug ?? t.name)
      const count = Number(t.problemsSolved ?? t.count ?? 0)
      if (name && count > 0) {
        pointsByTag[name] = calculatePoints(count, avgWeight)
        countsByTag[name] = count
      }
    }
  }

  // Build comprehensive topic mastery dictionary
  const topicMastery = {}
  for (const [tag, points] of Object.entries(pointsByTag)) {
    const roundedPts = Number(points.toFixed(2))
    topicMastery[tag] = {
      tag,
      solvedCount: countsByTag[tag] ?? 0,
      points: roundedPts,
      mastery: calculateMastery(roundedPts),
    }
  }

  // Evaluate against platform core tags
  const coreTags = CORE_TAGS[normPlatform] ?? []
  const coreTopicMastery = {}
  let totalMastery = 0

  for (const rawCoreTag of coreTags) {
    const t = normalizeTag(rawCoreTag)
    const masteryVal = topicMastery[t]?.mastery ?? 0
    coreTopicMastery[t] = masteryVal
    totalMastery += masteryVal
  }

  const denominator = coreTags.length > 0 ? coreTags.length : 1
  const skillScore = Number((totalMastery / denominator).toFixed(2))

  return {
    skillScore,
    topicMastery,
    coreTopicMastery,
    avgWeight: Number(avgWeight.toFixed(4)),
  }
}
