import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import AddFriendModal from '../components/friends/AddFriendModal'

const PALETTE = ['#3DA66A', '#E58A2B', '#3B6FE0', '#9B51E0', '#E05252', '#0284C7', '#16A34A', '#D97706']

const getAvatarColor = (friend) => {
  if (friend?.avatarColor) return friend.avatarColor
  const sum = (friend?.displayName || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

const getDaysAgo = (friend) => {
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
          const profiles = pData.profiles || {}
          let s = 0
          let st = 0
          for (const p of Object.values(profiles)) {
            s += p.problemsSolved ?? 0
            if ((p.streak ?? 0) > st) st = p.streak
          }
          setUserStats({ solved: s, streak: st })
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
              const profiles = pData.profiles || {}
              let s = 0
              let st = 0
              for (const p of Object.values(profiles)) {
                s += p.problemsSolved ?? 0
                if ((p.streak ?? 0) > st) st = p.streak
              }
              setUserStats({ solved: s, streak: st })
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
    return friends.map(f => ({
      ...f,
      daysAgo: getDaysAgo(f),
      color: getAvatarColor(f),
      ini: f.initials || (f.displayName || '?')[0].toUpperCase(),
    }))
  }, [friends])

  const liveFriends = useMemo(() => {
    return friendsWithDays.filter(f => f.daysAgo === 0)
  }, [friendsWithDays])

  const liveCount = liveFriends.length
  const totalSolved = useMemo(() => friends.reduce((acc, f) => acc + (f.totalSolved || 0), 0), [friends])
  const totalStreak = useMemo(() => friends.reduce((acc, f) => acc + (f.streak || 0), 0), [friends])

  const topActiveFriend = useMemo(() => {
    if (friendsWithDays.length === 0) return null
    return [...friendsWithDays].sort((a, b) => a.daysAgo - b.daysAgo)[0]
  }, [friendsWithDays])

  const subtitle = useMemo(() => {
    if (liveCount > 0) {
      return `${liveCount} of your ${liveCount === 1 ? 'friend has' : 'friends have'} already solved today.`
    }
    if (topActiveFriend) {
      return `${topActiveFriend.displayName} was last active ${formatAgo(topActiveFriend.daysAgo)}. Solve one problem today and you are first on the board.`
    }
    return 'Add friends to track progress, compete on the board, and keep your streak going together.'
  }, [liveCount, topActiveFriend])

  // ── Filtered & Sorted Friends Grid ──
  const displayedFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const list = friendsWithDays.filter(f => {
      const matchesTab = activeTab === 'all' || f.daysAgo === 0
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
      // 1. Online status priority: active_now (0) > active_recent (1) > active_today (2) > inactive (3)
      const STATUS_ORDER = { active_now: 0, active_recent: 1, active_today: 2, inactive: 3 }
      const statusA = STATUS_ORDER[a.status] ?? 3
      const statusB = STATUS_ORDER[b.status] ?? 3
      if (statusA !== statusB) return statusA - statusB

      // 2. Exact timestamp of sync/activity (latest first)
      const timeA = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0
      const timeB = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0
      if (timeA !== timeB) return timeB - timeA

      // 3. Days ago (lower days first)
      if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo

      // 4. Total solved
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
      if (f.lastActivity) {
        acts.push({
          id: `${f.id}-act`,
          n: f.displayName,
          ini: f.ini,
          col: f.color,
          text: f.lastActivity.text,
          t: f.lastActivity.timeAgo,
          daysAgo: f.daysAgo,
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

        {/* ── Filter & Search Bar ── */}
        <div className="bar">
          <button
            type="button"
            className={activeTab === 'all' ? 'on' : ''}
            onClick={() => setActiveTab('all')}
          >
            All friends ({friends.length})
          </button>
          <button
            type="button"
            className={activeTab === 'today' ? 'on' : ''}
            onClick={() => setActiveTab('today')}
          >
            Active today ({liveCount})
          </button>

          <div className="sp">
            <input
              type="search"
              placeholder="Search friends"
              aria-label="Search friends"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort friends"
              className="cc-sort-select"
            >
              <option value="rec">Recently active</option>
              <option value="solved">Most solved</option>
              <option value="streak">Longest streak</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <button
              type="button"
              className="p"
              onClick={() => setModalOpen(true)}
            >
              Add friend
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
                <span className="lbst mono m">{item.st}d streak</span>
                <span className="lbscore mono">{item.s}</span>
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
              displayedActivities.map((act) => (
                <div className="act" key={act.id}>
                  <div className="av" style={{ '--c': act.col }}>
                    {act.ini}
                  </div>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b>{act.n}</b> <span className="m">· {act.text}</span>
                  </span>
                  <span className="t">{act.t}</span>
                </div>
              ))
            ) : (
              <div className="m" style={{ padding: '12px 0', fontSize: 14 }}>
                No recent activity yet. When friends solve problems, they'll appear here.
              </div>
            )}
          </div>
        </section>

        {/* ── Friends Cards Grid (#gr) ── */}
        <section className="grid">
          {displayedFriends.map((f) => {
            const isLive = f.daysAgo === 0
            const lastText = f.lastActivity?.text || (f.platforms ? Object.keys(f.platforms).length + ' platforms linked' : 'No submissions yet')
            const lastTime = f.lastActivity?.timeAgo || f.lastSeenLabel || 'recently'

            return (
              <article className="c fc" key={f.id}>
                <div className="top">
                  <div className="av" style={{ '--c': f.color }}>
                    {f.ini}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
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

                <div>
                  <div className="big mono">{f.totalSolved ?? 0}</div>
                  <span className="m">problems solved</span>
                </div>

                <div className="m" style={{ fontSize: 14 }}>
                  <span className={`dot ${isLive ? 'live' : ''}`} />
                  {isLive ? 'Active today' : `Active ${lastTime}`}
                </div>

                <div className="last">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
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
          {activeTab === 'all' && !searchQuery.trim() && (
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
                : activeTab === 'today'
                ? 'Nobody has solved yet today. Be the first.'
                : searchQuery
                ? 'No friends match that search.'
                : 'No friends in your circle yet. Add friends above to start.'}
            </div>
          )}
        </section>
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
