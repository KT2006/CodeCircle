import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import leetcodeImg from '../assets/leetcode.png'
import codeforcesImg from '../assets/codeforces.png'
import codechefImg from '../assets/codechef.png'
import atcoderImg from '../assets/atcoder.png'
import geeksforgeeksImg from '../assets/geeksforgeeks.svg'

const PLATFORMS = [
  { key: 'leetcode',      label: 'LeetCode',      icon: leetcodeImg },
  { key: 'codeforces',    label: 'Codeforces',    icon: codeforcesImg },
  { key: 'codechef',      label: 'CodeChef',      icon: codechefImg },
  { key: 'atcoder',       label: 'AtCoder',       icon: atcoderImg },
  { key: 'geeksforgeeks', label: 'GeeksForGeeks', icon: geeksforgeeksImg },
]

const PLATFORM_COLORS = {
  leetcode:      '#FFA116',
  codeforces:    '#4A90E2',
  codechef:      '#C28B5B',
  atcoder:       '#9a9488',
  geeksforgeeks: '#2F8D46',
}

const CATEGORIES = [
  { label: 'Composite Score', key: 'composite' },
  { label: 'Rating',      key: 'rate'   },
  { label: 'Problems',    key: 'prob'   },
  { label: 'Contests',    key: 'cont'   },
  { label: 'Streak',      key: 'streak' },
  { label: 'Active days', key: 'days'   },
]

const ComparePage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

  // ── State ──
  const [friends, setFriends] = useState([])
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [swapped, setSwapped] = useState(false)
  const [activeTab, setActiveTab] = useState('s') // 's': Score, 't': Topics, 'p': Plan
  const [checkedPlan, setCheckedPlan] = useState({})
  const [showExplainer, setShowExplainer] = useState(false)

  // Derive selected friend ID from searchParams or first available friend
  const selectedFriendId = searchParams.get('friend') || (friends[0]?.id ? String(friends[0].id) : '')

  // ── 1. Load Friends List on Mount ──
  useEffect(() => {
    let cancelled = false
    const loadFriends = async () => {
      setFriendsLoading(true)
      try {
        const res = await fetch('/api/compare/friends', { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) {
          setFriends(data.friends ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setFriendsLoading(false)
      }
    }
    loadFriends()
    return () => { cancelled = true }
  }, [])

  // ── 2. Load Comparison Data when selectedFriendId Changes ──
  useEffect(() => {
    if (!selectedFriendId) return
    let cancelled = false

    const fetchCompare = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/compare?friendId=${selectedFriendId}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
        if (!cancelled) {
          setCompareData(data)
          setSwapped(false)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCompare()
    return () => { cancelled = true }
  }, [selectedFriendId])

  // ── Data Transformations ──
  const rawYou = compareData?.you
  const rawFriend = compareData?.friend

  // Format You side object
  const youObj = useMemo(() => {
    if (!rawYou) return null
    const platMap = Object.fromEntries(
      (rawYou.platformSolved || []).map(p => [p.key, p.count])
    )
    return {
      n: rawYou.displayName || user?.name || 'You',
      tag: 'You',
      ini: (rawYou.displayName || user?.name || 'K')[0].toUpperCase(),
      sub: rawYou.bio || 'Active coder',
      col: 'var(--you)',
      isYou: true,
      composite: Math.round(rawYou.compositeScore ?? 0),
      rawComposite: rawYou.compositeScore ?? 0,
      connectedScore: rawYou.connectedScore ?? null,
      missingPlatforms: rawYou.missingPlatforms ?? [],
      scoreBreakdown: rawYou.scoreBreakdown ?? null,
      streak: rawYou.streak ?? 0,
      prob: rawYou.problems ?? 0,
      cont: rawYou.contests ?? 0,
      days: rawYou.activeDays ?? 0,
      rate: rawYou.cfRating ?? 0,
      plat: PLATFORMS.map(p => platMap[p.key] ?? 0),
      cm: (rawYou.contestHistory || []).map(c => c.count ?? 0),
      cmLabels: (rawYou.contestHistory || []).map(c => c.label),
    }
  }, [rawYou, user])

  // Format Friend side object
  const friendObj = useMemo(() => {
    if (!rawFriend) return null
    const platMap = Object.fromEntries(
      (rawFriend.platformSolved || []).map(p => [p.key, p.count])
    )
    return {
      n: rawFriend.displayName,
      tag: 'Friend',
      ini: (rawFriend.displayName || 'F')[0].toUpperCase(),
      sub: rawFriend.bio || 'Active coder',
      col: 'var(--foe)',
      isYou: false,
      composite: Math.round(rawFriend.compositeScore ?? 0),
      rawComposite: rawFriend.compositeScore ?? 0,
      connectedScore: rawFriend.connectedScore ?? null,
      missingPlatforms: rawFriend.missingPlatforms ?? [],
      scoreBreakdown: rawFriend.scoreBreakdown ?? null,
      streak: rawFriend.streak ?? 0,
      prob: rawFriend.problems ?? 0,
      cont: rawFriend.contests ?? 0,
      days: rawFriend.activeDays ?? 0,
      rate: rawFriend.cfRating ?? 0,
      plat: PLATFORMS.map(p => platMap[p.key] ?? 0),
      cm: (rawFriend.contestHistory || []).map(c => c.count ?? 0),
      cmLabels: (rawFriend.contestHistory || []).map(c => c.label),
    }
  }, [rawFriend])

  // Side switching (swapped)
  const leftSide = swapped ? friendObj : youObj
  const rightSide = swapped ? youObj : friendObj

  // Category comparison scores
  const scoreStats = useMemo(() => {
    if (!youObj || !friendObj) return { wa: 0, wb: 0, chips: [] }
    let wa = 0
    let wb = 0

    const chips = CATEGORIES.map(({ label, key }) => {
      const yVal = youObj[key] ?? 0
      const fVal = friendObj[key] ?? 0
      if (yVal > fVal) {
        wa++
        return { label, winner: 'You', winClass: '' }
      }
      if (fVal > yVal) {
        wb++
        return { label, winner: friendObj.n, winClass: 'f' }
      }
      return { label, winner: 'Tie', winClass: 'tie' }
    })

    return { wa, wb, chips }
  }, [youObj, friendObj])

  // Head to Head Heading & Subtitle
  const leadHeading = useMemo(() => {
    const { wa, wb } = scoreStats
    if (wa > wb) return `You lead ${wa} to ${wb}`
    if (wb > wa) return `${friendObj?.n || 'Friend'} leads ${wb} to ${wa}`
    return 'All square'
  }, [scoreStats, friendObj])

  const leadSubtitle = useMemo(() => {
    if (!youObj || !friendObj) return ''
    const probDiff = Math.abs(youObj.prob - friendObj.prob)
    const contDiff = Math.abs(youObj.cont - friendObj.cont)
    const leader = youObj.prob >= friendObj.prob ? 'You are ahead' : `${friendObj.n} is ahead`
    return `${leader} by ${probDiff} problems and ${contDiff} contests. Compare platform breakdowns, topic radar, and consistency.`
  }, [youObj, friendObj])

  // 6-Month Contest History labels & values (dynamically derived)
  const monthLabels = useMemo(() => {
    if (youObj?.cmLabels?.length >= 6) return youObj.cmLabels.slice(0, 6)
    if (friendObj?.cmLabels?.length >= 6) return friendObj.cmLabels.slice(0, 6)
    const labels = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      labels.push(d.toLocaleDateString('en-US', { month: 'short' }))
    }
    return labels
  }, [youObj, friendObj])

  const maxMonthCount = useMemo(() => {
    const all = [...(youObj?.cm || []), ...(friendObj?.cm || [])]
    return Math.max(...all, 4)
  }, [youObj, friendObj])

  // Topic radar calculations (strictly dynamic from real sync data)
  const radarTopics = useMemo(() => {
    if (compareData?.topicComparison && compareData.topicComparison.length > 0) {
      return compareData.topicComparison.slice(0, 6).map(t => ({
        name: t.name,
        you: t.you ?? 0,
        friend: t.friend ?? 0,
      }))
    }
    return []
  }, [compareData])

  const maxTopicVal = useMemo(() => {
    if (radarTopics.length === 0) return 100
    const maxVal = Math.max(...radarTopics.map(t => Math.max(t.you, t.friend)))
    return maxVal > 0 ? maxVal : 100
  }, [radarTopics])

  // Platform comparison data with connection status + scores
  const platformComparison = useMemo(() => {
    if (!compareData) return []
    const youMissing = new Set(compareData.you?.missingPlatforms || [])
    const friendMissing = new Set(compareData.friend?.missingPlatforms || [])
    const youSolved = Object.fromEntries(
      (compareData.you?.platformSolved || []).map(p => [p.key, p])
    )
    const friendSolved = Object.fromEntries(
      (compareData.friend?.platformSolved || []).map(p => [p.key, p])
    )
    return PLATFORMS.map(({ key, label, icon }) => ({
      key,
      label,
      icon,
      color: PLATFORM_COLORS[key] || '#666',
      youCount: youSolved[key]?.count ?? 0,
      friendCount: friendSolved[key]?.count ?? 0,
      youScore: compareData.you?.platformScores?.[key] ?? null,
      friendScore: compareData.friend?.platformScores?.[key] ?? null,
      youConnected: !youMissing.has(key),
      friendConnected: !friendMissing.has(key),
    }))
  }, [compareData])

  // SVG Radar coordinates generator
  const radarData = useMemo(() => {
    if (radarTopics.length === 0) return { rings: [], youPoints: '', friendPoints: '', labels: [] }
    const cx = 150
    const cy = 130
    const R = 84
    const n = radarTopics.length
    const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2
    const point = (i, k) => `${cx + Math.cos(angle(i)) * R * k},${cy + Math.sin(angle(i)) * R * k}`

    const rings = [0.33, 0.66, 1].map(f => {
      return radarTopics.map((_, i) => point(i, f)).join(' ')
    })

    const youPoints = radarTopics.map((t, i) => point(i, Math.min(1, Math.max(0.08, t.you / maxTopicVal)))).join(' ')
    const friendPoints = radarTopics.map((t, i) => point(i, Math.min(1, Math.max(0.08, t.friend / maxTopicVal)))).join(' ')

    const labels = radarTopics.map((t, i) => ({
      name: t.name,
      x: cx + Math.cos(angle(i)) * (R + 24),
      y: cy + Math.sin(angle(i)) * (R + 18) + 4,
    }))

    return { rings, youPoints, friendPoints, labels }
  }, [radarTopics, maxTopicVal])

  // Key Insights list (from backend or dynamically derived)
  const insightsList = useMemo(() => {
    if (compareData?.insights && compareData.insights.length > 0) {
      return compareData.insights.map(item => ({
        id: item.id || item.title,
        title: item.title,
        sub: item.detail || item.sub || '',
        isYou: item.isYou ?? (item.type === 'ahead'),
      }))
    }
    if (!youObj || !friendObj) return []
    const items = []
    const pDiff = youObj.prob - friendObj.prob
    if (pDiff >= 0) {
      items.push({
        id: 'p1',
        title: `You've solved ${pDiff} more problems`,
        sub: `Leading with ${youObj.prob} total problems solved across platforms.`,
        isYou: true,
      })
    } else {
      items.push({
        id: 'p1',
        title: `${friendObj.n} has solved ${Math.abs(pDiff)} more problems`,
        sub: `Bridge the ${Math.abs(pDiff)} problem difference with regular solving.`,
        isYou: false,
      })
    }

    const sDiff = youObj.streak - friendObj.streak
    if (sDiff >= 0) {
      items.push({
        id: 's1',
        title: `Your streak is ${sDiff} days longer`,
        sub: `${youObj.streak}-day streak is active and solid.`,
        isYou: true,
      })
    } else {
      items.push({
        id: 's1',
        title: `${friendObj.n}'s streak is ${Math.abs(sDiff)} days longer`,
        sub: `Solve 1 problem today to build your streak.`,
        isYou: false,
      })
    }
    return items
  }, [compareData, youObj, friendObj])

  // Plan items (from backend or dynamically derived)
  const planItems = useMemo(() => {
    if (compareData?.plan && compareData.plan.length > 0) {
      return compareData.plan.map(p => {
        if (typeof p === 'string') return p
        return p.title ? `${p.title}${p.detail ? ` — ${p.detail}` : ''}` : p.detail
      })
    }
    const plans = []
    if (radarTopics.length > 0) {
      radarTopics.forEach(t => {
        if (t.friend > t.you && plans.length < 3) {
          plans.push(`Target ${t.name}: solve ~5 problems to bridge the gap with ${friendObj?.n}`)
        }
      })
    }
    if (youObj && friendObj && friendObj.prob > youObj.prob) {
      plans.push(`Target ~${Math.max(1, Math.ceil((friendObj.prob - youObj.prob) / 60))} problems/day to catch up in 2 months`)
    }
    if (youObj?.streak === 0) {
      plans.push('Solve at least 1 problem today to start an active streak')
    } else {
      plans.push(`Keep your active ${youObj?.streak}-day streak alive today`)
    }
    return plans
  }, [compareData, radarTopics, youObj, friendObj])

  const togglePlanCheck = (idx) => {
    setCheckedPlan(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="cc-compare">
      {/* ── Error Banner ── */}
      {error && (
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
          {error}
        </div>
      )}

      {/* ── Loading Skeleton / State ── */}
      {(loading || (friendsLoading && !compareData)) && (
        <section className="c" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span className="m">Loading comparison…</span>
        </section>
      )}

      {/* ── Empty State: No Friends ── */}
      {!loading && !friendsLoading && friends.length === 0 && (
        <section className="c" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2>No friends in your circle yet</h2>
          <p className="m" style={{ margin: '8px 0 20px' }}>
            Add friends to compare stats, head-to-head categories, topic mastery, and contest records.
          </p>
          <button
            type="button"
            className="p"
            onClick={() => navigate('/friends')}
          >
            Go to Friends
          </button>
        </section>
      )}

      {/* ── Loaded Content ── */}
      {!loading && youObj && friendObj && (
        <>
          {/* ── Hero Section (Head to head) ── */}
          <section className="c">
            <div className="cc-compare-hero-header">
              <span className="m">Head to head</span>
              {/* Friend Selector Dropdown */}
              <div className="cc-comp-against-wrap">
                <span className="m cc-comp-against-label">Comparing against:</span>
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSearchParams({ friend: e.target.value })}
                  className="cc-sort-select"
                  aria-label="Select friend to compare"
                >
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>{f.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            <h1>{leadHeading}</h1>
            <p className="m" style={{ margin: 0 }}>
              {leadSubtitle}
            </p>

            {/* Chips */}
            <div className="chips">
              {scoreStats.chips.map(c => (
                <span key={c.label} className={`chip ${c.winClass}`}>
                  {c.label} · {c.winner}
                </span>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSwapped(s => !s)}
              >
                Swap sides
              </button>
              <button
                type="button"
                onClick={() => setShowExplainer(s => !s)}
                style={{
                  background: showExplainer ? 'rgba(198, 244, 50, 0.12)' : undefined,
                  borderColor: showExplainer ? 'var(--you)' : undefined,
                  color: showExplainer ? 'var(--you)' : undefined,
                }}
              >
                {showExplainer ? 'Hide calculation details ▴' : 'How is composite score calculated? ⓘ'}
              </button>
            </div>

            {/* Formula Explainer Banner */}
            {showExplainer && (
              <div className="cc-formula-banner" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className="chip" style={{ fontSize: 12, padding: '3px 10px', background: 'var(--you)', color: 'var(--on)' }}>
                    Scoring Guide
                  </span>
                  <h3 className="brg" style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    How CodeCircle Calculates Composite Scores
                  </h3>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--mute)', lineHeight: 1.6 }}>
                  CodeCircle standardizes programming activity into a single 0–100 composite score across 5 platforms: LeetCode, Codeforces, CodeChef, AtCoder, and GeeksForGeeks. This normalizes varying rating ladders so you can compare multi-platform coders fairly.
                </p>
                <div className="cc-formula-grid">
                  <div className="cc-formula-card">
                    <div className="cc-formula-card-badge">
                      <span className="cc-formula-card-num">1</span>
                      <span>Platform Skill Score (0–100)</span>
                    </div>
                    <p className="cc-formula-card-desc">
                      Solved problems are weighted by difficulty across 12 algorithmic patterns. A diminishing returns curve rewards consistent breadth and problem difficulty rather than sheer problem count spam.
                    </p>
                    <span className="cc-formula-tag">Difficulty-weighted · Pattern mastery</span>
                  </div>

                  <div className="cc-formula-card">
                    <div className="cc-formula-card-badge">
                      <span className="cc-formula-card-num">2</span>
                      <span>Contest Performance (Optional)</span>
                    </div>
                    <p className="cc-formula-card-desc">
                      Official contest ratings (e.g. Codeforces, LeetCode) are scaled to a 0–100 benchmark. When available, each platform blends 70% problem solving skill and 30% contest rating.
                    </p>
                    <span className="cc-formula-tag">70% Skill + 30% Rating blend</span>
                  </div>

                  <div className="cc-formula-card">
                    <div className="cc-formula-card-badge">
                      <span className="cc-formula-card-num">3</span>
                      <span>Balanced Platform Weighting</span>
                    </div>
                    <p className="cc-formula-card-desc">
                      Each platform contributes an equal 20% weight toward your composite score (max 100). Unconnected platforms contribute 0 pts to reward multi-platform versatility.
                    </p>
                    <span className="cc-formula-tag">20% weight per platform · Max 20 pts each</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── VS Row (pa VS pb) ── */}
          <section className="vs">
            {/* Left Card */}
            <div className="c">
              <div className="pl">
                <div
                  className="av"
                  style={{
                    background: leftSide.col,
                    color: leftSide.isYou ? 'var(--on)' : '#fff',
                  }}
                >
                  {leftSide.ini}
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div className="n" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leftSide.n} <span className="m" style={{ fontSize: 13, fontWeight: 400 }}>{leftSide.tag}</span>
                  </div>
                  <div className="m" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leftSide.sub}
                  </div>
                </div>
              </div>

              <div className="mini">
                <div>
                  <b className="mono">{leftSide.streak}</b>
                  <small>day streak</small>
                </div>
                <div>
                  <b className="mono">{leftSide.prob}</b>
                  <small>problems</small>
                </div>
                <div>
                  <b className="mono">{leftSide.cont}</b>
                  <small>contests</small>
                </div>
                <div>
                  <b className="mono">{leftSide.days}</b>
                  <small>active days</small>
                </div>
              </div>
            </div>

            {/* VS Badge */}
            <div className="vsb m mono" style={{ fontWeight: 700 }}>
              VS
            </div>

            {/* Right Card */}
            <div className="c r">
              <div className="pl r">
                <div
                  className="av"
                  style={{
                    background: rightSide.col,
                    color: rightSide.isYou ? 'var(--on)' : '#fff',
                  }}
                >
                  {rightSide.ini}
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div className="n" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rightSide.n} <span className="m" style={{ fontSize: 13, fontWeight: 400 }}>{rightSide.tag}</span>
                  </div>
                  <div className="m" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rightSide.sub}
                  </div>
                </div>
              </div>

              <div className="mini" style={{ justifyContent: 'flex-end' }}>
                <div>
                  <b className="mono">{rightSide.streak}</b>
                  <small>day streak</small>
                </div>
                <div>
                  <b className="mono">{rightSide.prob}</b>
                  <small>problems</small>
                </div>
                <div>
                  <b className="mono">{rightSide.cont}</b>
                  <small>contests</small>
                </div>
                <div>
                  <b className="mono">{rightSide.days}</b>
                  <small>active days</small>
                </div>
              </div>
            </div>
          </section>

          {/* ── Tabs (Score, Topics, Plan) ── */}
          <div className="tabs">
            <button
              type="button"
              className={activeTab === 's' ? 'on' : ''}
              onClick={() => setActiveTab('s')}
            >
              Score
            </button>
            <button
              type="button"
              className={activeTab === 't' ? 'on' : ''}
              onClick={() => setActiveTab('t')}
            >
              Topics
            </button>
            <button
              type="button"
              className={activeTab === 'p' ? 'on' : ''}
              onClick={() => setActiveTab('p')}
            >
              Plan
            </button>
          </div>

          {/* ── TAB 1: SCORE ── */}
          {activeTab === 's' && (
            <>
              <div className="g">
              {/* Left Column: Category by category */}
              <div className="c">
                <div className="hd">
                  <h2>Category by category</h2>
                  <span className="m" style={{ fontSize: 13 }}>Brighter bar wins</span>
                </div>

                <div>
                  {CATEGORIES.map(({ label, key }) => {
                    const lVal = leftSide[key] ?? 0
                    const rVal = rightSide[key] ?? 0
                    const maxVal = Math.max(lVal, rVal, 1)
                    const leftPct = Math.round((lVal / maxVal) * 100)
                    const rightPct = Math.round((rVal / maxVal) * 100)
                    const leftWins = lVal > rVal
                    const rightWins = rVal > lVal

                    return (
                      <div className="mr" key={key}>
                        {/* Left Side */}
                        <div
                          className={`side l ${leftWins ? 'win' : ''}`}
                          style={{ '--col': leftSide.col }}
                        >
                          <b className="mono">{lVal || '—'}</b>
                          <div className="t">
                            <span style={{ width: `${leftPct}%` }} />
                          </div>
                        </div>

                        {/* Center Label */}
                        <div className="lab">{label}</div>

                        {/* Right Side */}
                        <div
                          className={`side ${rightWins ? 'win' : ''}`}
                          style={{ '--col': rightSide.col }}
                        >
                          <b className="mono">{rVal || '—'}</b>
                          <div className="t">
                            <span style={{ width: `${rightPct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Platform breakdown & 6-month contests */}
              <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                {/* Problems by platform */}
                <div className="c">
                  <div className="hd">
                    <h2>Problems by platform</h2>
                  </div>

                  <div>
                    {PLATFORMS.map(({ label }, idx) => {
                      const lVal = leftSide.plat[idx] ?? 0
                      const rVal = rightSide.plat[idx] ?? 0
                      const maxVal = Math.max(lVal, rVal, 1)
                      const leftPct = Math.round((lVal / maxVal) * 100)
                      const rightPct = Math.round((rVal / maxVal) * 100)
                      const leftWins = lVal > rVal
                      const rightWins = rVal > lVal

                      return (
                        <div className="mr" key={label}>
                          <div
                            className={`side l ${leftWins ? 'win' : ''}`}
                            style={{ '--col': leftSide.col }}
                          >
                            <b className="mono">{lVal || '—'}</b>
                            <div className="t">
                              <span style={{ width: `${leftPct}%` }} />
                            </div>
                          </div>

                          <div className="lab">{label}</div>

                          <div
                            className={`side ${rightWins ? 'win' : ''}`}
                            style={{ '--col': rightSide.col }}
                          >
                            <b className="mono">{rVal || '—'}</b>
                            <div className="t">
                              <span style={{ width: `${rightPct}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Contests, last 6 months */}
                <div className="c">
                  <div className="hd">
                    <h2>Contests, last 6 months</h2>
                    <span className="m" style={{ fontSize: 13 }}>
                      {leftSide.n} {leftSide.cont} · {rightSide.n} {rightSide.cont}
                    </span>
                  </div>

                  {/* 6 Month Columns */}
                  <div className="cols">
                    {monthLabels.map((m, i) => {
                      const lCount = leftSide.cm[i] ?? 0
                      const rCount = rightSide.cm[i] ?? 0
                      const lHeight = Math.max(4, Math.round((lCount / maxMonthCount) * 100))
                      const rHeight = Math.max(4, Math.round((rCount / maxMonthCount) * 100))

                      return (
                        <div key={m}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 3,
                              alignItems: 'flex-end',
                              height: 68,
                              width: '100%',
                              justifyContent: 'center',
                            }}
                          >
                            <span
                              style={{
                                width: '38%',
                                minHeight: 3,
                                background: leftSide.col,
                                height: `${lHeight}%`,
                              }}
                            />
                            <span
                              style={{
                                width: '38%',
                                minHeight: 3,
                                background: rightSide.col,
                                height: `${rHeight}%`,
                              }}
                            />
                          </div>
                          {m}
                        </div>
                      )
                    })}
                  </div>

                  <div className="gap">
                    <b>
                      {Math.abs(leftSide.cont - rightSide.cont)} {leftSide.cont >= rightSide.cont ? 'more contests' : 'fewer contests'}
                    </b>{' '}
                    than {rightSide.n}. Consistency in weekend contests keeps you sharp.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Platform Breakdown & Coverage ── */}
            <div className="c" style={{ marginTop: 12 }}>
              <div className="hd">
                <div>
                  <h2>Platform Breakdown & Coverage</h2>
                  <span className="m" style={{ fontSize: 15, marginTop: 4, display: 'inline-block' }}>
                    Direct side-by-side comparison across all 5 platforms. Unconnected platforms contribute 0 to the composite score.
                  </span>
                </div>
              </div>

              <div className="cc-platform-matrix">
                {platformComparison.map((p) => {
                  const leftConnected = swapped ? p.friendConnected : p.youConnected
                  const rightConnected = swapped ? p.youConnected : p.friendConnected
                  const leftCount = swapped ? p.friendCount : p.youCount
                  const rightCount = swapped ? p.youCount : p.friendCount
                  const leftScore = swapped ? p.friendScore : p.youScore
                  const rightScore = swapped ? p.youScore : p.friendScore
                  const lScoreVal = leftScore ?? 0
                  const rScoreVal = rightScore ?? 0
                  const leftWins = lScoreVal > rScoreVal
                  const rightWins = rScoreVal > lScoreVal
                  const isTie = lScoreVal === rScoreVal && (leftConnected || rightConnected) && lScoreVal > 0

                  return (
                    <div className="cc-platform-card" key={p.key}>
                      <div className="cc-platform-card-header">
                        <div className="cc-comp-platform-title">
                          <div className="cc-comp-platform-icon-wrap">
                            <img src={p.icon} alt={p.label} />
                          </div>
                          <div>
                            <span className="cc-comp-platform-name">{p.label}</span>
                            <span className="m" style={{ fontSize: 14, marginLeft: 8 }}>
                              20% composite weight
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {leftWins && (
                            <span className="chip" style={{ fontSize: 13, padding: '4px 12px' }}>
                              {leftSide.isYou ? 'You lead' : `${leftSide.n} leads`}
                            </span>
                          )}
                          {rightWins && (
                            <span className="chip f" style={{ fontSize: 13, padding: '4px 12px' }}>
                              {rightSide.isYou ? 'You lead' : `${rightSide.n} leads`}
                            </span>
                          )}
                          {isTie && (
                            <span className="chip tie" style={{ fontSize: 13, padding: '4px 12px' }}>
                              Tied
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="cc-score-row-duo">
                        {/* Left Side */}
                        <div className="cc-score-subcol">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="brg" style={{ fontSize: 18, fontWeight: 700, color: leftSide.col }}>
                              {leftSide.n}
                            </span>
                            <span className={`cc-status-pill ${leftConnected ? 'connected' : 'missing'}`}>
                              {leftConnected ? 'Connected' : 'Not connected'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Problems solved</span>
                            <b className="mono" style={{ fontSize: 20 }}>{leftCount}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Platform score</span>
                            <b className="mono" style={{ fontSize: 22, color: leftConnected ? leftSide.col : 'var(--mute)' }}>
                              {leftScore !== null ? Math.round(leftScore) : 0} <small className="m" style={{ fontSize: 14 }}>/ 100</small>
                            </b>
                          </div>
                          <div className="cc-platform-score-bar-track">
                            <div
                              className="cc-platform-score-bar-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, leftScore !== null ? Math.round(leftScore) : 0))}%`,
                                background: leftConnected ? leftSide.col : 'transparent',
                              }}
                            />
                          </div>
                        </div>

                        {/* Right Side */}
                        <div className="cc-score-subcol">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="brg" style={{ fontSize: 18, fontWeight: 700, color: rightSide.col }}>
                              {rightSide.n}
                            </span>
                            <span className={`cc-status-pill ${rightConnected ? 'connected' : 'missing'}`}>
                              {rightConnected ? 'Connected' : 'Not connected'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Problems solved</span>
                            <b className="mono" style={{ fontSize: 20 }}>{rightCount}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Platform score</span>
                            <b className="mono" style={{ fontSize: 22, color: rightConnected ? rightSide.col : 'var(--mute)' }}>
                              {rightScore !== null ? Math.round(rightScore) : 0} <small className="m" style={{ fontSize: 14 }}>/ 100</small>
                            </b>
                          </div>
                          <div className="cc-platform-score-bar-track">
                            <div
                              className="cc-platform-score-bar-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, rightScore !== null ? Math.round(rightScore) : 0))}%`,
                                background: rightConnected ? rightSide.col : 'transparent',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Detailed Composite Score Breakdown ── */}
            <div className="c" style={{ marginTop: 12 }}>
              <div className="hd">
                <div>
                  <h2>Detailed Composite Score Breakdown</h2>
                  <span className="m" style={{ fontSize: 15, marginTop: 4, display: 'inline-block' }}>
                    Transparent breakdown of platform scores, contest blending, and contribution to composite score
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="cc-score-summary-grid">
                {/* Left Side Summary */}
                <div className="cc-score-summary-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b className="brg" style={{ color: leftSide.col, fontSize: 19 }}>{leftSide.n}</b>
                    <span className="chip" style={{ fontSize: 13, padding: '3px 10px', background: 'rgba(255,255,255,0.06)', color: 'var(--mute)', border: '1px solid var(--line)' }}>
                      {leftSide.scoreBreakdown?.connectedCount ?? 0} of 5 connected
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                    <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Composite Score</span>
                    <b className="mono" style={{ fontSize: 32, color: leftSide.col, letterSpacing: '-.03em' }}>
                      {leftSide.composite}
                      <small className="m" style={{ fontSize: 16, fontWeight: 400 }}> / 100</small>
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, marginTop: 4 }}>
                    <span className="m">Pure Connected Score:</span>
                    <b className="mono" style={{ fontSize: 18 }}>
                      {leftSide.connectedScore !== null ? Math.round(leftSide.connectedScore) : leftSide.composite} / 100
                    </b>
                  </div>
                  {leftSide.missingPlatforms?.length > 0 && (
                    <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>{leftSide.missingPlatforms.length} unconnected platform(s) contribute 0 pts</span>
                    </div>
                  )}
                </div>

                {/* Right Side Summary */}
                <div className="cc-score-summary-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b className="brg" style={{ color: rightSide.col, fontSize: 19 }}>{rightSide.n}</b>
                    <span className="chip" style={{ fontSize: 13, padding: '3px 10px', background: 'rgba(255,255,255,0.06)', color: 'var(--mute)', border: '1px solid var(--line)' }}>
                      {rightSide.scoreBreakdown?.connectedCount ?? 0} of 5 connected
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                    <span className="m" style={{ fontSize: 15, fontWeight: 500 }}>Composite Score</span>
                    <b className="mono" style={{ fontSize: 32, color: rightSide.col, letterSpacing: '-.03em' }}>
                      {rightSide.composite}
                      <small className="m" style={{ fontSize: 16, fontWeight: 400 }}> / 100</small>
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, marginTop: 4 }}>
                    <span className="m">Pure Connected Score:</span>
                    <b className="mono" style={{ fontSize: 18 }}>
                      {rightSide.connectedScore !== null ? Math.round(rightSide.connectedScore) : rightSide.composite} / 100
                    </b>
                  </div>
                  {rightSide.missingPlatforms?.length > 0 && (
                    <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>{rightSide.missingPlatforms.length} unconnected platform(s) contribute 0 pts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Platform Contribution Breakdown List */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PLATFORMS.map(({ key, label, icon }) => {
                  const leftPlat = leftSide.scoreBreakdown?.platforms?.find(p => p.key === key)
                  const rightPlat = rightSide.scoreBreakdown?.platforms?.find(p => p.key === key)
                  const leftContribution = leftPlat?.connected && leftPlat?.platformScore !== null
                    ? (leftPlat.platformScore * 0.20).toFixed(1)
                    : '0.0'
                  const rightContribution = rightPlat?.connected && rightPlat?.platformScore !== null
                    ? (rightPlat.platformScore * 0.20).toFixed(1)
                    : '0.0'

                  return (
                    <div className="cc-breakdown-row" key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                          <div className="cc-comp-platform-icon-wrap" style={{ width: 34, height: 34 }}>
                            <img src={icon} alt={label} style={{ width: 20, height: 20 }} />
                          </div>
                          <span className="brg" style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                            {label}
                          </span>
                        </div>
                        <span className="chip" style={{ fontSize: 13, padding: '4px 12px', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text)', border: '1px solid var(--line)' }}>
                          20% weight · max 20.0 pts
                        </span>
                      </div>

                      <div className="cc-score-row-duo">
                        {/* Left Side Platform Detail */}
                        <div className="cc-score-subcol">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="brg" style={{ fontSize: 17, fontWeight: 700, color: leftSide.col }}>{leftSide.n}</span>
                            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: leftPlat?.connected ? leftSide.col : 'var(--mute)' }}>
                              +{leftContribution} pts
                            </span>
                          </div>
                          <div style={{ fontSize: 15, color: leftPlat?.connected ? 'var(--text)' : 'var(--mute)', lineHeight: 1.5 }}>
                            {leftPlat?.calculationText || (leftPlat?.connected ? `${Math.round(leftPlat.platformScore)} platform pts` : 'Not connected (0 pts)')}
                          </div>
                          {leftPlat?.topTopics && leftPlat.topTopics.length > 0 && (
                            <div className="cc-topic-pill-list">
                              {leftPlat.topTopics.slice(0, 3).map(t => (
                                <span className="cc-topic-pill" key={t.tag}>
                                  {t.tag}: <b style={{ color: leftSide.col }}>{Math.round(t.mastery)}%</b>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right Side Platform Detail */}
                        <div className="cc-score-subcol">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="brg" style={{ fontSize: 17, fontWeight: 700, color: rightSide.col }}>{rightSide.n}</span>
                            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: rightPlat?.connected ? rightSide.col : 'var(--mute)' }}>
                              +{rightContribution} pts
                            </span>
                          </div>
                          <div style={{ fontSize: 15, color: rightPlat?.connected ? 'var(--text)' : 'var(--mute)', lineHeight: 1.5 }}>
                            {rightPlat?.calculationText || (rightPlat?.connected ? `${Math.round(rightPlat.platformScore)} platform pts` : 'Not connected (0 pts)')}
                          </div>
                          {rightPlat?.topTopics && rightPlat.topTopics.length > 0 && (
                            <div className="cc-topic-pill-list">
                              {rightPlat.topTopics.slice(0, 3).map(t => (
                                <span className="cc-topic-pill" key={t.tag}>
                                  {t.tag}: <b style={{ color: rightSide.col }}>{Math.round(t.mastery)}%</b>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── TAB 2: TOPICS ── */}
        {activeTab === 't' && (
          radarTopics.length === 0 ? (
            <div className="c" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <h3 style={{ marginBottom: 8, fontSize: 18 }}>No common topic data yet</h3>
              <p className="m" style={{ maxWidth: 460, margin: '0 auto 16px', fontSize: 14 }}>
                Topic radar requires tagged problem data from platforms that classify problems by topics (such as Codeforces, LeetCode, and GeeksForGeeks).
              </p>
              <div className="m" style={{ fontSize: 13 }}>
                Connect your accounts and sync problem history to view topic radar comparisons.
              </div>
            </div>
          ) : (
            <div className="g g-even">
              {/* Left Column: Topic Radar SVG */}
              <div className="c">
                <div className="hd">
                  <h2>Topic radar</h2>
                </div>

                <svg
                  viewBox="0 0 300 260"
                  style={{ margin: 'auto', display: 'block', maxWidth: 420, width: '100%' }}
                >
                  {/* Concentric rings */}
                  {radarData.rings.map((pts, i) => (
                    <polygon
                      key={i}
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth="1"
                      points={pts}
                    />
                  ))}

                  {/* Left Side polygon */}
                  <polygon
                    fill={leftSide.col}
                    fillOpacity="0.22"
                    stroke={leftSide.col}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={swapped ? radarData.friendPoints : radarData.youPoints}
                  />

                  {/* Right Side polygon */}
                  <polygon
                    fill={rightSide.col}
                    fillOpacity="0.22"
                    stroke={rightSide.col}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={swapped ? radarData.youPoints : radarData.friendPoints}
                  />

                  {/* Axis labels */}
                  {radarData.labels.map(l => (
                    <text
                      key={l.name}
                      x={l.x}
                      y={l.y}
                      textAnchor="middle"
                      fontSize="12"
                      fill="var(--mute)"
                    >
                      {l.name}
                    </text>
                  ))}
                </svg>
              </div>

              {/* Right Column: Topic Winners */}
              <div className="c">
                <div className="hd">
                  <h2>Winners</h2>
                </div>

                <div>
                  {radarTopics.map(t => {
                    const lVal = swapped ? t.friend : t.you
                    const rVal = swapped ? t.you : t.friend
                    const leftWins = lVal >= rVal

                    return (
                      <div
                        className="mr"
                        key={t.name}
                        style={{ gridTemplateColumns: '1fr auto', padding: '12px 0' }}
                      >
                        <span style={{ fontSize: 14 }}>
                          {t.name}
                          {leftWins && <span className="crown">♛</span>}
                        </span>
                        <span className="mono">
                          <b style={{ fontSize: 20, color: leftWins ? leftSide.col : 'var(--mute)' }}>
                            {lVal}
                          </b>
                          <span className="m" style={{ margin: '0 6px' }}>·</span>
                          <b style={{ fontSize: 20, color: !leftWins ? rightSide.col : 'var(--mute)' }}>
                            {rVal}
                          </b>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        )}

          {/* ── TAB 3: PLAN ── */}
          {activeTab === 'p' && (
            <div className="g g-even">
              {/* Left Column: Key Insights */}
              <div className="c">
                <div className="hd">
                  <h2>Key insights</h2>
                </div>

                <div>
                  {insightsList.map(item => (
                    <div className="step" key={item.id}>
                      <span>
                        <b style={{ color: item.isYou ? 'var(--you)' : 'var(--foe)' }}>
                          {item.title}
                        </b>
                        <br />
                        <span className="m" style={{ fontSize: 13 }}>
                          {item.sub}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Plan to close the gaps */}
              <div className="c" style={{ alignSelf: 'start' }}>
                <div className="hd">
                  <h2>Plan to close the gaps</h2>
                </div>

                <div>
                  {planItems.map((task, idx) => (
                    <label className="step" key={idx} style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(checkedPlan[idx])}
                        onChange={() => togglePlanCheck(idx)}
                      />
                      <span style={{ fontSize: 14 }}>{task}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ComparePage
