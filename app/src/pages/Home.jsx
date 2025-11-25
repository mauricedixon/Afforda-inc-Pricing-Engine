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
      const subtotal = items.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
      const profit = subtotal * (projectData?.profit_margin ?? 0.2)
      setProject(projectData)
      setChartTotals({
        material,
        labor,
        profit,
        total: subtotal + profit,
      })
    }

    fetchSummary()
  }, [])

  const chartData = useMemo(() => {
    if (!chartTotals) return []
    return [
      { name: 'Material', value: chartTotals.material },
      { name: 'Labor', value: chartTotals.labor },
      { name: 'Profit', value: chartTotals.profit },
    ]
  }, [chartTotals])

  const COLORS = ['#4c8ed9', '#ffb347', '#50c878']

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
                {Math.round((project.profit_margin ?? 0.2) * 100)}%
              </p>
            )}
          </header>

          {status && <p className="warning">{status}</p>}

          {!chartTotals && !status && <p>Load a project to see real-time totals.</p>}

          {chartTotals && (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${formatCurrency(value)}`}
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

