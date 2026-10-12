import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Profile',  href: '/profile'  },
  { label: 'Compare',  href: '/compare'  },
  { label: 'Friends',  href: '/friends'  },
]

const AppShell = () => {
  const { pathname }             = useLocation()
  const navigate                 = useNavigate()
  const { error, setError, user, signOut } = useAuth()

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cc-theme') || 'auto' } catch { return 'auto' }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.dataset.theme = 'light'
    else if (theme === 'dark') root.dataset.theme = 'dark'
    else delete root.dataset.theme
    try { localStorage.setItem('cc-theme', theme) } catch { /* noop */ }
  }, [theme])

  const toggleTheme = () => {
    const isDark = document.documentElement.dataset.theme !== 'light' &&
      !document.documentElement.dataset.theme
        ? !window.matchMedia('(prefers-color-scheme: light)').matches
        : document.documentElement.dataset.theme === 'dark'
    setTheme(isDark ? 'light' : 'dark')
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign out failed.')
    }
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      {/* ── Top nav — matches reference .top-nav exactly ── */}
      <nav aria-label="Main" className="top-nav">
        {/* Logo */}
        <Link to="/profile" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <b>C</b>
          <span>CodeCircle</span>
        </Link>

        {/* Nav pill buttons */}
        <div className="top-nav-links">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                to={href}
                aria-current={active ? 'page' : undefined}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 15,
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--text)' : 'var(--line)'}`,
                  background: active ? 'var(--text)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--text)',
                  borderRadius: 999,
                  padding: '9px 18px',
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Link>
            )
          })}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Switch light or dark theme"
            style={{
              fontFamily: 'inherit',
              fontSize: 15,
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--text)',
              borderRadius: 999,
              padding: '9px 18px',
              whiteSpace: 'nowrap',
            }}
          >
            Theme
          </button>
        </div>

        {/* Sign out button — green background with logout icon */}
        <button
          type="button"
          onClick={handleSignOut}
          title={user?.name ? `${user.name} (Sign out)` : 'Sign out'}
          aria-label="Sign out"
          className="signout-btn"
        >
          <LogOut size={16} strokeWidth={2.4} />
        </button>
      </nav>

      {error && (
        <p role="alert" style={{
          maxWidth: 1120, margin: '0 auto',
          padding: '0 16px 8px', textAlign: 'right',
          fontSize: 13, color: '#ff6b6b',
        }}>
          {error}
        </p>
      )}

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '4px 16px 60px' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
