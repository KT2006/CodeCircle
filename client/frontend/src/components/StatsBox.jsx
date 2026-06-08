import React from 'react'
import {CodeXml} from 'lucide-react'

const StatsBox = (props) => {
  return (
    <>
     <div className="one small-box-with-icon border text-white bg-[#0C1324] border-[#1E2A45] px-3 py-2 rounded-3xl  flex items-center gap-5">
            <div className="left">
              <span>{props.icon}</span>
            </div>
            <div className="right flex flex-col">
              <h2>{props.h2}</h2>
              <h1 className='text-2xl font-semibold' >{props.h1}</h1>
              <h3>{props.h3}</h3>
            </div>
          </div>
    </>
  )
}

export default StatsBox
