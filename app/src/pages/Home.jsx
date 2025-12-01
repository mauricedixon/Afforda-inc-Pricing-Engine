import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { getLatestProjectId } from '../utils/storage.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

function Home() {
  const [project, setProject] = useState(null)
  const [chartTotals, setChartTotals] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const latestId = getLatestProjectId() ?? (isMockMode ? mockSamples.projectId : null)
    if (!latestId) return

    const fetchSummary = async () => {
      try {
        if (isMockMode) {
          const mockProject = mockDb.getProjectById(latestId)
          const mockItems = mockDb.getProjectLineItems(latestId)
          if (!mockProject || !mockItems) return
          prepareSummary(mockProject, mockItems)
          return
        }

        const [{ data: projectData, error: projectError }, { data: lineItems, error: itemsError }] =
          await Promise.all([
            supabase.from('projects').select('*').eq('id', latestId).single(),
            supabase.from('project_line_items').select('*').eq('project_id', latestId),
          ])

        if (projectError) throw projectError
        if (itemsError) throw itemsError
        if (!projectData || !lineItems) return
        prepareSummary(projectData, lineItems)
      } catch (error) {
        setStatus(error.message)
      }
    }

    const prepareSummary = (projectData, items) => {
      const material = items.reduce((sum, item) => sum + (item.material_cost ?? 0), 0)
      const labor = items.reduce((sum, item) => sum + (item.labor_cost ?? 0), 0)
      const hardCosts = items.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
      const profitMargin = projectData?.profit_margin ?? 0.2
      const bondRate = projectData?.bond_rate ?? 0.03
      const totalMarkup = profitMargin + bondRate
      
      // Divisor formula: Grand Total = Hard Costs / (1 - Total Markup)
      const grandTotal = totalMarkup >= 1 ? hardCosts : hardCosts / (1 - totalMarkup)
      const bondTotal = grandTotal * bondRate
      const profitTotal = grandTotal * profitMargin
      
      setProject(projectData)
      setChartTotals({
        material,
        labor,
        bond: bondTotal,
        profit: profitTotal,
        total: grandTotal,
      })
    }

    fetchSummary()
  }, [])

  const chartData = useMemo(() => {
    if (!chartTotals) return []
    // Filter out zero values and ensure all slices are positive
    const data = [
      { name: 'Material', value: Math.max(0, chartTotals.material) },
      { name: 'Labor', value: Math.max(0, chartTotals.labor) },
      { name: 'Bond', value: Math.max(0, chartTotals.bond) },
      { name: 'Profit', value: Math.max(0, chartTotals.profit) },
    ].filter(item => item.value > 0) // Only show slices with positive values
    return data
  }, [chartTotals])

  const COLORS = ['#4c8ed9', '#ffb347', '#9b59b6', '#50c878']

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

  return (
    <div>
      <header>
        <p className="eyebrow">Welcome back</p>
        <h1>Centralized Pricing Engine</h1>
        <p className="lede">
          Upload the cleaned labor + material spreadsheets once, then price every BOQ from a single
          workflow. You&apos;re always a few clicks away from an export-ready bid package.
        </p>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Start a Project</h2>
          <p>Kick off a new bid and capture the project profit margin up front.</p>
          <Link to="/pricing/new-project" className="button">
            Create project
          </Link>
        </article>

        <article className="panel">
          <h2>Upload BOQ</h2>
          <p>Drop in the latest takeoff sheet to price it with the central data.</p>
          <Link to="/pricing/project/latest/upload" className="button">
            Upload takeoff
          </Link>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel" style={{ minHeight: '320px' }}>
          <header style={{ marginBottom: '1rem' }}>
            <h2>Latest Bid Snapshot</h2>
            {project && (
              <p className="lede">
                {project.project_name} · Profit Margin{' '}
                {Math.round((project.profit_margin ?? 0.2) * 100)}% · Bond Rate{' '}
                {Math.round((project.bond_rate ?? 0.03) * 100)}%
              </p>
            )}
          </header>

          {status && <p className="warning">{status}</p>}

          {!chartTotals && !status && <p>Load a project to see real-time totals.</p>}

          {chartTotals && (
            <div style={{ width: '100%', height: 300, padding: '1rem' }}>
              <ResponsiveContainer>
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={chartData}
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value, percent }) => {
                      // Only show label if slice is large enough (> 3%)
                      if (percent < 0.03) return ''
                      // Format: Name on first line, value on second line
                      return `${name}\n${formatCurrency(value)}`
                    }}
                    labelLine={{
                      stroke: '#666',
                      strokeWidth: 1,
                      length: 15,
                      lengthType: 'straight',
                    }}
                    cx="50%"
                    cy="50%"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`slice-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <p className="eyebrow">Grand Total</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{formatCurrency(chartTotals.total)}</p>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}

export default Home

