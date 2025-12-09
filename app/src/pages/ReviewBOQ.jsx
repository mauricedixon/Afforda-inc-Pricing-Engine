import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import { getLatestProjectId, saveLatestProjectId } from '../utils/storage.js'
import { exportBOQToExcel } from '../utils/excelExporter.js'
import { safeNumber } from '../utils/csvParser.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'
import ProposalView from '../components/ProposalView.jsx'
import LineItemModal from '../components/LineItemModal.jsx'
import { calculateGrandTotal } from '../utils/pricingEngine.js'

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

  // Edit Project State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [editProjectForm, setEditProjectForm] = useState({
    project_name: '',
    status: 'draft',
    profit_margin: 20,
    bond_rate: 3,
    general_requirements: 0,
    notes: '',
  })

  // Line Item Edit State
  const [selectedLineItem, setSelectedLineItem] = useState(null)
  const [showLineItemModal, setShowLineItemModal] = useState(false)

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
    const calculations = calculateGrandTotal({
        lineItems, 
        profitMargin: localProfitMargin / 100, 
        bondRate: localBondRate / 100,
        generalRequirements: project?.general_requirements ?? 0
    })
    
    return {
      subtotal: calculations.hardCosts,
      bond: calculations.bond,
      profit: calculations.profit,
      grandTotal: calculations.grandTotal,
      unmatched: lineItems.filter((item) => !item.matched).length,
    }
  }, [lineItems, localBondRate, localProfitMargin])

  const handleUpdateRates = async (newBondRate, newProfitMargin) => {
    if (!project || !projectId) return
    
    setIsUpdating(true)
    const bondRateDecimal = Number(newBondRate) / 100
    const profitMarginDecimal = Number(newProfitMargin) / 100
    
    // Recalculate total value to save to DB
    const { grandTotal } = calculateGrandTotal({
        lineItems,
        profitMargin: profitMarginDecimal,
        bondRate: bondRateDecimal,
        generalRequirements: project?.general_requirements ?? 0
    })

    if (isMockMode) {
      const updatedProject = mockDb.updateProject(projectId, {
         bond_rate: bondRateDecimal, 
         profit_margin: profitMarginDecimal,
         total_value: grandTotal
      })
      setProject(updatedProject)
      setIsUpdating(false)
      return
    }
    
    const { error } = await supabase
      .from('projects')
      .update({
        bond_rate: bondRateDecimal,
        profit_margin: profitMarginDecimal,
        total_value: grandTotal
      })
      .eq('id', projectId)
    
    setIsUpdating(false)
    
    if (error) {
      setStatus(`Error updating rates: ${error.message}`)
      return
    }
    
    setProject((prev) => ({ ...prev, bond_rate: bondRateDecimal, profit_margin: profitMarginDecimal, total_value: grandTotal }))
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

  const openEditModal = () => {
    if (!project) return
    setEditProjectForm({
      project_name: project.project_name,
      status: project.status ?? 'draft',
      profit_margin: localProfitMargin,
      bond_rate: localBondRate,
      general_requirements: project.general_requirements ?? 0,
      notes: project.notes ?? '',
    })
    setShowEditProjectModal(true)
  }

  const handleSaveProject = async () => {
    if (!editProjectForm.project_name.trim()) {
      alert('Project name is required')
      return
    }

    setIsUpdating(true)
    const bondRateDecimal = Number(editProjectForm.bond_rate) / 100
    const profitMarginDecimal = Number(editProjectForm.profit_margin) / 100
    const generalRequirements = Number(editProjectForm.general_requirements)

    // Recalculate total value
    const { grandTotal } = calculateGrandTotal({
        lineItems,
        profitMargin: profitMarginDecimal,
        bondRate: bondRateDecimal,
        generalRequirements
    })

    const updates = {
      project_name: editProjectForm.project_name,
      status: editProjectForm.status,
      profit_margin: profitMarginDecimal,
      bond_rate: bondRateDecimal,
      general_requirements: generalRequirements,
      notes: editProjectForm.notes,
      total_value: grandTotal,
    }

    // If changing to approved, set submitted_at
    if (editProjectForm.status === 'approved' && project.status !== 'approved') {
        updates.submitted_at = new Date().toISOString()
    }

    if (isMockMode) {
      const updatedProject = mockDb.updateProject(projectId, updates)
      setProject(updatedProject)
      setLocalBondRate(editProjectForm.bond_rate)
      setLocalProfitMargin(editProjectForm.profit_margin)
      setShowEditProjectModal(false)
      setIsUpdating(false)
      return
    }

    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)

    if (error) {
      setStatus(`Error updating project: ${error.message}`)
      setIsUpdating(false)
      return
    }

    setProject((prev) => ({ ...prev, ...updates }))
    setLocalBondRate(editProjectForm.bond_rate)
    setLocalProfitMargin(editProjectForm.profit_margin)
    setShowEditProjectModal(false)
    setIsUpdating(false)
  }

  const handleLineItemClick = (item) => {
    setSelectedLineItem(item)
    setShowLineItemModal(true)
  }

  const handleSaveLineItem = async (updatedItem) => {
    setIsUpdating(true)
    
    // Optimistic UI update
    const updatedItems = lineItems.map(i => i.id === updatedItem.id ? updatedItem : i)
    setLineItems(updatedItems)
    
    if (isMockMode) {
        // For mock mode, we just update local state as mockDb doesn't have granular item update
        setShowLineItemModal(false)
        setIsUpdating(false)
        return
    }

    // 1. Update the parent item
    const { error } = await supabase
        .from('project_line_items')
        .update({
            material_cost: updatedItem.material_cost,
            labor_cost: updatedItem.labor_cost,
            total_cost: updatedItem.total_cost,
            matched: updatedItem.matched,
            warnings: updatedItem.warnings,
            is_composite: updatedItem.is_composite
        })
        .eq('id', updatedItem.id)

    if (error) {
        setStatus(`Failed to update item: ${error.message}`)
        setIsUpdating(false)
        return
    }

    // 2. Handle Components if Composite
    if (updatedItem.is_composite && updatedItem.components) {
        // Delete existing components
        const { error: deleteError } = await supabase
            .from('line_item_components')
            .delete()
            .eq('project_line_item_id', updatedItem.id)
        
        if (deleteError) {
             console.error('Error clearing components:', deleteError)
        }

        // Insert new components
        if (updatedItem.components.length > 0) {
            const payload = updatedItem.components.map(c => ({
                project_line_item_id: updatedItem.id,
                description: c.description,
                component_type: c.component_type,
                quantity: c.quantity,
                unit: c.unit,
                unit_cost: c.unit_cost
            }))

            const { error: insertError } = await supabase
                .from('line_item_components')
                .insert(payload)
            
            if (insertError) {
                console.error('Error saving components:', insertError)
                setStatus(`Saved total, but failed to save details: ${insertError.message}`)
            }
        }
    } else if (!updatedItem.is_composite) {
        // Ensure components are cleared if switched back to simple
        // (Optional, but good for cleanup)
        await supabase
            .from('line_item_components')
            .delete()
            .eq('project_line_item_id', updatedItem.id)
    }

    // 3. Update Project Total
    const { grandTotal } = calculateGrandTotal({
        lineItems: updatedItems,
        profitMargin: localProfitMargin / 100,
        bondRate: localBondRate / 100,
        generalRequirements: project?.general_requirements ?? 0
    })
    
    await supabase
        .from('projects')
        .update({ total_value: grandTotal })
        .eq('id', projectId)
        
    setProject(prev => ({ ...prev, total_value: grandTotal }))
    
    setIsUpdating(false)
    setShowLineItemModal(false)
  }

  if (isLoading) return <p>Loading…</p>
  if (!projectId) return <p>Create or select a project first.</p>

  return (
    <div>
      <header>
        <p className="eyebrow">Pricing Workflow</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1>Review BOQ</h1>
          <button
            className="button"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', height: 'auto' }}
            onClick={openEditModal}
          >
            Edit Project
          </button>
        </div>
        {project && (
          <div>
            <p className="lede">
              {project.project_name} · O&P {localProfitMargin}% · Bond Rate {localBondRate}%
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Overhead and Profit:</span>
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
                <th>Unit Cost</th>
                <th>Material</th>
                <th>Labor</th>
                <th>Total</th>
                <th>Matched?</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr
                  key={item.id}
                  className={!item.matched ? 'warning' : ''}
                  onClick={() => handleLineItemClick(item)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td>{item.line_number}</td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td>{item.quantity}</td>
                  <td>
                    {item.quantity > 0
                      ? formatCurrency(safeNumber(item.total_cost) / safeNumber(item.quantity))
                      : '-'}
                  </td>
                  <td>{formatCurrency(safeNumber(item.material_cost))}</td>
                  <td>{formatCurrency(safeNumber(item.labor_cost))}</td>
                  <td>{formatCurrency(safeNumber(item.total_cost))}</td>
                  <td>
                    {item.matched ? (
                      <span style={{ color: '#16a34a', fontWeight: 500 }}>Yes</span>
                    ) : (
                      <button
                        style={{
                          background: '#fff7ed',
                          color: '#ea580c',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 500,
                          border: '1px solid #fed7aa',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showEditProjectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div
            className="panel"
            style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2>Edit Project</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label>
                Project Name
                <input
                  type="text"
                  value={editProjectForm.project_name}
                  onChange={(e) =>
                    setEditProjectForm({ ...editProjectForm, project_name: e.target.value })
                  }
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>

              <label>
                Status
                <select
                  value={editProjectForm.status}
                  onChange={(e) =>
                    setEditProjectForm({ ...editProjectForm, status: e.target.value })
                  }
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
                >
                  <option value="draft">Draft</option>
                  <option value="review">Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <label>
                  Overhead and Profit (%)
                  <input
                    type="number"
                    step="0.5"
                    value={editProjectForm.profit_margin}
                    onChange={(e) =>
                      setEditProjectForm({ ...editProjectForm, profit_margin: e.target.value })
                    }
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  Bond Rate (%)
                  <input
                    type="number"
                    step="0.1"
                    value={editProjectForm.bond_rate}
                    onChange={(e) =>
                      setEditProjectForm({ ...editProjectForm, bond_rate: e.target.value })
                    }
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  Gen. Req ($)
                  <input
                    type="number"
                    step="100"
                    value={editProjectForm.general_requirements}
                    onChange={(e) =>
                      setEditProjectForm({ ...editProjectForm, general_requirements: e.target.value })
                    }
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  rows="4"
                  value={editProjectForm.notes}
                  onChange={(e) =>
                    setEditProjectForm({ ...editProjectForm, notes: e.target.value })
                  }
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  className="button"
                  style={{ background: '#64748b' }}
                  onClick={() => setShowEditProjectModal(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button className="button" onClick={handleSaveProject} disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {showLineItemModal && selectedLineItem && (
        <LineItemModal
          item={selectedLineItem}
          onClose={() => setShowLineItemModal(false)}
          onSave={handleSaveLineItem}
          isUpdating={isUpdating}
        />
      )}
    </div>
  )
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

export default ReviewBOQ
