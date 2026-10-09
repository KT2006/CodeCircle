import { useEffect, useState } from 'react'
import {
  ArrowLeftRight, ChevronDown, ChevronRight,
  Flame, Code2, Trophy, Calendar,
  Lightbulb, Target, TrendingUp, BookOpen,
  AlertCircle, CheckCircle, XCircle,
  Loader2, Users,
} from 'lucide-react'
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import leetcode        from '../assets/leetcode.png'
import codeforces      from '../assets/codeforces.png'
import codechef        from '../assets/codechef.png'
import atcoder         from '../assets/atcoder.png'
import geeksforgeeks   from '../assets/geeksforgeeks.svg'

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORM_ICON = { leetcode, codeforces, codechef, atcoder, geeksforgeeks }
const CF_MAX        = 3200

// ── Shared primitives ──────────────────────────────────────────────────────────

const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${className}`}>
    {children}
  </div>
)

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</p>
)

const fmt = (n) => new Intl.NumberFormat('en-US').format(Math.round(n ?? 0))

// ── Friend selector dropdown ───────────────────────────────────────────────────

const FriendSelector = ({ friends, selectedId, onChange, loading }) => {
  const [open, setOpen] = useState(false)
  const selected = friends.find(f => f.id === selectedId)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/8 disabled:opacity-50"
      >
        <Users className="h-4 w-4 text-violet-400" />
        {selected ? selected.displayName : 'Select a friend…'}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 max-h-60 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0e1527] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          {friends.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">No friends added yet.</p>
          ) : (
            friends.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onChange(f.id); setOpen(false) }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/6 ${
                  selectedId === f.id ? 'text-violet-300' : 'text-slate-200'
                }`}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {f.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{f.displayName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── User identity card ─────────────────────────────────────────────────────────

const UserCard = ({ user, isYou, flipped = false }) => {
  const statItems = [
    { icon: Flame,    label: 'day streak',  value: user.streak ?? 0,   color: 'text-orange-400'  },
    { icon: Code2,    label: 'problems',    value: fmt(user.problems),  color: 'text-blue-400'    },
    { icon: Trophy,   label: 'contests',    value: user.contests ?? 0,  color: 'text-amber-400'   },
    { icon: Calendar, label: 'active days', value: user.activeDays ?? 0,color: 'text-emerald-400' },
  ]

  return (
    <Card className="flex-1 p-5">
      <div className={`flex items-start gap-4 ${flipped ? 'flex-row-reverse text-right' : ''}`}>
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-[0_0_28px_rgba(0,0,0,0.5)]"
          style={{ backgroundColor: user.avatarColor }}
        >
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 ${flipped ? 'justify-end' : ''}`}>
            <p className="text-xl font-bold text-white">{user.handle ?? user.displayName}</p>
            {isYou && (
              <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-400">{user.bio}</p>
          <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${flipped ? 'justify-end' : ''}`}>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400">{user.status}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/6 pt-4">
        {statItems.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-lg font-bold text-white">{value}</span>
            <span className="text-center text-[10px] leading-tight text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const VSBadge = () => (
  <div className="flex shrink-0 items-center justify-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/40 bg-[#0e1527] text-base font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]">
      VS
    </div>
  </div>
)

// ── Sparkline ─────────────────────────────────────────────────────────────────

const Sparkline = ({ data, color = '#7C3AED' }) => {
  if (!data || data.length < 2) return null
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-12 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── CF Rating row ──────────────────────────────────────────────────────────────

const RatingBar = ({ youRating, friendRating, cfTiers }) => {
  const youPct    = Math.min(((youRating    ?? 0) / CF_MAX) * 100, 100)
  const friendPct = Math.min(((friendRating ?? 0) / CF_MAX) * 100, 100)
  const gap       = (friendRating ?? 0) - (youRating ?? 0)
  const pillPct   = (youPct + friendPct) / 2

  return (
    <div className="w-full space-y-2 px-4 py-2">
      <div className="relative flex items-center" style={{ height: 24 }}>
        <div
          className="absolute -translate-x-1/2 rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-0.5 text-xs font-semibold text-orange-300 whitespace-nowrap"
          style={{ left: `${Math.min(Math.max(pillPct, 10), 90)}%` }}
        >
          {gap > 0 ? `🔥 You are ${gap} behind` : gap < 0 ? `🏆 You are ${Math.abs(gap)} ahead` : '🎯 Tied!'}
        </div>
      </div>
      <div className="relative mt-1 h-3 overflow-visible rounded-full bg-white/8">
        <div className="absolute left-0 top-0 h-full rounded-full bg-violet-500" style={{ width: `${youPct}%` }} />
        <div className="absolute left-0 top-0 h-full rounded-l-full bg-blue-400 opacity-70" style={{ width: `${friendPct}%` }} />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-400 bg-[#0e1527] shadow-[0_0_8px_rgba(124,58,237,0.6)]"
          style={{ left: `${youPct}%` }} title={`You: ${youRating ?? '—'}`}
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-400 bg-[#0e1527] shadow-[0_0_8px_rgba(59,130,246,0.6)]"
          style={{ left: `${friendPct}%` }} title={`Friend: ${friendRating ?? '—'}`}
        />
      </div>
      {cfTiers && (
        <div className="flex items-start justify-between text-[10px] text-slate-500">
          {cfTiers.map(({ label, value }) => (
            <span key={value} className="whitespace-pre-line text-center leading-tight">
              {label.split('\n').map((line, i) => (
                <span key={i} className={`block ${i === 0 ? 'text-slate-400' : 'text-slate-600'}`}>{line}</span>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const CFRatingRow = ({ you, friend, cfTiers }) => (
  <Card className="p-5">
    <SectionLabel>Codeforces Rating</SectionLabel>
    <div className="mt-3 flex items-center gap-3">
      <div className="flex w-36 shrink-0 flex-col gap-1">
        <p className="text-3xl font-bold text-white">{you.cfRating ?? '—'}</p>
        {you.cfRankTitle && <p className="text-xs text-violet-400">{you.cfRankTitle}</p>}
        <Sparkline data={you.ratingSparkline} color="#7C3AED" />
      </div>
      <div className="flex-1">
        <RatingBar youRating={you.cfRating} friendRating={friend.cfRating} cfTiers={cfTiers} />
      </div>
      <div className="flex w-36 shrink-0 flex-col items-end gap-1">
        <p className="text-3xl font-bold text-white">{friend.cfRating ?? '—'}</p>
        {friend.cfRankTitle && <p className="text-xs text-blue-400">{friend.cfRankTitle}</p>}
        <Sparkline data={friend.ratingSparkline} color="#3B82F6" />
      </div>
    </div>
  </Card>
)

// ── Problems Solved ────────────────────────────────────────────────────────────

const DonutCenter = ({ you, friend }) => {
  const diff = friend.problems - you.problems
  const data = [
    { value: you.problems,    fill: '#7C3AED' },
    { value: friend.problems, fill: '#3B82F6' },
  ]
  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={46} outerRadius={68} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0} isAnimationActive={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <Code2 className="h-4 w-4 text-blue-300" />
        <p className={`text-lg font-bold ${diff > 0 ? 'text-rose-400' : diff < 0 ? 'text-emerald-400' : 'text-white'}`}>
          {diff > 0 ? `-${diff}` : diff < 0 ? `+${Math.abs(diff)}` : '='}
        </p>
        <p className="text-[10px] text-slate-400">problems</p>
      </div>
    </div>
  )
}

const ProblemsSolvedRow = ({ you, friend }) => (
  <Card className="p-5">
    <SectionLabel>Problems Solved (Total)</SectionLabel>
    <div className="mt-4 flex flex-col items-center gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-2.5">
        {you.platformSolved.map(p => (
          <div key={p.key} className="flex items-center gap-2">
            <img src={PLATFORM_ICON[p.key]} alt={p.label} className="h-4 w-4 shrink-0 object-contain opacity-80" />
            <span className="w-20 shrink-0 text-sm text-slate-300">{p.label}</span>
            <span className="w-10 shrink-0 text-sm font-bold text-white">{fmt(p.count)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
            </div>
          </div>
        ))}
        <p className="mt-1 text-lg font-bold text-slate-300">
          {fmt(you.problems)} <span className="text-sm font-normal text-slate-500">total</span>
        </p>
      </div>
      <DonutCenter you={you} friend={friend} />
      <div className="flex flex-1 flex-col gap-2.5">
        {friend.platformSolved.map(p => (
          <div key={p.key} className="flex flex-row-reverse items-center gap-2">
            <img src={PLATFORM_ICON[p.key]} alt={p.label} className="h-4 w-4 shrink-0 object-contain opacity-80" />
            <span className="w-20 shrink-0 text-right text-sm text-slate-300">{p.label}</span>
            <span className="w-10 shrink-0 text-right text-sm font-bold text-white">{fmt(p.count)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="ml-auto h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
            </div>
          </div>
        ))}
        <p className="mt-1 text-right text-lg font-bold text-slate-300">
          {fmt(friend.problems)} <span className="text-sm font-normal text-slate-500">total</span>
        </p>
      </div>
    </div>
  </Card>
)

// ── Contests ──────────────────────────────────────────────────────────────────

const ContestBarChart = ({ data, color }) => (
  <div className="h-16 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barSize={8} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#0e1527', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
)

const ContestsRow = ({ you, friend }) => {
  const gap = friend.contests - you.contests
  return (
    <Card className="p-5">
      <SectionLabel>Contests Attended</SectionLabel>
      <div className="mt-3 flex flex-col items-center gap-4 lg:flex-row">
        <div className="flex flex-1 items-center gap-3">
          <div className="shrink-0">
            <p className="text-3xl font-bold text-white">{you.contests}</p>
            <p className="text-xs text-slate-500">contests</p>
          </div>
          <div className="flex-1"><ContestBarChart data={you.contestHistory} color="#7C3AED" /></div>
        </div>
        <div className="flex w-full shrink-0 flex-col items-center gap-2 lg:w-52">
          <div className="flex h-5 w-full items-center gap-1">
            <div className="h-1.5 flex-1 rounded-full bg-violet-500" style={{ flex: you.contests || 1 }} />
            <div className="h-1.5 flex-1 rounded-full bg-blue-400" style={{ flex: friend.contests || 1 }} />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-white">
              {Math.abs(gap)} more contests
              <br /><span className="text-xs font-normal text-slate-400">
                {gap > 0 ? 'you need' : gap < 0 ? 'you lead' : 'tied!'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-row-reverse items-center gap-3">
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold text-white">{friend.contests}</p>
            <p className="text-xs text-slate-500">contests</p>
          </div>
          <div className="flex-1"><ContestBarChart data={friend.contestHistory} color="#3B82F6" /></div>
        </div>
      </div>
    </Card>
  )
}

// ── Topic Comparison ──────────────────────────────────────────────────────────

const TopicComparisonRow = ({ topicComparison, friendName }) => {
  const maxVal = Math.max(...topicComparison.flatMap(t => [t.you, t.friend]), 1)
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <SectionLabel>Topic Strength Comparison</SectionLabel>
          <p className="mt-0.5 text-xs text-slate-500">(Based on problems solved per tag)</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
            <span className="text-slate-300">You</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" />
            <span className="text-slate-300">{friendName?.split(' ')[0] ?? 'Friend'}</span>
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {topicComparison.map(({ name, you: yCount, friend: fCount }) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-sm text-slate-300" title={name}>{name}</span>
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-white">{yCount}</span>
            <div className="flex h-2.5 flex-1 gap-0.5">
              <div className="flex flex-1 items-center justify-end">
                <div className="h-full rounded-l-full bg-violet-500" style={{ width: `${(yCount / maxVal) * 100}%` }} />
              </div>
              <div className="flex flex-1 items-center">
                <div className="h-full rounded-r-full bg-blue-400" style={{ width: `${(fCount / maxVal) * 100}%` }} />
              </div>
            </div>
            <span className="w-10 shrink-0 text-sm font-semibold text-white">{fCount}</span>
          </div>
        ))}
        {topicComparison.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">No common topic data available</p>
        )}
      </div>
    </Card>
  )
}

// ── Key Insights ──────────────────────────────────────────────────────────────

const INSIGHT_STYLE = {
  behind: { Icon: XCircle,     iconCls: 'text-rose-400',    titleCls: 'text-rose-400'    },
  gap:    { Icon: AlertCircle, iconCls: 'text-amber-400',   titleCls: 'text-amber-300'   },
  ahead:  { Icon: CheckCircle, iconCls: 'text-emerald-400', titleCls: 'text-emerald-400' },
}

const KeyInsights = ({ insights }) => (
  <Card className="flex-1 p-5">
    <div className="mb-4 flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-yellow-400" />
      <h2 className="text-sm font-semibold text-white">Key Insights</h2>
    </div>
    {insights.length === 0 ? (
      <p className="py-4 text-center text-sm text-slate-500">No significant gaps detected — you're evenly matched!</p>
    ) : (
      <div className="space-y-3">
        {insights.map(({ id, type, title, detail }) => {
          const { Icon, iconCls, titleCls } = INSIGHT_STYLE[type] ?? INSIGHT_STYLE.gap
          return (
            <div key={id} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${titleCls}`}>{title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{detail}</p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
            </div>
          )
        })}
      </div>
    )}
  </Card>
)

// ── Plan to Catch Up ──────────────────────────────────────────────────────────

const PLAN_ICON_MAP = {
  problems: { Icon: Code2,      bg: 'bg-blue-500/12',    cls: 'text-blue-300'    },
  rating:   { Icon: TrendingUp, bg: 'bg-violet-500/12',  cls: 'text-violet-300'  },
  contests: { Icon: Trophy,     bg: 'bg-amber-500/12',   cls: 'text-amber-300'   },
  topics:   { Icon: BookOpen,   bg: 'bg-emerald-500/12', cls: 'text-emerald-300' },
}

const PlanToCatchUp = ({ plan }) => (
  <Card className="flex-1 p-5">
    <div className="mb-4 flex items-center gap-2">
      <Target className="h-4 w-4 text-violet-400" />
      <h2 className="text-sm font-semibold text-white">Plan to Catch Up</h2>
    </div>
    {plan.length === 0 ? (
      <p className="py-4 text-center text-sm text-slate-500">You're already ahead — keep it up! 🏆</p>
    ) : (
      <div className="space-y-2.5">
        {plan.map(({ id, icon, title, detail }) => {
          const { Icon, bg, cls } = PLAN_ICON_MAP[icon] ?? PLAN_ICON_MAP.problems
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-4 w-4 ${cls}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-xs text-slate-500">{detail}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
            </div>
          )
        })}
      </div>
    )}
  </Card>
)

// ── ComparePage ────────────────────────────────────────────────────────────────

const ComparePage = () => {
  const [friends,      setFriends]      = useState([])
  const [selectedId,   setSelectedId]   = useState(null)
  const [compareData,  setCompareData]  = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [error,        setError]        = useState(null)
  const [swapped,      setSwapped]      = useState(false)

  // Load friends list for selector
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res  = await fetch('/api/compare/friends', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) {
          setFriends(data.friends ?? [])
          // Auto-select first friend
          if (data.friends?.length > 0) setSelectedId(data.friends[0].id)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setFriendsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Fetch compare data when selectedId changes
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`/api/compare?friendId=${selectedId}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) { setCompareData(data); setSwapped(false) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId])

  // ── Derived ──
  const you    = swapped ? compareData?.friend : compareData?.you
  const friend = swapped ? compareData?.you    : compareData?.friend
  const hasData = Boolean(compareData && you && friend)

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Compare Profiles</h1>
          <p className="mt-1 text-sm text-slate-400">
            Side-by-side comparison to see your strengths, gaps, and a plan to improve.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FriendSelector
            friends={friends}
            selectedId={selectedId}
            onChange={setSelectedId}
            loading={friendsLoading}
          />
          {hasData && (
            <button
              type="button"
              onClick={() => setSwapped(s => !s)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Swap
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {/* Loading */}
      {(loading || (friendsLoading && !compareData)) && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {/* No friend selected */}
      {!loading && !friendsLoading && !selectedId && friends.length === 0 && !error && (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-base font-semibold text-white">No friends yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add a friend first from the Friends page, then come back to compare.
          </p>
        </Card>
      )}

      {/* No profile */}
      {!loading && error?.includes('platform accounts') && (
        <Card className="p-12 text-center">
          <p className="text-base font-semibold text-white">Your profile is not set up</p>
          <p className="mt-1 text-sm text-slate-500">
            Connect your platform handles in the Profile page first.
          </p>
        </Card>
      )}

      {/* Main compare content */}
      {hasData && !loading && (
        <>
          {/* Identity cards */}
          <div className="flex items-stretch gap-3">
            <UserCard user={you}    isYou={!swapped} />
            <VSBadge />
            <UserCard user={friend} isYou={swapped}  flipped />
          </div>

          {/* CF Rating */}
          <CFRatingRow you={you} friend={friend} cfTiers={compareData.cfTiers} />

          {/* Problems Solved */}
          {(you.platformSolved?.length > 0 || friend.platformSolved?.length > 0) && (
            <ProblemsSolvedRow you={you} friend={friend} />
          )}

          {/* Contests */}
          <ContestsRow you={you} friend={friend} />

          {/* Topic Comparison */}
          {compareData.topicComparison?.length > 0 && (
            <TopicComparisonRow topicComparison={compareData.topicComparison} friendName={friend.displayName} />
          )}

          {/* Insights + Plan */}
          <div className="flex flex-col gap-5 lg:flex-row">
            <KeyInsights insights={compareData.insights ?? []} />
            <PlanToCatchUp plan={compareData.plan ?? []} />
          </div>
        </>
      )}
    </div>
  )
}

export default ComparePage
