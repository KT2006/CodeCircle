import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import ComparePage from './pages/ComparePage'
import FeedPage from './pages/FeedPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'


import {BrowserRouter, Routes, Route} from 'react-router-dom'
import './App.css'

function App() {


  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LoginPage></LoginPage>} />
        <Route path='/compare' element={<ComparePage></ComparePage>} />
        <Route path='/friends' element={<FriendsPage></FriendsPage>}/>
        <Route path='/feed' element={<FeedPage></FeedPage>} />
        <Route path='/profile' element={<ProfilePage></ProfilePage>}/>
      </Routes>
    </BrowserRouter>
      
    </>
  )
}

export default App
