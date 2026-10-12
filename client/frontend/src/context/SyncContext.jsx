import { createContext, useContext, useState, useRef, useCallback } from 'react'

const SyncContext = createContext(null)

export const useSync = () => {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}

const PLATFORM_LABELS = {
  leetcode: 'LeetCode',
  codeforces: 'Codeforces',
  codechef: 'CodeChef',
  atcoder: 'AtCoder',
  geeksforgeeks: 'GeeksForGeeks',
}

export const SyncProvider = ({ children }) => {
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    visible: false,
    title: 'Compiling platform stats...',
    subtitle: 'Syncing Profile',
    progress: 0,
    status: 'idle', // 'idle' | 'syncing' | 'success' | 'partial' | 'error'
    errors: {},
  })

  const dismissTimerRef = useRef(null)

  const dismissToast = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    setSyncState(prev => ({ ...prev, visible: false }))
  }, [])

  const runStream = useCallback(async ({ url, body, targetName = 'Profile', onProfileUpdated, onComplete }) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)

    setSyncState({
      isSyncing: true,
      visible: true,
      title: 'Compiling platform stats...',
      subtitle: `Syncing ${targetName}`,
      progress: 8,
      status: 'syncing',
      errors: {},
    })

    const collectedErrors = {}

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.error?.message || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          let eventName = 'message'
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr)

              if (eventName === 'start') {
                const total = data.total || 1
                setSyncState(prev => ({
                  ...prev,
                  title: 'Compiling platform stats...',
                  subtitle: `Fetching ${total} platform${total > 1 ? 's' : ''}…`,
                  progress: 15,
                }))
              } else if (eventName === 'platform_success') {
                const { platform, profile, completed, total } = data
                const pct = Math.min(Math.round((completed / (total || 1)) * 95), 95)
                const platLabel = PLATFORM_LABELS[platform] || platform

                setSyncState(prev => ({
                  ...prev,
                  title: `Synced ${platLabel}`,
                  subtitle: `${completed} of ${total} platforms completed`,
                  progress: pct,
                }))

                if (onProfileUpdated) {
                  onProfileUpdated(platform, profile)
                }
              } else if (eventName === 'platform_error') {
                const { platform, error, completed, total } = data
                const pct = Math.min(Math.round((completed / (total || 1)) * 95), 95)
                const platLabel = PLATFORM_LABELS[platform] || platform
                collectedErrors[platform] = error?.message || 'Failed to fetch'

                setSyncState(prev => ({
                  ...prev,
                  title: `Failed to fetch ${platLabel}`,
                  subtitle: `${completed} of ${total} platforms finished with warning`,
                  progress: pct,
                  errors: { ...prev.errors, [platform]: error?.message },
                }))
              } else if (eventName === 'complete') {
                const { succeeded, failed } = data
                const hasFailures = failed > 0

                setSyncState(prev => ({
                  ...prev,
                  isSyncing: false,
                  progress: 100,
                  status: hasFailures ? (succeeded > 0 ? 'partial' : 'error') : 'success',
                  title: hasFailures
                    ? (succeeded > 0 ? 'Sync completed with warnings' : 'Failed to compile stats')
                    : 'Platform stats updated',
                  subtitle: hasFailures
                    ? `${succeeded} succeeded · ${failed} failed (${Object.keys(collectedErrors).map(p => PLATFORM_LABELS[p] || p).join(', ')})`
                    : 'All platforms synced successfully',
                  errors: { ...prev.errors, ...collectedErrors },
                }))

                if (onComplete) {
                  onComplete(data)
                }

                // Auto dismiss after 4 seconds if successful, or 6 seconds if warnings
                dismissTimerRef.current = setTimeout(() => {
                  setSyncState(prev => ({ ...prev, visible: false }))
                }, hasFailures ? 6000 : 3500)
              } else if (eventName === 'error') {
                throw new Error(data.message || 'Stream encountered an error')
              }
            } catch (parseErr) {
              console.error('SSE JSON parse error:', parseErr)
            }
          }
        }
      }
    } catch (err) {
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        status: 'error',
        progress: 100,
        title: 'Sync failed',
        subtitle: err.message || 'Network error occurred',
      }))
      dismissTimerRef.current = setTimeout(() => {
        setSyncState(prev => ({ ...prev, visible: false }))
      }, 5000)
    }
  }, [])

  const syncUserProfile = useCallback(({ handles, onProfileUpdated, onComplete }) => {
    return runStream({
      url: '/api/platform-profiles/fetch-stream',
      body: { handles },
      targetName: 'Profile',
      onProfileUpdated,
      onComplete,
    })
  }, [runStream])

  const syncFriendProfile = useCallback(({ friendId, displayName, handles, onProfileUpdated, onComplete }) => {
    return runStream({
      url: `/api/friends/${friendId}/sync-stream`,
      body: { displayName, handles },
      targetName: displayName || 'Friend Profile',
      onProfileUpdated,
      onComplete,
    })
  }, [runStream])

  return (
    <SyncContext.Provider value={{ syncState, syncUserProfile, syncFriendProfile, dismissToast }}>
      {children}
      {syncState.visible && <SyncToast state={syncState} onDismiss={dismissToast} />}
    </SyncContext.Provider>
  )
}

// ─── Floating Sync Toast (Matching User Design) ───────────────────────────────
const SyncToast = ({ state, onDismiss }) => {
  const { isSyncing, title, subtitle, progress, status } = state

  const isGreen = status === 'success' || status === 'syncing'
  const isRed = status === 'error'

  const barColor = isRed
    ? 'var(--hot)'
    : 'var(--you)'

  return (
    <aside
      aria-live="polite"
      role="status"
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        background: 'var(--surf)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
        minWidth: 290,
        maxWidth: 380,
        width: 'calc(100vw - 32px)',
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        backdropFilter: 'blur(16px)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px 16px', position: 'relative' }}>
        {/* Left Indicator: Animated Spinner or Finished Icon */}
        <div style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          {isSyncing ? (
            <svg
              style={{
                width: 24,
                height: 24,
                animation: 'cc-spin 0.85s linear infinite',
              }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="var(--you)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeDasharray="36 20"
              />
            </svg>
          ) : isGreen ? (
            <svg
              style={{ width: 24, height: 24, color: 'var(--you)' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          ) : (
            <svg
              style={{ width: 24, height: 24, color: isRed ? '#ff4d4d' : '#f59e0b' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        {/* Text Content */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
          <h4
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h4>
          <p
            style={{
              fontSize: 13,
              color: '#9ca3af',
              margin: '3px 0 0',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss toast"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b7280' }}
        >
          ×
        </button>
      </div>

      {/* Bottom Progress Bar (Matching CodeCircle Theme) */}
      <div
        style={{
          width: '100%',
          height: 3,
          background: 'rgba(255, 255, 255, 0.08)',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(Math.max(progress, 0), 100)}%`,
            background: barColor,
            boxShadow: isRed ? '0 0 8px rgba(255, 90, 77, 0.4)' : '0 0 8px rgba(198, 244, 50, 0.5)',
            transition: 'width 0.35s ease, background-color 0.35s ease',
          }}
        />
      </div>

      <style>{`
        @keyframes cc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  )
}
