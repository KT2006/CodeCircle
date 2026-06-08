import React from 'react'
import { platformData, PLATFORM_COLORS } from '../data/platformData'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'


  const total = platformData.reduce((sum, entry) => sum + entry.value, 0)
// then use: {total || '2006'}


const PlatformDonuts = () => {
  return (
    <>
        <PieChart width={180} height={180}>
          <text
            x="50%"
            y="50%"
            textAnchor='middle' //left se beech m laane ke liye
            dominantBaseline='middle' //upar se beech m laane ke liye
            fontSize={20}
            fill='white'
            // fontWeight={bold}
          >
            {total || '2006'} <br />
          </text>
           <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" 
                fill="gray" fontSize={11}>
                Total Solved
          </text>
            <Pie
                data={platformData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
            >
                {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[entry.name]} />
                ))}
            </Pie>
            <Tooltip />
        </PieChart>
    </>
  )
}

export default PlatformDonuts