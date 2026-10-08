import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Search, SlidersHorizontal, ChevronDown, Users } from 'lucide-react'
import FriendStatCard from '../components/friends/FriendStatCard'
import RecentActivity from '../components/friends/RecentActivity'
import FriendCard     from '../components/friends/FriendCard'
import AddFriendModal from '../components/friends/AddFriendModal'

// ── Constants ──────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'recently_active', label: 'Recently Active' },
  { value: 'streak',          label: 'Streak'          },
  { value: 'name',            label: 'Name'             },
  { value: 'problems_solved', label: 'Problems Solved'  },
]

const STATUS_ORDER = { active_now: 0, active_recent: 1, active_today: 2, inactive: 3 }

// ── Helpers ────────────────────────────────────────────────────────────────────

const filterFriends = (friends, tab, query) => {
  let result = friends
  if (tab === 'active') {
    result = result.filter(f =>
      ['active_now', 'active_recent', 'active_today'].includes(f.status)
    )
  }
  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      f =>
        f.displayName.toLowerCase().includes(q) ||
        (f.handle ?? '').toLowerCase().includes(q)
    )
  }
  return result
}

const sortFriends = (friends, sortBy) => {
  const copy = [...friends]
  if (sortBy === 'name') return copy.sort((a, b) => a.displayName.localeCompare(b.displayName))
  if (sortBy === 'streak') return copy.sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
  if (sortBy === 'problems_solved') {
    return copy.sort((a, b) => (b.totalSolved ?? 0) - (a.totalSolved ?? 0))
  }
  return copy.sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
  )
}

/** Build recent-activity items from the friends list */
const buildRecentActivity = (friends) => {
  const items = []
  for (const f of friends) {
    if (f.lastActivity) {
      items.push({
        id:             `${f.id}-activity`,
        friendInitials: f.initials,
        friendColor:    f.avatarColor,
        text:           f.lastActivity.text,
        platform:       f.lastActivity.platform,
        timeAgo:        f.lastActivity.timeAgo,
        badge:          null,
        badgeIcon:      f.lastActivity.platform,
      })
    }
  }
  return items.slice(0, 6)
}

// ── FriendsPage ────────────────────────────────────────────────────────────────

const FriendsPage = () => {
  const navigate = useNavigate()

  // ── data state ──
  const [friends,    setFriends]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState(null)
  const [removing,   setRemoving]   = useState(null) // friend id being removed

  // ── UI state ──
  const [activeTab,    setActiveTab]    = useState('all')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [sortBy,       setSortBy]       = useState('recently_active')
  const [sortOpen,     setSortOpen]     = useState(false)
  const [modalOpen,    setModalOpen]    = useState(false)

  // ── Fetch friends list ──
  const loadFriends = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res  = await fetch('/api/friends', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      setFriends(data.friends ?? [])
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res  = await fetch('/api/friends', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) setFriends(data.friends ?? [])
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    doLoad()
    return () => { cancelled = true }
  }, [])

  // ── Add friend (called from modal) ──
  const handleAddFriend = async (payload, { onError, onSuccess }) => {
    try {
      const res  = await fetch('/api/friends', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error?.message ?? `HTTP ${res.status}`)
        return
      }
      // Prepend new friend to list
      if (data.friend) setFriends(prev => [data.friend, ...prev])
      onSuccess()
    } catch (err) {
      onError(err.message)
    }
  }

  // ── Remove friend ──
  const handleRemoveFriend = async (friendId, e) => {
    e?.stopPropagation()
    if (removing) return
    setRemoving(friendId)
    try {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setFriends(prev => prev.filter(f => f.id !== friendId))
      }
    } finally {
      setRemoving(null)
    }
  }

  // ── Derived ──
  const activeCount = friends.filter(
    f => ['active_now', 'active_recent', 'active_today'].includes(f.status)
  ).length

  const displayedFriends = sortFriends(
    filterFriends(friends, activeTab, searchQuery),
    sortBy
  )

  const recentActivity   = buildRecentActivity(friends)
  const totalSolvedToday = friends.reduce((s, f) => s + (f.totalSolved ?? 0), 0)

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Sort'

  const FILTER_TABS = [
    { key: 'all',    label: `All Friends (${friends.length})` },
    { key: 'active', label: `Active Today (${activeCount})`   },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Friends</h1>
            <p className="mt-1 text-sm text-slate-400">
              See what your friends are solving, competing and learning.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={loadFriends}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.30)] transition-colors hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Add Friend
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {loadError && (
          <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {loadError}
          </div>
        )}

        {/* ── Stat cards row ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <FriendStatCard
            icon="friends"
            value={friends.length}
            label="Total friends"
            subtitle={`${activeCount} active today`}
          />
          <FriendStatCard
            icon="problems"
            value={totalSolvedToday}
            label="Combined problems solved"
            subtitle="across all friends"
          />
          <FriendStatCard
            icon="contests"
            value={friends.reduce((s, f) => s + (f.streak ?? 0), 0)}
            label="Total streak days"
            subtitle="combined streaks"
          />
          <FriendStatCard
            icon="rating"
            value={activeCount}
            label="Friends active today"
            subtitle={`out of ${friends.length} friends`}
          />
        </div>

        {/* ── Filter tabs + search/sort bar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'border-violet-500/30 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-44 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500/60 sm:w-52"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen(o => !o)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
              >
                <span className="hidden font-medium text-white sm:inline">{currentSortLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#0e1527] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setSortBy(value); setSortOpen(false) }}
                      className={`flex w-full px-4 py-2.5 text-sm transition-colors hover:bg-white/6 ${
                        sortBy === value ? 'text-violet-300' : 'text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
              aria-label="More filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        {recentActivity.length > 0 && (
          <RecentActivity activities={recentActivity} onViewAll={() => {}} />
        )}

        {/* ── Loading skeleton ── */}
        {loading && friends.length === 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-white/8 bg-white/3"
              />
            ))}
          </div>
        )}

        {/* ── Friend cards grid ── */}
        {!loading && displayedFriends.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {displayedFriends.map(friend => (
              <FriendCard
                key={friend.id}
                friend={friend}
                removing={removing === friend.id}
                onClick={() => navigate(`/friends/${friend.id}`)}
                onRemove={(e) => handleRemoveFriend(friend.id, e)}
              />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && displayedFriends.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/3 py-16 text-center">
            <Users className="h-10 w-10 text-slate-600" />
            <p className="text-base font-medium text-slate-300">
              {searchQuery ? 'No friends found' : 'No friends yet'}
            </p>
            <p className="text-sm text-slate-500">
              {searchQuery
                ? 'Try a different search term.'
                : 'Add a friend to start tracking their progress.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-2 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
              >
                <Plus className="h-4 w-4" />
                Add Friend
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Add Friend Modal ── */}
      <AddFriendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddFriend}
      />
    </>
  )
}

export default FriendsPage
