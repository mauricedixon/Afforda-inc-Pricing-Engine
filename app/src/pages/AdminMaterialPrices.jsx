import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient.js'
import { parseCsvFile, validateColumns, safeNumber } from '../utils/csvParser.js'
import { normalizeName } from '../utils/pricingEngine.js'
import { isMockMode, mockDb } from '../mockData.js'

function AdminMaterialPrices() {
  const [materials, setMaterials] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const refreshMaterials = async () => {
    if (isMockMode) {
      setMaterials(mockDb.listMaterialPrices())
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('material_prices')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      setStatus(`Error loading materials: ${error.message}`)
    } else {
      setMaterials(data ?? [])
      setStatus('')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshMaterials()
    }, 0)
    return () => clearTimeout(timeout)
  }, [])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const rows = await parseCsvFile(file)
      validateColumns(rows, ['item_name', 'unit', 'cost_per_unit'])
      setPreviewRows(
        rows
          .filter((row) => row.item_name)
          .map((row) => ({
            item_name: row.item_name.trim(),
            search_name: normalizeName(row.item_name),
            unit: row.unit ?? 'EA',
            full_description: row.full_description ?? row.item_name,
            cost_per_unit: safeNumber(row.cost_per_unit),
            vendor: row.vendor ?? null,
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
      mockDb.upsertMaterialPrices(previewRows)
      setMaterials(mockDb.listMaterialPrices())
      setPreviewRows([])
      setStatus('Material prices updated (demo data).')
      setIsSaving(false)
      return
    }
    const { error } = await supabase.from('material_prices').upsert(previewRows, {
      onConflict: 'search_name',
    })
    setIsSaving(false)

    if (error) {
      setStatus(`Error saving data: ${error.message}`)
      return
    }

    setStatus('Material prices updated successfully.')
    setPreviewRows([])
    await refreshMaterials()
  }

  return (
    <div>
      <header>
        <p className="eyebrow">Admin</p>
        <h1>Material Prices</h1>
        <p className="lede">
          Keep every vendor price list centralized so BOQ calculations are grounded in the latest
          costs.
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
          Expected columns: <code>Item_Name</code>, <code>Unit</code>, <code>Cost_Per_Unit</code>,
          optional <code>Full_Description</code>, <code>Vendor</code>
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
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Cost / Unit</th>
                  <th>Vendor</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.item_name}-${index}`}>
                    <td>{row.item_name}</td>
                    <td>{row.unit}</td>
                    <td>${row.cost_per_unit.toFixed(2)}</td>
                    <td>{row.vendor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section style={{ marginTop: '2.5rem' }}>
        <h3>Current Materials</h3>
        {isLoading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Cost / Unit</th>
                  <th>Vendor</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td>{material.item_name}</td>
                    <td>{material.unit}</td>
                    <td>${safeNumber(material.cost_per_unit).toFixed(2)}</td>
                    <td>{material.vendor ?? '—'}</td>
                    <td>{new Date(material.updated_at).toLocaleDateString()}</td>
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

export default AdminMaterialPrices

