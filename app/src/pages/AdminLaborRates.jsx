import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { parseCsvFile, validateColumns, safeNumber } from '../utils/csvParser.js'
import { isMockMode, mockDb } from '../mockData.js'

function AdminLaborRates() {
  const [existingRates, setExistingRates] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Search State
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [rateForm, setRateForm] = useState({
    trade: '',
    labor_type: '',
    hourly_cost: '',
    crew_size: 1,
    notes: '',
  })

  const refreshRates = async () => {
    if (isMockMode) {
      setExistingRates(mockDb.listLaborRates())
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('labor_rates')
      .select('*')
      .order('trade', { ascending: true })

    if (error) {
      setStatus(`Error loading labor rates: ${error.message}`)
    } else {
      setExistingRates(data ?? [])
      setStatus('')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshRates()
    }, 0)
    return () => clearTimeout(timeout)
  }, [])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const rows = await parseCsvFile(file)
      validateColumns(rows, ['trade', 'labor_type', 'hourly_cost'])
      setPreviewRows(
        rows
          .filter((row) => row.trade)
          .map((row) => ({
            trade: row.trade.trim(),
            labor_type: row.labor_type?.trim() ?? 'Prevailing Wage',
            hourly_cost: safeNumber(row.hourly_cost),
            crew_size: safeNumber(row.crew_size ?? 1, 1),
            notes: row.notes ?? null,
          })),
      )
      setStatus(`Loaded ${rows.length} rows from ${file.name}`)
    } catch (error) {
      setStatus(`Failed to parse file: ${error.message}`)
    }
  }

  const handleBulkSave = async () => {
    if (!previewRows.length) {
      setStatus('Upload a CSV before saving.')
      return
    }

    setIsSaving(true)

    if (isMockMode) {
      mockDb.upsertLaborRates(previewRows)
      setExistingRates(mockDb.listLaborRates())
      setPreviewRows([])
      setStatus('Labor rates updated (demo data).')
      setIsSaving(false)
      return
    }

    // Normalize trade and labor_type to lowercase to match unique index (lower(trade), lower(labor_type))
    const normalizedRows = previewRows.map((row) => ({
      ...row,
      trade: row.trade.toLowerCase(),
      labor_type: row.labor_type.toLowerCase(),
    }))
    
    // Handle upsert manually since unique index uses lower() function
    // Delete existing rows matching the normalized values, then insert
    const deletePromises = normalizedRows.map((row) =>
      supabase
        .from('labor_rates')
        .delete()
        .eq('trade', row.trade)
        .eq('labor_type', row.labor_type)
    )
    
    await Promise.all(deletePromises)
    
    const { error } = await supabase.from('labor_rates').insert(normalizedRows)
    setIsSaving(false)

    if (error) {
      setStatus(`Error saving data: ${error.message}`)
      return
    }

    setStatus('Labor rates updated successfully.')
    setPreviewRows([])
    await refreshRates()
  }

  // --- CRUD Logic ---

  const openAddModal = () => {
    setEditingId(null)
    setRateForm({
      trade: '',
      labor_type: '',
      hourly_cost: '',
      crew_size: 1,
      notes: '',
    })
    setIsModalOpen(true)
    setStatus('')
  }

  const openEditModal = (rate) => {
    setEditingId(rate.id)
    setRateForm({
      trade: rate.trade,
      labor_type: rate.labor_type,
      hourly_cost: rate.hourly_cost,
      crew_size: rate.crew_size ?? 1,
      notes: rate.notes ?? '',
    })
    setIsModalOpen(true)
    setStatus('')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rate?')) return

    if (isMockMode) {
      // mock delete not fully implemented in snippet, but usually handled
      setStatus('Delete not supported in mock mode for this view.')
      return
    }

    const { error } = await supabase.from('labor_rates').delete().eq('id', id)

    if (error) {
      setStatus(`Error deleting rate: ${error.message}`)
    } else {
      setStatus('Rate deleted.')
      refreshRates()
    }
  }

  const handleSaveRate = async () => {
    if (!rateForm.trade || !rateForm.labor_type || !rateForm.hourly_cost) {
      alert('Trade, Labor Type, and Hourly Cost are required.')
      return
    }

    setIsSaving(true)

    const payload = {
      trade: rateForm.trade,
      labor_type: rateForm.labor_type,
      hourly_cost: Number(rateForm.hourly_cost),
      crew_size: Number(rateForm.crew_size),
      notes: rateForm.notes,
    }

    if (isMockMode) {
      setStatus('Save not supported in mock mode for single entry.')
      setIsSaving(false)
      setIsModalOpen(false)
      return
    }

    let error = null

    if (editingId) {
      // Update
      const { error: updateError } = await supabase
        .from('labor_rates')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      // Insert
      const { error: insertError } = await supabase.from('labor_rates').insert([payload])
      error = insertError
    }

    setIsSaving(false)

    if (error) {
      if (error.code === '23505') {
        setStatus('Error: This Trade/Labor Type combination already exists.')
      } else {
        setStatus(`Error saving rate: ${error.message}`)
      }
      return
    }

    setStatus(editingId ? 'Rate updated.' : 'Rate added.')
    setIsModalOpen(false)
    refreshRates()
  }

  const filteredRates = useMemo(() => {
    if (!searchQuery) return existingRates
    const lowerQ = searchQuery.toLowerCase()
    return existingRates.filter(
      (r) =>
        r.trade.toLowerCase().includes(lowerQ) ||
        r.labor_type.toLowerCase().includes(lowerQ)
    )
  }, [existingRates, searchQuery])

  return (
    <div>
      <header>
        <p className="eyebrow">Admin</p>
        <h1>Labor Rates</h1>
        <p className="lede">
          Upload the consolidated spreadsheet once to keep the pricing engine aligned with the latest
          trade rates.
        </p>
      </header>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Upload CSV</h2>
        {isMockMode && (
          <p className="helper-text">
            Demo mode enabled. Uploads stay in-memory so you can experiment safely.
          </p>
        )}
        <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
        <p className="helper-text">
          Expected columns: <code>Trade</code>, <code>Labor_Type</code>, <code>Hourly_Cost</code>,
          optional <code>Crew_Size</code>, <code>Notes</code>
        </p>
        <button className="button" disabled={isSaving} onClick={handleBulkSave}>
          {isSaving ? 'Saving…' : 'Save to database'}
        </button>
        {status && <p style={{ marginTop: '0.5rem' }}>{status}</p>}
      </section>

      {previewRows.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h3>Preview ({previewRows.length} rows)</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Labor Type</th>
                  <th>Hourly Cost</th>
                  <th>Crew Size</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.trade}-${index}`}>
                    <td>{row.trade}</td>
                    <td>{row.labor_type}</td>
                    <td>${row.hourly_cost.toFixed(2)}</td>
                    <td>{row.crew_size}</td>
                    <td>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3>Current Rates</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Search Trade or Type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button className="button" onClick={openAddModal}>
              Add Rate
            </button>
          </div>
        </div>

        {isLoading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Labor Type</th>
                  <th>Hourly Cost</th>
                  <th>Crew Size</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{rate.trade}</td>
                    <td>{rate.labor_type}</td>
                    <td>${safeNumber(rate.hourly_cost).toFixed(2)}</td>
                    <td>{rate.crew_size ?? 1}</td>
                    <td>{new Date(rate.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEditModal(rate)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rate.id)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isModalOpen && (
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
          <div className="panel" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>{editingId ? 'Edit Rate' : 'Add Rate'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label>
                Trade
                <input
                  type="text"
                  value={rateForm.trade}
                  onChange={(e) => setRateForm({ ...rateForm, trade: e.target.value })}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              <label>
                Labor Type
                <input
                  type="text"
                  value={rateForm.labor_type}
                  onChange={(e) => setRateForm({ ...rateForm, labor_type: e.target.value })}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label>
                  Hourly Cost ($)
                  <input
                    type="number"
                    step="0.01"
                    value={rateForm.hourly_cost}
                    onChange={(e) => setRateForm({ ...rateForm, hourly_cost: e.target.value })}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  Crew Size
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={rateForm.crew_size}
                    onChange={(e) => setRateForm({ ...rateForm, crew_size: e.target.value })}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  rows="3"
                  value={rateForm.notes}
                  onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  className="button"
                  style={{ background: '#64748b' }}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button className="button" onClick={handleSaveRate} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminLaborRates
