/**
 * src/config/scoring.js
 *
 * Single source of truth for all scoring engine constants.
 * Plan §8: "All constants live in one config file. No magic numbers elsewhere."
 */

export const SCORE_VERSION = 1

/**
 * Saturation constant for the diminishing-returns mastery curve:
 * Mastery = 100 * (1 - exp(-points / S))
 * S = 150 ensures:
 *   - 10 problems at 800 (10 pts) -> ~6.4%
 *   - 30 problems at 1200 (67.5 pts) -> ~36.2%
 *   - 100 problems at 1600 (400 pts) -> ~93.1%
 */
export const SATURATION_CONSTANT = 150

export const DIFFICULTY_CONFIG = {
  BASE_RATING: 800,
  MIN_CLAMP_RATING: 800,
  MAX_CLAMP_RATING: 3500,
  UNRATED_CF_DEFAULT: 1200,

  // Tunable approximate ratings for difficulty buckets
  LEETCODE: {
    easy: 900,
    medium: 1500,
    hard: 2100,
  },
  GEEKSFORGEEKS: {
    school: 700,
    basic: 800,
    easy: 1000,
    medium: 1500,
    hard: 2000,
  },
}

/**
 * Core topics evaluated for each platform's skill score.
 * A missing topic contributes 0 to the sum, rewarding breadth.
 */
export const CORE_TAGS = {
  codeforces: [
    'greedy',
    'dp',
    'math',
    'implementation',
    'constructive algorithms',
    'binary search',
    'graphs',
    'trees',
    'dfs and similar',
    'data structures',
    'strings',
    'two pointers',
  ],
  leetcode: [
    'array',
    'string',
    'hash-table',
    'dynamic-programming',
    'math',
    'greedy',
    'sorting',
    'binary-search',
    'tree',
    'depth-first-search',
    'graph',
    'two-pointers',
  ],
  geeksforgeeks: [
    'arrays',
    'strings',
    'hash',
    'dynamic-programming',
    'mathematical',
    'greedy',
    'sorting',
    'binary-search',
    'tree',
    'dfs',
    'graph',
    'two-pointer-algorithm',
  ],
}

/**
 * Synonym mapping between tag slugs across platforms so gap analysis and
 * cross-platform radar comparison can match related topics.
 */
export const TAG_SYNONYMS = {
  // DP
  dp: 'dynamic-programming',
  'dynamic-programming': 'dynamic-programming',
  'dynamic programming': 'dynamic-programming',

  // Binary Search
  'binary search': 'binary-search',
  'binary-search': 'binary-search',

  // Graphs
  graphs: 'graph',
  graph: 'graph',

  // Trees
  trees: 'tree',
  tree: 'tree',

  // DFS / BFS
  'dfs and similar': 'dfs',
  'depth-first-search': 'dfs',
  dfs: 'dfs',
  'breadth-first-search': 'bfs',
  bfs: 'bfs',

  // Two pointers
  'two pointers': 'two-pointers',
  'two-pointers': 'two-pointers',
  'two-pointer-algorithm': 'two-pointers',

  // Arrays & Strings
  array: 'array',
  arrays: 'array',
  string: 'string',
  strings: 'string',

  // Math
  math: 'math',
  mathematical: 'math',

  // Hash Table
  'hash-table': 'hash-table',
  hash: 'hash-table',

  // Data Structures
  'data structures': 'data-structures',
  'data-structures': 'data-structures',
}

/**
 * Piecewise-linear rating anchors: [rating, score_0_to_100]
 * Follows published rank tiers per platform.
 */
export const CONTEST_RATING_ANCHORS = {
  codeforces: [
    [800, 0],
    [1200, 15],
    [1400, 30],
    [1600, 45],
    [1900, 65],
    [2100, 78],
    [2400, 90],
    [3000, 100],
  ],
  leetcode: [
    [1200, 0],
    [1500, 20],
    [1700, 40],
    [1850, 60],
    [2150, 85],
    [2500, 100],
  ],
  codechef: [
    [1000, 0],
    [1400, 20],
    [1600, 35],
    [1800, 50],
    [2000, 70],
    [2200, 85],
    [2500, 100],
  ],
  atcoder: [
    [0, 0],
    [400, 10],
    [800, 25],
    [1200, 45],
    [1600, 65],
    [2000, 80],
    [2400, 90],
    [2800, 100],
  ],
  geeksforgeeks: [
    [1200, 0],
    [1500, 25],
    [1800, 50],
    [2000, 75],
    [2300, 100],
  ],
}

/**
 * Solved problem volume anchors for platforms without granular topic tags
 * (CodeChef and AtCoder under Option B).
 */
export const VOLUME_ANCHORS = {
  codechef: [
    [0, 0],
    [30, 15],
    [100, 35],
    [250, 55],
    [500, 75],
    [1000, 90],
    [1500, 100],
  ],
  atcoder: [
    [0, 0],
    [30, 15],
    [100, 35],
    [250, 55],
    [500, 75],
    [1000, 90],
    [1500, 100],
  ],
}

export const BLEND_WEIGHTS = {
  WITH_CONTEST: {
    SKILL: 0.7,
    CONTEST: 0.3,
  },
  WITHOUT_CONTEST: {
    SKILL: 1.0,
    CONTEST: 0.0,
  },
}

export const ALL_SUPPORTED_PLATFORMS = [
  'codeforces',
  'leetcode',
  'codechef',
  'atcoder',
  'geeksforgeeks',
]
