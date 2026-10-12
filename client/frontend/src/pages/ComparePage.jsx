import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const PLATFORMS = [
  { key: 'leetcode',      label: 'LeetCode'      },
  { key: 'codeforces',    label: 'Codeforces'    },
  { key: 'codechef',      label: 'CodeChef'      },
  { key: 'atcoder',       label: 'AtCoder'       },
  { key: 'geeksforgeeks', label: 'GeeksForGeeks' },
]

const CATEGORIES = [
  { label: 'Composite Score', key: 'composite' },
  { label: 'Rating',      key: 'rate'   },
  { label: 'Problems',    key: 'prob'   },
  { label: 'Contests',    key: 'cont'   },
  { label: 'Streak',      key: 'streak' },
  { label: 'Active days', key: 'days'   },
]

const DEFAULT_TOPICS = [
  { name: 'Array',       you: 180, friend: 160 },
  { name: 'String',      you: 110, friend: 125 },
  { name: 'Math',        you: 95,  friend: 75  },
  { name: 'Tree',        you: 85,  friend: 50  },
  { name: 'Dynamic Prog', you: 70, friend: 85  },
  { name: 'Graph',       you: 60,  friend: 40  },
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
  const [challengeSent, setChallengeSent] = useState(false)
  const [checkedPlan, setCheckedPlan] = useState({})

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
      setChallengeSent(false)
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
      sub: rawYou.bio || 'SRM IST · Active',
      col: 'var(--you)',
      isYou: true,
      composite: Math.round(rawYou.compositeScore ?? 0),
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
      sub: rawFriend.bio || 'Active',
      col: 'var(--foe)',
      isYou: false,
      composite: Math.round(rawFriend.compositeScore ?? 0),
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

  // 6-Month Contest History labels & values
  const monthLabels = useMemo(() => {
    if (youObj?.cmLabels?.length >= 6) return youObj.cmLabels.slice(0, 6)
    if (friendObj?.cmLabels?.length >= 6) return friendObj.cmLabels.slice(0, 6)
    return ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  }, [youObj, friendObj])

  const maxMonthCount = useMemo(() => {
    const all = [...(youObj?.cm || []), ...(friendObj?.cm || [])]
    return Math.max(...all, 4)
  }, [youObj, friendObj])

  // Topic radar calculations
  const radarTopics = useMemo(() => {
    if (compareData?.topicComparison && compareData.topicComparison.length >= 4) {
      return compareData.topicComparison.slice(0, 6).map(t => ({
        name: t.name,
        you: t.you ?? 0,
        friend: t.friend ?? 0,
      }))
    }
    return DEFAULT_TOPICS
  }, [compareData])

  const maxTopicVal = useMemo(() => {
    const maxVal = Math.max(...radarTopics.map(t => Math.max(t.you, t.friend)))
    return maxVal > 0 ? maxVal : 100
  }, [radarTopics])

  // SVG Radar coordinates generator
  const radarData = useMemo(() => {
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

  // Key Insights list
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
        sub: 'You lead in total problems solved.',
        isYou: true,
      })
    } else {
      items.push({
        id: 'p1',
        title: `${friendObj.n} has solved ${Math.abs(pDiff)} more problems`,
        sub: 'Focus on daily consistency to bridge the gap.',
        isYou: false,
      })
    }

    const sDiff = youObj.streak - friendObj.streak
    if (sDiff >= 0) {
      items.push({
        id: 's1',
        title: `Your streak is ${sDiff} days longer`,
        sub: 'Great consistency. Keep it up.',
        isYou: true,
      })
    } else {
      items.push({
        id: 's1',
        title: `${friendObj.n}'s streak is ${Math.abs(sDiff)} days longer`,
        sub: 'Solve 1 problem every day to build momentum.',
        isYou: false,
      })
    }

    // Gaps in topics
    radarTopics.forEach((t, i) => {
      const diff = t.friend - t.you
      if (diff > 10 && items.length < 5) {
        items.push({
          id: `top-${i}`,
          title: `Gap in ${t.name}`,
          sub: `${friendObj.n} has solved ${diff} more ${t.name} problems.`,
          isYou: false,
        })
      }
    })

    return items
  }, [compareData, youObj, friendObj, radarTopics])

  // Plan items
  const planItems = useMemo(() => {
    if (compareData?.plan && compareData.plan.length > 0) {
      return compareData.plan.map(p => {
        if (typeof p === 'string') return p
        return p.title ? `${p.title}${p.detail ? ` — ${p.detail}` : ''}` : p.detail
      })
    }
    const plans = []
    radarTopics.forEach(t => {
      if (t.friend > t.you && plans.length < 3) {
        plans.push(`Solve 5 ${t.name} problems this week`)
      }
    })
    plans.push('Keep the daily streak active')
    plans.push('Compete in the upcoming weekend contest')
    return plans
  }, [compareData, radarTopics])

  const togglePlanCheck = (idx) => {
    setCheckedPlan(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // Handle Challenge Button Click
  const handleChallenge = () => {
    setChallengeSent(true)
    setTimeout(() => setChallengeSent(false), 4000)
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
                className="p"
                onClick={handleChallenge}
              >
                {challengeSent ? 'Goal challenge sent! ✓' : `Challenge ${friendObj.n} to a weekly goal`}
              </button>
              <button
                type="button"
                onClick={() => setSwapped(s => !s)}
              >
                Swap sides
              </button>
            </div>
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
          )}

          {/* ── TAB 2: TOPICS ── */}
          {activeTab === 't' && (
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
