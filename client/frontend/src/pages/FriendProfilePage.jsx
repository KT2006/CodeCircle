import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Scale, UserMinus, MoreHorizontal,
  ChevronDown, TrendingUp, Code2, Trophy, Flame,
  ArrowUp, ArrowDown, Clock, Calendar, Loader2,
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

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORM_ICON = { leetcode, codeforces, codechef, atcoder }
const RATING_TABS   = ['Codeforces', 'LeetCode', 'CodeChef', 'AtCoder']
const HEATMAP_RANGES = ['Last 3 months', 'Last 6 months', 'This year']
const TOPIC_MODES   = ['Problems', 'Accuracy']
const OVERVIEW_TABS = ['Overview', 'Activity', 'Contests', 'Topics']

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n) => new Intl.NumberFormat('en-US').format(Math.round(n ?? 0))

const StatusDot = ({ status }) => {
  const color = ['active_now','active_recent','active_today'].includes(status)
    ? 'bg-emerald-400' : 'bg-slate-500'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

const Delta = ({ value, suffix = '' }) => {
  if (value == null) return null
  const pos = value >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
      {pos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value}{suffix}
    </span>
  )
}

const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${className}`}>
    {children}
  </div>
)

const HeadlineStat = ({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
  <Card className="flex items-center gap-4 p-4">
    <div className={`shrink-0 rounded-xl p-3 ${iconBg}`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-emerald-400">{sub}</p>}
    </div>
  </Card>
)

const PlatformSolvedCard = ({ platformKey, label, solved, weekDelta }) => {
  const img = PLATFORM_ICON[platformKey]
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
        {weekDelta != null && <Delta value={weekDelta} suffix=" this week" />}
      </div>
    </Card>
  )
}

// ── Heatmap ────────────────────────────────────────────────────────────────────

const DAY_LABELS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const HEAT_COLORS = ['#1e2535','#166534','#16a34a','#22c55e','#4ade80']

const buildHeatmap = (activityByDate = {}, range = 'Last 6 months') => {
  const today    = new Date()
  const endDate  = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const startDate = new Date(endDate)
  if (range === 'This year') {
    startDate.setUTCMonth(0); startDate.setUTCDate(1)
  } else {
    const months = range === 'Last 3 months' ? 3 : 6
    startDate.setUTCMonth(startDate.getUTCMonth() - months)
    startDate.setUTCDate(1)
  }

  const firstWeekStart = new Date(startDate)
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - ((firstWeekStart.getUTCDay() + 6) % 7))

  const weeks = []
  let cursor = new Date(firstWeekStart)
  while (cursor <= endDate) {
    const week = []
    let monthLabel = ''
    for (let d = 0; d < 7; d++) {
      const date  = new Date(cursor)
      if (d === 0 && date.getUTCDate() <= 7) {
        monthLabel = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
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

const ActivityHeatmap = ({ activityByDate, range }) => {
  const weeks = buildHeatmap(activityByDate, range)
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-0">
        <div className="mr-1.5 flex flex-col justify-around pt-5">
          {DAY_LABELS.map(d => (
            <span key={d} className="h-3.5 text-[10px] leading-none text-slate-500">{d}</span>
          ))}
        </div>
        <div className="flex flex-col">
          <div className="mb-1 flex gap-0.5">
            {weeks.map((w, i) => (
              <div key={i} className="w-3.5 shrink-0 text-[9px] text-slate-500">{w.monthLabel}</div>
            ))}
          </div>
          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
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
  )
}

// ── Topic Strength ─────────────────────────────────────────────────────────────

const TopicStrength = ({ topics, mode = 'Problems' }) => {
  const isAccuracy = mode === 'Accuracy'
  const total = topics.reduce((s, t) => s + t.count, 0) || 1
  const withPct = topics.map(t => ({ ...t, pct: Math.round((t.count / total) * 100) }))
  const maxVal = Math.max(...withPct.map(t => isAccuracy ? t.pct : t.count), 1)

  if (topics.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No topic data available</p>
  }
  return (
    <div className="space-y-3">
      {withPct.map(({ name, count, pct, color }) => {
        const displayVal = isAccuracy ? pct : count
        return (
          <div key={name} className="flex items-center gap-3">
            <span className="shrink-0 truncate text-sm text-slate-300" style={{ width: '9rem' }} title={name}>{name}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full transition-all" style={{ width: `${(displayVal / maxVal) * 100}%`, backgroundColor: color }} />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-white">
              {isAccuracy ? `${pct}%` : count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Tooltips ───────────────────────────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1527] px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400">{label}</p>
      <p className="font-semibold text-violet-300">{payload[0].value} submissions</p>
    </div>
  )
}

// ── Sidebar items ──────────────────────────────────────────────────────────────

const TodayActivityItem = ({ platform, text, timeAgo }) => {
  const img = PLATFORM_ICON[platform]
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6">
        {img && <img src={img} alt={platform} className="h-4 w-4 object-contain" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{text}</p>
        <p className="text-xs text-slate-500">{timeAgo}</p>
      </div>
    </div>
  )
}

const RecentContestItem = ({ platform, name, rank, date, ratingDelta }) => {
  const img = PLATFORM_ICON[platform]
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/6">
        {img && <img src={img} alt={platform} className="h-4 w-4 object-contain" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">{name}</p>
        <p className="text-xs text-slate-500">{date}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-white">{rank}</p>
        {ratingDelta != null && (
          <span className={`text-xs font-semibold ${ratingDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ratingDelta >= 0 ? '↑' : '↓'} {Math.abs(ratingDelta)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Dropdown ───────────────────────────────────────────────────────────────────

const SimpleDropdown = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/8"
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

// ── Main component ─────────────────────────────────────────────────────────────

const FriendProfilePage = () => {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [profile,       setProfile]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [removing,      setRemoving]      = useState(false)

  const [activeTab,       setActiveTab]       = useState('Overview')
  const [ratingPlatform,  setRatingPlatform]  = useState('Codeforces')
  const [heatmapRange,    setHeatmapRange]    = useState('Last 6 months')
  const [topicMode,       setTopicMode]       = useState('Problems')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`/api/friends/${id}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const handleRemove = async () => {
    if (removing) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) navigate('/friends', { replace: true })
    } finally {
      setRemoving(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  // ── Error / not found ──
  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="text-5xl">🤷</span>
        <p className="text-lg font-semibold text-white">{error ?? 'Friend not found'}</p>
        <Link to="/friends" className="text-sm text-violet-400 hover:text-violet-300">
          ← Back to Friends
        </Link>
      </div>
    )
  }

  // ── Derived data ──
  const ratingKey = ratingPlatform === 'Codeforces' ? 'codeforces'
    : ratingPlatform === 'LeetCode' ? 'leetcode'
    : ratingPlatform === 'CodeChef' ? 'codechef'
    : 'atcoder'
  const ratingData   = profile.ratingHistory?.[ratingKey] ?? []
  const ratingValues = ratingData.map(d => d.rating)
  const ratingMin    = ratingValues.length ? Math.max(0, Math.min(...ratingValues) - 100) : 0
  const ratingMax    = ratingValues.length ? Math.max(...ratingValues) + 100 : 2000

  const subData = profile.submissionActivity ?? []
  const subMax  = Math.max(...subData.map(d => d.count), 10)
  const subLabels = subData.map((d, i) => i % 5 === 0 ? d.label : '')

  const headline = profile.headline ?? {}
  const cfRating = headline.cfRating?.value

  return (
    <div className="space-y-5">

      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/friends')}
        className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Friends
      </button>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Profile header */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="relative shrink-0">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-[0_0_28px_rgba(0,0,0,0.5)]"
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {profile.initials}
                </div>
                <span className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full border-2 border-[#0e1527] bg-emerald-400" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">
                    In your friends
                    <ChevronDown className="h-3 w-3" />
                  </span>
                  {profile.handles?.map(h => (
                    <span key={h.platform} className="text-xs text-slate-500">
                      {h.handle}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                  <StatusDot status="active_recent" />
                  <span className="text-emerald-400">Active</span>
                  <span className="text-slate-600">•</span>
                  <Clock className="h-3 w-3" />
                  <span>Last fetched: {profile.lastFetchedLabel}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/compare')}
                  className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/6 hover:text-white"
                >
                  <Scale className="h-4 w-4" />
                  Compare
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                  {removing
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <UserMinus className="h-4 w-4" />
                  }
                  Remove Friend
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 p-2 text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>

          {/* 4 headline stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeadlineStat
              icon={TrendingUp} iconBg="bg-violet-500/15" iconColor="text-violet-300"
              label="Codeforces Rating"
              value={cfRating != null ? fmt(cfRating) : '—'}
              sub={headline.cfRating?.delta}
            />
            <HeadlineStat
              icon={Code2} iconBg="bg-blue-500/15" iconColor="text-blue-300"
              label="Problems Solved"
              value={headline.problemsSolved?.value != null ? fmt(headline.problemsSolved.value) : '—'}
              sub={headline.problemsSolved?.delta}
            />
            <HeadlineStat
              icon={Trophy} iconBg="bg-amber-500/15" iconColor="text-amber-300"
              label="Contests Attended"
              value={headline.contestsAttended?.value != null ? fmt(headline.contestsAttended.value) : '—'}
              sub={headline.contestsAttended?.sub}
            />
            <HeadlineStat
              icon={Flame} iconBg="bg-orange-500/15" iconColor="text-orange-300"
              label="Current Streak"
              value={headline.currentStreak?.value != null ? `${headline.currentStreak.value} days` : '—'}
              sub={headline.currentStreak?.best != null ? `Best: ${headline.currentStreak.best} days` : undefined}
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

          {/* Overview tab content */}
          {activeTab === 'Overview' && (
            <>
              {/* Platform solved row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(profile.platformSolved ?? []).map(p => (
                  <PlatformSolvedCard key={p.key} platformKey={p.key} label={p.label} solved={p.solved} weekDelta={p.weekDelta} />
                ))}
              </div>

              {/* Rating Trend + Activity Heatmap */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                            <linearGradient id="friendRatingGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis domain={[ratingMin, ratingMax]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#0e1527', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                            itemStyle={{ color: '#a78bfa' }} labelStyle={{ color: '#94a3b8' }}
                          />
                          <Area type="monotone" dataKey="rating" stroke="#7C3AED" strokeWidth={2} fill="url(#friendRatingGrad)" dot={{ fill: '#7C3AED', r: 3 }} activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">No contest history for {ratingPlatform}</div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Activity Heatmap</h2>
                    <SimpleDropdown options={HEATMAP_RANGES} value={heatmapRange} onChange={setHeatmapRange} />
                  </div>
                  {Object.keys(profile.activityByDate ?? {}).length > 0 ? (
                    <ActivityHeatmap activityByDate={profile.activityByDate} range={heatmapRange} />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-500">No activity data available</div>
                  )}
                </Card>
              </div>

              {/* Topic Strength + Submission Activity */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Topic Strength</h2>
                      <p className="text-xs text-slate-500">
                        Based on {fmt(headline.problemsSolved?.value ?? 0)} solved problems
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
                  <TopicStrength topics={profile.topics ?? []} mode={topicMode} />
                </Card>

                <Card className="p-5">
                  <h2 className="mb-1 text-sm font-semibold text-white">Submission Activity</h2>
                  <p className="mb-4 text-xs text-slate-500">Last 30 days</p>
                  {subData.some(d => d.count > 0) ? (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }} barSize={8}>
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
                    <div className="flex h-52 items-center justify-center text-sm text-slate-500">No submission data</div>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* Activity tab */}
          {activeTab === 'Activity' && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Submission Activity</h2>
                <span className="text-xs text-slate-500">Last 30 days</span>
              </div>
              {subData.some(d => d.count > 0) ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }} barSize={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="label" tickFormatter={(v, i) => subLabels[i] || ''} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, subMax + 5]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="count" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">No submission data available</p>
              )}
            </Card>
          )}

          {/* Contests tab */}
          {activeTab === 'Contests' && (
            <div className="space-y-3">
              {(profile.recentContests ?? []).length === 0 ? (
                <Card className="p-8">
                  <p className="text-center text-sm text-slate-500">No contest history available</p>
                </Card>
              ) : (
                (profile.recentContests ?? []).map((c, i) => {
                  const img = PLATFORM_ICON[c.platform]
                  return (
                    <Card key={i} className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/6">
                        {img && <img src={img} alt={c.platform} className="h-5 w-5 object-contain" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.date}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-white">{c.rank}</p>
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
          )}

          {/* Topics tab */}
          {activeTab === 'Topics' && (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Topic Strength</h2>
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
              <TopicStrength topics={profile.topics ?? []} mode={topicMode} />
            </Card>
          )}

        </div>{/* /left column */}

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Bio */}
          <Card className="p-5">
            <div className="mb-2 text-3xl font-bold text-violet-400">"</div>
            <p className="text-sm leading-relaxed text-slate-300">{profile.bio}</p>
            <p className="mt-2 text-xs font-semibold text-violet-400">{profile.bioTag}</p>
          </Card>

          {/* Today's Activity */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Today's Activity</h2>
            {(profile.todayActivity ?? []).length > 0 ? (
              <div className="space-y-3">
                {profile.todayActivity.map((item, i) => (
                  <TodayActivityItem key={i} {...item} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">No activity today</p>
            )}
          </Card>

          {/* Recent Contests */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Recent Contests</h2>
            {(profile.recentContests ?? []).length > 0 ? (
              <div className="space-y-3">
                {profile.recentContests.slice(0, 3).map((item, i) => (
                  <RecentContestItem key={i} {...item} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">No contest history</p>
            )}
          </Card>

        </div>{/* /right sidebar */}
      </div>
    </div>
  )
}

export default FriendProfilePage
