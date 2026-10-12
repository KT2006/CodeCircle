import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useSync } from '../context/SyncContext'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import leetcodeImg      from '../assets/leetcode.png'
import codeforcesImg    from '../assets/codeforces.png'
import codechefImg      from '../assets/codechef.png'
import atcoderImg       from '../assets/atcoder.png'
import geeksforgeeksImg from '../assets/geeksforgeeks.svg'

// ─── CSS-var helpers (inline styles use var(--x)) ─────────────────────────────
const V = {
  bg:    'var(--bg)',
  surf:  'var(--surf)',
  surf2: 'var(--surf2)',
  line:  'var(--line)',
  text:  'var(--text)',
  mute:  'var(--mute)',
  you:   'var(--you)',
  on:    'var(--on)',
  hot:   'var(--hot)',
  h0:    'var(--h0)',
  h1:    'var(--h1)',
  h2:    'var(--h2)',
  h3:    'var(--h3)',
}

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'leetcode',      label: 'LeetCode',      abbr: 'LC',  color: '#FFA116', img: leetcodeImg,       profileUrl: (h) => `https://leetcode.com/${h}` },
  { id: 'codeforces',    label: 'Codeforces',    abbr: 'CF',  color: '#4A90E2', img: codeforcesImg,     profileUrl: (h) => `https://codeforces.com/profile/${h}` },
  { id: 'codechef',      label: 'CodeChef',      abbr: 'CC',  color: '#C28B5B', img: codechefImg,       profileUrl: (h) => `https://www.codechef.com/users/${h}` },
  { id: 'atcoder',       label: 'AtCoder',        abbr: 'AC',  color: '#9a9488', img: atcoderImg,        profileUrl: (h) => `https://atcoder.jp/users/${h}` },
  { id: 'geeksforgeeks', label: 'GeeksForGeeks',  abbr: 'GFG', color: '#2F8D46', img: geeksforgeeksImg,  profileUrl: (h) => `https://www.geeksforgeeks.org/user/${h}/` },
]

// ─── Shared styles ────────────────────────────────────────────────────────────
const card = {
  background: V.surf,
  border: `1px solid ${V.line}`,
  borderRadius: 20,
  padding: '18px 20px',
}

const btnBase = {
  fontFamily: 'inherit',
  fontSize: 15,
  cursor: 'pointer',
  border: `1px solid ${V.line}`,
  background: 'transparent',
  color: V.text,
  borderRadius: 999,
  padding: '9px 18px',
  transition: 'transform .15s',
}

const btnPrimary = {
  ...btnBase,
  background: V.you,
  borderColor: V.you,
  color: V.on,
  fontWeight: 700,
}

const brg = { fontFamily: "'Bricolage Grotesque','DM Sans',sans-serif", letterSpacing: '-.035em' }
const mono = { fontFamily: "'JetBrains Mono',ui-monospace,monospace" }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => typeof n === 'number' ? Math.round(n).toLocaleString() : '—'

const getGreeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const utcToday = () => {
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}

const getRelativeTime = (date) => {
  if (!date) return null
  const ms  = Date.now() - new Date(date).getTime()
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 2)  return 'just now'
  if (min < 60) return `${min} minutes ago`
  const hr = Math.round(min / 60)
  if (hr  < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const d  = Math.round(hr / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
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

const countActiveDays = (activityByDate = {}) =>
  Object.values(activityByDate).filter(v => v > 0).length

const sumActivityDays = (activityByDate = {}, days = 30) => {
  let total = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(utcToday())
    d.setUTCDate(d.getUTCDate() - i)
    total += activityByDate[d.toISOString().slice(0, 10)] ?? 0
  }
  return total
}

const fmtUtc = (ts, opts) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(ts))

const buildRatingSeries = (contestHistory = []) =>
  [...contestHistory]
    .filter((e) => e.date && Number.isFinite(Number(e.rating)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((e) => {
      const ts = Date.parse(e.date)
      return {
        ts,
        rating: Math.round(Number(e.rating)),
        contestName: e.contestName ?? e.name ?? '',
        label: fmtUtc(ts, { month: 'short', day: 'numeric' }),
        fullLabel: fmtUtc(ts, { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    })

const niceStep = (span, targetTicks = 4) => {
  if (!(span > 0)) return 100
  const rough = span / Math.max(1, targetTicks - 1)
  const mag = 10 ** Math.floor(Math.log10(rough))
  const err = rough / mag
  const mul = err <= 1.5 ? 1 : err <= 3 ? 2 : err <= 7 ? 5 : 10
  return mul * mag
}

const ratingYAxis = (vals) => {
  if (!vals.length) return { domain: [0, 2000], ticks: [0, 500, 1000, 1500, 2000] }
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = Math.max(50, Math.round((max - min) * 0.08) || 50)
  const lo = Math.max(0, min - pad)
  const hi = max + pad
  const step = niceStep(hi - lo, 4)
  const domainMin = Math.floor(lo / step) * step
  const domainMax = Math.ceil(hi / step) * step
  const ticks = []
  for (let v = domainMin; v <= domainMax + 1e-6; v += step) ticks.push(Math.round(v))
  return { domain: [domainMin, domainMax], ticks }
}

const ratingXTicks = (data) => {
  if (data.length === 0) return []
  if (data.length <= 4) return data.map((d) => d.ts)
  const first = data[0].ts
  const last = data[data.length - 1].ts
  const span = last - first
  const targets = [first, first + span / 3, first + (2 * span) / 3, last]
  const used = new Set()
  const ticks = []
  for (const t of targets) {
    let best = null
    let bestD = Infinity
    for (const d of data) {
      if (used.has(d.ts)) continue
      const dist = Math.abs(d.ts - t)
      if (dist < bestD) {
        bestD = dist
        best = d.ts
      }
    }
    if (best != null) {
      used.add(best)
      ticks.push(best)
    }
  }
  return ticks.sort((a, b) => a - b)
}

const formatRatingXTick = (ts, data) => {
  if (!data.length) return ''
  const span = data[data.length - 1].ts - data[0].ts
  const yearMs = 365.25 * 864e5
  if (span > yearMs * 1.6) return fmtUtc(ts, { month: 'short', year: '2-digit' })
  return fmtUtc(ts, { month: 'short', day: 'numeric' })
}

const buildTopics = (profiles = []) => {
  const map = new Map()
  for (const p of profiles) {
    for (const t of p.topics ?? []) {
      const name  = t.name ?? t.slug ?? ''
      const count = Number(t.problemsSolved ?? t.count ?? 0)
      if (name) map.set(name, (map.get(name) ?? 0) + count)
    }
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const max = entries[0]?.[1] ?? 1
  return entries.map(([name, count]) => ({ name, count, max, pct: Math.round((count / max) * 100) }))
}

const buildRecentContests = (profiles = [], limit = 20) => {
  const all = []
  for (const p of profiles) {
    for (const c of p.contestHistory ?? []) {
      if (!c.date) continue
      all.push({
        platform:    p.platform,
        name:        c.contestName ?? c.name ?? 'Contest',
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

const buildFeed = (profiles = [], limit = 5) => {
  const items = []
  for (let i = 0; i < 14; i++) {
    const d   = new Date(utcToday())
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    for (const p of profiles) {
      const count = (p.activityByDate ?? {})[key] ?? 0
      if (count > 0) {
        const cfg = PLATFORMS.find(c => c.id === p.platform)
        items.push({
          text:   `Solved ${count} on ${cfg?.label ?? p.platform}`,
          time:   i === 0 ? 'today' : i === 1 ? 'yesterday' : `${i} days ago`,
          color:  cfg?.color ?? V.mute,
          sortKey: i * 100 + profiles.indexOf(p),
        })
      }
    }
    if (items.length >= limit * 3) break
  }
  return items.sort((a, b) => a.sortKey - b.sortKey).slice(0, limit)
}

// Static "up next" problems (will be replaced by real recommendations later)
const UP_NEXT = [
  { title: 'Climbing Stairs', difficulty: 'Easy',   tags: ['DP'],    url: 'https://leetcode.com/problems/climbing-stairs/' },
  { title: 'Coin Change',     difficulty: 'Medium', tags: ['DP'],    url: 'https://leetcode.com/problems/coin-change/' },
  { title: 'Number of Islands', difficulty: 'Medium', tags: ['Graph'], url: 'https://leetcode.com/problems/number-of-islands/' },
]

// ─── SVG Ring (streak progress) ───────────────────────────────────────────────
const CIRC = 2 * Math.PI * 34  // ≈ 213.6

const Ring = ({ pct = 0 }) => {
  const offset = CIRC * (1 - Math.min(pct, 1))
  return (
    <svg width="68" height="68" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="42" r="34" fill="none" stroke={V.h0} strokeWidth="9" />
      <circle
        cx="42" cy="42" r="34" fill="none"
        stroke={V.you} strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 42 42)"
        style={{ transition: 'stroke-dashoffset .6s' }}
      />
    </svg>
  )
}

// ─── Edit Handles Modal ───────────────────────────────────────────────────────
const EditHandlesModal = ({ profiles, onClose, onSave, isSaving, saveError }) => {
  const [handles, setHandles] = useState(
    Object.fromEntries(PLATFORMS.map(p => [p.id, profiles[p.id]?.username ?? '']))
  )
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ ...card, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Edit handles</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {PLATFORMS.map(cfg => (
            <label key={cfg.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 16, background: V.surf2, border: `1px solid ${V.line}`, cursor: 'text' }}>
              {/* Platform image badge — same as HandlesPanel */}
              <span style={{ width: 44, height: 44, borderRadius: 12, background: cfg.color + '22', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <img src={cfg.img} alt={cfg.label} style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4 }} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: V.mute }}>{cfg.label}</span>
                <input
                  type="text"
                  value={handles[cfg.id]}
                  onChange={e => setHandles(h => ({ ...h, [cfg.id]: e.target.value }))}
                  placeholder="username"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: V.text, fontFamily: 'inherit', marginTop: 2 }}
                />
              </span>
            </label>
          ))}
        </div>
        {saveError && <p style={{ marginTop: 10, fontSize: 13, color: '#ff6b6b' }}>{saveError}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnBase}>Cancel</button>
          <button type="button" disabled={isSaving} onClick={() => onSave(handles)} style={{ ...btnPrimary, flex: 1 }}>
            {isSaving ? 'Fetching…' : 'Save & Fetch'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Handles panel ────────────────────────────────────────────────────────────
const HandlesPanel = ({ profiles, onEdit }) => (
  <section style={{ ...card, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Handles</h2>
      <button type="button" onClick={onEdit} style={btnBase}>Edit</button>
    </div>
    {/* rows flex-grow so they space evenly and fill the card height */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {PLATFORMS.map((cfg, idx) => {
        const p        = profiles[cfg.id]
        const username = p?.username ?? ''
        const isLast   = idx === PLATFORMS.length - 1
        return (
          <div key={cfg.id} style={{
            display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12,
            alignItems: 'center',
            padding: '11px 0',
            borderBottom: isLast ? 'none' : `1px solid ${V.line}`,
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: cfg.color + '22',
              display: 'grid', placeItems: 'center',
            }}>
              <img src={cfg.img} alt={cfg.label} style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4 }} />
            </span>

            <span>
              <div style={{ fontWeight: username ? 700 : 400, lineHeight: 1.2, color: username ? V.text : V.mute }}>
                {username || 'Not connected'}
              </div>
              <div style={{ fontSize: 13, color: V.mute, marginTop: 1 }}>{cfg.label}</div>
            </span>

            {username ? (
              <a href={cfg.profileUrl(username)} target="_blank" rel="noopener noreferrer"
                style={{ color: V.text, fontSize: 13, textUnderlineOffset: 3, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                View
              </a>
            ) : <span />}
          </div>
        )
      })}
    </div>
  </section>
)

// ─── Platform breakdown bar ───────────────────────────────────────────────────
const PlatformBar = ({ connectedProfiles, totalSolved }) => {
  const [selected, setSelected] = useState(null)

  const segments = PLATFORMS
    .map(cfg => ({ cfg, solved: connectedProfiles.find(p => p.platform === cfg.id)?.problemsSolved ?? 0 }))
    .filter(s => s.solved > 0)

  if (!totalSolved || segments.length === 0) return null

  const activeCfg     = selected ? PLATFORMS.find(c => c.id === selected) : null
  const activeProfile = selected ? connectedProfiles.find(p => p.platform === selected) : null
  const toggle        = (id) => setSelected(prev => prev === id ? null : id)

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Where your {fmt(totalSolved)} solves came from</h2>
        <span style={{ color: V.mute, fontSize: 14 }}>Tap a platform</span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 30, borderRadius: 14, overflow: 'hidden', gap: 3, margin: '16px 0 12px' }}>
        {segments.map(({ cfg, solved }) => (
          <button
            key={cfg.id}
            type="button"
            title={cfg.label}
            onClick={() => toggle(cfg.id)}
            style={{
              border: 0,
              borderRadius: 6,
              padding: 0,
              background: cfg.color,
              flex: solved,
              opacity: selected && selected !== cfg.id ? 0.35 : 1,
              cursor: 'pointer',
              minWidth: 8,
              transition: 'opacity .2s',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {segments.map(({ cfg, solved }) => (
          <button
            key={cfg.id}
            type="button"
            onClick={() => toggle(cfg.id)}
            style={{ ...btnBase, padding: '6px 14px', fontSize: 14, opacity: selected && selected !== cfg.id ? 0.4 : 1, transition: 'opacity .2s' }}
          >
            <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: cfg.color, marginRight: 7 }} />
            {cfg.label} <b style={mono}>{fmt(solved)}</b>
          </button>
        ))}
      </div>

      {/* Detail row for selected platform */}
      {activeCfg && activeProfile && (
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 16, background: V.surf2, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><b>{activeCfg.label}</b> <span style={{ color: V.mute }}>{activeProfile.username}</span></span>
          <span><b style={mono}>{fmt(activeProfile.problemsSolved)}</b> solved</span>
          {(activeProfile.rating ?? activeProfile.contestRating) != null && (
            <span>Rating <b style={mono}>{fmt(activeProfile.rating ?? activeProfile.contestRating)}</b></span>
          )}
          <a href={activeCfg.profileUrl(activeProfile.username)} target="_blank" rel="noopener noreferrer" style={{ color: V.text, textUnderlineOffset: 3 }}>
            View profile
          </a>
        </div>
      )}
    </section>
  )
}

// ─── Activity heatmap (GitHub-style year grid, from activityByDate) ──────────

const TOPIC_SHORT = {
  'Depth-First Search': 'DFS',
  'Breadth-First Search': 'BFS',
  'Dynamic Programming': 'DP',
  'Binary Search Tree': 'BST',
  'Binary Tree': 'Binary Tree',
  'Hash Table': 'Hash Map',
  'Hash Map': 'Hash Map',
}

const shortTopic = (name = '') => {
  if (TOPIC_SHORT[name]) return TOPIC_SHORT[name]
  return name.length > 16 ? name.split(/[\s-]+/).map((w) => w[0]).join('').toUpperCase() : name
}

const utcFromKey = (key) => new Date(`${key}T00:00:00.000Z`)

const activeYears = (activityByDate = {}) => {
  const years = new Set()
  for (const [day, count] of Object.entries(activityByDate)) {
    if (count > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day)) years.add(+day.slice(0, 4))
  }
  return [...years].sort((a, b) => b - a)
}

const heatmapRange = (selection) => {
  const end = utcToday()
  if (selection === 'rolling') {
    const start = new Date(end)
    start.setUTCFullYear(start.getUTCFullYear() - 1)
    return { start, end }
  }
  const year = Number(selection)
  const start = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  return { start, end: yearEnd < end ? yearEnd : end }
}

const MN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

const buildNativeHeatmap = (activityByDate = {}, start, end) => {
  const cursor = new Date(start)
  const dow = (cursor.getUTCDay() + 6) % 7
  cursor.setUTCDate(cursor.getUTCDate() - dow)

  const weeks = []
  let lastMonth = null
  while (cursor <= end) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().slice(0, 10)
      const inRange = cursor >= start && cursor <= end
      const count = inRange ? (activityByDate[key] ?? 0) : 0
      const level = !inRange ? -1 : count === 0 ? 0 : count <= 2 ? 1 : count <= 6 ? 2 : 3
      week.push({ key, count, level, inRange })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    const inRangeDays = week.filter((d) => d.inRange)
    const firstOfMonth = inRangeDays.find((d) => utcFromKey(d.key).getUTCDate() === 1)
    const labelSrc = firstOfMonth ?? inRangeDays[0]
    if (labelSrc) {
      const month = utcFromKey(labelSrc.key).getUTCMonth()
      if (month !== lastMonth) {
        week.monthLabel = MN_SHORT[month]
        lastMonth = month
      } else {
        week.monthLabel = ''
      }
    } else {
      week.monthLabel = ''
    }
    weeks.push(week)
  }
  return weeks
}

const HeatmapCard = ({ combinedActivity }) => {
  const years = useMemo(() => activeYears(combinedActivity), [combinedActivity])
  const [selection, setSelection] = useState('rolling')

  const { start, end } = useMemo(() => heatmapRange(selection), [selection])
  const weeks = useMemo(
    () => buildNativeHeatmap(combinedActivity, start, end),
    [combinedActivity, start, end]
  )

  // Measure the container width so cells can fill the full width on desktop
  const containerRef = useRef(null)
  const scrollRef    = useRef(null)
  const [cellSz, setCellSz] = useState(12)

  useEffect(() => {
    if (!containerRef.current) return
    const LABEL_COL = 32  // weekday label column width
    const COL_GAP   = 8   // gap between label col and grid
    const CELL_GAP  = 3

    const compute = (w) => {
      const available = w - LABEL_COL - COL_GAP
      const sz = Math.max(11, Math.floor((available - (weeks.length - 1) * CELL_GAP) / weeks.length))
      setCellSz(sz)
    }

    compute(containerRef.current.offsetWidth)
    const ro = new ResizeObserver(([entry]) => compute(entry.contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [weeks.length])

  // Scroll to latest days (right edge) on mobile/initial load or selection change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [weeks.length, selection, cellSz])

  const rangeActiveDays = useMemo(() => {
    let n = 0
    for (const [day, count] of Object.entries(combinedActivity)) {
      if (!(count > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      const t = utcFromKey(day)
      if (t >= start && t <= end) n++
    }
    return n
  }, [combinedActivity, start, end])

  const rangeLabel = selection === 'rolling'
    ? `${MN_SHORT[start.getUTCMonth()]} ${start.getUTCFullYear()} – ${MN_SHORT[end.getUTCMonth()]} ${end.getUTCFullYear()}`
    : String(selection)

  const GAP = 3
  const LABEL_COL = 32

  return (
    <section style={{ ...card, minWidth: 0, maxWidth: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 4px 14px', marginBottom: 6 }}>
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Activity heatmap</h2>
        <select
          aria-label="Heatmap period"
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="cc-sort-select"
          style={{ fontSize: 13, padding: '7px 38px 7px 16px' }}
        >
          <option value="rolling">Last 12 months</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Fluid grid container — ref measures available card width */}
      <div ref={containerRef} style={{ width: '100%', minWidth: 0 }}>
        {/* Scrollable wrapper for mobile and narrow viewports */}
        <div ref={scrollRef} className="cc-hscroll">
          <div style={{ minWidth: 'max-content' }}>
            {/* Month labels row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${LABEL_COL}px repeat(${weeks.length}, ${cellSz}px)`,
              gap: `0 ${GAP}px`,
              marginBottom: 6,
              fontSize: 11,
              color: V.mute,
            }}>
              <div />
              {weeks.map((week, wi) => (
                <div key={wi} style={{ overflow: 'visible', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  {week.monthLabel}
                </div>
              ))}
            </div>

            {/* Weekday labels + cell grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${LABEL_COL}px repeat(${weeks.length}, ${cellSz}px)`,
              gridTemplateRows: `repeat(7, ${cellSz}px)`,
              gap: `${GAP}px`,
            }}>
              {/* Weekday labels — placed in column 1, rows 1-7 */}
              {WEEKDAY_LABELS.map((lbl, i) => (
                <div key={i} style={{
                  gridColumn: 1,
                  gridRow: i + 1,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 9,
                  color: V.mute,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {lbl}
                </div>
              ))}

              {/* Cells — column 2…N+1, rows 1-7 */}
              {weeks.flatMap((week, wi) =>
                week.map((day, di) => (
                  <div
                    key={day.key}
                    title={
                      !day.inRange ? undefined
                        : day.count > 0 ? `${day.count} solve${day.count === 1 ? '' : 's'} · ${day.key}`
                        : `No solves · ${day.key}`
                    }
                    style={{
                      gridColumn: wi + 2,
                      gridRow: di + 1,
                      width: cellSz,
                      height: cellSz,
                      borderRadius: Math.max(2, Math.floor(cellSz * 0.28)),
                      background: day.level < 0 ? 'transparent' : `var(--h${day.level})`,
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <p style={{ margin: 0 }}>
          <b style={{ ...mono, color: V.you }}>{fmt(rangeActiveDays)}</b>
          <span style={{ color: V.mute }}> active days · {rangeLabel}</span>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: V.mute }}>
          Less
          {[0, 1, 2, 3].map((lvl) => (
            <i key={lvl} style={{ display: 'block', width: 10, height: 10, borderRadius: 2, background: `var(--h${lvl})` }} />
          ))}
          More
        </div>
      </div>
    </section>
  )
}

// ─── Rating trend card ────────────────────────────────────────────────────────
const RATING_PLATFORMS = ['LeetCode', 'Codeforces', 'CodeChef', 'AtCoder']
const RATING_KEY = { LeetCode: 'leetcode', Codeforces: 'codeforces', CodeChef: 'codechef', AtCoder: 'atcoder' }

// ─── Topics card ──────────────────────────────────────────────────────────────
const TopicsCard = ({ topics }) => {
  const [mode, setMode] = useState('p')  // 'p' = problems, 'a' = accuracy

  return (
    <section style={{ ...card, boxSizing: 'border-box', height: 380, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>DSA topics</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['p', 'Problems'], ['a', 'Accuracy']].map(([m, lbl]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ ...btnBase, padding: '5px 12px', fontSize: 13, ...(mode === m ? { background: V.text, color: V.bg, borderColor: V.text } : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      {topics.length === 0 ? (
        <p style={{ fontSize: 14, color: V.mute }}>No topic data available yet.</p>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 6 }}>
          {topics.map(({ name, count, pct, max }) => {
            const displayVal = mode === 'a' ? pct : count
            const barW       = mode === 'a' ? pct : Math.round((count / max) * 100)
            return (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 40px', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${V.line}` }}
                className="tbar-last-no-border">
                <div>
                  <span style={{ fontSize: 14 }}>{name}</span>
                  <div style={{ height: 8, borderRadius: 8, background: V.h0, marginTop: 6, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${barW}%`, background: V.you, borderRadius: 8 }} />
                  </div>
                </div>
                <b style={{ ...mono, textAlign: 'right', fontSize: 18 }}>{displayVal}{mode === 'a' ? '%' : ''}</b>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const TopicRadarCard = ({ topics }) => {
  const top = topics.slice(0, 5)
  const cx = 150, cy = 130, R = 90
  const n = top.length
  const max = top[0]?.count || 1
  const angle = (i) => (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
  const pt = (i, k) => `${cx + Math.cos(angle(i)) * R * k},${cy + Math.sin(angle(i)) * R * k}`

  return (
    <section style={{ ...card, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Topic radar</h2>
        <span style={{ color: V.mute, fontSize: 14 }}>Top 5 topics</span>
      </div>
      {n < 3 ? (
        <p style={{ fontSize: 14, color: V.mute }}>Solve across a few topics to see your radar.</p>
      ) : (
        <svg viewBox="0 0 300 260" role="img" aria-label="Radar chart of your top five topics" style={{ margin: 'auto', maxWidth: 420, display: 'block', width: '100%' }}>
          {[0.33, 0.66, 1].map((f) => (
            <polygon key={f} fill="none" stroke="var(--line)" points={top.map((_, i) => pt(i, f)).join(' ')} />
          ))}
          <polygon
            points={top.map((t, i) => pt(i, t.count / max)).join(' ')}
            fill="var(--you)" fillOpacity=".25" stroke="var(--you)" strokeWidth="3" strokeLinejoin="round"
          />
          {top.map((t, i) => (
            <text
              key={t.name}
              x={cx + Math.cos(angle(i)) * (R + 22)}
              y={cy + Math.sin(angle(i)) * (R + 16) + 4}
              textAnchor="middle"
              fontSize="12"
              fill="var(--mute)"
            >
              {shortTopic(t.name)}
            </text>
          ))}
        </svg>
      )}
    </section>
  )
}

// ─── Submissions bar chart (last 30 days from activityByDate) ─────────────────
const buildSubmissionsData = (activityByDate = {}, days = 60) => {
  const data = []
  const end = utcToday()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    const key   = d.toISOString().slice(0, 10)
    const count = activityByDate[key] ?? 0
    data.push({ key, count, date: d })
  }
  return data
}

const SubmissionsCard = ({ combinedActivity }) => {
  const data    = useMemo(() => buildSubmissionsData(combinedActivity, 60), [combinedActivity])
  const total60 = data.reduce((s, d) => s + d.count, 0)
  const maxVal  = Math.max(...data.map(d => d.count), 1)
  const startLabel = data[0]?.date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(data[0].date) : ''
  const endLabel   = data[data.length - 1]?.date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(data[data.length - 1].date) : ''

  return (
    <section style={{ ...card, boxSizing: 'border-box', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Submissions</h2>
        <span style={{ color: V.mute, fontSize: 14 }}>{total60} in 60 days</span>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={10} margin={{ top: 4, right: 0, bottom: 16, left: 0 }}>
            <XAxis
              dataKey="key"
              tick={false}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={false}
              contentStyle={{ background: V.surf, border: `1px solid ${V.line}`, borderRadius: 10, fontSize: 12, fontFamily: "'JetBrains Mono'" }}
              itemStyle={{ color: V.you }}
              labelStyle={{ color: V.mute }}
              labelFormatter={(key) => key}
              formatter={(v) => [v, 'solves']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.key}
                  fill={d.count >= maxVal * 0.7 ? 'var(--hot)' : 'var(--you)'}
                  fillOpacity={d.count === 0 ? 0.15 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: V.mute, marginTop: 2 }}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </section>
  )
}

// ─── Distribution card (groups by DSA/Competitive/Fundamentals) ───────────────
const buildDistribution = (connectedProfiles = []) => {
  // DSA = LeetCode (easy/medium/hard)
  const lc = connectedProfiles.find(p => p.platform === 'leetcode')
  const dsaEasy   = lc?.solvedByDifficulty?.easy   ?? 0
  const dsaMedium = lc?.solvedByDifficulty?.medium ?? 0
  const dsaHard   = lc?.solvedByDifficulty?.hard   ?? 0
  const dsaTotal  = dsaEasy + dsaMedium + dsaHard

  // Competitive = Codeforces + CodeChef
  const cf  = connectedProfiles.find(p => p.platform === 'codeforces')
  const cc  = connectedProfiles.find(p => p.platform === 'codechef')
  const cfSolved = cf?.problemsSolved ?? 0
  const ccSolved = cc?.problemsSolved ?? 0
  const compTotal = cfSolved + ccSolved

  // Fundamentals = GFG
  const gfg  = connectedProfiles.find(p => p.platform === 'geeksforgeeks')
  const gfgSolved = gfg?.problemsSolved ?? 0

  return [
    {
      label: 'DSA',
      total: dsaTotal,
      colors: ['#9a9488', 'var(--you)', 'var(--hot)'],
      segments: [
        { label: 'Easy',   value: dsaEasy,   color: '#9a9488' },
        { label: 'Medium', value: dsaMedium, color: 'var(--you)' },
        { label: 'Hard',   value: dsaHard,   color: 'var(--hot)' },
      ],
    },
    {
      label: 'Competitive',
      total: compTotal,
      colors: ['#c8a96e', '#4e8ef7'],
      segments: [
        { label: 'CodeChef',   value: ccSolved, color: '#c8a96e' },
        { label: 'Codeforces', value: cfSolved, color: '#4e8ef7' },
      ],
    },
    {
      label: 'Fundamentals',
      total: gfgSolved,
      colors: ['#2fb55e'],
      segments: [
        { label: 'GFG', value: gfgSolved, color: '#2fb55e' },
      ],
    },
  ].filter(g => g.total > 0)
}

// Compact 64px donut for DistributionCard
const MiniDonut = ({ segments, total }) => {
  const R = 24, SW = 7
  const circ = 2 * Math.PI * R
  const active = segments.filter(s => s.value > 0)
  const slices = active.map((s, idx) => {
    const frac  = s.value / Math.max(total, 1)
    const dash  = frac * circ
    const offset = active.slice(0, idx).reduce((sum, prev) => sum + (prev.value / Math.max(total, 1)) * circ, 0)
    return { ...s, dash, gap: circ - dash, offset }
  })
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={R} fill="none" stroke="var(--h0)" strokeWidth={SW} />
      {slices.map((s, i) => (
        <circle key={i} cx={32} cy={32} r={R} fill="none"
          stroke={s.color} strokeWidth={SW}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset + circ * 0.25}
          strokeLinecap="butt"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '32px 32px' }}
        />
      ))}
      <text x={32} y={36} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text)" fontFamily="'JetBrains Mono',monospace">
        {fmt(total)}
      </text>
    </svg>
  )
}

const DistributionCard = ({ connectedProfiles }) => {
  const groups = useMemo(() => buildDistribution(connectedProfiles), [connectedProfiles])

  return (
    <section style={{ ...card, boxSizing: 'border-box', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ ...brg, fontSize: 17, fontWeight: 700 }}>Distribution</h2>
        <span style={{ color: V.mute, fontSize: 13 }}>How they split</span>
      </div>
      {groups.length === 0 ? (
        <p style={{ fontSize: 14, color: V.mute }}>Add your platform handles to see distribution.</p>
      ) : (
        <div>
          {groups.map((g, gi) => (
            <div key={g.label} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 0',
              borderBottom: gi < groups.length - 1 ? `1px solid ${V.line}` : 'none',
            }}>
              {/* Smaller donut: 64px */}
              <MiniDonut segments={g.segments} total={g.total} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{g.label}</div>
                {g.segments.filter(s => s.value > 0).map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.mute }}>
                      <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      {s.label}
                    </span>
                    <b style={{ ...mono, fontSize: 13 }}>{fmt(s.value)}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Feed / Recent activity ───────────────────────────────────────────────────
const FeedCard = ({ feed }) => (
  <section style={{ ...card, boxSizing: 'border-box', width: '100%', height: '100%' }}>
    <h2 style={{ ...brg, fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Recent</h2>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {feed.length === 0 ? (
        <li style={{ padding: '10px 0', fontSize: 14, color: V.mute }}>No recent activity</li>
      ) : feed.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${V.line}`, fontSize: 13 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
          <span style={{ color: V.mute, fontSize: 12, whiteSpace: 'nowrap', marginLeft: 'auto', paddingLeft: 8 }}>{item.time}</span>
        </li>
      ))}
    </ul>
  </section>
)

// ─── Contests card ────────────────────────────────────────────────────────────
const PLAT_ICON = { leetcode: '🟡', codeforces: '🔵', codechef: '🟤', atcoder: '⬛', geeksforgeeks: '🟢' }

const ContestsCard = ({ contests }) => (
  <section style={{ ...card, boxSizing: 'border-box', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
      <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Recent contests</h2>
      <span style={{ color: V.mute, fontSize: 14 }}>Last {contests.length} attended</span>
    </div>
    {contests.length === 0 ? (
      <p style={{ fontSize: 14, color: V.mute }}>No contest history yet.</p>
    ) : (
      <div className="cc-contests-grid">
        {contests.map((c, i) => {
          const cfg = PLATFORMS.find(p => p.id === c.platform)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: V.surf2, border: `1px solid ${V.line}`, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: V.h0, border: `1px solid ${V.line}`, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 16 }}>
                {PLAT_ICON[c.platform] ?? '⚪'}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: V.mute, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.dateLabel} · {cfg?.label}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                <div style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{c.rank}</div>
                {c.ratingDelta != null && (
                  <div style={{ fontSize: 12, color: c.ratingDelta >= 0 ? V.you : V.hot, fontWeight: 700 }}>
                    {c.ratingDelta >= 0 ? '+' : ''}{c.ratingDelta}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </section>
)

// ─── Animated count-up stat box ───────────────────────────────────────────────
const StatBox = ({ value, label, sub, subColor }) => {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)
  const target = typeof value === 'number' ? value : 0

  useEffect(() => {
    if (!target) {
      const id = requestAnimationFrame(() => setDisplay(0))
      return () => cancelAnimationFrame(id)
    }
    const t0 = performance.now()
    const animate = (t) => {
      const k = Math.min((t - t0) / 900, 1)
      setDisplay(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return (
    <div style={card}>
      <div style={{ ...mono, ...brg, fontSize: 'clamp(30px,4vw,42px)', fontWeight: 800, lineHeight: 1 }}>
        {value == null ? '—' : display.toLocaleString()}
      </div>
      <small style={{ color: V.mute, display: 'block', marginTop: 6 }}>{label}</small>
      {sub && <span style={{ color: subColor ?? V.you, fontSize: 13, fontWeight: 700 }}>{sub}</span>}
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const Tabs = ({ active, onChange }) => {
  const tabs = [['o', 'Overview'], ['a', 'Activity'], ['c', 'Contests'], ['t', 'Topics']]
  return (
    <div className="cc-tabs">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`cc-tab-btn ${active === key ? 'active' : ''}`}
          style={{
            ...btnBase,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ...(active === key ? { background: V.text, color: V.bg, borderColor: V.text } : {}),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
const ProfilePage = () => {
  const navigate = useNavigate()
  const { user }  = useAuth()
  const { syncUserProfile, syncState } = useSync()

  // ── State ──
  const [profiles, setProfiles] = useState({
    leetcode: null, codeforces: null, codechef: null, atcoder: null, geeksforgeeks: null,
  })
  const [lastSyncedAt,  setLastSyncedAt]  = useState(null)
  const [isRefreshing,  setIsRefreshing]  = useState(false)
  const [fetchError,    setFetchError]    = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSaving,      setIsSaving]      = useState(false)
  const [saveError,     setSaveError]     = useState(null)
  const [activeTab,     setActiveTab]     = useState('o')
  const [ratingPlat,    setRatingPlat]    = useState('LeetCode')
  const [topicMode,     setTopicMode]     = useState('p')

  // Goal state (like reference — stored in localStorage)
  const [goalCount] = useState(() => {
    try { const g = +localStorage.getItem('cc-goal'); return g >= 1 && g <= 99 ? g : 3 } catch { return 3 }
  })
  const [goalUntil] = useState(() => {
    try { const u = localStorage.getItem('cc-until'); return /^\d{4}-\d{2}$/.test(u ?? '') ? u : '2027-03' } catch { return '2027-03' }
  })
  const [solved, setSolved] = useState(0)

  // ── Load profiles ──
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

  // ── Refresh (SSE Streaming) ──
  const handleRefresh = async () => {
    const connected = Object.entries(profiles).filter(([, p]) => p?.username).map(([plat, p]) => [plat, p.username])
    if (!connected.length || syncState.isSyncing) return
    setFetchError(null)
    syncUserProfile({
      handles: Object.fromEntries(connected),
      onProfileUpdated: (platform, profile) => {
        setProfiles(curr => ({ ...curr, [platform]: profile }))
        setLastSyncedAt(new Date())
      },
      onComplete: (summary) => {
        if (summary.failed > 0 && summary.succeeded === 0) {
          setFetchError('Failed to refresh platform profiles')
        }
      },
    })
  }

  // ── Save handles (SSE Streaming) ──
  const handleSaveHandles = async (newHandles) => {
    const toFetch = Object.fromEntries(Object.entries(newHandles).filter(([, v]) => v.trim()))
    if (!Object.keys(toFetch).length) { setShowEditModal(false); return }
    setIsSaving(true)
    setSaveError(null)

    // Close modal immediately and stream in the background
    setProfiles(Object.fromEntries(PLATFORMS.map(p => [p.id, newHandles[p.id]?.trim() ? profiles[p.id] : null])))
    setShowEditModal(false)
    setIsSaving(false)

    syncUserProfile({
      handles: toFetch,
      onProfileUpdated: (platform, profile) => {
        setProfiles(curr => ({ ...curr, [platform]: profile }))
        setLastSyncedAt(new Date())
      },
      onComplete: (summary) => {
        if (summary.failed > 0 && summary.succeeded === 0) {
          setFetchError('Could not fetch any platform profiles. Check the handles and try again.')
        }
      },
    })
  }

  // ── Derived ──
  const connectedProfiles = useMemo(
    () => Object.entries(profiles).filter(([, p]) => p).map(([platform, p]) => ({ ...p, platform })),
    [profiles]
  )
  const hasData = connectedProfiles.length > 0

  const displayName  = user?.name?.split(' ')[0] ?? connectedProfiles[0]?.username ?? 'You'
  const totalSolved   = hasData ? connectedProfiles.reduce((s, p) => s + (p.problemsSolved ?? 0), 0) : null
  const totalContests = hasData ? connectedProfiles.reduce((s, p) => s + (p.contestsAttended ?? 0), 0) : null

  const combinedActivity = useMemo(() => {
    const map = {}
    for (const p of connectedProfiles)
      for (const [day, count] of Object.entries(p.activityByDate ?? {}))
        map[day] = (map[day] ?? 0) + count
    return map
  }, [connectedProfiles])

  const currentStreak   = useMemo(() => getCurrentStreak(combinedActivity), [combinedActivity])
  const totalActiveDays = useMemo(() => countActiveDays(combinedActivity), [combinedActivity])
  const last30          = useMemo(() => sumActivityDays(combinedActivity, 30), [combinedActivity])

  const topics         = useMemo(() => buildTopics(connectedProfiles), [connectedProfiles])
  const recentContests = useMemo(() => buildRecentContests(connectedProfiles, 20), [connectedProfiles])
  const feed           = useMemo(() => buildFeed(connectedProfiles, 5), [connectedProfiles])

  // Rating trend derived (for inline overview)
  const ratingPlatKey  = RATING_KEY[ratingPlat]
  const ratingData     = useMemo(
    () => buildRatingSeries(profiles[ratingPlatKey]?.contestHistory ?? []),
    [profiles, ratingPlatKey]
  )
  const ratingVals     = ratingData.map(d => d.rating)
  const ratingAxis     = useMemo(() => ratingYAxis(ratingVals), [ratingVals])
  const ratingTicks    = useMemo(() => ratingXTicks(ratingData), [ratingData])

  const syncLabel = getRelativeTime(lastSyncedAt)

  // Goal helpers
  const fmtUntil = () => {
    const [y, m] = goalUntil.split('-')
    const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${MN[+m - 1]} ${y}`
  }
  const daysLeft = () => {
    const [y, m] = goalUntil.split('-')
    const end = new Date(+y, +m, 0)
    end.setHours(0,0,0,0)
    const now = new Date(); now.setHours(0,0,0,0)
    return Math.round((end - now) / 864e5)
  }
  const dl = daysLeft()
  const goalExpired = dl < 0
  const goalDone   = solved >= goalCount

  const goalCopy = goalExpired
    ? `Ended ${fmtUntil()}. Pick a new month to keep this going.`
    : goalDone
    ? `Goal reached. Streak is safe · ${dl} day${dl === 1 ? '' : 's'} left.`
    : `${solved} of ${goalCount} done · ${dl} day${dl === 1 ? '' : 's'} left.`

  const ringPct = goalCount > 0 ? solved / goalCount : 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%' }}>

      {showEditModal && (
        <EditHandlesModal
          profiles={profiles}
          onClose={() => { setShowEditModal(false); setSaveError(null) }}
          onSave={handleSaveHandles}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}

      {/* ── TOP: left column + handles sidebar ── */}
      <div className="cc-top-grid">

        {/* Left column — hero + streak fill same total height as handles */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 14 }}>

          {/* Hero card */}
          <section style={{ ...card, padding: '16px 20px' }}>
            <span style={{ color: V.mute, fontSize: 13 }}>{getGreeting()}</span>
            <h1 style={{ ...brg, fontSize: 'clamp(28px,3.8vw,48px)', lineHeight: 1, fontWeight: 800, margin: '4px 0 10px' }}>
              {displayName}
            </h1>
            {totalSolved != null && (
              <>
                <p style={{ ...brg, fontWeight: 700, fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.2, letterSpacing: '-.03em', margin: '0 0 4px' }}>
                  <span style={mono}>{fmt(totalSolved)}</span> problems across {connectedProfiles.length} platform{connectedProfiles.length !== 1 ? 's' : ''}
                </p>
                <p style={{ color: V.mute, fontSize: 13 }}>
                  {fmt(last30)} of those in the last 30 days.
                </p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={!hasData || syncState.isSyncing}
                style={{
                  ...btnPrimary,
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  opacity: (!hasData || syncState.isSyncing) ? 0.6 : 1,
                }}
              >
                <svg
                  style={{
                    width: 14,
                    height: 14,
                    animation: syncState.isSyncing ? 'cc-spin 0.85s linear infinite' : 'none',
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
                {syncState.isSyncing ? 'Syncing…' : 'Refresh data'}
              </button>
              <button type="button" onClick={() => navigate('/compare')} style={{ ...btnBase, padding: '8px 18px' }}>
                Compare with a friend
              </button>
              {syncLabel && (
                <span style={{ color: V.mute, fontSize: 12 }}>
                  Synced {syncLabel}
                </span>
              )}
              {!hasData && (
                <span style={{ color: V.mute, fontSize: 12 }}>Add your handles to get started</span>
              )}
            </div>
            {fetchError && (
              <p role="alert" style={{ marginTop: 8, fontSize: 12, color: V.hot }}>{fetchError}</p>
            )}
          </section>

          {/* Streak + Goal card — fills remaining height exactly */}
          <section style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: V.mute, fontSize: 13 }}>Current streak</div>
                <div style={{ ...brg, fontSize: 36, lineHeight: 1, fontWeight: 800, color: V.hot, marginTop: 2 }}>
                  {currentStreak}
                  <span style={{ fontSize: 18 }}> day{currentStreak !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <Ring pct={ringPct} />
            </div>

            {/* Goal section */}
            <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 6px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Today's goal</span>
                <span style={{ ...mono, ...brg, fontSize: 18, fontWeight: 800, letterSpacing: '-.04em' }}>{goalCount}</span>
                <span style={{ color: V.mute, fontSize: 13 }}>{goalCount === 1 ? 'problem' : 'problems'}</span>
              </div>
              <div style={{ color: V.mute, fontSize: 13 }}>
                until <strong style={{ color: V.text }}>{fmtUntil()}</strong>
              </div>
              <div style={{ color: V.mute, fontSize: 12 }}>{goalCopy}</div>
            </div>

            <button
              type="button"
              disabled={goalExpired || goalDone}
              onClick={() => { if (goalExpired || goalDone) return; setSolved(s => s + 1) }}
              style={{ ...btnPrimary, width: '100%', marginTop: 10, padding: '10px 18px', fontSize: 14, opacity: (goalExpired || goalDone) ? 0.5 : 1 }}
            >
              {goalExpired ? 'Window ended' : goalDone ? 'Done for today ✓' : 'Log a solve'}
            </button>
          </section>
        </div>

        {/* Handles sidebar — stretches to fill full height of left column */}
        <div style={{ alignSelf: 'stretch' }}>
          <HandlesPanel
            profiles={profiles}
            onEdit={() => { setSaveError(null); setShowEditModal(true) }}
          />
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="cc-stats-grid">
        <StatBox value={totalSolved} label="Problems solved" sub={last30 > 0 ? `+${fmt(last30)} in 30 days` : undefined} />
        <StatBox value={hasData ? totalActiveDays : null} label="Active days" sub={hasData && currentStreak > 0 ? `${currentStreak} day streak` : undefined} />
        <StatBox value={totalContests} label="Contests attended" />
      </div>

      {/* ── PLATFORM BAR ── */}
      <PlatformBar connectedProfiles={connectedProfiles} totalSolved={totalSolved} />

      {/* ── TABS ── */}
      <Tabs active={activeTab} onChange={setActiveTab} />

      {/* ── OVERVIEW ── */}
      {activeTab === 'o' && (
        <div className="cc-grid" style={{ alignItems: 'stretch' }}>

          {/* ── Row 1: Heatmap full width ── */}
          <div className="a12">
            <HeatmapCard combinedActivity={combinedActivity} />
          </div>

          {/* ── Row 2: Rating trend span 7 ── */}
          <section className="a7" style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Rating trend</h2>
              <span style={{ color: V.mute, fontSize: 14 }}>{ratingPlat}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {RATING_PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => setRatingPlat(p)}
                  style={{ ...btnBase, padding: '4px 11px', fontSize: 12, ...(ratingPlat === p ? { background: V.text, color: V.bg, borderColor: V.text } : {}) }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 320 }}>
              {ratingData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ratingData} margin={{ top: 20, right: 16, bottom: 20, left: 4 }}>
                    <defs>
                      <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--you)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--you)" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={V.h0} vertical={false} />
                    <XAxis
                      dataKey="ts" type="number" scale="time"
                      domain={['dataMin', 'dataMax']}
                      ticks={ratingTicks}
                      tickFormatter={(ts) => formatRatingXTick(ts, ratingData)}
                      tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: "'JetBrains Mono'" }}
                      tickLine={false} axisLine={false}
                      padding={{ left: 16, right: 8 }} dy={6}
                    />
                    <YAxis
                      domain={ratingAxis.domain} ticks={ratingAxis.ticks}
                      allowDecimals={false}
                      tickFormatter={(v) => Math.round(v).toLocaleString()}
                      tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: "'JetBrains Mono'" }}
                      tickLine={false} axisLine={false}
                      width={56} dx={6}
                    />
                    <Tooltip
                      contentStyle={{ background: V.surf, border: `1px solid ${V.line}`, borderRadius: 12, fontSize: 12, fontFamily: "'JetBrains Mono'" }}
                      itemStyle={{ color: 'var(--you)' }} labelStyle={{ color: 'var(--mute)' }}
                      labelFormatter={(ts) => fmtUtc(ts, { month: 'short', day: 'numeric', year: 'numeric' })}
                      formatter={(v) => [Math.round(v).toLocaleString(), 'Rating']}
                    />
                    <Area type="linear" dataKey="rating"
                      stroke="var(--you)" strokeWidth={3} strokeLinecap="round"
                      fill="url(#rg2)"
                      dot={{ fill: 'var(--you)', r: 5, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: 'var(--you)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: V.mute }}>
                  No contest history for {ratingPlat}
                </div>
              )}
            </div>
          </section>

          {/* ── Row 2: Topic strength span 5 ── */}
          <section className="a5" style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Topic strength</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['p', 'Problems'], ['a', 'Accuracy']].map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setTopicMode(m)}
                    style={{ ...btnBase, padding: '4px 11px', fontSize: 12, ...(topicMode === m ? { background: V.text, color: V.bg, borderColor: V.text } : {}) }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {topics.length === 0 ? (
              <p style={{ fontSize: 14, color: V.mute }}>No topic data available yet.</p>
            ) : (
              <div>
                {topics.slice(0, 7).map(({ name, count, pct, max }, idx) => {
                  const isLast     = idx === Math.min(topics.length, 7) - 1
                  const displayVal = topicMode === 'a' ? pct : count
                  const barW       = topicMode === 'a' ? pct : Math.round((count / max) * 100)
                  return (
                    <div key={name} style={{
                      display: 'grid', gridTemplateColumns: '1fr 44px', gap: 10,
                      alignItems: 'center', padding: '9px 0',
                      borderBottom: isLast ? 'none' : `1px solid ${V.line}`,
                    }}>
                      <div>
                        <span style={{ fontSize: 14 }}>{name}</span>
                        <div style={{ height: 7, borderRadius: 8, background: V.h0, marginTop: 6, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${barW}%`, background: V.you, borderRadius: 8, transition: 'width .4s' }} />
                        </div>
                      </div>
                      <b style={{ ...mono, textAlign: 'right', fontSize: 16 }}>{displayVal}{topicMode === 'a' ? '%' : ''}</b>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'a' && (
        <div className="cc-grid">
          {/* Row 1: Recent + Distribution — equal-width, equal-height cards */}
          <div className="a6">
            <FeedCard feed={feed} />
          </div>
          <div className="a6">
            <DistributionCard connectedProfiles={connectedProfiles} />
          </div>
          {/* Row 2: Submissions full width */}
          <div className="a12">
            <SubmissionsCard combinedActivity={combinedActivity} />
          </div>
        </div>
      )}

      {/* ── CONTESTS TAB ── */}
      {activeTab === 'c' && (
        <div className="cc-grid">
          <div className="a12">
            <ContestsCard contests={recentContests} />
          </div>
        </div>
      )}

      {/* ── TOPICS TAB ── */}
      {activeTab === 't' && (
        <div className="cc-grid">
          <div className="a8">
            <TopicsCard topics={topics} />
          </div>
          <div className="a4" style={{ minWidth: 0 }}>
            <TopicRadarCard topics={topics} />
          </div>

          {/* ── Up next: full width below topics ── */}
          <section className="a12" style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Up next for you</h2>
              <span style={{ color: V.mute, fontSize: 14 }}>Picked from weaker topics</span>
            </div>
            <div className="cc-next-grid">
              {UP_NEXT.map((p) => (
                <div key={p.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 16, background: V.surf2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {p.title}
                    {p.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, border: `1px solid ${V.line}`, color: V.mute, marginLeft: 6 }}>{tag}</span>
                    ))}
                  </span>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ ...btnPrimary, textDecoration: 'none', padding: '7px 16px', fontSize: 14, borderRadius: 999, flexShrink: 0, display: 'inline-block', marginLeft: 8 }}>
                    Solve
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

    </div>
  )
}

export default ProfilePage
