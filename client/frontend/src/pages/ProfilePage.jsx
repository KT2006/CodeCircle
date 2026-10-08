import { useEffect, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  CodeXml,
  Flame,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import leetcode from '../assets/leetcode.png'
import codeforces from '../assets/codeforces.png'
import codechef from '../assets/codechef.png'
import atcoder from '../assets/atcoder.png'

const PLATFORM_CONFIG = [
  {
    id: 'leetcode',
    name: 'LeetCode',
    icon: leetcode,
    color: '#7C3AED',
    glow: 'shadow-[0_0_30px_rgba(124,58,237,0.18)]',
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    icon: codeforces,
    color: '#22C55E',
    glow: 'shadow-[0_0_30px_rgba(34,197,94,0.18)]',
  },
  {
    id: 'codechef',
    name: 'CodeChef',
    icon: codechef,
    color: '#FB923C',
    glow: 'shadow-[0_0_30px_rgba(251,146,60,0.18)]',
  },
  {
    id: 'atcoder',
    name: 'AtCoder',
    icon: atcoder,
    color: '#3B82F6',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.18)]',
  },
]

const DEFAULT_HANDLES = {
  leetcode: '',
  codeforces: '',
  codechef: '',
  atcoder: '',
}

const RANGE_OPTIONS = [
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
  { value: 'overall', label: 'Overall' },
]

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Math.round(value))

const formatRating = (value) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const getRelativeSyncText = (date) => {
  const elapsedMs = Date.now() - date.getTime()
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60000))

  if (elapsedMinutes < 1) {
    return 'just now'
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`
  }

  const elapsedHours = Math.round(elapsedMinutes / 60)

  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`
  }

  const elapsedDays = Math.round(elapsedHours / 24)
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`
}

const buildRatingSeries = (history, range) => {
  const cutoff = range === 'overall' ? null : new Date()
  if (cutoff) {
    cutoff.setMonth(cutoff.getMonth() - Number.parseInt(range, 10))
  }

  return history
    .filter((entry) => {
      const date = new Date(entry.date)
      return Number.isFinite(entry.rating) && (!cutoff || date >= cutoff)
    })
    .sort((left, right) => new Date(left.date) - new Date(right.date))
    .map((entry) => ({
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        ...(range === 'overall' ? { year: '2-digit' } : {}),
      }).format(new Date(entry.date)),
      rating: entry.rating,
    }))
}

const buildHeatmap = (activityByDate = {}, range = 'year') => {
  const today = new Date()
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const firstVisibleDate = new Date(endDate)
  if (range === 'year') {
    firstVisibleDate.setUTCMonth(0, 1)
  } else {
    firstVisibleDate.setUTCDate(endDate.getUTCDate() - 364)
  }

  const firstWeekStart = new Date(firstVisibleDate)
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - ((firstWeekStart.getUTCDay() + 6) % 7))

  const weeks = []
  let totalActiveDays = 0

  for (let weekIndex = 0; ; weekIndex += 1) {
    const weekStart = new Date(firstWeekStart)
    weekStart.setUTCDate(firstWeekStart.getUTCDate() + weekIndex * 7)
    if (weekStart > endDate) break

    const week = []
    let monthLabel = weekIndex === 0 ? MONTH_LABEL_FORMATTER.format(firstVisibleDate) : ''
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(weekStart)
      date.setUTCDate(weekStart.getUTCDate() + dayIndex)
      const dateKey = date.toISOString().slice(0, 10)
      const isInRange = date >= firstVisibleDate && date <= endDate
      if (date.getUTCDate() === 1 && isInRange) {
        monthLabel = MONTH_LABEL_FORMATTER.format(date)
      }
      const submissionCount = isInRange ? Number(activityByDate[dateKey] ?? 0) : 0
      const intensity =
        submissionCount === 0 ? 0 : submissionCount === 1 ? 1 : submissionCount <= 3 ? 2 : submissionCount <= 6 ? 3 : submissionCount <= 10 ? 4 : 5

      if (submissionCount > 0) totalActiveDays += 1
      week.push({ dateKey, submissionCount, intensity, isInRange })
    }
    weeks.push({
      days: week,
      monthLabel,
      monthBoundary: Boolean(monthLabel) && weekIndex > 0,
    })
  }

  return { weeks, totalActiveDays, firstVisibleDate, endDate }
}

const getCurrentStreak = (activityByDate) => {
  const today = new Date()
  const todayKey = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10)
  const yesterday = new Date(`${todayKey}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  let dateKey = activityByDate[todayKey] ? todayKey : yesterday.toISOString().slice(0, 10)
  let streak = 0

  while (activityByDate[dateKey]) {
    streak += 1
    const previousDay = new Date(`${dateKey}T00:00:00.000Z`)
    previousDay.setUTCDate(previousDay.getUTCDate() - 1)
    dateKey = previousDay.toISOString().slice(0, 10)
  }

  return streak
}

const buildProfileSnapshot = (profiles = [], heatmapRange = 'year') => {
  if (profiles.length === 0) {
    return {
      contribution: [],
      totalSolved: null,
      highestRating: null,
      maxRating: null,
      totalContests: null,
      currentStreak: null,
      globalRanking: null,
      contestGlobalRanking: null,
      rankTitle: null,
      rankPlatformName: null,
      ratingPlatformName: null,
      activityPlatformName: null,
      activityAvailable: false,
      heatmap: buildHeatmap({}, heatmapRange),
      ratingByRange: Object.fromEntries(RANGE_OPTIONS.map(({ value }) => [value, []])),
      topicStrength: [],
    }
  }

  const platformById = Object.fromEntries(PLATFORM_CONFIG.map((platform) => [platform.id, platform]))
  const platformProfiles = profiles
    .filter((profile) => Number.isFinite(profile.problemsSolved))
    .map((profile) => ({
      ...platformById[profile.platform],
      solved: profile.problemsSolved,
    }))
  const totalSolved = platformProfiles.length > 0
    ? platformProfiles.reduce((total, profile) => total + profile.solved, 0)
    : null
  const contribution = platformProfiles
    .map((profile) => ({
      ...profile,
      share: totalSolved > 0 ? (profile.solved / totalSolved) * 100 : 0,
    }))
    .sort((left, right) => right.solved - left.solved)

  const activityByDate = {}
  for (const profile of profiles) {
    for (const [date, count] of Object.entries(profile.activityByDate ?? {})) {
      activityByDate[date] = (activityByDate[date] ?? 0) + count
    }
  }

  const topicColors = ['#8B5CF6', '#22C55E', '#FB923C', '#3B82F6', '#FF5B7F']
  const topics = profiles.flatMap((profile) =>
    profile.topics.map((topic) => ({
      ...topic,
      platform: profile.platform,
      platformName: platformById[profile.platform].name,
    })),
  )
    .sort((left, right) => right.problemsSolved - left.problemsSolved)
    .slice(0, 5)
    .map((topic, index) => ({
      ...topic,
      color: topicColors[index % topicColors.length],
    }))

  const ratingProfile =
    ['codeforces', 'leetcode', 'codechef', 'atcoder']
      .map((platform) => profiles.find((profile) => profile.platform === platform))
      .find(
        (profile) => profile && (profile.rating ?? profile.contestRating) !== null &&
          (profile.rating ?? profile.contestRating) !== undefined,
      ) ?? profiles[0]
  const leetcodeProfile = profiles.find((profile) => profile.platform === 'leetcode')
  const rankProfile = profiles.find((profile) => profile.rankTitle) ?? leetcodeProfile
  const activityAvailable = profiles.some((profile) => profile.activityAvailable)
  const contestHistory = ratingProfile.contestHistory ?? []

  return {
    contribution,
    totalSolved,
    highestRating: ratingProfile.rating ?? ratingProfile.contestRating ?? null,
    maxRating: ratingProfile.maxRating ?? null,
    totalContests: profiles.reduce((total, profile) => total + profile.contestsAttended, 0),
    currentStreak: !activityAvailable
      ? null
      : profiles.length === 1
        ? profiles[0].currentStreak ?? getCurrentStreak(activityByDate)
        : getCurrentStreak(activityByDate),
    globalRanking: leetcodeProfile?.globalRanking ?? null,
    contestGlobalRanking: leetcodeProfile?.contestGlobalRanking ?? null,
    rankTitle: rankProfile?.rankTitle ?? null,
    rankPlatformName: rankProfile ? platformById[rankProfile.platform].name : null,
    ratingPlatformName: platformById[ratingProfile.platform].name,
    activityPlatformName: profiles
      .filter((profile) => profile.activityAvailable)
      .map((profile) => platformById[profile.platform].name)
      .join(' + '),
    activityAvailable,
    heatmap: buildHeatmap(activityByDate, heatmapRange),
    ratingByRange: Object.fromEntries(
      RANGE_OPTIONS.map(({ value }) => [
        value,
        buildRatingSeries(contestHistory, value),
      ]),
    ),
    topicStrength: topics,
  }
}

const SurfaceCard = ({ className = '', children }) => (
  <div
    className={`rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_50px_rgba(0,0,0,0.32)] backdrop-blur ${className}`}
  >
    {children}
  </div>
)

const StatCard = ({ icon: Icon, iconColor, iconBg, title, value, subtitle, subtitleTitle }) => (
  <SurfaceCard className="group h-full min-h-[112px] p-4 transition-transform duration-200 hover:-translate-y-0.5">
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/5"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 text-slate-300">{title}</p>
        <p className="mt-1 truncate text-2xl font-semibold leading-none text-white">{value}</p>
        {subtitle ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400" title={subtitleTitle ?? subtitle}>
          {subtitle}
        </p> : null}
      </div>
    </div>
  </SurfaceCard>
)

const PlatformField = ({ platform, value, onChange, onKeyDown }) => (
  <div className={`min-w-0 rounded-2xl border border-white/8 bg-white/4 p-3 transition-all duration-200 hover:border-white/12 ${platform.glow}`}>
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-slate-950/60"
        style={{ boxShadow: `0 0 0 1px ${platform.color}22 inset` }}
      >
        <img className="h-6 w-6 object-contain" src={platform.icon} alt={`${platform.name} logo`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">{platform.name}</p>
        <input
          value={value}
          onChange={(event) => onChange(platform.id, event.target.value)}
          onKeyDown={onKeyDown}
          title={value}
          placeholder="enter username"
          className="mt-1 block min-w-0 w-full truncate border-none bg-transparent p-0 text-sm font-medium text-white outline-none placeholder:text-slate-500"
        />
      </div>
    </div>
  </div>
)

const ContributionTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const { name, value } = payload[0].payload

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1120] px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-white">{name}</p>
      <p className="mt-1 text-slate-300">{formatNumber(value)} solved</p>
    </div>
  )
}

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1120] px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-violet-300">{formatRating(payload[0].value)}</p>
    </div>
  )
}

const HeatmapLegend = () => (
  <div className="flex items-center gap-2 text-xs text-slate-400">
    <span>Less</span>
    {[0, 1, 2, 3, 4].map((step) => (
      <span
        key={step}
        className={`h-4 w-4 rounded-[4px] ${
          step === 0
            ? 'bg-[#212A3A]'
            : step === 1
              ? 'bg-[#0D4A22]'
              : step === 2
                ? 'bg-[#147634]'
                : step === 3
                  ? 'bg-[#1FA447]'
                  : 'bg-[#3DFB6C]'
        }`}
      />
    ))}
    <span>More</span>
  </div>
)

const intensityClassName = (intensity) => {
  if (intensity === 0) {
    return 'bg-[#212A3A]'
  }

  if (intensity === 1) {
    return 'bg-[#0D4A22]'
  }

  if (intensity === 2) {
    return 'bg-[#147634]'
  }

  if (intensity === 3) {
    return 'bg-[#1FA447]'
  }

  if (intensity === 4) {
    return 'bg-[#2AD15A]'
  }

  return 'bg-[#3DFB6C] shadow-[0_0_10px_rgba(61,251,108,0.25)]'
}

const ProfilePage = () => {
  const [platformHandles, setPlatformHandles] = useState(DEFAULT_HANDLES)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedRange, setSelectedRange] = useState('6m')
  const [heatmapRange, setHeatmapRange] = useState('year')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [profiles, setProfiles] = useState({
    leetcode: null,
    codeforces: null,
    codechef: null,
    atcoder: null,
  })
  const [fetchErrors, setFetchErrors] = useState({})

  useEffect(() => {
    let cancelled = false
    const loadSavedProfiles = async () => {
      try {
        const response = await fetch('/api/profile', { credentials: 'include' })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error?.message ?? `Unable to load saved profile (HTTP ${response.status}).`)
        }
        if (cancelled) return

        const savedProfiles = result.profiles ?? {}
        setProfiles((current) => ({ ...current, ...savedProfiles }))
        setPlatformHandles((current) => Object.fromEntries(
          PLATFORM_CONFIG.map(({ id }) => [id, savedProfiles[id]?.username ?? current[id]]),
        ))
        if (Object.keys(savedProfiles).length > 0) {
          const latestSync = Object.values(savedProfiles)
            .map((profile) => new Date(profile.lastSyncedAt))
            .filter((date) => Number.isFinite(date.getTime()))
            .sort((left, right) => right - left)[0]
          if (latestSync) setLastSyncedAt(latestSync)
        }
      } catch (error) {
        if (!cancelled) {
          setFetchErrors({ profile: error instanceof Error ? error.message : 'Unable to load saved profile.' })
        }
      }
    }

    loadSavedProfiles()
    return () => {
      cancelled = true
    }
  }, [])

  const handles = Object.fromEntries(
    PLATFORM_CONFIG.map(({ id }) => [id, platformHandles[id].trim()]),
  )
  const canFetchProfiles = Object.values(handles).some(Boolean)
  const currentProfiles = PLATFORM_CONFIG
    .map(({ id }) => profiles[id])
    .filter((profile) => profile && handles[profile.platform] &&
      profile.username?.toLowerCase() === handles[profile.platform].toLowerCase())
  const currentLeetcodeProfile = currentProfiles.find((profile) => profile.platform === 'leetcode')
  const currentCodeforcesProfile = currentProfiles.find((profile) => profile.platform === 'codeforces')
  const currentCodeChefProfile = currentProfiles.find((profile) => profile.platform === 'codechef')
  const currentAtCoderProfile = currentProfiles.find((profile) => profile.platform === 'atcoder')
  const profileSnapshot = buildProfileSnapshot(currentProfiles, heatmapRange)
  const primaryProfile =
    currentCodeforcesProfile ?? currentLeetcodeProfile ?? currentCodeChefProfile ?? currentAtCoderProfile
  const avatarLetter = (primaryProfile?.username ?? 'C').charAt(0).toUpperCase()
  const selectedTrend = profileSnapshot.ratingByRange[selectedRange]

  const updateHandle = (platformId, value) => {
    setPlatformHandles((current) => ({ ...current, [platformId]: value }))
    setProfiles((current) => ({ ...current, [platformId]: null }))
    setFetchErrors((current) => ({ ...current, [platformId]: '' }))
    setLastSyncedAt(null)
  }

  const refreshSnapshot = async () => {
    if (!canFetchProfiles || isRefreshing) {
      return
    }

    setIsRefreshing(true)
    const requests = Object.entries(handles).filter(([, handle]) => Boolean(handle))
    try {
      const response = await fetch('/api/platform-profiles/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handles: {
            ...Object.fromEntries(requests),
          },
        }),
      })
      const responseBody = await response.text()
      let result
      try {
        result = responseBody ? JSON.parse(responseBody) : null
      } catch {
        throw new Error(
          `Platform API returned a non-JSON response (HTTP ${response.status}). Check that the backend is running.`,
        )
      }
      if (!result) {
        throw new Error(`Platform API returned an empty response (HTTP ${response.status}).`)
      }

      const fetchedProfiles = result.profiles ?? {}
      const errors = Object.fromEntries(
        Object.entries(result.errors ?? {}).map(([platform, error]) => [
          platform,
          error.message ?? 'Unable to fetch profile',
        ]),
      )
      if (!response.ok && Object.keys(errors).length === 0) {
        throw new Error(result.error?.message ?? `Unable to fetch platform profiles (HTTP ${response.status})`)
      }
      if (response.ok && Object.keys(fetchedProfiles).length === 0 && Object.keys(errors).length === 0) {
        throw new Error('Platform API returned no profiles or errors.')
      }

      setProfiles((current) => ({ ...current, ...fetchedProfiles }))
      setFetchErrors(errors)
      if (Object.keys(fetchedProfiles).length > 0) {
        setLastSyncedAt(new Date())
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch platform profiles'
      setFetchErrors(Object.fromEntries(requests.map(([platform]) => [platform, message])))
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleInputKeyDown = async (event) => {
    if (event.key === 'Enter') {
      await refreshSnapshot()
    }
  }

  return (
    <div className="min-w-0 space-y-5">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)_minmax(0,1.15fr)]">
              <div className="flex min-w-0 items-start gap-4 rounded-[24px]">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#8B5CF6,#5B21B6_78%)] text-3xl font-semibold shadow-[0_0_60px_rgba(124,58,237,0.34)] sm:h-20 sm:w-20 sm:text-4xl">
                    {avatarLetter}
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div>
                      <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                        {primaryProfile?.username ?? 'Your Profile'}
                      </h1>
                      <p className="mt-2 max-w-[420px] text-sm leading-6 text-slate-300 sm:text-base">
                        {primaryProfile
                          ? `${profileSnapshot.ratingPlatformName} profile`
                          : 'Enter a platform username to load your stats.'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-base text-slate-200">
                        <span>{profileSnapshot.ratingPlatformName ?? 'Contest'} Rating</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-4xl font-semibold leading-none text-violet-400 sm:text-5xl">
                          {profileSnapshot.highestRating == null
                            ? '—'
                            : formatRating(profileSnapshot.highestRating)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {profileSnapshot.ratingPlatformName === 'Codeforces' && currentCodeforcesProfile?.rankTitle
                          ? `${currentCodeforcesProfile.rankTitle}${currentCodeforcesProfile.maxRating ? ` · max ${formatNumber(currentCodeforcesProfile.maxRating)}` : ''}`
                          : profileSnapshot.maxRating !== null
                          ? `${profileSnapshot.rankTitle ? `${profileSnapshot.rankTitle} · ` : ''}max ${formatNumber(profileSnapshot.maxRating)}`
                          : profileSnapshot.contestGlobalRanking
                          ? `Contest rank #${formatNumber(profileSnapshot.contestGlobalRanking)}`
                          : `${profileSnapshot.ratingPlatformName ?? 'Platform'} contest rating`}
                      </p>
                    </div>
                  </div>
              </div>

              <div className="flex min-w-0 items-start gap-3 rounded-[24px] border border-white/6 bg-white/3 p-4 lg:col-start-2 2xl:col-start-auto">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-medium leading-6 text-slate-100">
                    {currentCodeforcesProfile
                      ? 'Codeforces Rank'
                      : currentLeetcodeProfile
                        ? 'LeetCode Global Ranking'
                        : `${profileSnapshot.rankPlatformName ?? 'Platform'} Rank`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {currentCodeforcesProfile?.rankTitle
                      ? `${currentCodeforcesProfile.rankTitle} · max rating ${formatNumber(currentCodeforcesProfile.maxRating ?? 0)}`
                      : profileSnapshot.globalRanking
                      ? `Global rank #${formatNumber(profileSnapshot.globalRanking)} on LeetCode.`
                      : currentCodeChefProfile?.rankTitle
                        ? `${currentCodeChefProfile.rankTitle} · CodeChef rating tier`
                        : currentAtCoderProfile?.rankTitle
                          ? `${currentAtCoderProfile.rankTitle} · AtCoder rating tier`
                          : 'Ranking will appear here when the profile data is available.'}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3 rounded-[24px] border border-white/6 bg-white/3 p-4 lg:col-span-2 2xl:col-span-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-white">Connected Handles</p>
                    <p className="mt-1 text-sm text-slate-400">Enter any platform handle, then fetch data.</p>
                  </div>
                  <button
                    onClick={refreshSnapshot}
                    disabled={!canFetchProfiles || isRefreshing}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition-all hover:border-violet-400 hover:bg-violet-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Fetching...' : 'Fetch Data'}</span>
                  </button>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  {PLATFORM_CONFIG.map((platform) => (
                    <PlatformField
                      key={platform.id}
                      platform={platform}
                      value={platformHandles[platform.id]}
                      onChange={updateHandle}
                      onKeyDown={handleInputKeyDown}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                  <span>{lastSyncedAt ? `Last fetched: ${getRelativeSyncText(lastSyncedAt)}` : 'No profile data fetched yet.'}</span>
                </div>
                {Object.entries(fetchErrors).map(([platform, message]) => (
                  <p key={platform} role="alert" className="text-sm text-rose-300">
                    {PLATFORM_CONFIG.find((item) => item.id === platform)?.name ?? platform}: {message}
                  </p>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <StatCard
              icon={CodeXml}
              iconColor="#4ADE80"
              iconBg="rgba(34,197,94,0.14)"
              title="Problems Solved"
              value={profileSnapshot.totalSolved === null ? '—' : formatNumber(profileSnapshot.totalSolved)}
              subtitle={currentProfiles.length > 0
                ? `Across ${formatNumber(currentProfiles.length)} platform${currentProfiles.length === 1 ? '' : 's'}`
                : null}
              subtitleTitle="Combined platform totals may count the same problem more than once."
            />
            <StatCard
              icon={TrendingUp}
              iconColor="#8B5CF6"
              iconBg="rgba(139,92,246,0.14)"
              title="Contest Rating"
              value={profileSnapshot.highestRating === null ? '—' : formatRating(profileSnapshot.highestRating)}
              subtitle={profileSnapshot.ratingPlatformName
                ? `${profileSnapshot.ratingPlatformName}${profileSnapshot.rankTitle ? ` · ${profileSnapshot.rankTitle}` : ''}`
                : null}
            />
            <StatCard
              icon={Calendar}
              iconColor="#FB923C"
              iconBg="rgba(251,146,60,0.14)"
              title="Contests Attended"
              value={profileSnapshot.totalContests === null ? '—' : formatNumber(profileSnapshot.totalContests)}
              subtitle={currentProfiles.length > 0
                ? `Across ${formatNumber(currentProfiles.length)} platform${currentProfiles.length === 1 ? '' : 's'}`
                : null}
            />
            <StatCard
              icon={Flame}
              iconColor="#60A5FA"
              iconBg="rgba(59,130,246,0.14)"
              title="Current Streak"
              value={profileSnapshot.currentStreak === null
                ? '—'
                : `${formatNumber(profileSnapshot.currentStreak)} days`}
            />
            <StatCard
              icon={Calendar}
              iconColor="#3B82F6"
              iconBg="rgba(59,130,246,0.14)"
              title="Active Days"
              value={
                profileSnapshot.activityAvailable
                  ? formatNumber(profileSnapshot.heatmap.totalActiveDays)
                  : '—'
              }
              subtitle={profileSnapshot.activityAvailable
                ? `${heatmapRange === 'year' ? 'Calendar year' : 'Last 365 days'} · across ${formatNumber(currentProfiles.filter((profile) => profile.activityAvailable).length)} platforms`
                : null}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] xl:items-start">
            <SurfaceCard className="p-5 lg:p-6">
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">Platform Contribution</h2>
                  <p className="mt-1 text-sm text-slate-400">Reported solved totals by connected platform</p>
                </div>

                <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1fr)] 2xl:items-center">
                  <div className="relative mx-auto h-52 w-52 max-w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={profileSnapshot.contribution}
                          dataKey="solved"
                          nameKey="name"
                          innerRadius={66}
                          outerRadius={94}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {profileSnapshot.contribution.map((platform) => (
                            <Cell key={platform.id} fill={platform.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ContributionTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-semibold text-white">
                        {profileSnapshot.totalSolved === null ? '—' : formatNumber(profileSnapshot.totalSolved)}
                      </span>
                      <span className="mt-1 text-sm text-slate-400">Total Solved</span>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    {profileSnapshot.contribution.map((platform) => (
                      <div key={platform.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(48px,0.8fr)_max-content] items-center gap-2 sm:gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: platform.color }} />
                          <span className="truncate text-base text-white">{platform.name}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#273247]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${platform.share}%`, backgroundColor: platform.color }}
                          />
                        </div>
                        <div className="whitespace-nowrap text-right text-xs text-slate-300 sm:text-sm">
                          {Math.round(platform.share)}% ({formatNumber(platform.solved)})
                        </div>
                      </div>
                    ))}

                    {profileSnapshot.contribution.length === 0 ? (
                      <p className="text-sm text-slate-400">Fetch a platform profile to show platform contribution.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5 lg:p-6">
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">Topic Strength</h2>
                  <p className="mt-1 text-sm text-slate-400">Solved problems by platform tag. Tag counts can overlap.</p>
                </div>

                <div className="space-y-4">
                  {profileSnapshot.topicStrength.map((topic) => {
                    return (
                      <div key={`${topic.platform}:${topic.slug}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5"
                            style={{ backgroundColor: `${topic.color}14`, color: topic.color }}
                          >
                            <CodeXml className="h-4 w-4" />
                          </span>
                          <span className="truncate text-base text-white">{topic.name} <span className="text-xs text-slate-400">({topic.platformName})</span></span>
                        </div>
                        <div className="whitespace-nowrap text-right text-sm font-semibold text-white">
                          {formatNumber(topic.problemsSolved)} solved
                        </div>
                      </div>
                    )
                  })}
                  {currentProfiles.length > 0 && profileSnapshot.topicStrength.length === 0 ? (
                    <p className="text-sm text-slate-400">No topic breakdown is available for these profiles.</p>
                  ) : null}
                  {currentProfiles.length === 0 ? (
                    <p className="text-sm text-slate-400">Fetch a profile to show solved counts by topic.</p>
                  ) : null}
                </div>
              </div>
            </SurfaceCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.78fr)_minmax(260px,340px)] xl:items-start">
            <SurfaceCard className="p-5 lg:p-6">
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-white">Activity Heatmap</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {profileSnapshot.activityPlatformName
                          ? `Combined daily submissions · ${profileSnapshot.activityPlatformName}`
                          : 'Combined daily submissions across platforms'}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <select
                        aria-label="Activity heatmap date range"
                        value={heatmapRange}
                        onChange={(event) => setHeatmapRange(event.target.value)}
                        className="appearance-none rounded-xl border border-white/10 bg-[#0E1527] py-2 pl-3 pr-9 text-xs font-medium text-slate-200 outline-none transition-colors hover:border-white/20 focus:border-violet-400"
                      >
                        <option value="year">Calendar year</option>
                        <option value="365">Last 365 days</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                {profileSnapshot.activityAvailable ? (
                  <>
                    <div className="overflow-x-auto pb-2">
                      <div className="w-max min-w-full">
                        <div className="mb-3 flex gap-1 text-[11px] leading-4 text-slate-500">
                          <div className="w-8 shrink-0" />
                          {profileSnapshot.heatmap.weeks.map((week, weekIndex) => (
                            <div
                              key={`month-${weekIndex}`}
                              className={`w-[11px] shrink-0 whitespace-nowrap ${week.monthBoundary ? 'ml-2' : ''}`}
                            >
                              {week.monthLabel}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-1">
                          <div className="grid w-8 shrink-0 grid-rows-[repeat(7,11px)] gap-1 text-[10px] leading-[11px] text-slate-500">
                            {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, index) => (
                              <span key={`${label}-${index}`} className="h-[11px] leading-[11px]">{label}</span>
                            ))}
                          </div>

                          <div className="flex gap-1">
                            {profileSnapshot.heatmap.weeks.map((week, weekIndex) => (
                              <div
                                key={`week-${weekIndex}`}
                                className={`grid grid-rows-[repeat(7,11px)] gap-1 ${week.monthBoundary ? 'ml-2' : ''}`}
                              >
                                {week.days.map((day) => (
                                  <div
                                    key={day.dateKey}
                                    aria-label={day.isInRange
                                      ? `${day.dateKey}: ${formatNumber(day.submissionCount)} submissions`
                                      : undefined}
                                    className={`h-[11px] w-[11px] rounded-[3px] transition-colors ${day.isInRange ? intensityClassName(day.intensity) : 'bg-transparent'}`}
                                    title={day.isInRange
                                      ? `${day.dateKey}: ${formatNumber(day.submissionCount)} submissions`
                                      : undefined}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-base font-semibold text-emerald-400 sm:text-xl">
                        Total Active Days: {formatNumber(profileSnapshot.heatmap.totalActiveDays)}
                      </p>
                      <HeatmapLegend />
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-sm text-slate-400">
                    {currentProfiles.length > 0
                      ? 'Activity data is unavailable for these profiles.'
                      : 'Fetch a profile to show activity.'}
                  </p>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5 lg:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-white">Rating Trend</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {profileSnapshot.ratingPlatformName
                        ? `${profileSnapshot.ratingPlatformName} contest rating history`
                        : 'Contest rating history'}
                    </p>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedRange}
                      onChange={(event) => setSelectedRange(event.target.value)}
                      className="appearance-none rounded-2xl border border-white/10 bg-[#0E1527] py-3 pl-4 pr-10 text-sm font-medium text-white outline-none transition-colors hover:border-white/16"
                    >
                      {RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {selectedTrend.length > 0 ? <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedTrend} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#1E293B" strokeDasharray="3 6" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        tickFormatter={formatRating}
                        domain={[(dataMin) => dataMin - 50, (dataMax) => dataMax + 50]}
                      />
                      <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#5B21B6', strokeDasharray: '4 4' }} />
                      <Area
                        type="monotone"
                        dataKey="rating"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        fill="url(#ratingGradient)"
                        dot={{ r: 4, strokeWidth: 0, fill: '#8B5CF6' }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#A78BFA' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div> : <p className="flex h-[300px] items-center justify-center text-sm text-slate-400">
                  {currentProfiles.length > 0 ? 'No contest rating history for this range.' : 'Fetch a profile to show rating history.'}
                </p>}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5 lg:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-500/12 p-2.5 text-violet-300">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-white">Profile Overview</h2>
                    <p className="mt-1 text-sm text-slate-400">Highlights from your fetched platform data</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-[15px] leading-8 text-slate-200">
                  {currentProfiles.length > 0 ? (
                    <>
                      <p>
                        {profileSnapshot.topicStrength[0]
                          ? `Your most-solved topic is ${profileSnapshot.topicStrength[0].name} (${profileSnapshot.topicStrength[0].platformName}) with ${formatNumber(profileSnapshot.topicStrength[0].problemsSolved)} solved problems.`
                          : 'No topic breakdown was provided for these profiles.'}
                      </p>
                      <p className="mt-4">
                        {formatNumber(profileSnapshot.totalContests)} contests attended
                        {profileSnapshot.currentStreak > 0
                          ? ` · ${formatNumber(profileSnapshot.currentStreak)}-day current streak`
                          : ''}
                        .
                      </p>
                      <p className="mt-4">
                        {profileSnapshot.activityAvailable
                          ? `${formatNumber(profileSnapshot.heatmap.totalActiveDays)} active days in the last 365 days.`
                          : 'Activity data is unavailable.'}
                      </p>
                    </>
                  ) : <p>Fetch a profile to see its stats here.</p>}
                </div>

              </div>
            </SurfaceCard>
          </section>
    </div>
  )
}

export default ProfilePage
