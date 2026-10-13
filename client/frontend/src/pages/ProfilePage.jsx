import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useSync } from '../context/SyncContext'
import {
  V, card, brg, mono, btnBase, btnPrimary,
  PLATFORMS, RATING_PLATFORMS, RATING_KEY, UP_NEXT,
  fmt, utcToday, getRelativeTime,
  getCurrentStreak, countActiveDays, sumActivityDays,
  buildTopics, buildRecentContests, buildFeed, buildRatingSeries,
  ratingYAxis, ratingXTicks,
  HeatmapCard, StatBox, PlatformBar,
  TopicsCard, TopicRadarCard, ContestsCard,
  SubmissionsCard, FeedCard, DistributionCard, RatingTrendSection,
  Ring, EditHandlesModal, HandlesPanel,
} from '../components/profileComponents'

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const Tabs = ({ active, onChange }) => {
  const tabs = [['o','Overview'],['a','Activity'],['c','Contests'],['t','Topics']]
  return (
    <div className="cc-tabs">
      {tabs.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)}
          className={`cc-tab-btn ${active === key ? 'active' : ''}`}
          style={{ ...btnBase, whiteSpace: 'nowrap', flexShrink: 0, ...(active === key ? { background: V.text, color: V.bg, borderColor: V.text } : {}) }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const navigate = useNavigate()
  const { user }  = useAuth()
  const { syncUserProfile, syncState } = useSync()

  const [profiles, setProfiles] = useState({ leetcode: null, codeforces: null, codechef: null, atcoder: null, geeksforgeeks: null })
  const [lastSyncedAt,  setLastSyncedAt]  = useState(null)
  const [fetchError,    setFetchError]    = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSaving,      setIsSaving]      = useState(false)
  const [saveError,     setSaveError]     = useState(null)
  const [activeTab,     setActiveTab]     = useState('o')
  const [ratingPlat,    setRatingPlat]    = useState('LeetCode')
  const [topicMode,     setTopicMode]     = useState('p')
  const [copiedLink,    setCopiedLink]    = useState(false)

  const [goalCount] = useState(() => { try { const g = +localStorage.getItem('cc-goal'); return g >= 1 && g <= 99 ? g : 3 } catch { return 3 } })
  const [goalUntil] = useState(() => { try { const u = localStorage.getItem('cc-until'); return /^\d{4}-\d{2}$/.test(u ?? '') ? u : '2027-03' } catch { return '2027-03' } })
  const [solved, setSolved] = useState(0)

  // ── Load ──
  useEffect(() => {
    let cancelled = false
    fetch('/api/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const saved = data.profiles ?? {}
        setProfiles(curr => ({ ...curr, ...saved }))
        const latestSync = Object.values(saved).map(p => new Date(p.lastSyncedAt)).filter(d => Number.isFinite(d.getTime())).sort((a,b) => b-a)[0]
        if (latestSync) setLastSyncedAt(latestSync)
      })
      .catch(err => { if (!cancelled) setFetchError(err.message) })
    return () => { cancelled = true }
  }, [])

  // ── Refresh ──
  const handleRefresh = () => {
    const connected = Object.entries(profiles).filter(([,p]) => p?.username).map(([plat,p]) => [plat, p.username])
    if (!connected.length || syncState.isSyncing) return
    setFetchError(null)
    syncUserProfile({
      handles: Object.fromEntries(connected),
      onProfileUpdated: (platform, profile) => { setProfiles(curr => ({ ...curr, [platform]: profile })); setLastSyncedAt(new Date()) },
      onComplete: summary => { if (summary.failed > 0 && summary.succeeded === 0) setFetchError('Failed to refresh platform profiles') },
    })
  }

  // ── Save handles ──
  const handleSaveHandles = (newHandles) => {
    const toFetch = Object.fromEntries(Object.entries(newHandles).filter(([,v]) => v.trim()))
    if (!Object.keys(toFetch).length) { setShowEditModal(false); return }
    setIsSaving(true); setSaveError(null)
    setProfiles(Object.fromEntries(PLATFORMS.map(p => [p.id, newHandles[p.id]?.trim() ? profiles[p.id] : null])))
    setShowEditModal(false); setIsSaving(false)
    syncUserProfile({
      handles: toFetch,
      onProfileUpdated: (platform, profile) => { setProfiles(curr => ({ ...curr, [platform]: profile })); setLastSyncedAt(new Date()) },
      onComplete: summary => { if (summary.failed > 0 && summary.succeeded === 0) setFetchError('Could not fetch any platform profiles. Check the handles and try again.') },
    })
  }

  // ── Derived ──
  const connectedProfiles = useMemo(() => Object.entries(profiles).filter(([,p]) => p).map(([platform,p]) => ({ ...p, platform })), [profiles])
  const hasData = connectedProfiles.length > 0
  const displayName   = user?.username ?? user?.name?.split(' ')[0] ?? connectedProfiles[0]?.username ?? 'You'
  const totalSolved   = hasData ? connectedProfiles.reduce((s,p) => s + (p.problemsSolved ?? 0), 0) : null
  const totalContests = hasData ? connectedProfiles.reduce((s,p) => s + (p.contestsAttended ?? 0), 0) : null

  const combinedActivity = useMemo(() => {
    const map = {}
    for (const p of connectedProfiles) for (const [day,count] of Object.entries(p.activityByDate ?? {})) map[day] = (map[day] ?? 0) + count
    return map
  }, [connectedProfiles])

  const currentStreak = useMemo(() => {
    const actStreak    = getCurrentStreak(combinedActivity)
    const directStreak = connectedProfiles.reduce((best,p) => { const s = p.currentStreak ?? p.streak ?? 0; return s > best ? s : best }, 0)
    return Math.max(actStreak, directStreak)
  }, [combinedActivity, connectedProfiles])

  const totalActiveDays = useMemo(() => countActiveDays(combinedActivity), [combinedActivity])
  const last30          = useMemo(() => sumActivityDays(combinedActivity, 30), [combinedActivity])
  const topics          = useMemo(() => buildTopics(connectedProfiles), [connectedProfiles])
  const recentContests  = useMemo(() => buildRecentContests(connectedProfiles, 20), [connectedProfiles])
  const feed            = useMemo(() => buildFeed(connectedProfiles, 5), [connectedProfiles])

  const ratingPlatKey = RATING_KEY[ratingPlat]
  const ratingData    = useMemo(() => buildRatingSeries(profiles[ratingPlatKey]?.contestHistory ?? []), [profiles, ratingPlatKey])
  const ratingVals    = ratingData.map(d => d.rating)
  const ratingAxis    = useMemo(() => ratingYAxis(ratingVals), [ratingVals])
  const ratingTicks   = useMemo(() => ratingXTicks(ratingData), [ratingData])

  const syncLabel = getRelativeTime(lastSyncedAt)

  // Goal helpers
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtUntil = () => { const [y,m] = goalUntil.split('-'); return `${MN[+m-1]} ${y}` }
  const daysLeft = () => { const [y,m] = goalUntil.split('-'); const end = new Date(+y,+m,0); end.setHours(0,0,0,0); const now = new Date(); now.setHours(0,0,0,0); return Math.round((end-now)/864e5) }
  const dl        = daysLeft()
  const goalExpired = dl < 0
  const goalDone    = solved >= goalCount
  const goalCopy    = goalExpired ? `Ended ${fmtUntil()}. Pick a new month.` : goalDone ? `Goal reached · ${dl} day${dl===1?'':'s'} left.` : `${solved} of ${goalCount} done · ${dl} day${dl===1?'':'s'} left.`
  const ringPct     = goalCount > 0 ? solved / goalCount : 0

  const copyShareLink = () => {
    if (!user?.username) return
    navigator.clipboard.writeText(`${window.location.origin}/u/${user.username}`).then(() => {
      setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2200)
    })
  }

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%' }}>

      {showEditModal && (
        <EditHandlesModal profiles={profiles} onClose={() => { setShowEditModal(false); setSaveError(null) }}
          onSave={handleSaveHandles} isSaving={isSaving} saveError={saveError} />
      )}

      {/* ── TOP ── */}
      <div className="cc-top-grid">

        {/* Left: hero + streak/goal */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 14 }}>

          {/* Hero */}
          <section style={{ ...card, padding: '16px 20px' }}>
            <span style={{ color: V.mute, fontSize: 13 }}>{greeting}</span>
            <h1 style={{ ...brg, fontSize: 'clamp(28px,3.8vw,48px)', lineHeight: 1, fontWeight: 800, margin: '4px 0 10px' }}>{displayName}</h1>
            {totalSolved != null && (
              <>
                <p style={{ ...brg, fontWeight: 700, fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.2, letterSpacing: '-.03em', margin: '0 0 4px' }}>
                  <span style={mono}>{fmt(totalSolved)}</span> problems across {connectedProfiles.length} platform{connectedProfiles.length !== 1 ? 's' : ''}
                </p>
                <p style={{ color: V.mute, fontSize: 13 }}>{fmt(last30)} of those in the last 30 days.</p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              <button type="button" onClick={handleRefresh} disabled={!hasData || syncState.isSyncing}
                style={{ ...btnPrimary, padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: (!hasData || syncState.isSyncing) ? 0.6 : 1 }}>
                <svg style={{ width: 14, height: 14, animation: syncState.isSyncing ? 'cc-spin 0.85s linear infinite' : 'none' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
                </svg>
                {syncState.isSyncing ? 'Syncing…' : 'Refresh data'}
              </button>
              <button type="button" onClick={() => navigate('/compare')} style={{ ...btnBase, padding: '8px 18px' }}>
                Compare with a friend
              </button>
              {user?.username && (
                <button type="button" onClick={copyShareLink}
                  style={{ ...btnBase, padding: '8px 16px', fontSize: 14, background: copiedLink ? V.you : 'transparent', color: copiedLink ? V.on : V.text, borderColor: copiedLink ? V.you : V.line }}>
                  {copiedLink ? '✓ Copied!' : '⎘ Share profile'}
                </button>
              )}
              {syncLabel && <span style={{ color: V.mute, fontSize: 12 }}>Synced {syncLabel}</span>}
              {!hasData && <span style={{ color: V.mute, fontSize: 12 }}>Add your handles to get started</span>}
            </div>
            {fetchError && <p role="alert" style={{ marginTop: 8, fontSize: 12, color: V.hot }}>{fetchError}</p>}
          </section>

          {/* Streak + Goal */}
          <section style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: V.mute, fontSize: 13 }}>Current streak</div>
                <div style={{ ...brg, fontSize: 36, lineHeight: 1, fontWeight: 800, color: V.hot, marginTop: 2 }}>
                  {currentStreak}<span style={{ fontSize: 18 }}> day{currentStreak !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <Ring pct={ringPct} />
            </div>
            <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 6px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Today's goal</span>
                <span style={{ ...mono, ...brg, fontSize: 18, fontWeight: 800, letterSpacing: '-.04em' }}>{goalCount}</span>
                <span style={{ color: V.mute, fontSize: 13 }}>{goalCount === 1 ? 'problem' : 'problems'}</span>
              </div>
              <div style={{ color: V.mute, fontSize: 13 }}>until <strong style={{ color: V.text }}>{fmtUntil()}</strong></div>
              <div style={{ color: V.mute, fontSize: 12 }}>{goalCopy}</div>
            </div>
            <button type="button" disabled={goalExpired || goalDone}
              onClick={() => { if (goalExpired || goalDone) return; setSolved(s => s+1) }}
              style={{ ...btnPrimary, width: '100%', marginTop: 10, padding: '10px 18px', fontSize: 14, opacity: (goalExpired || goalDone) ? 0.5 : 1 }}>
              {goalExpired ? 'Window ended' : goalDone ? 'Done for today ✓' : 'Log a solve'}
            </button>
          </section>
        </div>

        {/* Right: Handles */}
        <div style={{ alignSelf: 'stretch' }}>
          <HandlesPanel profiles={profiles} onEdit={() => { setSaveError(null); setShowEditModal(true) }} />
        </div>
      </div>

      {/* ── STATS ── */}
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
          <div className="a12"><HeatmapCard combinedActivity={combinedActivity} /></div>

          <section className="a7" style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <RatingTrendSection ratingData={ratingData} ratingPlat={ratingPlat} setRatingPlat={setRatingPlat} ratingAxis={ratingAxis} ratingTicks={ratingTicks} />
          </section>

          <section className="a5" style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Topic strength</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['p','Problems'],['a','Accuracy']].map(([m,lbl]) => (
                  <button key={m} type="button" onClick={() => setTopicMode(m)}
                    style={{ ...btnBase, padding: '4px 11px', fontSize: 12, ...(topicMode === m ? { background: V.text, color: V.bg, borderColor: V.text } : {}) }}>{lbl}</button>
                ))}
              </div>
            </div>
            {topics.length === 0 ? <p style={{ fontSize: 14, color: V.mute }}>No topic data available yet.</p>
              : topics.slice(0, 7).map(({ name, count, pct, max }, idx) => {
                  const isLast = idx === Math.min(topics.length,7)-1
                  const displayVal = topicMode === 'a' ? pct : count
                  const barW = topicMode === 'a' ? pct : Math.round((count/max)*100)
                  return (
                    <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: isLast ? 'none' : `1px solid ${V.line}` }}>
                      <div>
                        <span style={{ fontSize: 14 }}>{name}</span>
                        <div style={{ height: 7, borderRadius: 8, background: V.h0, marginTop: 6, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${barW}%`, background: V.you, borderRadius: 8, transition: 'width .4s' }} />
                        </div>
                      </div>
                      <b style={{ ...mono, textAlign: 'right', fontSize: 16 }}>{displayVal}{topicMode === 'a' ? '%' : ''}</b>
                    </div>
                  )
                })
            }
          </section>
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === 'a' && (
        <div className="cc-grid">
          <div className="a6"><FeedCard feed={feed} /></div>
          <div className="a6"><DistributionCard connectedProfiles={connectedProfiles} /></div>
          <div className="a12"><SubmissionsCard combinedActivity={combinedActivity} /></div>
        </div>
      )}

      {/* ── CONTESTS ── */}
      {activeTab === 'c' && (
        <div className="cc-grid">
          <div className="a12"><ContestsCard contests={recentContests} /></div>
        </div>
      )}

      {/* ── TOPICS ── */}
      {activeTab === 't' && (
        <div className="cc-grid">
          <div className="a8"><TopicsCard topics={topics} /></div>
          <div className="a4" style={{ minWidth: 0 }}><TopicRadarCard topics={topics} /></div>
          <section className="a12" style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Up next for you</h2>
              <span style={{ color: V.mute, fontSize: 14 }}>Picked from weaker topics</span>
            </div>
            <div className="cc-next-grid">
              {UP_NEXT.map(p => (
                <div key={p.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 16, background: V.surf2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {p.title}
                    {p.tags.map(tag => <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, border: `1px solid ${V.line}`, color: V.mute, marginLeft: 6 }}>{tag}</span>)}
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
