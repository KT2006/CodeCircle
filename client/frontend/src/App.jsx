import LoginPage from './pages/LoginPage'
import ComparePage from './pages/ComparePage'
import FeedPage from './pages/FeedPage'
import FriendsPage from './pages/FriendsPage'
import FriendProfilePage from './pages/FriendProfilePage'
import ProfilePage from './pages/ProfilePage'
import AppShell from './components/AppShell'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { getReturnTo } from './auth/returnTo'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SyncProvider } from './context/SyncContext'
import './App.css'

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
