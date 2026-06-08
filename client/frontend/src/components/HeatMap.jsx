// src/components/HeatMap.jsx
import React from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import 'react-calendar-heatmap/dist/styles.css'   // ← library’s default styles

/* ------------------------------------------------------------------ *
 *  1️⃣  Sample data – replace this with your real data later.
 * ------------------------------------------------------------------ */
const values = [
  { date: '2026-01-01', count: 3 },
  { date: '2026-01-02', count: 5 },
  { date: '2026-01-03', count: 1 },
  { date: '2026-05-09', count: 2 },
  { date: '2026-06-05', count: 4 },
  // …add as many entries as you like
]

/* ------------------------------------------------------------------ *
 *  2️⃣  Helper: colour each square based on its count.
 *      Feel free to tweak the thresholds / colours to suit your UI.
 * ------------------------------------------------------------------ */
const classForValue = (value) => {
  if (!value || !value.count) return 'color-empty'           // no entry for that day

  // Define thresholds – you can change the numbers or add more bands.
  if (value.count >= 5) return 'color-g5'
  if (value.count >= 4) return 'color-g4'
  if (value.count >= 3) return 'color-g3'
  if (value.count >= 2) return 'color-g2'
  return 'color-g1'                         // count === 1
}

/* ------------------------------------------------------------------ *
 *  3️⃣  The component itself.
 * ------------------------------------------------------------------ */
const HeatMap = () => {
  const today = new Date()

  // One year ago (exactly 365 days before today). Adjust the “-11”
  // if you want a different window (e.g., 6 months → -5).
  const startDate = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate()
  )

  return (
    <div className="w-full h-full flex items-center">
      <CalendarHeatmap
        startDate={startDate}
        endDate={today}
        values={values}
        classForValue={classForValue}
        // Optional: show a tooltip with the raw count when hovering.
        tooltipDataAttrs={(value) => ({
          'data-tip': value?.date
            ? `${value.date}: ${value.count} contribution(s)`
            : 'No data',
        })}
      />
    </div>
  )
}

export default HeatMap
