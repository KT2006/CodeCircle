// Mock data for the Friends page — replace with real API calls in Phase 7

export const FRIENDS_MOCK = [
  {
    id: '1',
    displayName: 'Arjun Sharma',
    handle: '@arjun_07',
    avatarColor: '#7C3AED',
    initials: 'A',
    status: 'active_now',         // 'active_now' | 'active_recent' | 'active_today' | 'inactive'
    lastSeenLabel: 'Active now',
    streak: 14,
    platforms: {
      codeforces: { delta: +5, total: 412, rating: null,   ratingDelta: null },
      codechef:   { delta: +3, total: null, rating: 1320,  ratingDelta: +3  },
      leetcode:   { delta: +0, total: 286,  rating: null,   ratingDelta: null },
    },
    sparkline: [30, 38, 32, 45, 42, 55, 50, 62, 58, 70],
    lastActivity: { platform: 'codeforces', text: 'Participated in CF Round #1012', timeAgo: '1 hour ago' },
  },
  {
    id: '2',
    displayName: 'Rahul Verma',
    handle: '@rahul_dev',
    avatarColor: '#2563EB',
    initials: 'R',
    status: 'active_recent',
    lastSeenLabel: 'Active 32 min ago',
    streak: 7,
    platforms: {
      codeforces: { delta: +2, total: 624,  rating: null,   ratingDelta: null },
      codechef:   { delta: +0, total: null,  rating: 1180,  ratingDelta: +0  },
      leetcode:   { delta: +1, total: 342,  rating: null,   ratingDelta: null },
    },
    sparkline: [20, 25, 22, 28, 26, 30, 27, 32, 29, 35],
    lastActivity: { platform: 'leetcode', text: 'Solved 2 problems on LeetCode', timeAgo: '32 minutes ago' },
  },
  {
    id: '3',
    displayName: 'Priya Singh',
    handle: '@priya_24',
    avatarColor: '#DB2777',
    initials: 'P',
    status: 'active_recent',
    lastSeenLabel: 'Active 1 hour ago',
    streak: 21,
    platforms: {
      codeforces: { delta: +3, total: 511,  rating: null,   ratingDelta: null },
      codechef:   { delta: +1, total: null,  rating: 1420,  ratingDelta: +1  },
      leetcode:   { delta: +0, total: 198,  rating: null,   ratingDelta: null },
    },
    sparkline: [40, 48, 44, 55, 52, 65, 60, 72, 68, 80],
    lastActivity: { platform: 'codeforces', text: 'Increased CF rating by 68', timeAgo: '2 hours ago' },
  },
  {
    id: '4',
    displayName: 'Aditya Kumar',
    handle: '@aditya_k',
    avatarColor: '#059669',
    initials: 'A',
    status: 'active_recent',
    lastSeenLabel: 'Active 2 hours ago',
    streak: 5,
    platforms: {
      codeforces: { delta: +1, total: 278,  rating: null,   ratingDelta: null },
      codechef:   { delta: +4, total: null,  rating: 960,   ratingDelta: +4  },
      leetcode:   { delta: +3, total: 412,  rating: null,   ratingDelta: null },
    },
    sparkline: [15, 20, 18, 25, 22, 28, 25, 32, 29, 36],
    lastActivity: { platform: 'codechef', text: 'Solved 3 problems on CodeChef', timeAgo: '3 hours ago' },
  },
  {
    id: '5',
    displayName: 'Neha Patel',
    handle: '@neha_p',
    avatarColor: '#10B981',
    initials: 'N',
    status: 'active_today',
    lastSeenLabel: 'Active today',
    streak: 9,
    platforms: {
      codeforces: { delta: +6, total: 387,  rating: null,   ratingDelta: null },
      codechef:   { delta: +0, total: null,  rating: 1024,  ratingDelta: +0  },
      leetcode:   { delta: +0, total: 256,  rating: null,   ratingDelta: null },
    },
    sparkline: [25, 30, 28, 35, 32, 38, 35, 42, 39, 45],
    lastActivity: { platform: 'leetcode', text: 'Solved 6 problems on LeetCode', timeAgo: '5 hours ago' },
  },
  {
    id: '6',
    displayName: 'Siddharth Roy',
    handle: '@siddharth_r',
    avatarColor: '#7C3AED',
    initials: 'S',
    status: 'inactive',
    lastSeenLabel: 'Last active yesterday',
    streak: 2,
    platforms: {
      codeforces: { delta: +0, total: 198,  rating: null,   ratingDelta: null },
      codechef:   { delta: +0, total: null,  rating: 842,   ratingDelta: +0  },
      leetcode:   { delta: +0, total: 176,  rating: null,   ratingDelta: null },
    },
    sparkline: [10, 12, 11, 14, 13, 15, 14, 16, 15, 17],
    lastActivity: { platform: 'codeforces', text: 'Rated in CF Div 3', timeAgo: 'yesterday' },
  },
]

export const RECENT_ACTIVITY_MOCK = [
  {
    id: 'ra1',
    friendInitials: 'A',
    friendColor: '#7C3AED',
    text: 'Arjun solved 5 problems',
    platform: 'LeetCode',
    timeAgo: '24 minutes ago',
    badge: '+5',
    badgeColor: '#7C3AED',
    badgeIcon: 'leetcode',
  },
  {
    id: 'ra2',
    friendInitials: 'R',
    friendColor: '#2563EB',
    text: 'Rahul participated in Codeforces Round #1012',
    platform: 'Codeforces',
    timeAgo: '1 hour ago',
    badge: null,
    badgeIcon: 'codeforces',
  },
  {
    id: 'ra3',
    friendInitials: 'P',
    friendColor: '#DB2777',
    text: 'Priya increased Codeforces rating by 68',
    platform: 'Codeforces',
    timeAgo: '2 hours ago',
    badge: '+68',
    badgeColor: '#22C55E',
    badgeIcon: 'codeforces',
    badgeType: 'rating',
  },
  {
    id: 'ra4',
    friendInitials: 'A',
    friendColor: '#059669',
    text: 'Aditya solved 3 problems',
    platform: 'CodeChef',
    timeAgo: '3 hours ago',
    badge: '+3',
    badgeColor: '#F97316',
    badgeIcon: 'codechef',
  },
]

// ── Per-friend rich profile data (keyed by friend id) ─────────────────────────

export const FRIEND_PROFILES = {
  '1': {
    bio: 'Solving today for a better tomorrow.',
    bioTag: '#KeepGoing',
    lastFetchedLabel: '12 minutes ago',
    // 4 headline stat cards
    headline: {
      cfRating:        { value: 1320, delta: '+68 (last 30 days)' },
      problemsSolved:  { value: 1024, delta: '+23 this week' },
      contestsAttended:{ value: 47,   sub: '1 this month'   },
      currentStreak:   { value: 14,   best: 42              },
    },
    // Per-platform solved + weekly delta
    platformSolved: [
      { key: 'leetcode',   label: 'LeetCode',   solved: 511, weekDelta: +12 },
      { key: 'codeforces', label: 'Codeforces', solved: 412, weekDelta: +8  },
      { key: 'codechef',   label: 'CodeChef',   solved: 198, weekDelta: +3  },
      { key: 'atcoder',    label: 'AtCoder',    solved: 256, weekDelta: +0  },
    ],
    // Rating history per platform (for Rating Trend chart)
    ratingHistory: {
      codeforces: [
        { label: 'Apr 2', rating: 820 }, { label: 'Apr 20', rating: 870 },
        { label: 'May 5', rating: 910 }, { label: 'May 22', rating: 950 },
        { label: 'Jun 8', rating: 990 }, { label: 'Jun 25', rating: 1040 },
        { label: 'Jul 10', rating: 1080 }, { label: 'Jul 28', rating: 1130 },
        { label: 'Aug 14', rating: 1180 }, { label: 'Aug 31', rating: 1240 },
        { label: 'Sep 13', rating: 1320 },
      ],
      leetcode: [
        { label: 'Apr 5', rating: 1480 }, { label: 'May 2', rating: 1510 },
        { label: 'Jun 1', rating: 1540 }, { label: 'Jul 3', rating: 1590 },
        { label: 'Aug 7', rating: 1620 }, { label: 'Sep 4', rating: 1650 },
      ],
      codechef: [
        { label: 'Apr 10', rating: 1200 }, { label: 'May 15', rating: 1250 },
        { label: 'Jun 20', rating: 1280 }, { label: 'Jul 25', rating: 1310 },
        { label: 'Aug 28', rating: 1320 },
      ],
      atcoder: [
        { label: 'May 3', rating: 600 }, { label: 'Jun 14', rating: 650 },
        { label: 'Jul 19', rating: 700 }, { label: 'Aug 23', rating: 720 },
      ],
    },
    // Activity heatmap: date → submission count
    activityByDate: (() => {
      const map = {}
      const base = new Date('2025-04-01')
      for (let i = 0; i < 170; i++) {
        const d = new Date(base)
        d.setDate(base.getDate() + i)
        const key = d.toISOString().slice(0, 10)
        // generate some activity with gaps
        if (Math.random() > 0.3) map[key] = Math.floor(Math.random() * 10) + 1
      }
      return map
    })(),
    // Topics
    topics: [
      { name: 'Array',               count: 224, color: '#7C3AED' },
      { name: 'Dynamic Programming', count: 148, color: '#3B82F6' },
      { name: 'Graph',               count: 132, color: '#22C55E' },
      { name: 'Tree',                count: 88,  color: '#EAB308' },
      { name: 'Hash Table',          count: 85,  color: '#F97316' },
    ],
    // Submission activity last 30 days (for bar chart)
    submissionActivity: (() => {
      const days = []
      const base = new Date('2025-08-14')
      for (let i = 0; i < 30; i++) {
        const d = new Date(base)
        d.setDate(base.getDate() + i)
        days.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          count: Math.random() > 0.25 ? Math.floor(Math.random() * 48) + 2 : 0,
        })
      }
      return days
    })(),
    // Stats snapshot vs last 30 days
    statsSnapshot: {
      problemsSolved: +23,
      ratingChange:   +68,
      contestsAttended: 1,
      activeDays: 18,
    },
    // Today's activity
    todayActivity: [
      { platform: 'leetcode',   text: 'Solved 2 problems on LeetCode',    timeAgo: '2 hours ago'  },
      { platform: 'codeforces', text: 'Solved 1 problem on Codeforces',   timeAgo: '4 hours ago'  },
      { platform: 'codeforces', text: 'Participated in CF Round #1012',   timeAgo: '6 hours ago'  },
    ],
    // Recent contests
    recentContests: [
      { platform: 'codeforces', name: 'Codeforces Round #1012', rank: '#842',  date: 'Sep 7, 2025',  ratingDelta: -32  },
      { platform: 'codechef',   name: 'CodeChef Starters 170',  rank: '#412',  date: 'Aug 28, 2025', ratingDelta: +120 },
      { platform: 'atcoder',    name: 'AtCoder Beginner 356',    rank: '#623',  date: 'Aug 17, 2025', ratingDelta: +45  },
    ],
  },
}

// Fill remaining friends with lighter profiles
for (const friend of [
  { id: '2', name: 'Rahul Verma',    bio: 'Grinding every day.', tag: '#Consistent' },
  { id: '3', name: 'Priya Singh',    bio: 'Keep pushing forward.', tag: '#NeverStop'  },
  { id: '4', name: 'Aditya Kumar',   bio: 'One problem at a time.', tag: '#Focus'      },
  { id: '5', name: 'Neha Patel',     bio: 'Progress over perfection.', tag: '#Growth'  },
  { id: '6', name: 'Siddharth Roy',  bio: 'Learning something new today.', tag: '#Daily' },
]) {
  FRIEND_PROFILES[friend.id] = {
    bio: friend.bio,
    bioTag: friend.tag,
    lastFetchedLabel: '1 hour ago',
    headline: {
      cfRating:         { value: 900 + Math.floor(Math.random() * 800), delta: '+20 (last 30 days)' },
      problemsSolved:   { value: 300 + Math.floor(Math.random() * 700), delta: '+10 this week'       },
      contestsAttended: { value: 10  + Math.floor(Math.random() * 40),  sub: '0 this month'          },
      currentStreak:    { value: 3   + Math.floor(Math.random() * 20),  best: 30                     },
    },
    platformSolved: [
      { key: 'leetcode',   label: 'LeetCode',   solved: 100 + Math.floor(Math.random() * 400), weekDelta: Math.floor(Math.random() * 10) },
      { key: 'codeforces', label: 'Codeforces', solved: 80  + Math.floor(Math.random() * 300), weekDelta: Math.floor(Math.random() * 8)  },
      { key: 'codechef',   label: 'CodeChef',   solved: 50  + Math.floor(Math.random() * 200), weekDelta: Math.floor(Math.random() * 5)  },
      { key: 'atcoder',    label: 'AtCoder',    solved: 30  + Math.floor(Math.random() * 150), weekDelta: Math.floor(Math.random() * 3)  },
    ],
    ratingHistory: {
      codeforces: [
        { label: 'Apr', rating: 800 }, { label: 'May', rating: 850 },
        { label: 'Jun', rating: 900 }, { label: 'Jul', rating: 920 },
        { label: 'Aug', rating: 950 }, { label: 'Sep', rating: 970 },
      ],
      leetcode: [
        { label: 'Apr', rating: 1400 }, { label: 'Jun', rating: 1450 },
        { label: 'Aug', rating: 1480 }, { label: 'Sep', rating: 1500 },
      ],
      codechef: [{ label: 'Apr', rating: 1100 }, { label: 'Sep', rating: 1200 }],
      atcoder:  [{ label: 'Apr', rating: 500  }, { label: 'Sep', rating: 600  }],
    },
    activityByDate: (() => {
      const map = {}
      const base = new Date('2025-04-01')
      for (let i = 0; i < 170; i++) {
        const d = new Date(base)
        d.setDate(base.getDate() + i)
        if (Math.random() > 0.45) map[d.toISOString().slice(0, 10)] = Math.floor(Math.random() * 6) + 1
      }
      return map
    })(),
    topics: [
      { name: 'Array',   count: 80 + Math.floor(Math.random() * 100), color: '#7C3AED' },
      { name: 'DP',      count: 50 + Math.floor(Math.random() * 80),  color: '#3B82F6' },
      { name: 'Graph',   count: 40 + Math.floor(Math.random() * 60),  color: '#22C55E' },
      { name: 'Tree',    count: 30 + Math.floor(Math.random() * 50),  color: '#EAB308' },
      { name: 'Strings', count: 20 + Math.floor(Math.random() * 40),  color: '#F97316' },
    ],
    submissionActivity: (() => {
      const days = []
      const base = new Date('2025-08-14')
      for (let i = 0; i < 30; i++) {
        const d = new Date(base)
        d.setDate(base.getDate() + i)
        days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: Math.random() > 0.3 ? Math.floor(Math.random() * 30) + 1 : 0 })
      }
      return days
    })(),
    statsSnapshot: { problemsSolved: Math.floor(Math.random() * 20), ratingChange: Math.floor(Math.random() * 60), contestsAttended: Math.floor(Math.random() * 3), activeDays: Math.floor(Math.random() * 25) },
    todayActivity: [
      { platform: 'leetcode', text: 'Solved a problem on LeetCode', timeAgo: '3 hours ago' },
    ],
    recentContests: [
      { platform: 'codeforces', name: 'Codeforces Round #1010', rank: '#900', date: 'Sep 5, 2025', ratingDelta: +20 },
      { platform: 'codechef',   name: 'CodeChef Starters 168',  rank: '#600', date: 'Aug 14, 2025', ratingDelta: +40 },
    ],
  }
}

export const STAT_CARDS_MOCK = {
  friendsActive: { value: 8, subtitle: 'out of 12 friends' },
  problemsSolved: { value: 47, subtitle: 'across all platforms', delta: '+28%' },
  contestsAttended: { value: 3, subtitle: 'today' },
  totalRatingChange: { value: '+124', subtitle: 'across all friends', delta: '+42%' },
}
