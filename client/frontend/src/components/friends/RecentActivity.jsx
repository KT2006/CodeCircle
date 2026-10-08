import { ArrowRight, TrendingUp } from 'lucide-react'
import leetcode  from '../../assets/leetcode.png'
import codeforces from '../../assets/codeforces.png'
import codechef  from '../../assets/codechef.png'
import atcoder   from '../../assets/atcoder.png'

const PLATFORM_ICON = { leetcode, codeforces, codechef, atcoder }

/** Small coloured initial avatar */
const MiniAvatar = ({ initials, color }) => (
  <div
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
    style={{ backgroundColor: color }}
  >
    {initials}
  </div>
)

/** Right-side badge — either a "+N" pill or a platform icon bar-chart */
const ActivityBadge = ({ badge, badgeColor, badgeIcon, badgeType }) => {
  const platformImg = PLATFORM_ICON[badgeIcon]

  if (badge) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {platformImg && (
          <img src={platformImg} alt={badgeIcon} className="h-5 w-5 rounded object-contain opacity-80" />
        )}
        <span
          className="rounded-lg px-2 py-0.5 text-sm font-bold"
          style={{ color: badgeColor ?? '#22C55E', backgroundColor: `${badgeColor ?? '#22C55E'}1A` }}
        >
          {badgeType === 'rating' ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {badge}
            </span>
          ) : badge}
        </span>
      </div>
    )
  }

  /* no badge — just show the platform icon */
  return platformImg
    ? <img src={platformImg} alt={badgeIcon} className="h-5 w-5 rounded object-contain opacity-80" />
    : null
}

/**
 * Recent Activity feed strip — two columns of activity items.
 *
 * @param {{ activities: Array, onViewAll?: () => void }} props
 */
const RecentActivity = ({ activities = [], onViewAll }) => {
  // Split into two columns: left = even indices, right = odd indices
  const left  = activities.filter((_, i) => i % 2 === 0)
  const right = activities.filter((_, i) => i % 2 !== 0)

  return (
    <section className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Recent Activity</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs text-violet-400 transition-colors hover:text-violet-300"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[left, right].map((col, colIdx) => (
          <div key={colIdx} className="space-y-2">
            {col.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-3 py-2.5 transition-colors hover:bg-white/5"
              >
                <MiniAvatar initials={item.friendInitials} color={item.friendColor} />

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">
                    {item.text}{' '}
                    <span className="text-slate-400">on {item.platform}</span>
                  </p>
                  <p className="text-xs text-slate-500">{item.timeAgo}</p>
                </div>

                {/* Badge */}
                <ActivityBadge
                  badge={item.badge}
                  badgeColor={item.badgeColor}
                  badgeIcon={item.badgeIcon}
                  badgeType={item.badgeType}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export default RecentActivity
