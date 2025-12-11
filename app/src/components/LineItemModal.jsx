import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabaseClient.js'

const formatCurrencyInput = (value) => {
  if (value === null || value === undefined) return ''
  return value.toString()
}

function LineItemModal({ item, onClose, onSave, isUpdating }) {
  const [mode, setMode] = useState('simple') // 'simple' | 'composite'
  const [form, setForm] = useState({
    material_cost: 0,
    labor_cost: 0,
    total_cost: 0,
    matched: false,
  })
  
  const [components, setComponents] = useState([])
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [isEstimating, setIsEstimating] = useState(false)

  // Derive quantity from the parent item safely
  const parentQty = useMemo(() => {
    return Number(item?.quantity) || 0
  }, [item])

  useEffect(() => {
    if (item) {
      setForm({
        material_cost: item.material_cost ?? 0,
        labor_cost: item.labor_cost ?? 0,
        total_cost: item.total_cost ?? 0,
        matched: item.matched ?? false,
        confidence_score: item.confidence_score ?? null,
        ai_reasoning: item.ai_reasoning ?? null,
        pricing_source: item.pricing_source ?? 'manual',
      })
      
      if (item.is_composite) {
        setMode('composite')
        fetchComponents(item.id)
      } else {
        setMode('simple')
        setComponents([])
      }
    }
  }, [item])

  const fetchComponents = async (itemId) => {
    setIsLoadingComponents(true)
    const { data, error } = await supabase
      .from('line_item_components')
      .select('*')
      .eq('project_line_item_id', itemId)
    
    if (!error && data) {
      // Check if old data has 'use_rate' flag; if not present, assume false
      // We also handle 'rate_per_unit' if present, otherwise default to 0
      const enhancedData = data.map(c => ({
        ...c,
        use_rate: c.use_rate ?? false, // Default to false if not saved previously
        rate_per_unit: c.rate_per_unit ?? 0
      }))
      setComponents(enhancedData)
    }
    setIsLoadingComponents(false)
  }

  // Calculate totals from components whenever they change
  useEffect(() => {
    if (mode === 'composite') {
      const calculateComponentCost = (c) => {
        // If "use_rate" is active, Qty = Rate * ParentQty
        const qty = c.use_rate ? (c.rate_per_unit * parentQty) : c.quantity
        return qty * c.unit_cost
      }

      const material = components
        .filter(c => c.component_type === 'material')
        .reduce((sum, c) => sum + calculateComponentCost(c), 0)
        
      const labor = components
        .filter(c => c.component_type === 'labor')
        .reduce((sum, c) => sum + calculateComponentCost(c), 0)

      const other = components
        .filter(c => !['material', 'labor'].includes(c.component_type))
        .reduce((sum, c) => sum + calculateComponentCost(c), 0)

      setForm(prev => ({
        ...prev,
        material_cost: material,
        labor_cost: labor + other,
        total_cost: material + labor + other
      }))
    }
  }, [components, mode, parentQty])

  const handleChange = (field, value) => {
    if (mode === 'composite') return

    const numValue = parseFloat(value)
    const newValue = isNaN(numValue) ? 0 : numValue

    setForm(prev => {
      const updated = { ...prev, [field]: newValue }
      if (field === 'material_cost' || field === 'labor_cost') {
        updated.total_cost = updated.material_cost + updated.labor_cost
      }
      return updated
    })
  }

  const handleAddComponent = () => {
    setComponents(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        description: '',
        component_type: 'material',
        quantity: 1, // Default absolute qty
        rate_per_unit: 0, // Default rate
        use_rate: false, // Default to absolute
        unit_cost: 0,
        unit: 'EA'
      }
    ])
  }

  const handleUpdateComponent = (id, field, value) => {
    setComponents(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value }
      }
      return c
    }))
  }

  const handleRemoveComponent = (id) => {
    setComponents(prev => prev.filter(c => c.id !== id))
  }

  const handleAiEstimate = async () => {
    setIsEstimating(true)
    try {
      const { data, error } = await supabase.functions.invoke('estimate-item', {
        body: { 
            item_name: item.item_name,
            description: item.description 
        }
      })

      if (error) throw error

      setForm(prev => ({
        ...prev,
        material_cost: data.material_cost || 0,
        labor_cost: data.labor_cost || 0,
        total_cost: (data.material_cost || 0) + (data.labor_cost || 0),
        confidence_score: data.confidence_score,
        ai_reasoning: data.reasoning,
        pricing_source: 'ai'
      }))

    } catch (err) {
      console.error('AI Estimate failed:', err)
      alert('Failed to get AI estimate. Please try again.')
    } finally {
      setIsEstimating(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Bake the calculated quantity for persistence
    const finalComponents = mode === 'composite' ? components.map(c => ({
        ...c,
        quantity: c.use_rate ? (c.rate_per_unit * parentQty) : c.quantity
    })) : []

    onSave({
      ...item,
      ...form,
      is_composite: mode === 'composite',
      components: finalComponents,
      matched: true, 
      warnings: [] 
    })
  }

  if (!item) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div className="panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Edit Line Item</h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem' }}
          >
            &times;
          </button>
        </header>

        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>Item Description</p>
          <p style={{ margin: 0 }}>{item.description}</p>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
             <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Qty: <strong>{item.quantity} {item.unit}</strong></span>
          </div>
          {item.pricing_source === 'ai' && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.05em' }}>AI Estimate</span>
                    {item.confidence_score !== null && (
                         <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: item.confidence_score > 80 ? '#dcfce7' : item.confidence_score > 50 ? '#fef9c3' : '#fee2e2',
                            color: item.confidence_score > 80 ? '#166534' : item.confidence_score > 50 ? '#854d0e' : '#991b1b',
                        }}>
                            {item.confidence_score}% Confidence
                        </span>
                    )}
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', fontStyle: 'italic' }}>
                    "{item.ai_reasoning || 'No reasoning provided.'}"
                </p>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                    type="button"
                    onClick={() => setMode('simple')}
                    style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: mode === 'simple' ? '2px solid #2563eb' : 'none',
                        color: mode === 'simple' ? '#2563eb' : '#64748b',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0.5rem'
                    }}
                >
                    Simple Pricing
                </button>
                <button 
                    type="button"
                    onClick={() => setMode('composite')}
                    style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: mode === 'composite' ? '2px solid #2563eb' : 'none',
                        color: mode === 'composite' ? '#2563eb' : '#64748b',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0.5rem'
                    }}
                >
                    Detailed Breakdown (Assembly)
                </button>
            </div>

            <button
                type="button"
                onClick={handleAiEstimate}
                disabled={isEstimating || isUpdating}
                style={{
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    color: 'white',
                    border: 'none',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: isEstimating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                }}
            >
                {isEstimating ? (
                    <>
                        <span className="animate-spin" style={{ display: 'inline-block' }}>↻</span> Estimating...
                    </>
                ) : (
                    <>
                        <span>✨</span> AI Re-Estimate
                    </>
                )}
            </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'simple' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <label>
                Material Cost ($)
                <input
                    type="number"
                    step="0.01"
                    value={form.material_cost}
                    onChange={(e) => handleChange('material_cost', e.target.value)}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                />
                </label>
                <label>
                Labor Cost ($)
                <input
                    type="number"
                    step="0.01"
                    value={form.labor_cost}
                    onChange={(e) => handleChange('labor_cost', e.target.value)}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                />
                </label>
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>Type</th>
                            <th style={{ padding: '0.5rem' }}>Description</th>
                            <th style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}>Link?</th>
                            <th style={{ padding: '0.5rem', width: '80px' }}>{components.some(c => c.use_rate) ? 'Rate' : 'Qty'}</th>
                            <th style={{ padding: '0.5rem', width: '80px' }}>Calc Qty</th>
                            <th style={{ padding: '0.5rem', width: '60px' }}>Unit</th>
                            <th style={{ padding: '0.5rem', width: '100px' }}>Cost ($)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.5rem', width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {components.map((comp) => (
                            <tr key={comp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.5rem' }}>
                                    <select 
                                        value={comp.component_type}
                                        onChange={(e) => handleUpdateComponent(comp.id, 'component_type', e.target.value)}
                                        style={{ width: '100%', padding: '0.25rem' }}
                                    >
                                        <option value="material">Material</option>
                                        <option value="labor">Labor</option>
                                        <option value="equipment">Equipment</option>
                                        <option value="other">Other</option>
                                    </select>
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input 
                                        type="text" 
                                        value={comp.description}
                                        onChange={(e) => handleUpdateComponent(comp.id, 'description', e.target.value)}
                                        placeholder="Item name"
                                        style={{ width: '100%', padding: '0.25rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <input 
                                        type="checkbox"
                                        checked={comp.use_rate}
                                        onChange={(e) => handleUpdateComponent(comp.id, 'use_rate', e.target.checked)}
                                        title="Link to parent quantity?"
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    {comp.use_rate ? (
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={comp.rate_per_unit}
                                            onChange={(e) => handleUpdateComponent(comp.id, 'rate_per_unit', parseFloat(e.target.value))}
                                            placeholder="Rate"
                                            style={{ width: '100%', padding: '0.25rem', borderColor: '#3b82f6' }}
                                        />
                                    ) : (
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={comp.quantity}
                                            onChange={(e) => handleUpdateComponent(comp.id, 'quantity', parseFloat(e.target.value))}
                                            style={{ width: '100%', padding: '0.25rem' }}
                                        />
                                    )}
                                </td>
                                <td style={{ padding: '0.5rem', color: '#64748b' }}>
                                    {comp.use_rate ? (comp.rate_per_unit * parentQty).toFixed(2) : comp.quantity}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input 
                                        type="text" 
                                        value={comp.unit}
                                        onChange={(e) => handleUpdateComponent(comp.id, 'unit', e.target.value)}
                                        style={{ width: '100%', padding: '0.25rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={comp.unit_cost}
                                        onChange={(e) => handleUpdateComponent(comp.id, 'unit_cost', parseFloat(e.target.value))}
                                        style={{ width: '100%', padding: '0.25rem' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                    {((comp.use_rate ? (comp.rate_per_unit * parentQty) : comp.quantity) * comp.unit_cost).toFixed(2)}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveComponent(comp.id)}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                    >
                                        &times;
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button 
                        type="button"
                        onClick={handleAddComponent}
                        style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                        + Add Component
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                        * "Link?" calculates Qty based on parent item Qty ({item.quantity})
                    </span>
                </div>
            </div>
          )}

          <label style={{ marginBottom: '1.5rem', display: 'block' }}>
            Total Cost ($)
            <input
              type="number"
              step="0.01"
              value={form.total_cost}
              readOnly={mode === 'composite'}
              onChange={(e) => mode !== 'composite' && setForm(prev => ({ ...prev, total_cost: parseFloat(e.target.value) || 0 }))}
              style={{ width: '100%', marginTop: '0.25rem', fontWeight: 'bold', background: mode === 'composite' ? '#f1f5f9' : 'white' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="button"
              className="button"
              style={{ background: '#94a3b8' }}
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Approve & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LineItemModal
