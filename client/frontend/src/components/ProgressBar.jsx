import React from 'react'
import { platformData, PLATFORM_COLORS } from '../data/platformData'

let totalCount = 0;

for(let i = 0; i<platformData.length; i++) totalCount += platformData[i].value;

// width pehle hi pata karlete hai har platform ki 
//and then we'll work accordingly
//first find the component

//we need ot map them with the exact same colors used to represent the platform in the pie-chart, then display and the %age and the no.of questions solved in the platform
const ProgressBar = ({name}) => {
    const entry = platformData.find((e) => e.name === name)
    //now we've found name toh uska corresponding with i.e percentage nikaalo
    const percentage = ((entry.value / totalCount) * 100).toFixed(0); //for no precision
    const count = entry.value;
  return (
    <>
        <div className="progress-bar flex items-center w-full gap-2">

              <h3>{name}</h3>
            <div className="outer-div w-full h-1 bg-gray-500 rounded-4xl">
                <div className="inner-filling h-1"
                style={{
                    width:  `${percentage}%`,
                    backgroundColor: PLATFORM_COLORS[name]
                }}
            >
                </div>
             </div>

        <div className="percentage-count flex gap-2 items-center text-white">
            <h3 className='flex' >{percentage}% </h3>
            <h3>({count})</h3>
        </div>

        </div>
      
    </>
  )
}

export default ProgressBar