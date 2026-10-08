import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Calendar, ChevronDown,
  Clock, Code2, Edit2, ExternalLink, Flame,
  RefreshCw, Trophy, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import leetcode   from '../assets/leetcode.png'
import codeforces from '../assets/codeforces.png'
import codechef   from '../assets/codechef.png'
import atcoder    from '../assets/atcoder.png'

// ─── Constants ──────────────────────────────────────────────────────────────────

const PLATFORM_ICON = { leetcode, codeforces, codechef, atcoder }

const PLATFORM_CONFIG = [
  {
    id: 'leetcode',
    label: 'LeetCode',
    color: '#7C3AED',
    profileUrl: (handle) => `https://leetcode.com/${handle}`,
  },
  {
    id: 'codeforces',
    label: 'Codeforces',
    color: '#22C55E',
    profileUrl: (handle) => `https://codeforces.com/profile/${handle}`,
  },
  {
    id: 'codechef',
    label: 'CodeChef',
    color: '#FB923C',
    profileUrl: (handle) => `https://www.codechef.com/users/${handle}`,
  },
  {
    id: 'atcoder',
    label: 'AtCoder',
    color: '#3B82F6',
    profileUrl: (handle) => `https://atcoder.jp/users/${handle}`,
  },
]

const RATING_TABS    = ['Codeforces', 'LeetCode', 'CodeChef', 'AtCoder']
const TOPIC_COLORS   = ['#8B5CF6', '#22C55E', '#FB923C', '#3B82F6', '#FF5B7F']
const TOPIC_MODES    = ['Problems', 'Accuracy']
const OVERVIEW_TABS  = ['Overview', 'Activity', 'Contests', 'Topics', 'Compare']
const HEATMAP_OPTS   = ['Last 3 months', 'Last 6 months', 'This year']
const DAY_LABELS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HEAT_COLORS    = ['#1e2535', '#166534', '#16a34a', '#22c55e', '#4ade80']

// ─── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n) => new Intl.NumberFormat('en-US').format(Math.round(n ?? 0))

const getRelativeTime = (date) => {
  if (!date) return null
  const ms  = Date.now() - new Date(date).getTime()
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1)  return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr  < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const d  = Math.round(hr / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const utcToday = () => {
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}

const getCurrentStreak = (activityByDate = {}) => {
  const todayKey = utcToday().toISOString().slice(0, 10)
  const yday = new Date(`${todayKey}T00:00:00.000Z`)
  yday.setUTCDate(yday.getUTCDate() - 1)
  let key = activityByDate[todayKey] ? todayKey : yday.toISOString().slice(0, 10)
  let streak = 0
  while (activityByDate[key]) {
    streak++
    const prev = new Date(`${key}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    key = prev.toISOString().slice(0, 10)
  }
  return streak
}

/** Returns start Date for a given heatmap range option */
const heatmapStartDate = (range) => {
  const end = utcToday()
  if (range === 'This year') {
    return new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
  }
  const months = range === 'Last 3 months' ? 3 : 6
  const start = new Date(end)
  start.setUTCMonth(start.getUTCMonth() - months)
  start.setUTCDate(1)
  return start
}

/** Count active days within a date range */
const countActiveDaysInRange = (activityByDate = {}, startDate) => {
  const end = utcToday()
  let count = 0
  const cursor = new Date(startDate)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    if ((activityByDate[key] ?? 0) > 0) count++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

/** Build last-N-days bar chart from activityByDate */
const buildSubmissionActivity = (activityByDate = {}, days = 30) => {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(utcToday())
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({ label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, count: activityByDate[key] ?? 0 })
  }
  return result
}

/** Sum submissions over last N days */
const sumActivityDays = (activityByDate = {}, days = 30) => {
  let total = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(utcToday())
    d.setUTCDate(d.getUTCDate() - i)
    total += activityByDate[d.toISOString().slice(0, 10)] ?? 0
  }
  return total
}

/** Build heatmap weeks respecting range option */
const buildHeatmap = (activityByDate = {}, range = 'Last 6 months') => {
  const endDate   = utcToday()
  const startDate = heatmapStartDate(range)

  const firstWeekStart = new Date(startDate)
  const dow = (firstWeekStart.getUTCDay() + 6) % 7
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - dow)

  const weeks = []
  let cursor  = new Date(firstWeekStart)
  while (cursor <= endDate) {
    const week = []
    let monthLabel = ''
    for (let d = 0; d < 7; d++) {
      const date    = new Date(cursor)
      if (d === 0 && date.getUTCDate() <= 7) {
        monthLabel  = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      }
      const key     = date.toISOString().slice(0, 10)
      const inRange = date >= startDate && date <= endDate
      const count   = inRange ? (activityByDate[key] ?? 0) : 0
      const intensity = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4
      week.push({ key, count, intensity, inRange })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push({ days: week, monthLabel })
  }
  return weeks
}

/** Build rating series from contestHistory */
const buildRatingSeries = (contestHistory = []) =>
  [...contestHistory]
    .filter((e) => e.date && Number.isFinite(Number(e.rating)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((e) => ({
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(e.date)),
      rating: Number(e.rating),
      date: e.date,
    }))

/** Merge topics across all platforms, top 5, carry both count and pct */
const buildTopics = (profiles = []) => {
  const map = new Map()
  for (const p of profiles) {
    for (const t of p.topics ?? []) {
      const name  = t.name ?? t.slug ?? ''
      const count = Number(t.problemsSolved ?? t.count ?? 0)
      if (name) map.set(name, (map.get(name) ?? 0) + count)
    }
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const total   = entries.reduce((s, [, c]) => s + c, 0) || 1
  return entries.map(([name, count], i) => ({
    name,
    count,
    pct: Math.round((count / total) * 100),   // % of solved problems in top-5 pool
    color: TOPIC_COLORS[i],
  }))
}

/** Merge recent contests across platforms, most recent first */
const buildRecentContests = (profiles = [], limit = 10) => {
  const all = []
  for (const p of profiles) {
    for (const c of p.contestHistory ?? []) {
      if (!c.date) continue
      all.push({
        platform:    p.platform,
        name:        c.contestName,
        rank:        c.ranking ? `#${fmt(c.ranking)}` : '—',
        date:        c.date,
        dateLabel:   new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(c.date)),
        newRating:   c.rating ?? null,
        ratingDelta: (c.oldRating != null && c.rating != null) ? c.rating - c.oldRating : null,
      })
    }
  }
  return all.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit)
}

/** Build recent activity list from activityByDate, last 7 days, up to `limit` */
const buildRecentActivity = (profiles = [], limit = 5) => {
  const items = []
  for (let i = 0; i < 14; i++) {
    const d   = new Date(utcToday())
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    for (const p of profiles) {
      const count = (p.activityByDate ?? {})[key] ?? 0
      if (count > 0) {
        const cfg = PLATFORM_CONFIG.find(c => c.id === p.platform)
        items.push({
          platform: p.platform,
          text:     `Solved ${count} problem${count === 1 ? '' : 's'} on ${cfg?.label ?? p.platform}`,
          timeAgo:  i === 0 ? 'today' : i === 1 ? 'yesterday' : getRelativeTime(d),
          sortKey:  i,
        })
      }
    }
    if (items.length >= limit * 2) break
  }
  return items
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, limit)
}

// ─── UI Components ───────────────────────────────────────────────────────────────

const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${className}`}>
    {children}
  </div>
)

const SimpleDropdown = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
      >
        <Calendar className="h-3.5 w-3.5" />
        {value}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-white/10 bg-[#0e1527] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`flex w-full px-4 py-2.5 text-xs transition-colors hover:bg-white/6 ${value === opt ? 'text-violet-300' : 'text-slate-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const HeadlineStat = ({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
  <Card className="flex items-center gap-4 p-4">
    <div className={`shrink-0 rounded-xl p-3 ${iconBg}`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs font-medium text-emerald-400">{sub}</p>}
    </div>
  </Card>
)

const PlatformSolvedCard = ({ platformKey, label, solved, contestRating, rating }) => {
  const img        = PLATFORM_ICON[platformKey]
  const displayRating = rating ?? contestRating ?? null
  return (
    <Card className="flex items-center gap-3 p-4">
      {img && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/6">
          <img src={img} alt={label} className="h-5 w-5 object-contain" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        {solved != null ? (
          <p className="text-lg font-bold text-white">
            {fmt(solved)} <span className="text-sm font-normal text-slate-400">solved</span>
          </p>
        ) : (
          <p className="text-sm text-slate-500 italic">Not connected</p>
        )}
        {displayRating != null && (
          <p className="text-xs text-violet-400">Rating: {fmt(displayRating)}</p>
        )}
      </div>
    </Card>
  )
}

const TopicStrength = ({ topics, mode = 'Problems' }) => {
  const isAccuracy = mode === 'Accuracy'
  // bar is relative to the largest value in the current mode
  const maxVal = Math.max(...topics.map(t => isAccuracy ? t.pct : t.count), 1)
  if (topics.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No topic data available</p>
  }
  return (
    <div className="space-y-3">
      {topics.map(({ name, count, pct, color }) => {
        const displayVal = isAccuracy ? pct : count
        const barWidth   = `${(displayVal / maxVal) * 100}%`
        const label      = isAccuracy ? `${pct}%` : String(count)
        return (
          <div key={name} className="flex items-center gap-3">
            {/* name: fixed max-width + truncate so long names don't push bar */}
            <span
              className="shrink-0 truncate text-sm text-slate-300"
              style={{ width: '9rem' }}
              title={name}
            >
              {name}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: barWidth, backgroundColor: color }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-white">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1527] px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400">{label}</p>
      <p className="font-semibold text-violet-300">{payload[0].value} submissions</p>
    </div>
  )
}

const ActivityItem = ({ platform, text, timeAgo }) => {
  const img = PLATFORM_ICON[platform]
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6">
        {img
          ? <img src={img} alt={platform} className="h-4 w-4 object-contain" />
          : <Trophy className="h-4 w-4 text-amber-400" />
        }
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{text}</p>
        <p className="text-xs text-slate-500">{timeAgo}</p>
      </div>
    </div>
  )
}

// ─── Tab content panels ──────────────────────────────────────────────────────────

const ActivityTab = ({ submissionActivity, subMax, subLabels, submissionsLast30, activeDaysLast30 }) => (
  <div className="space-y-4">
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Submission Activity</h2>
        <span className="text-xs text-slate-500">Last 30 days</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">{submissionsLast30} total submissions · {activeDaysLast30} active days</p>
      {submissionsLast30 > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={submissionActivity} margin={{ top: 5, right: 5, bottom: 0, left: -20 }} barSize={7}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={(v, i) => subLabels[i] || ''}
                tick={{ fill: '#64748b', fontSize: 9 }}
                tickLine={false} axisLine={false}
              />
              <YAxis domain={[0, subMax + 5]} tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" fill="#7C3AED" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">No submission data for last 30 days</div>
      )}
    </Card>
  </div>
)

const ContestsTab = ({ recentContests }) => (
  <div className="space-y-3">
    {recentContests.length === 0 ? (
      <Card className="p-8">
        <p className="text-center text-sm text-slate-500">No contest history available</p>
      </Card>
    ) : (
      recentContests.map((c, i) => {
        const img = PLATFORM_ICON[c.platform]
        const cfg = PLATFORM_CONFIG.find(p => p.id === c.platform)
        return (
          <Card key={i} className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/6">
              {img && <img src={img} alt={c.platform} className="h-5 w-5 object-contain" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{c.name}</p>
              <p className="text-xs text-slate-500">{cfg?.label} · {c.dateLabel}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-white">{c.rank}</p>
              {c.newRating != null && (
                <p className="text-xs text-slate-400">Rating: {fmt(c.newRating)}</p>
              )}
              {c.ratingDelta != null && (
                <p className={`text-xs font-semibold ${c.ratingDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {c.ratingDelta >= 0 ? '↑' : '↓'} {Math.abs(c.ratingDelta)}
                </p>
              )}
            </div>
          </Card>
        )
      })
    )}
  </div>
)

const TopicsTab = ({ topics, totalSolved, mode }) => (
  <div className="space-y-4">
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Topic Strength</h2>
        <p className="text-xs text-slate-500">
          {totalSolved != null ? `Based on ${fmt(totalSolved)} solved problems across all platforms` : 'Connect a platform to see topics'}
        </p>
      </div>
      <TopicStrength topics={topics} mode={mode} />
    </Card>
    {topics.length > 0 && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {topics.map(({ name, count, color }) => (
          <Card key={name} className="p-4">
            <div className="mb-1 flex h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: color }} />
            </div>
            <p className="mt-2 text-lg font-bold text-white">{count}</p>
            <p className="truncate text-xs text-slate-400">{name}</p>
          </Card>
        ))}
      </div>
    )}
  </div>
)

const CompareTab = ({ navigate }) => (
  <Card className="p-8 text-center">
    <Trophy className="mx-auto mb-3 h-10 w-10 text-amber-400 opacity-60" />
    <p className="text-base font-semibold text-white">Compare with Friends</p>
    <p className="mt-1 text-sm text-slate-400">See how your stats stack up against your friends.</p>
    <button
      type="button"
      onClick={() => navigate('/compare')}
      className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
    >
      Go to Compare
      <ArrowRight className="h-4 w-4" />
    </button>
  </Card>
)

// ─── Edit Handles Modal ──────────────────────────────────────────────────────────

const EditHandlesModal = ({ profiles, onClose, onSave, isSaving, saveError }) => {
  const [handles, setHandles] = useState(
    Object.fromEntries(PLATFORM_CONFIG.map(p => [p.id, profiles[p.id]?.username ?? '']))
  )
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e1527] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-white">Edit Connected Handles</h2>
        <div className="space-y-3">
          {PLATFORM_CONFIG.map(cfg => (
            <div key={cfg.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/6">
                <img src={PLATFORM_ICON[cfg.id]} alt={cfg.label} className="h-4 w-4 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{cfg.label}</p>
                <input
                  type="text"
                  value={handles[cfg.id]}
                  onChange={e => setHandles(h => ({ ...h, [cfg.id]: e.target.value }))}
                  placeholder="username"
                  className="mt-0.5 block w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
          ))}
        </div>
        {saveError && (
          <p className="mt-3 text-xs text-rose-400">{saveError}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSave(handles)}
            className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {isSaving ? 'Fetching…' : 'Save & Fetch'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Right sidebar ───────────────────────────────────────────────────────────────

const Sidebar = ({
  profiles, hasData,
  totalSolved, totalContests, currentStreak, totalActiveDays,
  recentActivity, navigate,
  onEditHandles,
}) => (
  <div className="space-y-4">

    {/* Connected Handles */}
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Connected Handles</h2>
        <button
          type="button"
          onClick={onEditHandles}
          className="flex items-center gap-1 text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          <Edit2 className="h-3 w-3" />
          Edit
        </button>
      </div>
      <div className="space-y-1">
        {PLATFORM_CONFIG.map(cfg => {
          const p = profiles[cfg.id]
          return (
            <div
              key={cfg.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/6">
                <img src={PLATFORM_ICON[cfg.id]} alt={cfg.label} className="h-5 w-5 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                {p ? (
                  <p className="text-sm font-medium text-white">{p.username}</p>
                ) : (
                  <p className="text-sm italic text-slate-600">Not connected</p>
                )}
                <p className="text-[11px] text-slate-500">{cfg.label}</p>
              </div>
              {p && (
                <a
                  href={cfg.profileUrl(p.username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
                  aria-label={`View ${p.username} on ${cfg.label}`}
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </Card>

    {/* Quick Stats */}
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Quick Stats</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-xl bg-white/4 p-3">
          <Code2 className="h-5 w-5 text-blue-400" />
          <p className="mt-1 text-xl font-bold text-white">{totalSolved != null ? fmt(totalSolved) : '—'}</p>
          <p className="text-[11px] text-slate-500">Problems solved</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-white/4 p-3">
          <Trophy className="h-5 w-5 text-amber-400" />
          <p className="mt-1 text-xl font-bold text-white">{totalContests != null ? fmt(totalContests) : '—'}</p>
          <p className="text-[11px] text-slate-500">Contests attended</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-white/4 p-3">
          <Flame className="h-5 w-5 text-orange-400" />
          <p className="mt-1 text-xl font-bold text-white">{hasData ? `${currentStreak} days` : '—'}</p>
          <p className="text-[11px] text-slate-500">Current streak</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-white/4 p-3">
          <Calendar className="h-5 w-5 text-blue-400" />
          <p className="mt-1 text-xl font-bold text-white">{hasData ? fmt(totalActiveDays) : '—'}</p>
          <p className="text-[11px] text-slate-500">Active days</p>
        </div>
      </div>
    </Card>

    {/* Recent Activity */}
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {recentActivity.length > 0 ? (
        <div className="space-y-3">
          {recentActivity.map((item, i) => (
            <ActivityItem key={i} {...item} />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-slate-500">
          {hasData ? 'No recent activity' : 'Connect a platform to see activity'}
        </p>
      )}
    </Card>

  </div>
)

// ─── Main ProfilePage ─────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const navigate = useNavigate()

  // ── Data state ──
  const [profiles, setProfiles] = useState({
    leetcode: null, codeforces: null, codechef: null, atcoder: null,
  })
  const [lastSyncedAt,  setLastSyncedAt]  = useState(null)
  const [isRefreshing,  setIsRefreshing]  = useState(false)
  const [fetchError,    setFetchError]    = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSaving,      setIsSaving]      = useState(false)
  const [saveError,     setSaveError]     = useState(null)

  // ── UI state ──
  const [activeTab,      setActiveTab]      = useState('Overview')
  const [ratingPlatform, setRatingPlatform] = useState('Codeforces')
  const [topicMode,      setTopicMode]      = useState('Problems')
  const [heatmapRange,   setHeatmapRange]   = useState('Last 6 months')

  // ── Load saved profiles on mount ──
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res  = await fetch('/api/profile', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (cancelled) return

        const saved = data.profiles ?? {}
        setProfiles(curr => ({ ...curr, ...saved }))

        const latestSync = Object.values(saved)
          .map(p => new Date(p.lastSyncedAt))
          .filter(d => Number.isFinite(d.getTime()))
          .sort((a, b) => b - a)[0]
        if (latestSync) setLastSyncedAt(latestSync)
      } catch (err) {
        if (!cancelled) setFetchError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Refresh all connected platforms ──
  const handleRefresh = async () => {
    const connectedHandles = Object.entries(profiles)
      .filter(([, p]) => p?.username)
      .map(([platform, p]) => [platform, p.username])
    if (connectedHandles.length === 0 || isRefreshing) return
    setIsRefreshing(true)
    setFetchError(null)
    try {
      const res  = await fetch('/api/platform-profiles/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ handles: Object.fromEntries(connectedHandles) }),
      })
      const data = await res.json()
      if (!res.ok && !data.profiles) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      const fetched = data.profiles ?? {}
      setProfiles(curr => ({ ...curr, ...fetched }))
      if (Object.keys(fetched).length > 0) setLastSyncedAt(new Date())
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  // ── Save & fetch new handles from edit modal ──
  const handleSaveHandles = async (newHandles) => {
    const toFetch = Object.fromEntries(
      Object.entries(newHandles).filter(([, v]) => v.trim())
    )
    if (Object.keys(toFetch).length === 0) {
      setShowEditModal(false)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const res  = await fetch('/api/platform-profiles/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ handles: toFetch }),
      })
      const data = await res.json()
      if (!res.ok && !data.profiles) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      const fetched = data.profiles ?? {}
      // Clear platforms that were removed
      const cleared = Object.fromEntries(
        PLATFORM_CONFIG.map(p => [p.id, newHandles[p.id]?.trim() ? (fetched[p.id] ?? profiles[p.id]) : null])
      )
      setProfiles(cleared)
      if (Object.keys(fetched).length > 0) setLastSyncedAt(new Date())
      setShowEditModal(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const connectedProfiles = useMemo(
    () => Object.values(profiles).filter(Boolean),
    [profiles]
  )
  const hasData = connectedProfiles.length > 0

  const primaryProfile =
    profiles.codeforces ?? profiles.leetcode ?? profiles.codechef ?? profiles.atcoder ?? null
  const avatarLetter = (primaryProfile?.username ?? 'Y').charAt(0).toUpperCase()
  const displayName  = primaryProfile?.username ?? 'Your Profile'
  const rankTitle    = primaryProfile?.rankTitle ?? null

  // Combined activityByDate
  const combinedActivity = useMemo(() => {
    const map = {}
    for (const p of connectedProfiles) {
      for (const [day, count] of Object.entries(p.activityByDate ?? {})) {
        map[day] = (map[day] ?? 0) + count
      }
    }
    return map
  }, [connectedProfiles])

  const cfProfile     = profiles.codeforces
  const cfRating      = cfProfile?.rating ?? null
  const totalSolved   = hasData ? connectedProfiles.reduce((s, p) => s + (p.problemsSolved ?? 0), 0) : null
  const totalContests = hasData ? connectedProfiles.reduce((s, p) => s + (p.contestsAttended ?? 0), 0) : null
  const currentStreak = primaryProfile?.currentStreak != null
    ? primaryProfile.currentStreak
    : getCurrentStreak(combinedActivity)

  // Heatmap-range-aware active days
  const heatmapStart   = heatmapStartDate(heatmapRange)
  const totalActiveDays = countActiveDaysInRange(combinedActivity, heatmapStart)

  // Last 30 days figures
  const submissionsLast30  = sumActivityDays(combinedActivity, 30)
  const activeDaysLast30   = useMemo(() => {
    const start = new Date(utcToday())
    start.setUTCDate(start.getUTCDate() - 29)
    return countActiveDaysInRange(combinedActivity, start)
  }, [combinedActivity])
  const submissionActivity = useMemo(() => buildSubmissionActivity(combinedActivity, 30), [combinedActivity])
  const subMax             = Math.max(...submissionActivity.map(d => d.count), 10)
  const subLabels          = submissionActivity.map((d, i) => i % 5 === 0 ? d.label : '')

  // Rating trend
  const ratingPlatformKey = ratingPlatform === 'Codeforces' ? 'codeforces'
    : ratingPlatform === 'LeetCode' ? 'leetcode'
    : ratingPlatform === 'CodeChef' ? 'codechef'
    : 'atcoder'
  const ratingData   = useMemo(
    () => buildRatingSeries(profiles[ratingPlatformKey]?.contestHistory ?? []),
    [profiles, ratingPlatformKey]
  )
  const ratingValues = ratingData.map(d => d.rating)
  const ratingMin    = ratingValues.length ? Math.max(0, Math.min(...ratingValues) - 100) : 0
  const ratingMax    = ratingValues.length ? Math.max(...ratingValues) + 100 : 2000

  // Heatmap
  const heatmapWeeks = useMemo(
    () => buildHeatmap(combinedActivity, heatmapRange),
    [combinedActivity, heatmapRange]
  )

  const topics         = useMemo(() => buildTopics(connectedProfiles), [connectedProfiles])
  const recentContests = useMemo(() => buildRecentContests(connectedProfiles, 10), [connectedProfiles])
  const recentActivity = useMemo(() => buildRecentActivity(connectedProfiles, 5), [connectedProfiles])

  const platformSolvedRows = PLATFORM_CONFIG.map(({ id, label }) => ({
    platformKey:   id,
    label,
    solved:        profiles[id]?.problemsSolved ?? null,
    rating:        profiles[id]?.rating ?? null,
    contestRating: profiles[id]?.contestRating ?? null,
  }))

  const lastFetchedLabel = getRelativeTime(lastSyncedAt)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {showEditModal && (
        <EditHandlesModal
          profiles={profiles}
          onClose={() => { setShowEditModal(false); setSaveError(null) }}
          onSave={handleSaveHandles}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Profile header */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#8B5CF6,#5B21B6_78%)] text-2xl font-bold text-white shadow-[0_0_28px_rgba(124,58,237,0.4)]">
                    {avatarLetter}
                  </div>
                  <span className={`absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full border-2 border-[#0e1527] ${hasData ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-xl font-bold text-white sm:text-2xl">{displayName}</h1>
                  {rankTitle && (
                    <div className="mt-1">
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">{rankTitle}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:w-auto sm:shrink-0">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={!hasData || isRefreshing}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/6 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/compare')}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                  Compare
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-xs">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${hasData ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {hasData
                  ? <span className="text-emerald-400">Connected</span>
                  : <span className="text-slate-500">No platforms connected</span>
                }
              </span>
              {lastFetchedLabel && (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Last fetched</span>
                  <span className="text-slate-200">{lastFetchedLabel}</span>
                </span>
              )}
            </div>
            {fetchError && (
              <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{fetchError}</p>
            )}
          </Card>

          {/* 4 headline stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeadlineStat
              icon={TrendingUp} iconBg="bg-violet-500/15" iconColor="text-violet-300"
              label="Codeforces Rating"
              value={cfRating != null ? fmt(cfRating) : '—'}
              sub={cfProfile?.maxRating ? `Max: ${fmt(cfProfile.maxRating)}` : undefined}
            />
            <HeadlineStat
              icon={Code2} iconBg="bg-blue-500/15" iconColor="text-blue-300"
              label="Problems Solved"
              value={totalSolved != null ? fmt(totalSolved) : '—'}
              sub={connectedProfiles.length > 0 ? `Across ${connectedProfiles.length} platform${connectedProfiles.length === 1 ? '' : 's'}` : undefined}
            />
            <HeadlineStat
              icon={Trophy} iconBg="bg-amber-500/15" iconColor="text-amber-300"
              label="Contests Attended"
              value={totalContests != null ? fmt(totalContests) : '—'}
            />
            <HeadlineStat
              icon={Flame} iconBg="bg-orange-500/15" iconColor="text-orange-300"
              label="Current Streak"
              value={hasData ? `${currentStreak} days` : '—'}
              sub={hasData && totalActiveDays > 0 ? `${totalActiveDays} active days` : undefined}
            />
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {OVERVIEW_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:bg-white/6 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab: Activity */}
          {activeTab === 'Activity' && (
            <ActivityTab
              submissionActivity={submissionActivity}
              subMax={subMax}
              subLabels={subLabels}
              submissionsLast30={submissionsLast30}
              activeDaysLast30={activeDaysLast30}
            />
          )}

          {/* Tab: Contests */}
          {activeTab === 'Contests' && (
            <ContestsTab recentContests={recentContests} />
          )}

          {/* Tab: Topics */}
          {activeTab === 'Topics' && (
            <TopicsTab topics={topics} totalSolved={totalSolved} mode={topicMode} />
          )}

          {/* Tab: Compare */}
          {activeTab === 'Compare' && (
            <CompareTab navigate={navigate} />
          )}

          {/* Tab: Overview — main content */}
          {activeTab === 'Overview' && (
            <>
              {/* Platform solved row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {platformSolvedRows.map(p => (
                  <PlatformSolvedCard key={p.platformKey} {...p} />
                ))}
              </div>

              {/* Rating Trend + Activity Heatmap */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                {/* Rating Trend */}
                <Card className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white">Rating Trend</h2>
                    <div className="flex gap-1">
                      {RATING_TABS.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setRatingPlatform(t)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            ratingPlatform === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-44">
                    {ratingData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ratingData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                          <defs>
                            <linearGradient id="profileRatingGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis domain={[ratingMin, ratingMax]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#0e1527', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                            itemStyle={{ color: '#a78bfa' }}
                            labelStyle={{ color: '#94a3b8' }}
                          />
                          <Area type="monotone" dataKey="rating" stroke="#7C3AED" strokeWidth={2} fill="url(#profileRatingGrad)" dot={{ fill: '#7C3AED', r: 3 }} activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        {hasData ? `No contest history for ${ratingPlatform}` : 'Connect a platform to see rating trend'}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Activity Heatmap */}
                <Card className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Activity Heatmap</h2>
                    <SimpleDropdown options={HEATMAP_OPTS} value={heatmapRange} onChange={setHeatmapRange} />
                  </div>
                  {Object.keys(combinedActivity).length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <div className="flex min-w-max gap-0">
                          <div className="mr-1.5 flex flex-col justify-around pt-5">
                            {DAY_LABELS.map(d => (
                              <span key={d} className="h-3.5 text-[10px] leading-none text-slate-500">{d}</span>
                            ))}
                          </div>
                          <div className="flex flex-col">
                            <div className="mb-1 flex gap-0.5">
                              {heatmapWeeks.map((w, i) => (
                                <div key={i} className="w-3.5 shrink-0 text-[9px] text-slate-500">{w.monthLabel}</div>
                              ))}
                            </div>
                            <div className="flex gap-0.5">
                              {heatmapWeeks.map((week, wi) => (
                                <div key={wi} className="flex flex-col gap-0.5">
                                  {week.days.map((day) => (
                                    <div
                                      key={day.key}
                                      title={day.inRange ? `${day.key}: ${day.count} submissions` : ''}
                                      className="h-3.5 w-3.5 rounded-[3px]"
                                      style={{ backgroundColor: HEAT_COLORS[day.intensity] }}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                              <span>Less</span>
                              {HEAT_COLORS.map((c, i) => (
                                <div key={i} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: c }} />
                              ))}
                              <span>More</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Total active days for this range */}
                      <p className="mt-3 text-sm font-semibold text-emerald-400">
                        Total Active Days: {fmt(totalActiveDays)}
                        <span className="ml-2 text-xs font-normal text-slate-500">({heatmapRange})</span>
                      </p>
                    </>
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                      {hasData ? 'No activity data available' : 'Connect a platform to see activity'}
                    </div>
                  )}
                </Card>
              </div>

              {/* Topic Strength + Submission Activity */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                {/* Topic Strength */}
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Topic Strength</h2>
                      <p className="text-xs text-slate-500">
                        {totalSolved != null ? `Based on ${fmt(totalSolved)} solved problems` : 'Connect a platform to see topics'}
                      </p>
                    </div>
                    <div className="flex gap-1 rounded-xl bg-white/5 p-0.5">
                      {TOPIC_MODES.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTopicMode(m)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            topicMode === m ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TopicStrength topics={topics} mode={topicMode} />
                </Card>

                {/* Submission Activity */}
                <Card className="p-5">
                  <h2 className="mb-1 text-sm font-semibold text-white">Submission Activity</h2>
                  <p className="mb-4 text-xs text-slate-500">Last 30 days · {submissionsLast30} total submissions</p>
                  {submissionsLast30 > 0 ? (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={submissionActivity} margin={{ top: 5, right: 8, bottom: 0, left: -20 }} barSize={8}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickFormatter={(v, i) => subLabels[i] || ''}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickLine={false} axisLine={false}
                          />
                          <YAxis domain={[0, subMax + 5]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-52 items-center justify-center text-sm text-slate-500">
                      {hasData ? 'No submission data for last 30 days' : 'Connect a platform to see activity'}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

        </div>{/* /left column */}

        {/* ── Right sidebar ── */}
        <Sidebar
          profiles={profiles}
          hasData={hasData}
          totalSolved={totalSolved}
          totalContests={totalContests}
          currentStreak={currentStreak}
          totalActiveDays={totalActiveDays}
          recentActivity={recentActivity}
          navigate={navigate}
          onEditHandles={() => { setSaveError(null); setShowEditModal(true) }}
        />

      </div>
    </div>
  )
}

export default ProfilePage
