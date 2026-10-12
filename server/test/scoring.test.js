/**
 * test/scoring.test.js
 *
 * Scoring engine unit tests (Plan §8.7).
 * Tests all required cases:
 * 1. Boundary cases (0 problems, unrated, empty arrays)
 * 2. Monotonicity (more/harder problems never lowers the score)
 * 3. Master saturation targets (Plan §8.3 calibrations)
 * 4. Piecewise linear interpolation anchors
 * 5. Composite score with missing platforms (Zero-penalty D11 rule)
 * 6. Gap analysis inverse mathematics
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SCORE_VERSION,
  SATURATION_CONSTANT,
  getRatingWeight,
  getAverageDifficultyWeight,
  calculatePoints,
  calculateMastery,
  calculatePointsFromMastery,
  interpolateAnchors,
  calculateContestScore,
  calculateVolumeScore,
  computePlatformSkill,
  computePlatformScore,
  computeCompositeScore,
  computeGapAnalysis,
  scoreProfile,
} from '../src/scoring/index.js'

describe('Scoring Engine — Unit Tests (Plan §8.7)', () => {
  // ── 1. Difficulty Weighting ───────────────────────────────────────────────
  describe('Difficulty Weights', () => {
    it('clamps ratings below 800 to 1.0 (800 / 800)^2', () => {
      assert.equal(getRatingWeight(500), 1.0)
      assert.equal(getRatingWeight(800), 1.0)
    })

    it('clamps ratings above 3500 to (3500 / 800)^2', () => {
      const maxWeight = (3500 / 800) ** 2
      assert.equal(getRatingWeight(4000), Number(maxWeight.toFixed(4)))
    })

    it('calculates correct quadratic weights for standard ratings', () => {
      // 1200 / 800 = 1.5 -> 2.25
      assert.equal(getRatingWeight(1200), 2.25)
      // 1600 / 800 = 2.0 -> 4.0
      assert.equal(getRatingWeight(1600), 4.0)
      // 2000 / 800 = 2.5 -> 6.25
      assert.equal(getRatingWeight(2000), 6.25)
      // 2400 / 800 = 3.0 -> 9.0
      assert.equal(getRatingWeight(2400), 9.0)
    })

    it('falls back to 1200 default for null/unrated Codeforces problems', () => {
      assert.equal(getRatingWeight(null), 2.25)
      assert.equal(getRatingWeight(undefined), 2.25)
    })

    it('monotonicity: higher rating always yields >= weight', () => {
      let prev = 0
      for (let r = 700; r <= 3600; r += 100) {
        const w = getRatingWeight(r)
        assert.ok(w >= prev, `Weight for rating ${r} should be >= previous ${prev}`)
        prev = w
      }
    })

    it('computes LeetCode average difficulty weight accurately', () => {
      // All Easy: r=900 -> (900/800)^2 = 1.2656
      const allEasy = getAverageDifficultyWeight({ easy: 100, medium: 0, hard: 0 }, 'leetcode')
      assert.equal(allEasy, getRatingWeight(900))

      // Balanced mix: 10 Easy, 10 Hard
      const mixed = getAverageDifficultyWeight({ easy: 10, medium: 0, hard: 10 }, 'leetcode')
      const expected = Number(((getRatingWeight(900) + getRatingWeight(2100)) / 2).toFixed(4))
      assert.equal(mixed, expected)
    })
  })

  // ── 2. Tag Mastery Curve ──────────────────────────────────────────────────
  describe('Mastery Curve & Diminishing Returns', () => {
    it('boundary: 0 points gives 0 mastery', () => {
      assert.equal(calculateMastery(0), 0)
      assert.equal(calculateMastery(-5), 0)
    })

    it('satisfies Plan §8.3 calibration targets', () => {
      // 10 problems at 800 (weight 1.0) = 10 pts -> ~6.45%
      const tenAt800 = calculateMastery(10)
      assert.ok(tenAt800 >= 6.0 && tenAt800 <= 7.0, `10 pts gives ${tenAt800}, expected ~6.4%`)

      // 30 problems at 1200 (weight 2.25) = 67.5 pts -> ~36.2%
      const thirtyAt1200 = calculateMastery(30 * 2.25)
      assert.ok(thirtyAt1200 >= 35.0 && thirtyAt1200 <= 37.0, `67.5 pts gives ${thirtyAt1200}, expected ~36%`)

      // 100 problems at 1600 (weight 4.0) = 400 pts -> ~93.1%
      const hundredAt1600 = calculateMastery(100 * 4.0)
      assert.ok(hundredAt1600 >= 92.0 && hundredAt1600 <= 94.0, `400 pts gives ${hundredAt1600}, expected ~93%`)
    })

    it('monotonicity: more points strictly increases or saturates mastery', () => {
      let prev = 0
      for (let pts = 0; pts <= 800; pts += 20) {
        const m = calculateMastery(pts)
        assert.ok(m >= prev, `Mastery at ${pts} pts should be >= ${prev}`)
        assert.ok(m <= 100, 'Mastery should never exceed 100')
        prev = m
      }
    })

    it('inverse function calculates points needed accurately', () => {
      const targetMastery = 50 // 50% mastery
      const ptsNeeded = calculatePointsFromMastery(targetMastery)
      const reconstructedMastery = calculateMastery(ptsNeeded)
      assert.ok(Math.abs(reconstructedMastery - targetMastery) < 0.2)
    })
  })

  // ── 3. Contest Tier Interpolation ─────────────────────────────────────────
  describe('Contest Rating Interpolation', () => {
    const anchors = [[800, 0], [1200, 20], [1600, 40], [2000, 80], [2400, 100]]

    it('returns exact anchor values at exact rating points', () => {
      assert.equal(interpolateAnchors(800, anchors), 0)
      assert.equal(interpolateAnchors(1200, anchors), 20)
      assert.equal(interpolateAnchors(1600, anchors), 40)
      assert.equal(interpolateAnchors(2000, anchors), 80)
      assert.equal(interpolateAnchors(2400, anchors), 100)
    })

    it('interpolates linearly midway between anchors', () => {
      // Halfway between 1200 (20) and 1600 (40) is 1400 (30)
      assert.equal(interpolateAnchors(1400, anchors), 30)
    })

    it('clamps values below minimum anchor and above maximum anchor', () => {
      assert.equal(interpolateAnchors(400, anchors), 0)
      assert.equal(interpolateAnchors(3000, anchors), 100)
    })

    it('returns null contest score for unrated users', () => {
      assert.equal(calculateContestScore('codeforces', null), null)
      assert.equal(calculateContestScore('leetcode', undefined), null)
    })
  })

  // ── 4. Platform Skill Scores & Breadth ────────────────────────────────────
  describe('Platform Skill Calculation', () => {
    it('handles empty profile gracefully (0 score)', () => {
      const result = computePlatformSkill('codeforces', {})
      assert.equal(result.skillScore, 0)
      assert.deepEqual(result.topicMastery, {})
    })

    it('rewards breadth across core tags', () => {
      // Case A: 100 problems in ONLY 1 core tag (e.g. 'dp')
      const singleTopicProfile = {
        topics: [{ slug: 'dp', problemsSolved: 100 }],
        solvedByBucket: { medium: 100 },
      }
      const singleRes = computePlatformSkill('codeforces', singleTopicProfile)

      // Case B: 10 problems in each of the 10 core tags (same total 100 problems)
      const diverseTopicsProfile = {
        topics: [
          { slug: 'greedy', problemsSolved: 10 },
          { slug: 'dp', problemsSolved: 10 },
          { slug: 'math', problemsSolved: 10 },
          { slug: 'binary search', problemsSolved: 10 },
          { slug: 'graphs', problemsSolved: 10 },
          { slug: 'trees', problemsSolved: 10 },
          { slug: 'strings', problemsSolved: 10 },
          { slug: 'data structures', problemsSolved: 10 },
          { slug: 'two pointers', problemsSolved: 10 },
          { slug: 'implementation', problemsSolved: 10 },
        ],
        solvedByBucket: { medium: 100 },
      }
      const diverseRes = computePlatformSkill('codeforces', diverseTopicsProfile)

      // Diminishing returns ensures diverse breadth beats extreme single-topic over-specialization
      assert.ok(
        diverseRes.skillScore > singleRes.skillScore,
        `Diverse score (${diverseRes.skillScore}) should exceed single-tag specialist score (${singleRes.skillScore})`,
      )
    })

    it('computes volume score for CodeChef & AtCoder (Option B)', () => {
      const ccProfile = { problemsSolved: 300 }
      const res = computePlatformSkill('codechef', ccProfile)
      assert.ok(res.skillScore > 50 && res.skillScore < 85)
    })
  })

  // ── 5. Composite Score & Zero-Penalty Rule (D11) ──────────────────────────
  describe('Composite Score Calculation (D11 Zero Penalty)', () => {
    it('applies D11 zero-penalty: missing platforms contribute 0', () => {
      // 5 supported platforms in total: ['codeforces', 'leetcode', 'codechef', 'atcoder', 'geeksforgeeks']
      // User only connected LeetCode with score 80
      const scores = { leetcode: 80 }
      const result = computeCompositeScore(scores)

      // D11: (80 + 0 + 0 + 0 + 0) / 5 = 16.0
      assert.equal(result.compositeScore, 16.0)
      // Connected average reports 80.0
      assert.equal(result.connectedScore, 80.0)
      assert.equal(result.connectedCount, 1)
      assert.equal(result.missingPlatforms.length, 4)
    })

    it('averages perfectly when all 5 platforms are connected', () => {
      const scores = {
        codeforces: 60,
        leetcode: 80,
        codechef: 70,
        atcoder: 50,
        geeksforgeeks: 90,
      }
      const result = computeCompositeScore(scores)
      // (60 + 80 + 70 + 50 + 90) / 5 = 70.0
      assert.equal(result.compositeScore, 70.0)
      assert.equal(result.connectedScore, 70.0)
      assert.equal(result.missingPlatforms.length, 0)
    })

    it('blends contest rating when opted-in (70% skill + 30% contest)', () => {
      const score = computePlatformScore({
        skillScore: 80,
        contestScore: 50,
        includeContests: true,
      })
      // 80 * 0.7 + 50 * 0.3 = 56 + 15 = 71.0
      assert.equal(score, 71.0)
    })

    it('ignores contest rating when opt-in is false', () => {
      const score = computePlatformScore({
        skillScore: 80,
        contestScore: 50,
        includeContests: false,
      })
      assert.equal(score, 80.0)
    })
  })

  // ── 6. Deterministic Gap Analysis ─────────────────────────────────────────
  describe('Gap Analysis Math (Plan §8.6)', () => {
    it('identifies topic gaps and calculates problems needed', () => {
      const mySkill = {
        topicMastery: {
          'dynamic-programming': { points: 20, mastery: 12.5 },
        },
      }
      const friendSkill = {
        topicMastery: {
          'dynamic-programming': { points: 150, mastery: 63.2 },
        },
      }

      const gaps = computeGapAnalysis(mySkill, friendSkill, 2.25)
      assert.equal(gaps.length, 1)
      assert.equal(gaps[0].tag, 'dynamic-programming')
      assert.ok(gaps[0].gap > 50)
      assert.ok(gaps[0].pointsNeeded > 100)
      assert.ok(gaps[0].problemsNeeded > 20)
    })
  })

  // ── 7. Snapshot Test Pinned to SCORE_VERSION ──────────────────────────────
  describe('Pinned Score Version', () => {
    it('returns score_version = 1 in high level scoreProfile', () => {
      const profile = {
        rating: 1500,
        problemsSolved: 120,
        solvedByBucket: { easy: 50, medium: 50, hard: 20 },
        topics: [{ slug: 'array', problemsSolved: 40 }],
      }
      const scored = scoreProfile('leetcode', profile, { includeContests: true })
      assert.equal(scored.scoreVersion, SCORE_VERSION)
      assert.ok(scored.skillScore > 0)
      assert.ok(scored.platformScore > 0)
    })
  })
})
