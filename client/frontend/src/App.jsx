import LoginPage from './pages/LoginPage'
import ComparePage from './pages/ComparePage'
import FeedPage from './pages/FeedPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'
import AppShell from './components/AppShell'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
