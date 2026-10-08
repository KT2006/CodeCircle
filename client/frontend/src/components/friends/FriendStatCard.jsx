import { Users, Code2, Trophy, TrendingUp } from 'lucide-react'

/**
 * A single summary card in the top stat bar on the Friends page.
 *
 * @param {{ icon: 'friends'|'problems'|'contests'|'rating', value: string|number, label: string, subtitle: string, delta?: string }} props
 */
const ICON_MAP = {
  friends:  { Icon: Users,      bg: 'bg-violet-500/15',  text: 'text-violet-300'  },
  problems: { Icon: Code2,      bg: 'bg-blue-500/15',    text: 'text-blue-300'    },
  contests: { Icon: Trophy,     bg: 'bg-amber-500/15',   text: 'text-amber-300'   },
  rating:   { Icon: TrendingUp, bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
}

const FriendStatCard = ({ icon = 'friends', value, label, subtitle, delta }) => {
  const { Icon, bg, text } = ICON_MAP[icon] ?? ICON_MAP.friends

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
      {/* Icon bubble */}
      <div className={`shrink-0 rounded-xl p-3 ${bg}`}>
        <Icon className={`h-5 w-5 ${text}`} />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
          {delta && (
            <span className="text-xs font-semibold text-emerald-400">{delta}</span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-slate-200">{label}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

export default FriendStatCard
