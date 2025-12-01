import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import { getLatestProjectId, saveLatestProjectId } from '../utils/storage.js'
import { exportBOQToExcel } from '../utils/excelExporter.js'
import { safeNumber } from '../utils/csvParser.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'
import ProposalView from '../components/ProposalView.jsx'

function ReviewBOQ({ useLatestProject = false }) {
  const params = useParams()
  const [project, setProject] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showProposal, setShowProposal] = useState(false)
  const [localBondRate, setLocalBondRate] = useState(3)
  const [localProfitMargin, setLocalProfitMargin] = useState(20)
  const [isUpdating, setIsUpdating] = useState(false)
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
      setLocalBondRate(Math.round((projectData.bond_rate ?? 0.03) * 100))
      setLocalProfitMargin(Math.round((projectData.profit_margin ?? 0.2) * 100))
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
    setLocalBondRate(Math.round((projectData.bond_rate ?? 0.03) * 100))
    setLocalProfitMargin(Math.round((projectData.profit_margin ?? 0.2) * 100))
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
    const hardCosts = lineItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
    const profitMargin = localProfitMargin / 100
    const bondRate = localBondRate / 100
    const totalMarkup = profitMargin + bondRate
    
    // Divisor formula: Grand Total = Hard Costs / (1 - Total Markup)
    const grandTotal = totalMarkup >= 1 ? hardCosts : hardCosts / (1 - totalMarkup)
    const bondTotal = grandTotal * bondRate
    const profitTotal = grandTotal * profitMargin
    
    return {
      subtotal: hardCosts,
      bond: bondTotal,
      profit: profitTotal,
      grandTotal,
      unmatched: lineItems.filter((item) => !item.matched).length,
    }
  }, [lineItems, localBondRate, localProfitMargin])

  const handleUpdateRates = async (newBondRate, newProfitMargin) => {
    if (!project || !projectId) return
    
    setIsUpdating(true)
    const bondRateDecimal = Number(newBondRate) / 100
    const profitMarginDecimal = Number(newProfitMargin) / 100
    
    if (isMockMode) {
      // Update mock project
      const updatedProject = { ...project, bond_rate: bondRateDecimal, profit_margin: profitMarginDecimal }
      setProject(updatedProject)
      setIsUpdating(false)
      return
    }
    
    const { error } = await supabase
      .from('projects')
      .update({
        bond_rate: bondRateDecimal,
        profit_margin: profitMarginDecimal,
      })
      .eq('id', projectId)
    
    setIsUpdating(false)
    
    if (error) {
      setStatus(`Error updating rates: ${error.message}`)
      return
    }
    
    setProject({ ...project, bond_rate: bondRateDecimal, profit_margin: profitMarginDecimal })
  }

  const handleBondRateChange = (value) => {
    const newRate = Number(value)
    setLocalBondRate(newRate)
    handleUpdateRates(newRate, localProfitMargin)
  }

  const handleProfitMarginChange = (value) => {
    const newMargin = Number(value)
    setLocalProfitMargin(newMargin)
    handleUpdateRates(localBondRate, newMargin)
  }

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
          <div>
            <p className="lede">
              {project.project_name} · Profit Margin {localProfitMargin}% · Bond Rate {localBondRate}%
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Profit Margin:</span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  value={localProfitMargin}
                  onChange={(e) => handleProfitMarginChange(e.target.value)}
                  disabled={isUpdating}
                  style={{ width: '80px', padding: '0.25rem' }}
                />
                <span>%</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Bond Rate:</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={localBondRate}
                  onChange={(e) => handleBondRateChange(e.target.value)}
                  disabled={isUpdating}
                  style={{ width: '80px', padding: '0.25rem' }}
                />
                <span>%</span>
              </label>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button className="button" onClick={handleExport}>
            Export Excel
          </button>
          <button
            className="button"
            style={{ background: '#475569' }}
            onClick={() => setShowProposal(true)}
          >
            Preview Proposal
          </button>
        </div>
      </header>

      {status && <p>{status}</p>}

      <section style={{ marginTop: '2rem' }}>
        <div className="summary">
          <div>
            <h3>Subtotal</h3>
            <p>{formatCurrency(totals.subtotal)}</p>
          </div>
          <div>
            <h3>Bond</h3>
            <p>{formatCurrency(totals.bond)}</p>
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

      {showProposal && (
        <ProposalView
          project={{
            ...project,
            bond_rate: localBondRate / 100,
            profit_margin: localProfitMargin / 100,
          }}
          items={lineItems}
          onClose={() => setShowProposal(false)}
        />
      )}
    </div>
  )
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

export default ReviewBOQ

