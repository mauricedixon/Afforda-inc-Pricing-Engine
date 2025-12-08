import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from './services/supabaseClient.js'
import { getLatestProjectId } from './utils/storage.js'
import { isMockMode } from './mockData.js'
import AffordaLogo from './components/AffordaLogo.jsx'
import './App.css'

const primaryLinks = [
  { label: 'Dashboard', to: '/' },
  { label: 'Pricing', to: '/pricing/new-project' },
]

const adminLinks = [
  { label: 'Labor Rates', to: '/admin/labor-rates' },
  { label: 'Material Prices', to: '/admin/material-prices' },
]

function App() {
  const [currentProject, setCurrentProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchProject = async (projectId) => {
      if (!projectId) {
        if (isMounted) {
          setCurrentProject(null)
          setLoadingProject(false)
        }
        return
      }

      setLoadingProject(true)
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
      if (!isMounted) return

      if (error) {
        console.error('Failed to load project', error)
        setCurrentProject(null)
      } else {
        setCurrentProject(data)
      }
      setLoadingProject(false)
    }

    const latestId = getLatestProjectId()
    fetchProject(latestId)

    const handleProjectChange = (event) => {
      fetchProject(event.detail?.projectId ?? getLatestProjectId())
    }

    window.addEventListener('afforda:project-change', handleProjectChange)

    return () => {
      isMounted = false
      window.removeEventListener('afforda:project-change', handleProjectChange)
    }
  }, [])

  const projectStatus = currentProject?.status ?? 'No project selected'

  return (
    <div className={`shell ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
      <aside className={`sidebar ${!isSidebarOpen ? 'closed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isSidebarOpen ? '«' : '»'}
        </button>

        <div className="sidebar-content-wrapper">
          <div className="sidebar-header">
            <AffordaLogo className="sidebar-logo" variant="sidebar" />
            <h1>Pricing Engine</h1>
          </div>

          <section className="current-project-card">
          <p className="nav-label">Current Project</p>
          {loadingProject ? (
            <p className="helper-text">Checking for saved projects…</p>
          ) : currentProject ? (
            <>
              <div className="project-meta">
                <h3>{currentProject.project_name}</h3>
                <span className="status-pill">{projectStatus}</span>
              </div>
              <p className="helper-text">
                Overhead and Profit:{' '}
                <strong>{Math.round((currentProject.profit_margin ?? 0.2) * 100)}%</strong>
              </p>
              <div className="project-actions">
                <Link className="pill-link" to={`/pricing/project/${currentProject.id}/upload`}>
                  Upload BOQ
                </Link>
                <Link className="pill-link" to={`/pricing/project/${currentProject.id}/review`}>
                  Review Bid
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="helper-text">
                No active project yet. Start a new one to unlock quick actions.
              </p>
              <Link className="pill-link" to="/pricing/new-project">
                Create Project
              </Link>
            </>
          )}
        </section>

        <nav>
          <p className="nav-label">Navigation</p>
          <ul>
            {primaryLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav>
          <p className="nav-label">Admin</p>
          <ul>
            {adminLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        </div>
      </aside>

      <main className="content">
        {!isSidebarOpen && (
          <button
            className="sidebar-toggle-floating"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            title="Expand Sidebar"
          >
            »
          </button>
        )}
        {isMockMode && (
          <div className="demo-banner">
            Demo data enabled. Uploads and projects are stored locally for previews.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

export default App
