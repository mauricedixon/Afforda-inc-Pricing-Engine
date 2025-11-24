import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import { getLatestProjectId, saveLatestProjectId } from '../utils/storage.js'
import { exportBOQToExcel } from '../utils/excelExporter.js'
import { safeNumber } from '../utils/csvParser.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'

function ReviewBOQ({ useLatestProject = false }) {
  const params = useParams()
  const [project, setProject] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const fallbackProjectId = isMockMode ? mockSamples.projectId : null
  const projectId = useMemo(() => {
    const sourceId = useLatestProject ? getLatestProjectId() : params.projectId
    return sourceId ?? fallbackProjectId
  }, [params.projectId, useLatestProject, fallbackProjectId])

  const fetchData = useCallback(async (id) => {
    setIsLoading(true)

    if (isMockMode) {
      const projectData = mockDb.getProjectById(id)
      const items = mockDb.getProjectLineItems(id)
      setIsLoading(false)

      if (!projectData) {
        setStatus('Demo project not found.')
        return
      }

      setProject(projectData)
      setLineItems(items)
      saveLatestProjectId(id)
      return
    }

    const [{ data: projectData, error: projectError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_line_items').select('*').eq('project_id', id).order('line_number'),
      ])

    setIsLoading(false)

    if (projectError) {
      setStatus(projectError.message)
      return
    }
    if (itemsError) {
      setStatus(itemsError.message)
      return
    }

    setProject(projectData)
    setLineItems(items || [])
    saveLatestProjectId(id)
  }, [])

  useEffect(() => {
    if (!projectId) {
      const timeout = setTimeout(() => {
        setStatus('No project selected.')
        setIsLoading(false)
      }, 0)
      return () => clearTimeout(timeout)
    }
    const timeout = setTimeout(() => {
      fetchData(projectId)
    }, 0)
    return () => clearTimeout(timeout)
  }, [fetchData, projectId])

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
    const profit = subtotal * (project?.profit_margin ?? 0.2)
    return {
      subtotal,
      profit,
      grandTotal: subtotal + profit,
      unmatched: lineItems.filter((item) => !item.matched).length,
    }
  }, [lineItems, project])

  const handleExport = () => {
    if (!project) {
      setStatus('Project not loaded yet.')
      return
    }

    try {
      exportBOQToExcel({ project, lineItems })
    } catch (error) {
      setStatus(`Export failed: ${error.message}`)
    }
  }

  if (isLoading) return <p>Loading…</p>
  if (!projectId) return <p>Create or select a project first.</p>

  return (
    <div>
      <header>
        <p className="eyebrow">Pricing Workflow</p>
        <h1>Review BOQ</h1>
        {project && (
          <p className="lede">
            {project.project_name} · Profit Margin {Math.round((project.profit_margin ?? 0.2) * 100)}%
          </p>
        )}
        <button className="button" style={{ marginTop: '1rem' }} onClick={handleExport}>
          Export Excel
        </button>
      </header>

      {status && <p>{status}</p>}

      <section style={{ marginTop: '2rem' }}>
        <div className="summary">
          <div>
            <h3>Subtotal</h3>
            <p>{formatCurrency(totals.subtotal)}</p>
          </div>
          <div>
            <h3>Profit</h3>
            <p>{formatCurrency(totals.profit)}</p>
          </div>
          <div>
            <h3>Grand Total</h3>
            <p>{formatCurrency(totals.grandTotal)}</p>
          </div>
          <div>
            <h3>Flags</h3>
            <p>{totals.unmatched} items need review</p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Material</th>
                <th>Labor</th>
                <th>Total</th>
                <th>Matched?</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className={!item.matched ? 'warning' : ''}>
                  <td>{item.line_number}</td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(safeNumber(item.material_cost))}</td>
                  <td>{formatCurrency(safeNumber(item.labor_cost))}</td>
                  <td>{formatCurrency(safeNumber(item.total_cost))}</td>
                  <td>{item.matched ? 'Yes' : 'Review'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

export default ReviewBOQ

