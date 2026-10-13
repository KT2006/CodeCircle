import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import AddFriendModal from '../components/friends/AddFriendModal'
import leetcodeImg from '../assets/leetcode.png'
import codeforcesImg from '../assets/codeforces.png'
import codechefImg from '../assets/codechef.png'
import atcoderImg from '../assets/atcoder.png'
import geeksforgeeksImg from '../assets/geeksforgeeks.svg'

const PALETTE = ['#3DA66A', '#E58A2B', '#3B6FE0', '#9B51E0', '#E05252', '#0284C7', '#16A34A', '#D97706']

const PLATFORM_META = {
  leetcode:      { label: 'LeetCode',      color: '#FFA116', icon: leetcodeImg },
  codeforces:    { label: 'Codeforces',    color: '#4A90E2', icon: codeforcesImg },
  codechef:      { label: 'CodeChef',      color: '#C28B5B', icon: codechefImg },
  atcoder:       { label: 'AtCoder',       color: '#9a9488', icon: atcoderImg },
  geeksforgeeks: { label: 'GeeksForGeeks', color: '#2F8D46', icon: geeksforgeeksImg },
}

const getDiffClass = (diff) => {
  if (!diff) return ''
  const d = String(diff).toLowerCase()
  if (d.includes('easy')) return 'easy'
  if (d.includes('medium')) return 'medium'
  if (d.includes('hard')) return 'hard'
  if (/\d+/.test(d)) return 'rating'
  return ''
}

const getAvatarColor = (friend) => {
  if (friend?.avatarColor) return friend.avatarColor
  const sum = (friend?.displayName || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

const getDaysAgo = (friend) => {
  if (friend?.todayActivity?.hasActivity || friend?.todayActivity?.solvedCount > 0) return 0
  if (['active_now', 'active_recent', 'active_today'].includes(friend?.status)) return 0
  if (friend?.lastSyncedAt) {
    const diffMs = Date.now() - new Date(friend.lastSyncedAt).getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  }
  return 99
}

const formatAgo = (d) => {
  if (d === 0) return 'today'
  if (d === 1) return '1 day ago'
  return `${d} days ago`
}

const computeUserStats = (profiles = {}) => {
  let solved = 0
  let directStreak = 0
  const combinedActivity = {}

  for (const p of Object.values(profiles)) {
    if (!p) continue
    solved += p.problemsSolved ?? 0
    const st = p.currentStreak ?? p.streak ?? 0
    if (st > directStreak) directStreak = st

    for (const [day, count] of Object.entries(p.activityByDate ?? {})) {
      if (count > 0) {
        combinedActivity[day] = (combinedActivity[day] ?? 0) + count
      }
    }
  }

  // Calculate streak from combinedActivity across all platforms
  const todayKey = new Date().toISOString().slice(0, 10)
  const yday = new Date(`${todayKey}T00:00:00.000Z`)
  yday.setUTCDate(yday.getUTCDate() - 1)
  let key = combinedActivity[todayKey] ? todayKey : yday.toISOString().slice(0, 10)
  let activityStreak = 0
  while (combinedActivity[key]) {
    activityStreak++
    const prev = new Date(`${key}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    key = prev.toISOString().slice(0, 10)
  }

  return {
    solved,
    streak: Math.max(directStreak, activityStreak),
  }
}

const FriendsPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Data State ──
  const [friends, setFriends] = useState([])
  const [userStats, setUserStats] = useState({ solved: 0, streak: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // ── UI Filter & Sort State ──
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'today'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('rec') // 'rec' | 'solved' | 'streak'
  const [viewAllActivity, setViewAllActivity] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedFriends, setExpandedFriends] = useState({})

  const toggleExpandFriend = (id) => {
    setExpandedFriends(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Load Friends & User Profile ──
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // 1. Load friends
      const res = await fetch('/api/friends', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      setFriends(data.friends ?? [])

      // 2. Load user profile for leaderboard
      try {
        const pRes = await fetch('/api/profile', { credentials: 'include' })
        if (pRes.ok) {
          const pData = await pRes.json()
          setUserStats(computeUserStats(pData.profiles || {}))
        }
      } catch {
        // Fallback gracefully
      }
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch('/api/friends', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) setFriends(data.friends ?? [])

        try {
          const pRes = await fetch('/api/profile', { credentials: 'include' })
          if (pRes.ok) {
            const pData = await pRes.json()
            if (!cancelled) {
              setUserStats(computeUserStats(pData.profiles || {}))
            }
          }
        } catch {
          // fallback
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Modal Add Friend ──
  const handleModalAdd = async (payload, { onError, onSuccess }) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error?.message ?? `HTTP ${res.status}`)
        return
      }
      if (data.friend) {
        setFriends(prev => [data.friend, ...prev])
      } else {
        await loadData()
      }
      onSuccess()
    } catch (err) {
      onError(err.message)
    }
  }

  // ── Derived Statistics ──
  const friendsWithDays = useMemo(() => {
    return friends.map(f => {
      const todaySolved = f.todayActivity?.solvedCount ?? 0
      const hasTodayActivity = Boolean(f.todayActivity?.hasActivity || todaySolved > 0)
      const days = hasTodayActivity ? 0 : getDaysAgo(f)
      return {
        ...f,
        daysAgo: days,
        isLive: days === 0 || hasTodayActivity,
        todaySolved,
        todayPlatforms: f.todayActivity?.platforms || [],
        todayProblems: f.todayActivity?.problems || [],
        recentProblems: f.recentActivity?.problems || [],
        color: getAvatarColor(f),
        ini: f.initials || (f.displayName || '?')[0].toUpperCase(),
      }
    })
  }, [friends])

  const liveFriends = useMemo(() => {
    return friendsWithDays.filter(f => f.isLive || f.todaySolved > 0 || f.daysAgo === 0)
  }, [friendsWithDays])

  const liveCount = liveFriends.length
  const totalSolved = useMemo(() => friends.reduce((acc, f) => acc + (f.totalSolved || 0), 0), [friends])
  const totalStreak = useMemo(() => friends.reduce((acc, f) => acc + (f.streak || 0), 0), [friends])

  const circleSolvedToday = useMemo(() => {
    return liveFriends.reduce((acc, f) => acc + (f.todaySolved || 0), 0)
  }, [liveFriends])

  const circlePlatformBreakdown = useMemo(() => {
    const map = {}
    for (const f of liveFriends) {
      for (const p of f.todayPlatforms) {
        map[p.platform] = (map[p.platform] || 0) + (p.count || 0)
      }
    }
    return Object.entries(map).map(([platform, count]) => ({
      platform,
      count,
      ...(PLATFORM_META[platform] || { label: platform, color: 'var(--mute)', icon: null }),
    }))
  }, [liveFriends])

  const topActiveFriend = useMemo(() => {
    if (friendsWithDays.length === 0) return null
    return [...friendsWithDays].sort((a, b) => a.daysAgo - b.daysAgo)[0]
  }, [friendsWithDays])

  const subtitle = useMemo(() => {
    if (liveCount > 0) {
      if (circleSolvedToday > 0) {
        return `${liveCount} of your ${liveCount === 1 ? 'friend has' : 'friends have'} solved ${circleSolvedToday} problem${circleSolvedToday === 1 ? '' : 's'} today. See who solved what below.`
      }
      return `${liveCount} of your ${liveCount === 1 ? 'friend has' : 'friends have'} already solved today.`
    }
    if (topActiveFriend) {
      return `${topActiveFriend.displayName} was last active ${formatAgo(topActiveFriend.daysAgo)}. Solve one problem today and you are first on the board.`
    }
    return 'Add friends to track progress, compete on the board, and keep your streak going together.'
  }, [liveCount, circleSolvedToday, topActiveFriend])

  // ── Filtered & Sorted Friends Grid ──
  const displayedFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const list = friendsWithDays.filter(f => {
      const matchesTab = activeTab === 'all' || f.isLive || f.todaySolved > 0 || f.daysAgo === 0
      const matchesSearch = !q || (f.displayName + ' ' + (f.handle || '')).toLowerCase().includes(q)
      return matchesTab && matchesSearch
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'solved') {
        const diff = (b.totalSolved ?? 0) - (a.totalSolved ?? 0)
        if (diff !== 0) return diff
        return (b.streak ?? 0) - (a.streak ?? 0)
      }
      if (sortBy === 'streak') {
        const diff = (b.streak ?? 0) - (a.streak ?? 0)
        if (diff !== 0) return diff
        return (b.totalSolved ?? 0) - (a.totalSolved ?? 0)
      }
      if (sortBy === 'name') {
        return (a.displayName || '').localeCompare(b.displayName || '')
      }

      // Default: 'rec' (Recently active)
      // 1. Solved today priority (higher todaySolved first)
      if (b.todaySolved !== a.todaySolved) {
        return (b.todaySolved || 0) - (a.todaySolved || 0)
      }

      // 2. Online status priority
      const STATUS_ORDER = { active_now: 0, active_recent: 1, active_today: 2, inactive: 3 }
      const statusA = STATUS_ORDER[a.status] ?? 3
      const statusB = STATUS_ORDER[b.status] ?? 3
      if (statusA !== statusB) return statusA - statusB

      // 3. Exact timestamp of sync/activity (latest first)
      const timeA = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0
      const timeB = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0
      if (timeA !== timeB) return timeB - timeA

      // 4. Days ago
      if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo

      // 5. Total solved
      return (b.totalSolved ?? 0) - (a.totalSolved ?? 0)
    })
  }, [friendsWithDays, activeTab, searchQuery, sortBy])

  // ── Leaderboard Data (User + Friends) ──
  const leaderboard = useMemo(() => {
    const userName = user?.name || 'You'
    const userInitial = (user?.name || 'K')[0].toUpperCase()
    const userEntry = {
      id: 'self',
      n: userName,
      ini: userInitial,
      col: 'var(--you)',
      s: userStats.solved,
      st: userStats.streak,
      you: true,
    }
    const friendEntries = friendsWithDays.map(f => ({
      id: f.id,
      n: f.displayName,
      ini: f.ini,
      col: f.color,
      s: f.totalSolved || 0,
      st: f.streak || 0,
      you: false,
    }))
    return [userEntry, ...friendEntries].sort((a, b) => b.s - a.s)
  }, [user, userStats, friendsWithDays])

  // ── Recent Activity ──
  const allActivities = useMemo(() => {
    const acts = []
    for (const f of friendsWithDays) {
      if (f.todaySolved > 0) {
        const topPlat = f.todayPlatforms[0]?.platformLabel || 'LeetCode'
        const probTitles = f.todayProblems.slice(0, 2).map(p => p.title).join(', ')
        acts.push({
          id: `${f.id}-today`,
          n: f.displayName,
          ini: f.ini,
          col: f.color,
          text: `Solved ${f.todaySolved} question${f.todaySolved === 1 ? '' : 's'} on ${topPlat}${probTitles ? `: ${probTitles}` : ''}`,
          t: 'today',
          daysAgo: 0,
          isToday: true,
          platform: f.todayPlatforms[0]?.platform,
        })
      } else if (f.lastActivity) {
        acts.push({
          id: `${f.id}-act`,
          n: f.displayName,
          ini: f.ini,
          col: f.color,
          text: f.lastActivity.text,
          t: f.lastActivity.timeAgo,
          daysAgo: f.daysAgo,
          isToday: false,
          platform: f.lastActivity.platform,
        })
      } else if (f.totalSolved > 0) {
        acts.push({
          id: `${f.id}-act-gen`,
          n: f.displayName,
          ini: f.ini,
          col: f.color,
          text: `${f.totalSolved} problems solved`,
          t: f.lastSeenLabel || formatAgo(f.daysAgo),
          daysAgo: f.daysAgo,
          isToday: false,
        })
      }
    }
    return acts.sort((a, b) => a.daysAgo - b.daysAgo)
  }, [friendsWithDays])

  const displayedActivities = viewAllActivity ? allActivities : allActivities.slice(0, 4)

  return (
    <>
      <div className="cc-friends">
        {/* ── Error Banner ── */}
        {loadError && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 16,
              background: 'rgba(255, 107, 107, 0.12)',
              border: '1px solid rgba(255, 107, 107, 0.25)',
              color: '#ff6b6b',
              fontSize: 14,
            }}
          >
            {loadError}
          </div>
        )}

        {/* ── Hero Section ── */}
        <section className="c">
          <span className="m">Your circle</span>
          <h1>
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}, {liveCount} solving today.
          </h1>
          <p className="m" style={{ margin: 0 }}>
            {subtitle}
          </p>
        </section>

        {/* ── Numbers Summary Row ── */}
        <section className="nums">
          <div className="c">
            <div className="d mono">{friends.length}</div>
            <small>friends</small>
          </div>
          <div className="c">
            <div className="d mono">{totalSolved}</div>
            <small>problems solved together</small>
          </div>
          <div className="c">
            <div className="d mono">{totalStreak}</div>
            <small>combined streak days</small>
          </div>
          <div className="c">
            <div className="d mono">{liveCount}</div>
            <small>solving today</small>
          </div>
        </section>

        {/* ── Segmented Tabs (matches Profile and Compare standard) ── */}
        <div className="cc-tabs cc-friends-tabs">
          <button
            type="button"
            className={`cc-tab-btn ${activeTab === 'all' ? 'active on' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All friends ({friends.length})
          </button>
          <button
            type="button"
            className={`cc-tab-btn ${activeTab === 'today' ? 'active on' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Active today ({liveCount})
          </button>
        </div>

        {/* ── Responsive Search & Filter Bar ── */}
        <div className="cc-friends-bar">
          <div className="cc-friends-search-box">
            <svg
              className="cc-search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search friends..."
              aria-label="Search friends"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cc-friends-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="cc-search-clear-btn"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="cc-friends-filter-actions">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort friends"
              className="cc-sort-select cc-friends-sort"
            >
              <option value="rec">Recently active</option>
              <option value="solved">Most solved</option>
              <option value="streak">Longest streak</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <button
              type="button"
              className="p cc-friends-add-btn"
              onClick={() => setModalOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Add friend</span>
            </button>
          </div>
        </div>

        {/* ── Leaderboard Card (#lb) ── */}
        <section className="c">
          <div className="hd">
            <h2>Leaderboard</h2>
            <span className="m" style={{ fontSize: 13 }}>By problems solved</span>
          </div>

          <div>
            {leaderboard.map((item, index) => (
              <div className="lbrow" key={item.id}>
                <span className="lbrank mono">{index + 1}</span>
                <span
                  className="lbav"
                  style={{
                    background: item.col,
                    color: item.you ? 'var(--on)' : '#fff',
                  }}
                >
                  {item.ini}
                </span>
                <div className="lbinfo">
                  <span className="lbname">
                    {item.you ? (
                      <>
                        <b>{item.n}</b>
                        <span className="you-tag">you</span>
                      </>
                    ) : (
                      item.n
                    )}
                  </span>
                  <span className="lbst-mobile mono m">{item.st}d streak</span>
                </div>
                <span className="lbst lbst-desktop mono m">{item.st}d streak</span>
                <div className="lbscore-wrap">
                  <span className="lbscore mono">{item.s}</span>
                  <span className="lbscore-sub m">solved</span>
                </div>
              </div>
            ))}
          </div>

          {friends.length <= 1 && (
            <div className="dash" style={{ marginTop: 14 }}>
              <b>{friends.length === 0 ? 'Nobody else on the board yet' : 'Only two of you so far'}</b>
              <div className="m" style={{ margin: '4px 0 12px' }}>
                Add friends to see everyone on one board.
              </div>
              <button
                type="button"
                className="p"
                onClick={() => setModalOpen(true)}
              >
                Add a friend
              </button>
            </div>
          )}
        </section>

        {/* ── Recent Activity Card (#ra) ── */}
        <section className="c">
          <div className="hd">
            <h2>Recent activity</h2>
            {allActivities.length > 4 && (
              <button type="button" onClick={() => setViewAllActivity(v => !v)}>
                {viewAllActivity ? 'Show less' : 'View all'}
              </button>
            )}
          </div>

          <div>
            {displayedActivities.length > 0 ? (
              displayedActivities.map((act) => {
                const platMeta = PLATFORM_META[act.platform]
                return (
                  <div className="act" key={act.id}>
                    <div className="av" style={{ '--c': act.col }}>
                      {act.ini}
                    </div>
                    <div className="act-body">
                      <div className="act-header">
                        <span className="act-name"><b>{act.n}</b></span>
                        <span className="t" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {act.isToday && <span className="dot live" />}
                          {act.t}
                        </span>
                      </div>
                      <div className="act-text-row">
                        {platMeta?.icon && (
                          <img
                            src={platMeta.icon}
                            alt=""
                            className="act-plat-icon"
                          />
                        )}
                        <span className="m act-text-content">{act.text}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="m" style={{ padding: '12px 0', fontSize: 14 }}>
                No recent activity yet. When friends solve problems, they'll appear here.
              </div>
            )}
          </div>
        </section>

        {/* ── Active Today Tab: Detailed Who Solved What Breakdown ── */}
        {activeTab === 'today' && (
          <section className="today-hub">
            <div className="today-hub-banner">
              <div className="today-hub-top">
                <div>
                  <div className="today-hub-title">
                    <span>Active Today Activity Breakdown</span>
                  </div>
                  <p className="m" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    Live breakdown of who solved what, how many questions, and on which platform today.
                  </p>
                </div>
                <div className="today-circle-pills">
                  <span className="today-pill accent">
                    {circleSolvedToday} questions solved today
                  </span>
                  {circlePlatformBreakdown.map((p) => (
                    <span className="today-pill" key={p.platform}>
                      {p.icon && <img src={p.icon} alt={p.label} />}
                      <span>{p.label}: <b>{p.count}</b> solved</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Today Feed List */}
            <div className="today-feed">
              {displayedFriends.length > 0 ? (
                displayedFriends.map((f) => {
                  const isExpanded = Boolean(expandedFriends[f.id])
                  const visibleProblems = isExpanded ? f.todayProblems : f.todayProblems.slice(0, 4)
                  const remainingCount = Math.max(0, f.todayProblems.length - 4)

                  return (
                    <article className="today-card" key={f.id}>
                      <div className="today-card-header">
                        <div className="today-card-user">
                          <div className="av" style={{ '--c': f.color }}>
                            {f.ini}
                          </div>
                          <div>
                            <div className="n">{f.displayName}</div>
                            <div className="m" style={{ fontSize: 13 }}>
                              {f.handle || 'No handle'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className="streak mono">{f.streak ?? 0}d streak</span>
                          {f.todaySolved > 0 ? (
                            <span className="today-solved-badge">
                              +{f.todaySolved} solved today
                            </span>
                          ) : (
                            <span className="m" style={{ fontSize: 13 }}>
                              Active today (0 solved yet)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Platform breakdown */}
                      {f.todayPlatforms.length > 0 && (
                        <div className="today-card-platforms">
                          {f.todayPlatforms.map((plat) => {
                            const meta = PLATFORM_META[plat.platform] || { label: plat.platform, icon: null }
                            return (
                              <span className="today-card-plat-pill" key={plat.platform}>
                                {meta.icon && <img src={meta.icon} alt={plat.platformLabel} />}
                                <span>{plat.platformLabel}: <b>{plat.count}</b> {plat.count === 1 ? 'question' : 'questions'}</span>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Solved Problems List */}
                      {f.todayProblems.length > 0 ? (
                        <div className="today-prob-list">
                          <div className="m" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            Questions solved today ({f.todayProblems.length}):
                          </div>
                          {visibleProblems.map((prob, idx) => {
                            const pMeta = PLATFORM_META[prob.platform]
                            const diffCls = getDiffClass(prob.difficulty)
                            return (
                              <div className="today-prob-row" key={`${prob.title}-${idx}`}>
                                <div className="today-prob-info">
                                  {pMeta?.icon && <img src={pMeta.icon} alt="" />}
                                  {prob.url ? (
                                    <a
                                      href={prob.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="today-prob-title"
                                    >
                                      {prob.title}
                                      <span style={{ opacity: 0.6, fontSize: 12 }}>↗</span>
                                    </a>
                                  ) : (
                                    <span className="today-prob-title">{prob.title}</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  {prob.difficulty && (
                                    <span className={`today-diff-badge ${diffCls}`}>
                                      {prob.difficulty}
                                    </span>
                                  )}
                                  <span className="m" style={{ fontSize: 12 }}>today</span>
                                </div>
                              </div>
                            )
                          })}

                          {remainingCount > 0 && (
                            <button
                              type="button"
                              className="today-expand-btn"
                              onClick={() => toggleExpandFriend(f.id)}
                            >
                              {isExpanded ? 'Show fewer questions' : `+ ${remainingCount} more questions solved today`}
                            </button>
                          )}
                        </div>
                      ) : f.todaySolved > 0 ? (
                        <div className="m" style={{ fontSize: 13, background: 'var(--surf2)', padding: '10px 14px', borderRadius: 10 }}>
                          Solved {f.todaySolved} problems across {f.todayPlatforms.map(p => p.platformLabel).join(', ')} today.
                        </div>
                      ) : (
                        <div className="m" style={{ fontSize: 13 }}>
                          Active today · No problems solved yet today.
                        </div>
                      )}

                      <div className="btns" style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="p"
                          onClick={() => navigate(`/compare?friend=${f.id}`)}
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/friends/${f.id}`)}
                        >
                          View profile
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="empty">
                  {loading
                    ? 'Loading circle…'
                    : 'Nobody has solved yet today. Be the first.'}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── All Friends Tab: Cards Grid (#gr) ── */}
        {activeTab === 'all' && (
          <section className="grid cc-friends-grid">
            {displayedFriends.map((f) => {
              const isLive = f.isLive || f.todaySolved > 0 || f.daysAgo === 0
              const lastText = f.lastActivity?.text || (f.platforms ? Object.keys(f.platforms).length + ' platforms linked' : 'No submissions yet')
              const lastTime = f.lastActivity?.timeAgo || f.lastSeenLabel || 'recently'

              return (
                <article className="c fc" key={f.id}>
                  <div className="top">
                    <div className="av" style={{ '--c': f.color }}>
                      {f.ini}
                    </div>
                    <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
                      <div
                        className="n"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {f.displayName}
                      </div>
                      <div
                        className="m"
                        style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {f.handle || 'No handle'}
                      </div>
                    </div>
                    <span className="streak mono">{f.streak ?? 0}d</span>
                  </div>

                  {/* If active today, show Today Highlight Block */}
                  {f.todaySolved > 0 ? (
                    <div className="card-today-highlight">
                      <div className="card-today-top">
                        <span className="card-today-count">
                          +{f.todaySolved} today
                        </span>
                        <div className="card-today-plat-pills">
                          {f.todayPlatforms.map((plat) => {
                            const meta = PLATFORM_META[plat.platform]
                            return (
                              <span className="card-mini-plat-pill" key={plat.platform}>
                                {meta?.icon && <img src={meta.icon} alt="" />}
                                <span>{plat.count}</span>
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {f.todayProblems.length > 0 && (
                        <div className="card-today-probs">
                          {f.todayProblems.slice(0, 2).map((prob, i) => (
                            <div className="card-today-prob-item" key={i}>
                              <span style={{ color: 'var(--you)', flexShrink: 0 }}>✓</span>
                              {prob.url ? (
                                <a
                                  href={prob.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  {prob.title}
                                </a>
                              ) : (
                                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {prob.title}
                                </span>
                              )}
                            </div>
                          ))}
                          {f.todayProblems.length > 2 && (
                            <span className="m" style={{ fontSize: 11 }}>
                              +{f.todayProblems.length - 2} more today
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div>
                    <div className="big mono">{f.totalSolved ?? 0}</div>
                    <span className="m">problems solved</span>
                  </div>

                  <div className="m" style={{ fontSize: 14 }}>
                    <span className={`dot ${isLive ? 'live' : ''}`} />
                    {f.todaySolved > 0 ? `Active today (+${f.todaySolved} solved)` : isLive ? 'Active today' : `Active ${lastTime}`}
                  </div>

                  <div className="last">
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, marginRight: 8 }}>
                      {lastText}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {lastTime}
                    </span>
                  </div>

                  <div className="btns">
                    <button
                      type="button"
                      className="p"
                      onClick={() => navigate(`/compare?friend=${f.id}`)}
                    >
                      Compare
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/friends/${f.id}`)}
                    >
                      View profile
                    </button>
                  </div>
                </article>
              )
            })}

            {/* Dash Card when in 'all' tab & no search */}
            {!searchQuery.trim() && (
              <div className="dash">
                <b>Know someone who codes?</b>
                <span className="m">Friends make the streak easier to keep.</span>
                <button
                  type="button"
                  className="p"
                  onClick={() => setModalOpen(true)}
                >
                  Add friend
                </button>
              </div>
            )}

            {/* Empty State */}
            {displayedFriends.length === 0 && (
              <div className="empty">
                {loading
                  ? 'Loading circle…'
                  : searchQuery
                  ? 'No friends match that search.'
                  : 'No friends in your circle yet. Add friends above to start.'}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Multi-Platform Add Friend Modal ── */}
      <AddFriendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalAdd}
      />
    </>
  )
}

export default FriendsPage
