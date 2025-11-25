import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { parseCsvFile, validateColumns, safeNumber } from '../utils/csvParser.js'
import { isMockMode, mockDb } from '../mockData.js'

function AdminLaborRates() {
  const [existingRates, setExistingRates] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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

  const handleSave = async () => {
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
        <button className="button" disabled={isSaving} onClick={handleSave}>
          {isSaving ? 'Saving…' : 'Save to database'}
        </button>
        {status && <p>{status}</p>}
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
        <h3>Current Rates</h3>
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
                </tr>
              </thead>
              <tbody>
                {existingRates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{rate.trade}</td>
                    <td>{rate.labor_type}</td>
                    <td>${safeNumber(rate.hourly_cost).toFixed(2)}</td>
                    <td>{rate.crew_size ?? 1}</td>
                    <td>{new Date(rate.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminLaborRates

