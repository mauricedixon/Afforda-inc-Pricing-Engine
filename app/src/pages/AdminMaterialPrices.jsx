import { useEffect, useState, useMemo } from 'react'
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

  // Search State
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [materialForm, setMaterialForm] = useState({
    item_name: '',
    unit: '',
    cost_per_unit: '',
    vendor: '',
    full_description: '',
  })

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
      const rows = await parseCsvFile(file, {
        detectHeader: true,
        requiredHeaders: ['item_name', 'unit', 'cost_per_unit'],
        customAliases: {
          item_name: ['item_name', 'item', 'name', 'material', 'description', 'product', 'item name'],
          unit: ['unit', 'uom', 'units'],
          cost_per_unit: [
            'cost_per_unit',
            'cost',
            'price',
            'unit_price',
            'rate',
            'material_cost',
            'cost per unit',
            'unit cost',
          ],
          vendor: ['vendor', 'supplier', 'source'],
          full_description: ['full_description', 'details', 'notes', 'full description'],
        },
      })
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

  const handleBulkSave = async () => {
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

  // --- CRUD Logic ---

  const openAddModal = () => {
    setEditingId(null)
    setMaterialForm({
      item_name: '',
      unit: 'EA',
      cost_per_unit: '',
      vendor: '',
      full_description: '',
    })
    setIsModalOpen(true)
    setStatus('')
  }

  const openEditModal = (item) => {
    setEditingId(item.id)
    setMaterialForm({
      item_name: item.item_name,
      unit: item.unit,
      cost_per_unit: item.cost_per_unit,
      vendor: item.vendor ?? '',
      full_description: item.full_description ?? '',
    })
    setIsModalOpen(true)
    setStatus('')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return

    if (isMockMode) {
      setStatus('Delete not supported in mock mode.')
      return
    }

    const { error } = await supabase.from('material_prices').delete().eq('id', id)

    if (error) {
      setStatus(`Error deleting material: ${error.message}`)
    } else {
      setStatus('Material deleted.')
      refreshMaterials()
    }
  }

  const handleSaveMaterial = async () => {
    if (!materialForm.item_name || !materialForm.unit || !materialForm.cost_per_unit) {
      alert('Item Name, Unit, and Cost are required.')
      return
    }

    setIsSaving(true)

    const searchName = normalizeName(materialForm.item_name)
    const payload = {
      item_name: materialForm.item_name,
      search_name: searchName,
      unit: materialForm.unit,
      cost_per_unit: Number(materialForm.cost_per_unit),
      vendor: materialForm.vendor || null,
      full_description: materialForm.full_description || null,
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
        .from('material_prices')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      // Insert
      const { error: insertError } = await supabase.from('material_prices').insert([payload])
      error = insertError
    }

    setIsSaving(false)

    if (error) {
      if (error.code === '23505') {
        setStatus('Error: A material with this name (search key) already exists.')
      } else {
        setStatus(`Error saving material: ${error.message}`)
      }
      return
    }

    setStatus(editingId ? 'Material updated.' : 'Material added.')
    setIsModalOpen(false)
    refreshMaterials()
  }

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return materials
    const lowerQ = searchQuery.toLowerCase()
    return materials.filter(
      (m) =>
        m.item_name.toLowerCase().includes(lowerQ) ||
        (m.vendor && m.vendor.toLowerCase().includes(lowerQ))
    )
  }, [materials, searchQuery])

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
        <h2>Upload Excel/ CSV</h2>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3>Current Materials</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Search Item or Vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button className="button" onClick={openAddModal}>
              Add Material
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
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Cost / Unit</th>
                  <th>Vendor</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material) => (
                  <tr key={material.id}>
                    <td>{material.item_name}</td>
                    <td>{material.unit}</td>
                    <td>${safeNumber(material.cost_per_unit).toFixed(2)}</td>
                    <td>{material.vendor ?? '—'}</td>
                    <td>{new Date(material.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEditModal(material)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(material.id)}
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
            <h2>{editingId ? 'Edit Material' : 'Add Material'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label>
                Item Name
                <input
                  type="text"
                  value={materialForm.item_name}
                  onChange={(e) => setMaterialForm({ ...materialForm, item_name: e.target.value })}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label>
                  Unit
                  <input
                    type="text"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  Cost / Unit ($)
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.cost_per_unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, cost_per_unit: e.target.value })}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
              <label>
                Vendor
                <input
                  type="text"
                  value={materialForm.vendor}
                  onChange={(e) => setMaterialForm({ ...materialForm, vendor: e.target.value })}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </label>
              <label>
                Full Description
                <textarea
                  rows="3"
                  value={materialForm.full_description}
                  onChange={(e) => setMaterialForm({ ...materialForm, full_description: e.target.value })}
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
                <button className="button" onClick={handleSaveMaterial} disabled={isSaving}>
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

export default AdminMaterialPrices
