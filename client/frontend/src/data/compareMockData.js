// Mock data for the Compare page — replace with real API calls in Phase 8

export const YOU = {
  handle:      'kshitij_21',
  displayName: 'Kshitij Totawar',
  initials:    'K',
  avatarColor: '#7C3AED',
  tag:         'You',
  bio:         'Final Year CSE @ SRM IST',
  status:      'Active now',
  streak:      21,
  problems:    749,
  contests:    25,
  activeDays:  235,
  // Codeforces rating
  cfRating:    741,
  cfDelta:     '+68 (last 30 days)',
  // Platform breakdown
  platformSolved: [
    { key: 'leetcode',   label: 'LeetCode',   count: 454, pct: 61, color: '#7C3AED' },
    { key: 'codeforces', label: 'Codeforces', count: 140, pct: 19, color: '#22C55E' },
    { key: 'codechef',   label: 'CodeChef',   count: 120, pct: 16, color: '#FB923C' },
    { key: 'atcoder',    label: 'AtCoder',    count:  35, pct:  5, color: '#3B82F6' },
  ],
  // Mini rating sparkline (last 10 contests)
  ratingSparkline: [620, 650, 640, 670, 660, 690, 700, 720, 730, 741],
  // Contest history (monthly counts for bar chart)
  contestHistory: [
    { label: 'Apr', count: 2 }, { label: 'May', count: 4 }, { label: 'Jun', count: 3 },
    { label: 'Jul', count: 5 }, { label: 'Aug', count: 6 }, { label: 'Sep', count: 5 },
  ],
  // Topic strength
  topics: [
    { name: 'Array',           count: 224 },
    { name: 'Dynamic Programming', count: 105 },
    { name: 'Graph',           count: 132 },
    { name: 'Tree',            count:  88 },
    { name: 'Binary Search',   count:  86 },
    { name: 'Hash Table',      count:  85 },
  ],
}

export const FRIEND = {
  id:          '1',
  handle:      '@arjun_07',
  displayName: 'Arjun Sharma',
  initials:    'A',
  avatarColor: '#2563EB',
  bio:         '3rd Year CSE @ IITD',
  status:      'Active 2 hours ago',
  streak:      42,
  problems:    1024,
  contests:    47,
  activeDays:  289,
  cfRating:    1320,
  cfDelta:     '+275 (last 30 days)',
  platformSolved: [
    { key: 'leetcode',   label: 'LeetCode',   count: 611, pct: 60, color: '#7C3AED' },
    { key: 'codeforces', label: 'Codeforces', count: 412, pct: 40, color: '#22C55E' },
    { key: 'codechef',   label: 'CodeChef',   count: 198, pct: 19, color: '#FB923C' },
    { key: 'atcoder',    label: 'AtCoder',    count: 256, pct: 25, color: '#3B82F6' },
  ],
  ratingSparkline: [900, 950, 980, 1020, 1060, 1100, 1150, 1200, 1280, 1320],
  contestHistory: [
    { label: 'Apr', count: 4 }, { label: 'May', count: 7 }, { label: 'Jun', count: 6 },
    { label: 'Jul', count: 9 }, { label: 'Aug', count: 11 }, { label: 'Sep', count: 10 },
  ],
  topics: [
    { name: 'Array',           count: 212 },
    { name: 'Dynamic Programming', count: 248 },
    { name: 'Graph',           count: 221 },
    { name: 'Tree',            count: 138 },
    { name: 'Binary Search',   count: 102 },
    { name: 'Hash Table',      count:  96 },
  ],
}

export const KEY_INSIGHTS = [
  {
    id: 'ki1',
    type: 'behind',   // 'behind' | 'gap' | 'ahead'
    title: 'You are 579 rating points behind',
    detail: 'You need to solve more problems and participate in more contests.',
  },
  {
    id: 'ki2',
    type: 'gap',
    title: 'Dynamic Programming',
    detail: 'Arjun has solved 143 more problems in DP.',
  },
  {
    id: 'ki3',
    type: 'gap',
    title: 'Graph & AtCoder',
    detail: 'Largest gaps in these topics.',
  },
  {
    id: 'ki4',
    type: 'ahead',
    title: "You're ahead in Arrays",
    detail: "You've solved 12 more problems in Arrays.",
  },
]

export const PLAN_TO_CATCH_UP = [
  {
    id: 'p1',
    icon: 'problems',
    title: 'Solve 275 more problems',
    detail: '~2 problems per day',
  },
  {
    id: 'p2',
    icon: 'rating',
    title: 'Gain ~580 Codeforces rating',
    detail: 'Estimated 15–20 more contests',
  },
  {
    id: 'p3',
    icon: 'contests',
    title: 'Attend 22 more contests',
    detail: '~1 contest every 2 weeks',
  },
  {
    id: 'p4',
    icon: 'topics',
    title: 'Improve in key topics',
    detail: 'Focus on Dynamic Programming, Graph, AtCoder',
  },
]

// Codeforces rating tier anchors for the rating bar
export const CF_TIERS = [
  { label: 'Newbie\n0',         value: 0    },
  { label: 'Pupil\n800',        value: 800  },
  { label: 'Specialist\n1400',  value: 1400 },
  { label: 'Expert\n2000',      value: 2000 },
  { label: 'Candidate Master\n2400', value: 2400 },
  { label: 'Master\n3000+',     value: 3000 },
]
