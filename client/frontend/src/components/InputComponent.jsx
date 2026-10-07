import React from 'react'
import {SaveIcon, SquarePen} from 'lucide-react'
import codeforces from '../assets/codeforces.png'
import { useState } from 'react'

const InputComponent = (props) => {
  const [handle, setHandle] = useState('');
  const [isediting, setIsEditing] = useState(false);
  return (
    <>
         <div className="two flex gap-5 items-center">

                  <img src={props.img} alt="" className='h-10 w-10' />
                  <input type="text" placeholder='enter username' className='border border-white rounded-lg py-2 px-2 disabled:opacity-50 disabled:cursor-not-allowed'
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)} //dom m naam daal diya properly
                    disabled={!isediting} // disabled when not editing
                  />
                  <span
                    onClick={() =>{
                      //editing ke state ko badlo
                      setIsEditing(!isediting)
                    }}
                  >
                    {isediting ? <SaveIcon></SaveIcon> : <SquarePen></SquarePen>}
                    </span>

            </div>
    </>
  )
}

export default InputComponent
