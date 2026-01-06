import React, { useMemo } from 'react'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

// Helper to check if a date string falls on the same local calendar day
const isSameLocalDay = (dateString, referenceDate) => {
  if (!dateString) return false
  const date = new Date(dateString)
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  )
}

// Helper to check if a date string falls within a local month
const isInLocalMonth = (dateString, referenceDate) => {
  if (!dateString) return false
  const date = new Date(dateString)
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  )
}

function DashboardMetrics({ projects = [], selectedDate = new Date() }) {
  const metrics = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Normalize selectedDate to start of day for month comparison
    const monthRef = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)

    let boqsToday = 0
    let sentToday = 0
    let totalValueMonth = 0

    projects.forEach(p => {
        // BOQs Today (Created today) - compare in local timezone
        if (isSameLocalDay(p.created_at, today)) {
            boqsToday++
        }

        // Proposals Sent Today (Submitted today) - compare in local timezone
        if (p.submitted_at && isSameLocalDay(p.submitted_at, today)) {
            sentToday++
        }

        // Total Value (Selected Month) - compare in local timezone
        if (isInLocalMonth(p.created_at, monthRef)) {
            totalValueMonth += (Number(p.total_value) || 0)
        }
    })

    return { boqsToday, sentToday, totalValueMonth }
  }, [projects, selectedDate])

  return (
    <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
      <article className="panel">
        <p className="eyebrow">Daily Activity</p>
        <h2>{metrics.boqsToday}</h2>
        <p>BOQs Uploaded Today</p>
      </article>
      
      <article className="panel">
        <p className="eyebrow">Output</p>
        <h2>{metrics.sentToday}</h2>
        <p>Proposals Sent Today</p>
      </article>

      <article className="panel">
        <p className="eyebrow">Pipeline (Month)</p>
        <h2>{formatCurrency(metrics.totalValueMonth)}</h2>
        <p>Total Estimated Value</p>
      </article>
    </section>
  )
}

export default DashboardMetrics




