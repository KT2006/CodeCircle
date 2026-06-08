import React from 'react'

const StatsDiagramBox = ({title, subtitle, chart, right}) => {
  return (
   <>
    <div className="box w-1/2 flex  h-65 p-4 border-[#1E2A45] border bg-[#0C1324] rounded-3xl"> 

        <div className="left-section flex flex-col w-[50%] gap-2 justify-evenly  ">
          <div className="text-section ml-2 flex flex-col gap-1 text-white">
            {title}
            {subtitle}
          </div>

          <div className="char-section">
            {chart}
          </div>
        </div>
        <div className="right-section flex flex-col gap-2 p-2 items-center justify-evenly w-[70%] text-white">
          {right}
        </div>
         
     </div>
   </>
  )
}

export default StatsDiagramBox
