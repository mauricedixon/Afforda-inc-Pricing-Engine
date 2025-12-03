import React, { useState, useEffect } from 'react'

const formatCurrencyInput = (value) => {
  if (value === null || value === undefined) return ''
  return value.toString()
}

function LineItemModal({ item, onClose, onSave, isUpdating }) {
  const [form, setForm] = useState({
    material_cost: 0,
    labor_cost: 0,
    total_cost: 0,
    matched: false,
  })

  useEffect(() => {
    if (item) {
      setForm({
        material_cost: item.material_cost ?? 0,
        labor_cost: item.labor_cost ?? 0,
        total_cost: item.total_cost ?? 0,
        matched: item.matched ?? false,
      })
    }
  }, [item])

  const handleChange = (field, value) => {
    const numValue = parseFloat(value)
    const newValue = isNaN(numValue) ? 0 : numValue

    setForm(prev => {
      const updated = { ...prev, [field]: newValue }
      
      // Auto-calculate total if material or labor changes
      if (field === 'material_cost' || field === 'labor_cost') {
        updated.total_cost = updated.material_cost + updated.labor_cost
      }
      return updated
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...item,
      ...form,
      // If user is manually saving, we assume they are resolving the issue
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
      <div className="panel" style={{ width: '100%', maxWidth: '500px' }}>
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
        </div>

        <form onSubmit={handleSubmit}>
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

          <label style={{ marginBottom: '1.5rem', display: 'block' }}>
            Total Cost ($)
            <input
              type="number"
              step="0.01"
              value={form.total_cost}
              onChange={(e) => setForm(prev => ({ ...prev, total_cost: parseFloat(e.target.value) || 0 }))}
              style={{ width: '100%', marginTop: '0.25rem', fontWeight: 'bold' }}
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
