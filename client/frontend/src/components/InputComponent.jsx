import React from 'react'
import {SquarePen} from 'lucide-react'
import codeforces from '../assets/codeforces.png'

const InputComponent = (props) => {
  return (
    <>
         <div className="two flex gap-5 items-center">

                  <img src={props.img} alt="" className='h-10 w-10' />
                  <input type="text" placeholder='enter username' className='border border-white rounded-lg py-2 px-2' />
                  <span><SquarePen /></span>

            </div>
    </>
  )
}

export default InputComponent
