import LoginPage from './pages/LoginPage'
import ComparePage from './pages/ComparePage'
import FeedPage from './pages/FeedPage'
import FriendsPage from './pages/FriendsPage'
import FriendProfilePage from './pages/FriendProfilePage'
import ProfilePage from './pages/ProfilePage'
import PublicProfilePage from './pages/PublicProfilePage'
import AppShell from './components/AppShell'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { getReturnTo } from './auth/returnTo'
import { BrowserRouter, Navigate, Route, Routes, useLocation, Link } from 'react-router-dom'
import { SyncProvider } from './context/SyncContext'
import './App.css'

// Minimal nav shell for public (unauthenticated) pages
const PublicShell = ({ children }) => {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <nav aria-label="Main" className="top-nav">
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit', marginRight: 'auto' }}>
          <b>C</b>
          <span>CodeCircle</span>
        </Link>
        <Link to="/" style={{ fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--you)', color: 'var(--on)', borderRadius: 999, padding: '9px 18px', textDecoration: 'none', fontWeight: 700 }}>
          Sign in
        </Link>
      </nav>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '4px 16px 60px' }}>
        {children}
      </main>
    </div>
  )
}

const AuthenticatedApp = () => {
  const { isLoading, user } = useAuth()
  const location = useLocation()
  const loadingPage = (
    <main className="flex min-h-dvh items-center justify-center bg-[#050816] text-sm text-slate-300">
      Checking your session…
    </main>
  )

  return (
    <Routes>
      <Route path="/" element={isLoading ? loadingPage : user ? <Navigate to={getReturnTo(location)} replace /> : <LoginPage />} />
      {/* Public profile — no auth required, wrapped in minimal nav shell */}
      <Route path="/u/:username" element={<PublicShell><PublicProfilePage /></PublicShell>} />
      <Route element={isLoading ? loadingPage : user ? <AppShell /> : <Navigate to="/" state={{ from: location }} replace />}>
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/friends/:id" element={<FriendProfilePage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={isLoading ? loadingPage : <Navigate to={user ? '/profile' : '/'} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SyncProvider>
          <AuthenticatedApp />
        </SyncProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
