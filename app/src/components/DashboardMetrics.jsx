import React, { useMemo } from 'react'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

function DashboardMetrics({ projects = [], selectedDate = new Date() }) {
  const metrics = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    
    // Filter for selected month
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString()
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString()

    let boqsToday = 0
    let sentToday = 0
    let totalValueMonth = 0

    projects.forEach(p => {
        // BOQs Today (Created today)
        if (p.created_at >= startOfDay) {
            boqsToday++
        }

        // Proposals Sent Today (Submitted today)
        if (p.submitted_at && p.submitted_at >= startOfDay) {
            sentToday++
        }

        // Total Value (Selected Month) - based on created_at or submitted_at? 
        // Usually "Sales this month" refers to submitted/won, but "Pipeline" refers to created.
        // Let's assume this matches the filter context (e.g. Projects active in this month)
        // For "Total Value", let's sum up everything *created* in this month for a "Pipeline" view, 
        // or everything *submitted* if we want "Sales".
        // Let's go with Total Value of BOQs Created in this month (Pipeline Volume).
        if (p.created_at >= startOfMonth && p.created_at <= endOfMonth) {
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


