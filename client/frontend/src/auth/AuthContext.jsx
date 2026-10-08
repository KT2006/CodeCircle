import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthContext from './context'

const readJsonResponse = async (response) => {
  const body = await response.text()
  let result
  try {
    result = body ? JSON.parse(body) : null
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(result?.error?.message ?? `Request failed (HTTP ${response.status}).`)
  }
  if (!result) {
    throw new Error('The server returned an empty response.')
  }
  return result
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [googleClientId, setGoogleClientId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadAuthState = async () => {
      const [configResult, userResult] = await Promise.allSettled([
        fetch('/api/auth/config', { credentials: 'include' }).then(readJsonResponse),
        fetch('/api/auth/me', { credentials: 'include' }).then(async (response) => {
          if (response.status === 401) return null
          return readJsonResponse(response)
        }),
      ])

      if (cancelled) return
      if (configResult.status === 'fulfilled') {
        setGoogleClientId(configResult.value.googleClientId ?? '')
      } else {
        setError(configResult.reason instanceof Error
          ? configResult.reason.message
          : 'Unable to load Google sign-in configuration.')
      }
      if (userResult.status === 'fulfilled') {
        setUser(userResult.value?.user ?? null)
      } else {
        setError(userResult.reason instanceof Error
          ? userResult.reason.message
          : 'Unable to check your sign-in status.')
      }
      setIsLoading(false)
    }

    loadAuthState()
    return () => {
      cancelled = true
    }
  }, [])

  const signInWithGoogle = useCallback(async (idToken) => {
    setError('')
    const result = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }).then(readJsonResponse)
    setUser(result.user)
    return result.user
  }, [])

  const signOut = useCallback(async () => {
    setError('')
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).then(readJsonResponse)
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    googleClientId,
    isLoading,
    error,
    setError,
    signInWithGoogle,
    signOut,
  }), [user, googleClientId, isLoading, error, signInWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
