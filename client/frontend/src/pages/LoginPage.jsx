import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getReturnTo } from '../auth/returnTo'
import codecircleEmblem from '../assets/codecircle_emblem.jpg'

const LoginPage = () => {
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const googleButtonRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { googleClientId, error, isLoading, isWakingUp, setError, signInWithGoogle } = useAuth()

  useEffect(() => {
    if (!googleClientId || isLoading) return undefined

    let cancelled = false
    const initializeGoogleSignIn = () => {
      if (cancelled || !window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError('Google sign-in did not return a credential. Please try again.')
            return
          }
          try {
            await signInWithGoogle(credential)
            navigate(getReturnTo(location), { replace: true })
          } catch (signInError) {
            setError(signInError instanceof Error ? signInError.message : 'Google sign-in failed.')
          }
        },
      })
      if (!googleButtonRef.current) return
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      })
      setIsGoogleReady(true)
    }

    const script = document.getElementById('google-identity-services')
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn()
    } else if (script) {
      script.addEventListener('load', initializeGoogleSignIn)
    } else {
      const googleScript = document.createElement('script')
      googleScript.id = 'google-identity-services'
      googleScript.src = 'https://accounts.google.com/gsi/client'
      googleScript.async = true
      googleScript.defer = true
      googleScript.addEventListener('load', initializeGoogleSignIn)
      googleScript.addEventListener('error', () => {
        if (!cancelled) setError('Google sign-in could not be loaded. Check your connection and try again.')
      }, { once: true })
      document.head.appendChild(googleScript)
    }

    return () => {
      cancelled = true
      script?.removeEventListener('load', initializeGoogleSignIn)
    }
  }, [googleClientId, isLoading, location, navigate, setError, signInWithGoogle])

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '32px 16px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Top Header: Logo with neon green background & C + Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--you)',
            color: 'var(--on)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 26,
            fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif",
            letterSpacing: '-.03em',
            boxShadow: '0 0 24px rgba(198, 244, 50, 0.28)',
            flexShrink: 0,
          }}
        >
          C
        </div>
        <h1
          style={{
            fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif",
            fontSize: 'clamp(32px, 5.5vw, 54px)',
            fontWeight: 800,
            letterSpacing: '-.035em',
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1,
          }}
        >
          CodeCircle
        </h1>
      </div>

      {/* Center Image + Written Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 10,
          marginBottom: 20,
          width: '100%',
          maxWidth: 560,
        }}
      >
        <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 16px', position: 'relative' }}>
          {/* Subtle neon lime glow backdrop */}
          <div
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(198, 244, 50, 0.28) 0%, rgba(198, 244, 50, 0.08) 45%, transparent 70%)',
              filter: 'blur(28px)',
              pointerEvents: 'none',
            }}
          />
          <img
            src={codecircleEmblem}
            alt="CodeCircle"
            style={{
              width: 'min(70vw, 240px)',
              height: 'min(70vw, 240px)',
              borderRadius: 36,
              objectFit: 'cover',
              position: 'relative',
              boxShadow: '0 20px 48px -10px rgba(0,0,0,0.8), 0 0 32px rgba(198, 244, 50, 0.2)',
              border: '1px solid rgba(198, 244, 50, 0.22)',
            }}
          />
        </div>

        <h2
          style={{
            fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif",
            fontSize: 'clamp(22px, 3.8vw, 36px)',
            fontWeight: 400,
            letterSpacing: '-.03em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Welcome to <span style={{ fontWeight: 800 }}>CodeCircle</span>
        </h2>

        <div
          style={{
            fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif",
            fontSize: 'clamp(18px, 3vw, 28px)',
            fontWeight: 700,
            letterSpacing: '-.025em',
            color: 'var(--text)',
            display: 'flex',
            gap: '6px 10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span>Track Progress.</span> <span>Compare.</span> <span>Improve.</span>
        </div>

        <p
          style={{
            fontSize: 'clamp(17px, 2.4vw, 22px)',
            color: 'var(--mute)',
            margin: 0,
          }}
        >
          All in <span style={{ fontWeight: 800, color: 'var(--text)' }}>ONE</span> Circle.
        </p>
      </div>

      {/* Bottom Auth Section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          width: '100%',
          maxWidth: 360,
        }}
      >
        {isLoading || isWakingUp ? (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--mute)', margin: 0 }}>
            {isWakingUp ? '⏳ Server is starting up, please wait…' : 'Loading sign-in…'}
          </p>
        ) : googleClientId ? (
          <div style={{ display: 'flex', minHeight: 44, width: '100%', justifyContent: 'center' }}>
            {!isGoogleReady && <span className="sr-only">Loading Google sign-in…</span>}
            <div ref={googleButtonRef} />
          </div>
        ) : (
          <p style={{ textAlign: 'center', fontSize: 14, color: '#f59e0b', margin: 0 }}>
            Google sign-in is not configured.
          </p>
        )}

        {error && (
          <p role="alert" style={{ textAlign: 'center', fontSize: 14, color: 'var(--hot)', margin: 0 }}>
            {error}
          </p>
        )}

        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--mute)',
            lineHeight: 1.5,
            margin: 0,
            padding: '0 8px',
          }}
        >
          By continuing, you agree to our terms of service and privacy policy
        </p>
      </div>
    </div>
  )
}

export default LoginPage
