import { ChevronRight, Flame, Loader2, UserMinus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import leetcode        from '../../assets/leetcode.png'
import codeforces      from '../../assets/codeforces.png'
import codechef        from '../../assets/codechef.png'
import atcoder         from '../../assets/atcoder.png'
import geeksforgeeks   from '../../assets/geeksforgeeks.svg'

const PLATFORM_ICON = { leetcode, codeforces, codechef, atcoder, geeksforgeeks }

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  active_now:    'bg-emerald-400',
  active_recent: 'bg-emerald-400',
  active_today:  'bg-emerald-400',
  inactive:      'bg-slate-500',
}

const StatusDot = ({ status }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLOR[status] ?? 'bg-slate-500'}`} />
)

// ── Avatar ─────────────────────────────────────────────────────────────────────

const Avatar = ({ initials, color }) => (
  <div
    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-[0_0_20px_rgba(0,0,0,0.4)]"
    style={{ backgroundColor: color }}
  >
    {initials}
  </div>
)

// ── Mini sparkline ─────────────────────────────────────────────────────────────

const Sparkline = ({ data }) => {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-10 w-24 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Platform stat cell ─────────────────────────────────────────────────────────

const PlatformStat = ({ platformKey, total, rating }) => {
  const img          = PLATFORM_ICON[platformKey]
  const displayValue = total ?? rating ?? '—'
  const subLabel     = total != null ? 'solved' : rating != null ? 'rating' : ''

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        {img && <img src={img} alt={platformKey} className="h-4 w-4 object-contain opacity-90" />}
      </div>
      <span className="text-sm font-bold text-white">{displayValue}</span>
      <span className="text-[10px] text-slate-500">{subLabel}</span>
    </div>
  )
}

// ── Last-activity bar ──────────────────────────────────────────────────────────

const LastActivity = ({ platform, text, timeAgo }) => {
  const img = PLATFORM_ICON[platform]
  return (
    <div className="flex items-center gap-2 border-t border-white/6 pt-3 text-xs text-slate-400">
      {img && <img src={img} alt={platform} className="h-3.5 w-3.5 shrink-0 object-contain opacity-70" />}
      <span className="min-w-0 truncate">{text}</span>
      <span className="ml-auto shrink-0 text-slate-500">{timeAgo}</span>
    </div>
  )
}

// ── FriendCard ─────────────────────────────────────────────────────────────────

/**
 * @param {{ friend: object, removing: boolean, onClick: () => void, onRemove: (e) => void }} props
 */
const FriendCard = ({ friend, removing = false, onClick, onRemove }) => {
  const {
    displayName,
    handle,
    avatarColor,
    initials,
    status,
    lastSeenLabel,
    streak,
    platforms,
    sparkline,
    lastActivity,
  } = friend

  const platformEntries = Object.entries(platforms ?? {})

  return (
    <article
      className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-all duration-200 hover:border-violet-500/30 hover:shadow-[0_8px_32px_rgba(124,58,237,0.14)]"
      onClick={onClick}
    >
      {/* Remove button — shown on hover */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          title="Remove friend"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 opacity-0 transition-all hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100 disabled:cursor-wait"
        >
          {removing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
            : <UserMinus className="h-3.5 w-3.5" />
          }
        </button>
      )}

      {/* ── Header row ── */}
      <div className="flex items-start gap-3">
        <Avatar initials={initials} color={avatarColor} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{displayName}</p>
          <p className="truncate text-xs text-slate-400">{handle}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
            <StatusDot status={status} />
            <span>{lastSeenLabel}</span>
          </div>
        </div>

        {/* Streak pill + chevron */}
        <div className="flex shrink-0 items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
              <Flame className="h-3.5 w-3.5" />
              {streak}d
            </div>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400" />
        </div>
      </div>

      {/* ── Platform stats row ── */}
      {platformEntries.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center justify-around">
            {platformEntries.map(([key, stat]) => (
              <PlatformStat
                key={key}
                platformKey={key}
                total={stat.total}
                rating={stat.rating}
              />
            ))}
          </div>
          {sparkline?.length > 1 && <Sparkline data={sparkline} />}
        </div>
      )}

      {/* ── Last activity ── */}
      {lastActivity && (
        <LastActivity
          platform={lastActivity.platform}
          text={lastActivity.text}
          timeAgo={lastActivity.timeAgo}
        />
      )}
    </article>
  )
}

export default FriendCard
