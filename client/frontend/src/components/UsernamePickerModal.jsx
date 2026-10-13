/**
 * UsernamePickerModal.jsx
 *
 * Shown on first login when user.username is null.
 * Blocking — cannot be dismissed without choosing a valid username.
 * Debounced real-time availability check via GET /api/auth/check-username.
 */

import { useEffect, useRef, useState } from 'react'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

const V = {
  bg:   'var(--bg)',
  surf: 'var(--surf)',
  surf2:'var(--surf2)',
  line: 'var(--line)',
  text: 'var(--text)',
  mute: 'var(--mute)',
  you:  'var(--you)',
  on:   'var(--on)',
  hot:  'var(--hot)',
}

const card = {
  background: V.surf,
  border: `1px solid ${V.line}`,
  borderRadius: 20,
  padding: '28px 28px 24px',
}

const brg = { fontFamily: "'Bricolage Grotesque','DM Sans',sans-serif", letterSpacing: '-.035em' }

const btnBase = {
  fontFamily: 'inherit',
  fontSize: 15,
  cursor: 'pointer',
  border: `1px solid ${V.line}`,
  background: 'transparent',
  color: V.text,
  borderRadius: 999,
  padding: '10px 20px',
  transition: 'transform .15s',
}

const btnPrimary = {
  ...btnBase,
  background: V.you,
  borderColor: V.you,
  color: V.on,
  fontWeight: 700,
}

export default function UsernamePickerModal({ onSave }) {
  const [value,     setValue]     = useState('')
  const [status,    setStatus]    = useState('idle') // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const debounceRef = useRef(null)
  const inputRef    = useRef(null)

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleChange = (raw) => {
    // Auto-lowercase, strip illegal chars
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setValue(cleaned)
    setError('')

    if (cleaned.length < 3) {
      setStatus(cleaned.length > 0 ? 'short' : 'idle')
      clearTimeout(debounceRef.current)
      return
    }
    if (!USERNAME_RE.test(cleaned)) {
      setStatus('invalid')
      clearTimeout(debounceRef.current)
      return
    }

    setStatus('checking')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(cleaned)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        setStatus(data.available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status !== 'available' || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/auth/me/username', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to save username.')
        if (data.error?.code === 'USERNAME_TAKEN') setStatus('taken')
        return
      }
      onSave(data.user)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const statusColor =
    status === 'available' ? '#4ade80' :
    status === 'taken'     ? V.hot :
    status === 'invalid' || status === 'short' ? V.mute :
    V.mute

  const statusText =
    status === 'checking'  ? 'Checking…' :
    status === 'available' ? `✓ ${value} is available` :
    status === 'taken'     ? `✗ ${value} is already taken` :
    status === 'short'     ? 'At least 3 characters' :
    status === 'invalid'   ? 'Only a–z, 0–9, and underscores' :
    'Lowercase letters, numbers, and underscores · 3–20 chars'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)',
      padding: 16,
    }}>
      <div style={{ ...card, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.65)' }}>
        {/* Header */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: V.mute }}>Welcome to CodeCircle</span>
          <h2 style={{ ...brg, fontSize: 24, fontWeight: 800, margin: '4px 0 0' }}>
            Choose your username
          </h2>
        </div>
        <p style={{ fontSize: 14, color: V.mute, margin: '8px 0 20px', lineHeight: 1.5 }}>
          Your username is your public identity — it appears in your shareable profile link{' '}
          <span style={{ color: V.text }}>codecircle.app/u/<b>{value || 'yourname'}</b></span>.
          You can change it later.
        </p>

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: V.mute, fontSize: 15, pointerEvents: 'none', userSelect: 'none',
            }}>@</span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => handleChange(e.target.value)}
              placeholder="yourname"
              maxLength={20}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: V.surf2,
                border: `1.5px solid ${
                  status === 'available' ? '#4ade80' :
                  status === 'taken' || status === 'invalid' ? V.hot :
                  V.line
                }`,
                borderRadius: 12,
                padding: '12px 16px 12px 34px',
                fontSize: 16,
                fontFamily: "'JetBrains Mono', monospace",
                color: V.text,
                outline: 'none',
                transition: 'border-color .15s',
              }}
            />
          </div>

          {/* Status line */}
          <div style={{ fontSize: 13, color: statusColor, marginTop: 8, minHeight: 20, transition: 'color .15s' }}>
            {statusText}
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 13, color: V.hot, marginTop: 6 }}>{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status !== 'available' || saving}
            style={{
              ...btnPrimary,
              width: '100%',
              marginTop: 20,
              padding: '12px 20px',
              fontSize: 15,
              opacity: (status !== 'available' || saving) ? 0.45 : 1,
              cursor: (status !== 'available' || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Claim username'}
          </button>
        </form>
      </div>
    </div>
  )
}
