import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthContext from './context'
import {
  cacheUser, getCachedUser, clearUserCache,
  cacheConfig, getCachedConfig, clearAllCache,
} from './authCache'

const readJsonResponse = async (response) => {
  const body = await response.text()
  let result
  try {
    result = body ? JSON.parse(body) : null
  } catch {
    // Non-JSON body — Render/Vercel gateway error page
    if (response.status === 502 || response.status === 503) {
      throw new Error('__GATEWAY__')
    }
    throw new Error(`Unexpected response from server (HTTP ${response.status}). Try again.`)
  }
  if (!response.ok) {
    const msg = result?.error?.message ?? `Request failed (HTTP ${response.status}).`
    const rid = result?.error?.requestId
    const err = new Error(msg)
    err.requestId = rid ?? null
    err.status = response.status
    err.code = result?.error?.code ?? null
    throw err
  }
  if (!result) throw new Error('The server returned an empty response.')
  return result
}

/** Fetch with automatic retry on 502/503 (Render cold-start) */
const fetchWithRetry = async (url, options = {}, { maxAttempts = 3, delayMs = 3000 } = {}) => {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res
    try {
      res = await fetch(url, options)
    } catch {
      lastErr = Object.assign(new Error('Could not reach the server. Check your connection.'), { isNetwork: true })
      if (attempt < maxAttempts) { await new Promise(r => setTimeout(r, delayMs)); continue }
      throw lastErr
    }
    if ((res.status === 502 || res.status === 503) && attempt < maxAttempts) {
      lastErr = Object.assign(new Error('__GATEWAY__'), { status: res.status })
      await new Promise(r => setTimeout(r, delayMs))
      continue
    }
    return res
  }
  throw Object.assign(new Error('__GATEWAY__'), { status: lastErr?.status ?? 502 })
}

/** Turn a raw error into a user-facing message string */
const friendlyMessage = (err) => {
  if (!err) return 'Something went wrong.'
  if (err.message === '__GATEWAY__') {
    return 'Server is starting up — please wait a moment and try again.'
  }
  if (err.isNetwork) return 'Could not reach the server. Check your connection.'
  if (err.requestId) {
    return `${err.message} (ref: ${err.requestId.slice(0, 8)})`
  }
  return err.message ?? 'Something went wrong.'
}

export const AuthProvider = ({ children }) => {
  const [user,           setUser]           = useState(() => getCachedUser()?.user ?? null)
  const [googleClientId, setGoogleClientId] = useState(() => getCachedConfig() ?? '')
  const [isLoading,      setIsLoading]      = useState(() => {
    // If we have both cached values, skip the loading spinner entirely
    const hasUser   = Boolean(getCachedUser())
    const hasConfig = Boolean(getCachedConfig())
    return !(hasUser && hasConfig)
  })
  const [isWakingUp,     setIsWakingUp]     = useState(false)
  const [error,          setError]          = useState('')

  useEffect(() => {
    let cancelled = false

    // These are still needed for the background validate below
    const cachedConfig = getCachedConfig()
    const cachedAuth   = getCachedUser()

    // ── Step 2: validate in background (always, even if cache hit) ──
    const validate = async () => {
      const [configResult, userResult] = await Promise.allSettled([
        // Only fetch config if not already cached — it never changes
        cachedConfig
          ? Promise.resolve({ googleClientId: cachedConfig })
          : fetchWithRetry('/api/auth/config', { credentials: 'include' })
              .then(res => {
                if (res.status === 502 || res.status === 503) {
                  if (!cancelled) setIsWakingUp(true)
                }
                return readJsonResponse(res)
              }),
        fetchWithRetry('/api/auth/me', { credentials: 'include' })
          .then(async (res) => {
            if (res.status === 401) return null
            return readJsonResponse(res)
          }),
      ])

      if (cancelled) return
      setIsWakingUp(false)

      // Config result
      if (configResult.status === 'fulfilled') {
        const id = configResult.value.googleClientId ?? ''
        setGoogleClientId(id)
        if (id) cacheConfig(id)
      } else if (!cachedConfig) {
        // Only show error if we had no cached fallback
        setError(friendlyMessage(configResult.reason))
      }

      // User result
      if (userResult.status === 'fulfilled') {
        const freshUser = userResult.value?.user ?? null
        setUser(freshUser)
        if (freshUser) {
          cacheUser(freshUser)
        } else {
          // Server says not logged in — clear any stale cache
          clearUserCache()
        }
      } else {
        const err = userResult.reason
        if (err?.status === 401 || err?.code === 'UNAUTHENTICATED') {
          // JWT expired or revoked — clear cache and force re-login
          clearUserCache()
          setUser(null)
        } else if (!cachedAuth) {
          // Only show error if we had no cached fallback to show
          setError(friendlyMessage(err))
        }
        // If we had a cache hit and the network failed (502, offline),
        // silently keep showing the cached user — don't error the UI
      }

      // If we didn't unblock loading above (no cache), do it now
      setIsLoading(false)
    }

    validate()
    return () => { cancelled = true }
  }, [])

  const signInWithGoogle = useCallback(async (idToken) => {
    setError('')
    try {
      const res = await fetchWithRetry('/api/auth/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      const result = await readJsonResponse(res)
      setUser(result.user)
      cacheUser(result.user)   // cache immediately after sign-in
      return result.user
    } catch (err) {
      const msg = friendlyMessage(err)
      setError(msg)
      throw Object.assign(new Error(msg), { cause: err })
    }
  }, [])

  const signOut = useCallback(async () => {
    setError('')
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(readJsonResponse)
    } catch {
      // Even if the server call fails, clear local state
    }
    clearAllCache()
    setUser(null)
    setGoogleClientId('')
  }, [])

  const value = useMemo(() => ({
    user,
    googleClientId,
    isLoading,
    isWakingUp,
    error,
    setError,
    signInWithGoogle,
    signOut,
  }), [user, googleClientId, isLoading, isWakingUp, error, signInWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
