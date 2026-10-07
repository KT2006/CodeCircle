import React from 'react'

const StatsDiagramBox = ({title, subtitle, chart, right}) => {
  const hasLeft = title || subtitle || chart;

  return (
   <>
    <div className="box w-1/2 flex h-65  p-4 border-[#1E2A45] border bg-[#0C1324] rounded-3xl">

        {hasLeft && (
          <div className="left-section flex flex-col w-[50%] gap-2 justify-evenly">
            <div className="text-section ml-2 flex flex-col gap-1 text-white">
              {title}
              {subtitle}
            </div>

            <div className="char-section">
              {chart}
            </div>
          </div>
        )}

        <div className={`right-section flex flex-col gap-2 p-2 items-center  justify-evenly text-white ${hasLeft ? 'w-[80%]' : 'w-full'}`}>
          {right}
        </div>

     </div>
   </>
  )
}

export default StatsDiagramBox
