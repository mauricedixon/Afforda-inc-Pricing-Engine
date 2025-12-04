import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { getLatestProjectId } from '../utils/storage.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'
import { calculateGrandTotal } from '../utils/pricingEngine.js'
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import DashboardMetrics from '../components/DashboardMetrics.jsx'
import HistoryChart from '../components/HistoryChart.jsx'
import ProjectHistoryList from '../components/ProjectHistoryList.jsx'

function Home() {
  const [projects, setProjects] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // Selected Project for Pie Chart Snapshot
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [chartTotals, setChartTotals] = useState(null)
  
  const [status, setStatus] = useState('')
  const [viewMode, setViewMode] = useState('monthly') // 'weekly' | 'monthly'

  // 1. Fetch All Projects (for History/Metrics)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        if (isMockMode) {
          const allProjects = mockDb.listProjects()
          setProjects(allProjects)
          // Default to latest project
          if (allProjects.length > 0) {
             const sorted = [...allProjects].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
             setSelectedProjectId(sorted[0].id)
          }
          return
        }

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) throw error
        setProjects(data || [])
        if (data && data.length > 0) {
            // Check local storage for latest, otherwise first in list
            const storedId = getLatestProjectId()
            const found = data.find(p => p.id === storedId)
            setSelectedProjectId(found ? found.id : data[0].id)
        }
      } catch (error) {
        console.error('Error loading projects:', error)
        setStatus('Failed to load project history.')
      }
    }
    fetchProjects()
  }, [])

  // 2. Fetch Details for Selected Project (for Pie Chart)
  useEffect(() => {
    if (!selectedProjectId) return

    const fetchProjectDetails = async () => {
      try {
        if (isMockMode) {
          const mockProject = mockDb.getProjectById(selectedProjectId)
          const mockItems = mockDb.getProjectLineItems(selectedProjectId)
          if (mockProject) {
             setSelectedProject(mockProject)
             prepareSummary(mockProject, mockItems)
          }
          return
        }

        const [{ data: projectData, error: projectError }, { data: lineItems, error: itemsError }] =
          await Promise.all([
            supabase.from('projects').select('*').eq('id', selectedProjectId).single(),
            supabase.from('project_line_items').select('*').eq('project_id', selectedProjectId),
          ])

        if (projectError) throw projectError
        if (itemsError) throw itemsError
        
        setSelectedProject(projectData)
        prepareSummary(projectData, lineItems)
      } catch (error) {
        console.error(error)
        // Don't show global error for this, just maybe clear chart
      }
    }

    const prepareSummary = (projectData, items) => {
        const calculations = calculateGrandTotal({
            lineItems: items || [], 
            profitMargin: projectData.profit_margin ?? 0.2, 
            bondRate: projectData.bond_rate ?? 0.03,
            generalRequirements: projectData.general_requirements ?? 0
        })

      setChartTotals({
        material: calculations.material,
        labor: calculations.labor,
        bond: calculations.bond,
        profit: calculations.profit,
        total: calculations.grandTotal,
      })
    }

    fetchProjectDetails()
  }, [selectedProjectId])

  const pieChartData = useMemo(() => {
    if (!chartTotals) return []
    return [
      { name: 'Material', value: Math.max(0, chartTotals.material) },
      { name: 'Labor', value: Math.max(0, chartTotals.labor) },
      { name: 'Bond', value: Math.max(0, chartTotals.bond) },
      { name: 'O&P', value: Math.max(0, chartTotals.profit) },
    ].filter(item => item.value > 0)
  }, [chartTotals])

  const COLORS = ['#4c8ed9', '#ffb347', '#9b59b6', '#50c878']

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

  const handleDateChange = (offset) => {
    const newDate = new Date(selectedDate)
    if (viewMode === 'weekly') {
        newDate.setDate(newDate.getDate() + (offset * 7))
    } else {
        newDate.setMonth(newDate.getMonth() + offset)
    }
    setSelectedDate(newDate)
  }

  const getDateLabel = () => {
    if (viewMode === 'weekly') {
        const start = new Date(selectedDate)
        start.setDate(selectedDate.getDate() - selectedDate.getDay()) // Sunday
        const end = new Date(start)
        end.setDate(start.getDate() + 6) // Saturday
        
        // Format: "MMM d - MMM d, YYYY"
        const opts = { month: 'short', day: 'numeric' }
        return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`
    }
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <p className="eyebrow">Overview</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
                <h1>Dashboard</h1>
                <p className="lede">
                Track your pricing volume, proposal activity, and recent bids.
                </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button 
                    onClick={() => handleDateChange(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '1.2rem' }}
                >
                    ‹
                </button>
                <span style={{ fontWeight: 600, minWidth: '160px', textAlign: 'center', fontSize: '0.9rem' }}>
                    {getDateLabel()}
                </span>
                <button 
                    onClick={() => handleDateChange(1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '1.2rem' }}
                >
                    ›
                </button>
            </div>
        </div>
      </header>

      <DashboardMetrics projects={projects} selectedDate={selectedDate} />

      <section className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr', marginBottom: '2rem' }}>
        <article className="panel">
            <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                    <h2>{viewMode === 'weekly' ? 'Weekly Volume' : 'Monthly Volume'}</h2>
                    <p>Total value of BOQs uploaded in {viewMode === 'weekly' ? 'this week' : selectedDate.toLocaleDateString('en-US', { month: 'long' })}</p>
                </div>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                    <button
                        onClick={() => setViewMode('weekly')}
                        style={{
                            border: 'none',
                            background: viewMode === 'weekly' ? '#fff' : 'transparent',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            color: viewMode === 'weekly' ? '#0f172a' : '#64748b',
                            boxShadow: viewMode === 'weekly' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer'
                        }}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => setViewMode('monthly')}
                        style={{
                            border: 'none',
                            background: viewMode === 'monthly' ? '#fff' : 'transparent',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            color: viewMode === 'monthly' ? '#0f172a' : '#64748b',
                            boxShadow: viewMode === 'monthly' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer'
                        }}
                    >
                        Month
                    </button>
                </div>
            </header>
            <HistoryChart projects={projects} selectedDate={selectedDate} viewMode={viewMode} />
        </article>

        <article className="panel" style={{ minHeight: '320px' }}>
          <header style={{ marginBottom: '1rem' }}>
            <h2>Bid Snapshot</h2>
            {selectedProject ? (
              <p className="lede" style={{ fontSize: '0.9rem' }}>
                {selectedProject.project_name}
                <br/>
                <span style={{ opacity: 0.7 }}>
                    O&P {Math.round((selectedProject.profit_margin ?? 0.2) * 100)}% · Bond {Math.round((selectedProject.bond_rate ?? 0.03) * 100)}%
                </span>
              </p>
            ) : (
                <p>Select a project to view breakdown.</p>
            )}
          </header>

          {chartTotals ? (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`slice-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <p className="eyebrow">Grand Total</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(chartTotals.total)}</p>
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                No data available
            </div>
          )}
        </article>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
            <h2>Project History</h2>
            <Link to="/pricing/new-project" className="button">
                + New Project
            </Link>
        </div>
        <ProjectHistoryList projects={projects} selectedDate={selectedDate} />
      </section>
    </div>
  )
}

export default Home
