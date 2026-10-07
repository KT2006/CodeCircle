import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Dummy data showing rating progression over time
const ratingData = [
  { month: 'Jan', rating: 1200 },
  { month: 'Feb', rating: 1350 },
  { month: 'Mar', rating: 1300 },
  { month: 'Apr', rating: 1550 },
  { month: 'May', rating: 1600 },
  { month: 'Jun', rating: 1850 },
  { month: 'Jul', rating: 1900 },
  { month: 'Aug', rating: 2006 } // Your top score!
]

// Custom Tooltip so it matches the dark theme perfectly
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0C1324] border border-[#1E2A45] p-3 rounded-xl shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-purple-400 font-bold text-lg">
          {payload[0].value} <span className="text-xs text-gray-500 font-normal">Rating</span>
        </p>
      </div>
    );
  }
  return null;
}

const RatingChart = () => {
  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      {/* ResponsiveContainer ensures the chart fits into the StatsDiagramBox right-section */}
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={ratingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {/* The gradient makes the area "fade out" beautifully at the bottom */}
            <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.5}/>
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
            </linearGradient>
          </defs>

          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 12 }}
            domain={['dataMin - 100', 'dataMax + 100']} // Dynamically zooms the Y axis
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#1E2A45', strokeWidth: 2, strokeDasharray: '4 4' }}
          />

          <Area
            type="monotone" // Smooth curvy line instead of sharp edges
            dataKey="rating"
            stroke="#8B5CF6" // Purple stroke
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRating)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RatingChart