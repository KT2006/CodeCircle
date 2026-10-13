/**
 * PublicProfilePage.jsx
 *
 * Publicly shareable coding portfolio at /u/:username
 * No authentication required. Uses the same components as ProfilePage
 * in read-only mode, driven by the /api/public/:username endpoint.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  V, card, brg, mono, btnBase, btnPrimary,
  PLATFORMS, RATING_PLATFORMS, RATING_KEY,
  fmt, utcToday, sumActivityDays,
  buildTopics, buildRecentContests, buildRatingSeries,
  ratingYAxis, ratingXTicks, formatRatingXTick,
  HeatmapCard, StatBox, PlatformBar,
  TopicsCard, TopicRadarCard, ContestsCard,
  SubmissionsCard, FeedCard, DistributionCard, RatingTrendSection,
} from '../components/profileComponents'

// ─── Copy link button ─────────────────────────────────────────────────────────
const CopyLinkButton = ({ username }) => {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/u/${username}`
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }
  return (
    <button type="button" onClick={copy} style={{
      ...btnBase,
      background: copied ? V.you : 'transparent',
      color: copied ? V.on : V.text,
      borderColor: copied ? V.you : V.line,
      padding: '8px 16px', fontSize: 14,
      display: 'inline-flex', alignItems: 'center', gap: 7,
    }}>
      {copied ? '✓ Copied!' : '⎘ Copy profile link'}
    </button>
  )
}

// ─── Tab bar (same style as ProfilePage) ──────────────────────────────────────
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

// ─── Public profile page ───────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { username } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [activeTab, setActiveTab] = useState('o')
  const [ratingPlat, setRatingPlat] = useState('LeetCode')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`/api/public/${encodeURIComponent(username)}`)
      .then(async res => { const j = await res.json(); if (!res.ok) throw new Error(j.error?.message ?? 'Not found.'); return j })
      .then(j => { if (!cancelled) { setData(j); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [username])

  // ── Adapt public API data shape to match what ProfilePage components expect ──
  // The public API returns: { username, displayName, platforms: [{platform, handle, problemsSolved,
  //   rating, maxRating, rankTitle, contestsAttended, solvedByDifficulty, topics, sparkline,
  //   recentContests, activityByDate?}], stats, activityByDate, topics, recentContests }

  // connectedProfiles shape expected by components
  const connectedProfiles = useMemo(() => {
    if (!data) return []
    return data.platforms.map(p => ({
      platform:           p.platform,
      username:           p.handle,
      problemsSolved:     p.problemsSolved ?? 0,
      rating:             p.rating ?? null,
      contestRating:      p.rating ?? null,
      maxRating:          p.maxRating ?? null,
      rankTitle:          p.rankTitle ?? null,
      contestsAttended:   p.contestsAttended ?? 0,
      solvedByDifficulty: p.solvedByDifficulty ?? null,
      topics:             (p.topics ?? []).map(t => ({ name: t.name, slug: t.name, problemsSolved: t.count })),
      activityByDate:     {},   // per-platform activity not needed; combinedActivity used
      contestHistory:     (p.recentContests ?? []).map(c => ({
        contestName: c.name, date: c.date, rating: c.rating, oldRating: c.oldRating, ranking: c.rank,
      })),
    }))
  }, [data])

  const combinedActivity = useMemo(() => data?.activityByDate ?? {}, [data])

  const topics         = useMemo(() => {
    // Public API provides merged topics already; adapt to { name, count, max, pct }
    if (!data?.topics?.length) return []
    const max = data.topics[0]?.count || 1
    return data.topics.map(t => ({ name: t.name, count: t.count, max, pct: Math.round((t.count / max) * 100) }))
  }, [data])

  const recentContests = useMemo(() => buildRecentContests(connectedProfiles, 20), [connectedProfiles])
  const totalSolved    = data?.stats?.totalSolved ?? null
  const totalContests  = data?.stats?.totalContests ?? null
  const currentStreak  = data?.stats?.currentStreak ?? 0
  const activeDays     = data?.stats?.activeDays ?? 0
  const last30         = useMemo(() => sumActivityDays(combinedActivity, 30), [combinedActivity])

  // Feed — recent activity across platforms
  const feed = useMemo(() => {
    const items = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(utcToday()); d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      const count = combinedActivity[key] ?? 0
      if (count > 0) {
        items.push({ text: `Solved ${count} problem${count !== 1 ? 's' : ''}`, time: i === 0 ? 'today' : i === 1 ? 'yesterday' : `${i} days ago`, color: V.you, sortKey: i })
      }
      if (items.length >= 5) break
    }
    return items
  }, [combinedActivity])

  // Rating trend
  const ratingPlatKey = RATING_KEY[ratingPlat]
  const ratingData    = useMemo(() => {
    const p = connectedProfiles.find(p => p.platform === ratingPlatKey)
    return buildRatingSeries(p?.contestHistory ?? [])
  }, [connectedProfiles, ratingPlatKey])
  const ratingVals  = ratingData.map(d => d.rating)
  const ratingAxis  = useMemo(() => ratingYAxis(ratingVals), [ratingVals])
  const ratingTicks = useMemo(() => ratingXTicks(ratingData), [ratingData])

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 16px', color: V.mute }}>Loading profile…</div>
  )

  if (error) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>🔍</div>
      <h1 style={{ ...brg, fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Profile not found</h1>
      <p style={{ color: V.mute, marginBottom: 24 }}>No CodeCircle user goes by <b>@{username}</b>.</p>
      <Link to="/" style={{ color: V.you, fontWeight: 700, textDecoration: 'none' }}>← Go to CodeCircle</Link>
    </div>
  )

  const displayName = data.displayName
  const initials    = (displayName || username).charAt(0).toUpperCase()

  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%' }}>

      {/* ── TOP: hero + handles ── */}
      <div className="cc-top-grid">

        {/* Left: hero card */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 14 }}>
          <section style={{ ...card, padding: '16px 20px' }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: V.you, color: V.on,
                display: 'grid', placeItems: 'center',
                ...brg, fontSize: 26, fontWeight: 800,
              }}>
                {initials}
              </div>
              <div>
                <h1 style={{ ...brg, fontSize: 'clamp(22px,3.5vw,42px)', lineHeight: 1, fontWeight: 800, margin: 0 }}>
                  {displayName}
                </h1>
                <div style={{ color: V.mute, fontSize: 14, marginTop: 3 }}>@{username}</div>
              </div>
            </div>

            {totalSolved != null && (
              <>
                <p style={{ ...brg, fontWeight: 700, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.2, letterSpacing: '-.03em', margin: '0 0 4px' }}>
                  <span style={mono}>{fmt(totalSolved)}</span> problems across {connectedProfiles.length} platform{connectedProfiles.length !== 1 ? 's' : ''}
                </p>
                <p style={{ color: V.mute, fontSize: 13 }}>{fmt(last30)} of those in the last 30 days.</p>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              <CopyLinkButton username={username} />
              <Link to="/" style={{ ...btnBase, textDecoration: 'none', padding: '8px 16px', fontSize: 14 }}>
                Join CodeCircle
              </Link>
            </div>
          </section>

          {/* Stats summary card — sits below hero same as ProfilePage streak card */}
          <section style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ color: V.mute, fontSize: 13 }}>Current streak</div>
                <div style={{ ...brg, fontSize: 32, lineHeight: 1, fontWeight: 800, color: V.hot, marginTop: 4 }}>
                  {currentStreak}<span style={{ fontSize: 16 }}> day{currentStreak !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div>
                <div style={{ color: V.mute, fontSize: 13 }}>Active days</div>
                <div style={{ ...mono, ...brg, fontSize: 32, lineHeight: 1, fontWeight: 800, marginTop: 4 }}>{fmt(activeDays)}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 14, background: V.surf2, fontSize: 13, color: V.mute, textAlign: 'center' }}>
              View full profile on <Link to="/" style={{ color: V.you, fontWeight: 700, textDecoration: 'none' }}>CodeCircle</Link>
            </div>
          </section>
        </div>

        {/* Right: Handles panel (read-only — no Edit button) */}
        <section style={{ ...card, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Handles</h2>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {PLATFORMS.map((cfg, idx) => {
              const p = connectedProfiles.find(cp => cp.platform === cfg.id)
              const handle = p?.username ?? ''
              const isLast = idx === PLATFORMS.length - 1
              return (
                <div key={cfg.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: isLast ? 'none' : `1px solid ${V.line}` }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: cfg.color + '22', display: 'grid', placeItems: 'center' }}>
                    <img src={cfg.img} alt={cfg.label} style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4 }} />
                  </span>
                  <span>
                    <div style={{ fontWeight: handle ? 700 : 400, lineHeight: 1.2, color: handle ? V.text : V.mute }}>{handle || 'Not connected'}</div>
                    <div style={{ fontSize: 13, color: V.mute, marginTop: 1 }}>{cfg.label}</div>
                  </span>
                  {handle
                    ? <a href={cfg.profileUrl(handle)} target="_blank" rel="noopener noreferrer" style={{ color: V.text, fontSize: 13, textUnderlineOffset: 3, textDecoration: 'underline', whiteSpace: 'nowrap' }}>View</a>
                    : <span />}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── STATS ROW ── */}
      <div className="cc-stats-grid">
        <StatBox value={totalSolved} label="Problems solved" sub={last30 > 0 ? `+${fmt(last30)} in 30 days` : undefined} />
        <StatBox value={activeDays} label="Active days" sub={currentStreak > 0 ? `${currentStreak} day streak` : undefined} />
        <StatBox value={totalContests} label="Contests attended" />
      </div>

      {/* ── PLATFORM BAR ── */}
      <PlatformBar connectedProfiles={connectedProfiles} totalSolved={totalSolved} />

      {/* ── TABS ── */}
      <Tabs active={activeTab} onChange={setActiveTab} />

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'o' && (
        <div className="cc-grid" style={{ alignItems: 'stretch' }}>
          <div className="a12">
            <HeatmapCard combinedActivity={combinedActivity} />
          </div>
          <section className="a7" style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <RatingTrendSection
              ratingData={ratingData} ratingPlat={ratingPlat} setRatingPlat={setRatingPlat}
              ratingAxis={ratingAxis} ratingTicks={ratingTicks}
            />
          </section>
          <section className="a5" style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h2 style={{ ...brg, fontSize: 18, fontWeight: 700 }}>Topic strength</h2>
            </div>
            {topics.length === 0
              ? <p style={{ fontSize: 14, color: V.mute }}>No topic data yet.</p>
              : topics.slice(0, 7).map(({ name, count, max }, idx) => {
                  const isLast = idx === Math.min(topics.length, 7) - 1
                  return (
                    <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: isLast ? 'none' : `1px solid ${V.line}` }}>
                      <div>
                        <span style={{ fontSize: 14 }}>{name}</span>
                        <div style={{ height: 7, borderRadius: 8, background: V.h0, marginTop: 6, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${Math.round((count/max)*100)}%`, background: V.you, borderRadius: 8, transition: 'width .4s' }} />
                        </div>
                      </div>
                      <b style={{ ...mono, textAlign: 'right', fontSize: 16 }}>{count}</b>
                    </div>
                  )
                })
            }
          </section>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'a' && (
        <div className="cc-grid">
          <div className="a6"><FeedCard feed={feed} /></div>
          <div className="a6"><DistributionCard connectedProfiles={connectedProfiles} /></div>
          <div className="a12"><SubmissionsCard combinedActivity={combinedActivity} /></div>
        </div>
      )}

      {/* ── CONTESTS TAB ── */}
      {activeTab === 'c' && (
        <div className="cc-grid">
          <div className="a12"><ContestsCard contests={recentContests} /></div>
        </div>
      )}

      {/* ── TOPICS TAB ── */}
      {activeTab === 't' && (
        <div className="cc-grid">
          <div className="a8"><TopicsCard topics={topics} /></div>
          <div className="a4" style={{ minWidth: 0 }}><TopicRadarCard topics={topics} /></div>
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div style={{ textAlign: 'center', padding: '12px 0 0', color: V.mute, fontSize: 14 }}>
        <Link to="/" style={{ color: V.you, fontWeight: 700, textDecoration: 'none' }}>CodeCircle</Link>
        {' · Track your coding across every platform'}
      </div>
    </div>
  )
}
