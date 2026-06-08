import React from 'react'
import logo from '../assets/logo.png'
import { Link } from 'react-router-dom'
import { LogOut, Sun } from 'lucide-react'
const NavBar = () => {
  return (
   <>
    <div className="hero flex items-center bg-black text-white justify-between px-20 sticky top-0 z-50">

        <div className="left-section flex items-center justify-start ">
            <img className='object-cover h-18 w-18 mt-2 ' src={logo} alt="" />
            <h1 className='text-white font-semibold text-3xl' >CodeCircle</h1>
        </div>

        <div className="center flex items-center gap-14 ">
            <Link to='/feed' >Feed</Link>
            <Link to='/compare' >Compare</Link>
            <Link to='/friends'>Friends</Link>
            <Link to='/profile'>Profile</Link>
        </div>

        <div className="right flex items-center gap-7 text-white">
            <Sun />
            
            <button className=' bg-purple-400 flex gap-3 px-5 py-2 rounded-3xl' >LogOut <LogOut size={20} /> </button>
        </div>
    </div>
   </>
  )
}

export default NavBar
