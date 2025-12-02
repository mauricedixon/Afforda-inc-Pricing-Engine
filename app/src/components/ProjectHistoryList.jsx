import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const StatusBadge = ({ status }) => {
  const colors = {
    draft: { bg: '#f1f5f9', color: '#475569' },
    review: { bg: '#fff7ed', color: '#ea580c' },
    approved: { bg: '#f0fdf4', color: '#16a34a' },
    rejected: { bg: '#fef2f2', color: '#dc2626' },
  }
  const style = colors[status?.toLowerCase()] || colors.draft

  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.color,
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  )
}

function ProjectHistoryList({ projects = [], selectedDate = new Date() }) {
  const filteredProjects = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()

    return projects
      .filter(p => {
        const d = new Date(p.created_at)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Newest first
  }, [projects, selectedDate])

  if (filteredProjects.length === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#64748b' }}>No projects found for this month.</p>
        <Link to="/pricing/new-project" className="button" style={{ marginTop: '1rem' }}>
          Start New Project
        </Link>
      </div>
    )
  }

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>Date</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>Project Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>Total Value</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr key={project.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{formatDate(project.created_at)}</td>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{project.project_name}</td>
                <td style={{ padding: '1rem' }}>
                  <StatusBadge status={project.status} />
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {formatCurrency(project.total_value)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <Link 
                    to={`/pricing/project/${project.id}/review`}
                    style={{ 
                      color: '#4c8ed9', 
                      textDecoration: 'none', 
                      fontSize: '0.875rem', 
                      fontWeight: 500 
                    }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProjectHistoryList


