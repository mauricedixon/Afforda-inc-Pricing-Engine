import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value ?? 0)

function HistoryChart({ projects = [], selectedDate = new Date(), viewMode = 'monthly' }) {
  const chartData = useMemo(() => {
    if (viewMode === 'weekly') {
      const startOfWeek = new Date(selectedDate)
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)

      // Initialize 7 days
      const weeklyData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek)
        d.setDate(startOfWeek.getDate() + i)
        return {
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          value: 0,
          count: 0,
          date: d.toLocaleDateString()
        }
      })

      projects.forEach(p => {
        const d = new Date(p.created_at)
        if (d >= startOfWeek && d < endOfWeek) {
            const dayIndex = d.getDay() // 0 (Sun) to 6 (Sat)
            if (weeklyData[dayIndex]) {
                weeklyData[dayIndex].value += (Number(p.total_value) || 0)
                weeklyData[dayIndex].count += 1
            }
        }
      })
      return weeklyData
    }

    // Default: Monthly
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    // Initialize array for every day of the month
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      value: 0,
      count: 0,
      date: new Date(year, month, i + 1).toLocaleDateString()
    }))

    projects.forEach(p => {
      const d = new Date(p.created_at)
      // Check if project is in the selected month/year
      if (d.getMonth() === month && d.getFullYear() === year) {
        const dayIndex = d.getDate() - 1
        if (dailyData[dayIndex]) {
            dailyData[dayIndex].value += (Number(p.total_value) || 0)
            dailyData[dayIndex].count += 1
        }
      }
    })

    return dailyData
  }, [projects, selectedDate, viewMode])

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="day" 
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            tickFormatter={(value) => `$${value / 1000}k`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div style={{ 
                    background: '#fff', 
                    border: '1px solid #e2e8f0', 
                    padding: '8px 12px',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>{data.date}</p>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Volume: <span style={{ color: '#0f172a', fontWeight: 500 }}>{formatCurrency(data.value)}</span>
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      BOQs: <span style={{ color: '#0f172a', fontWeight: 500 }}>{data.count}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#4c8ed9' : '#e2e8f0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HistoryChart


