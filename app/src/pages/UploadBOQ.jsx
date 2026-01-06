import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import { parseCsvFile, validateColumns, safeNumber } from '../utils/csvParser.js'
import { runPricingEngine, buildLaborIndex, buildMaterialIndex, processRows, calculateGrandTotal } from '../utils/pricingEngine.js'
import { getLatestProjectId, saveLatestProjectId } from '../utils/storage.js'
import { isMockMode, mockDb, mockSamples } from '../mockData.js'

function UploadBOQ({ useLatestProject = false }) {
  const params = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fallbackProjectId = isMockMode ? mockSamples.projectId : null
  const projectId = useMemo(() => {
    const sourceId = useLatestProject ? getLatestProjectId() : params.projectId
    return sourceId ?? fallbackProjectId
  }, [params.projectId, useLatestProject, fallbackProjectId])

  useEffect(() => {
    if (!projectId) {
      setStatus('No project selected. Create a project first.')
      setIsLoading(false)
      return
    }

    fetchProject(projectId)
  }, [projectId])

  async function fetchProject(id) {
    setIsLoading(true)

    if (isMockMode) {
      const data = mockDb.getProjectById(id)
      setIsLoading(false)
      if (!data) {
        setStatus('Demo project not found.')
        return
      }
      setProject(data)
      saveLatestProjectId(id)
      return
    }

    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
    setIsLoading(false)

    if (error) {
      setStatus(`Error loading project: ${error.message}`)
      return
    }

    setProject(data)
    saveLatestProjectId(id)
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = await parseCsvFile(file, {
        detectHeader: true,
        requiredHeaders: ['description', 'unit', 'qty'],
        customAliases: {
          description: ['description', 'detail', 'item', 'scope'],
          unit: ['unit', 'units'],
          qty: ['qty', 'quantity', 'qty_', 'qty__', 'qty.'],
          labor_type: ['labor_type', 'labour_type', 'labor', 'labor type', 'labour type'],
          unit_price: ['unit_price', 'unit_rate', 'unit_cost'],
          material_amount: ['material', 'material_cost', 'material_amount'],
          labour_amount: ['labour', 'labor', 'labour_cost'],
          total_price: ['total_price', 'total'],
        },
      })
      const adapted = parsed.map((row) => ({
        ...row,
        description: row.description ?? row.item ?? row.item_name ?? row.detail ?? row.scope ?? '',
        unit: row.unit ?? row.units ?? '',
        qty: row.qty ?? row.quantity ?? row.length ?? row.qty_ ?? row.qty__ ?? '',
      }))
      validateColumns(adapted, ['description', 'unit', 'qty'])

      const normalized = adapted
        .filter((row) => row.description)
        .map((row) => ({
          description: row.description,
          unit: row.unit ?? 'EA',
          qty: safeNumber(row.qty ?? row.quantity ?? row.length ?? 0),
          labor_type: row.labor_type,
          item_name: row.item_name ?? row.description,
          material_cost: safeNumber(row.material_amount, null),
          labor_cost: safeNumber(row.labour_amount, null),
          total_cost: safeNumber(row.total_price, null),
        }))
      setRows(normalized)
      setStatus(`Loaded ${normalized.length} rows from ${file.name}`)
    } catch (error) {
      setStatus(`Failed to parse file: ${error.message}`)
    }
  }

  const handleCalculate = async () => {
    if (!projectId) {
      setStatus('Create a project before uploading a BOQ.')
      return
    }

    if (!rows.length) {
      setStatus('Upload a BOQ before calculating.')
      return
    }

    try {
      setIsCalculating(true)

      if (isMockMode) {
        const materials = mockDb.listMaterialPrices()
        const laborRates = mockDb.listLaborRates()
        const materialIndex = buildMaterialIndex(materials)
        const laborIndex = buildLaborIndex(laborRates)
        
        // Pass project labor type as default
        const defaultLaborType = project.labor_type ?? 'Prevailing Wage'
        const lineItems = processRows(rows, materialIndex, laborIndex, defaultLaborType)
        
        mockDb.saveProjectLineItems(projectId, lineItems)

        // Calculate and save initial total
        const profitMargin = Number(project.profit_margin ?? 0.2)
        const bondRate = Number(project.bond_rate ?? 0.03)
        const generalRequirements = Number(project.general_requirements ?? 0)

        const { grandTotal } = calculateGrandTotal({
          lineItems,
          profitMargin,
          bondRate,
          generalRequirements,
        })

        const finalTotal = Number.isFinite(grandTotal) ? grandTotal : 0
        mockDb.updateProject(projectId, { total_value: finalTotal })

        navigate(`/pricing/project/${projectId}/review`)
      } else {
        // Pass project labor type as default
        const defaultLaborType = project.labor_type ?? 'Prevailing Wage'
        const lineItems = await runPricingEngine({ projectId, rows, defaultLaborType })

        // Calculate and save initial total
        const profitMargin = Number(project.profit_margin ?? 0.2)
        const bondRate = Number(project.bond_rate ?? 0.03)
        const generalRequirements = Number(project.general_requirements ?? 0)

        const { grandTotal } = calculateGrandTotal({
          lineItems,
          profitMargin,
          bondRate,
          generalRequirements,
        })

        const finalTotal = Number.isFinite(grandTotal) ? grandTotal : 0

        const { error: updateError } = await supabase
          .from('projects')
          .update({ total_value: finalTotal })
          .eq('id', projectId)

        if (updateError) {
          throw new Error(`Failed to update project total: ${updateError.message}`)
        }

        navigate(`/pricing/project/${projectId}/review`)
      }
    } catch (error) {
      setStatus(`Calculation failed: ${error.message}`)
    } finally {
      setIsCalculating(false)
    }
  }

  if (isLoading) {
    return <p>Loading project…</p>
  }

  if (!projectId) {
    return (
      <div>
        <h1>No project selected</h1>
        <p>Create a project before uploading a BOQ.</p>
      </div>
    )
  }

  return (
    <div>
      <header>
        <p className="eyebrow">Pricing Workflow</p>
        <h1>Upload BOQ</h1>
        {project && <p className="lede">Project: {project.project_name}</p>}
      </header>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Upload Excel/ CSV</h2>
        <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
        <p className="helper-text">
          Required columns: <code>Description</code>, <code>Unit</code>, <code>Qty</code>. Optional{' '}
          <code>Labor_Type</code>. Download the sample{' '}
          <a href="/samples/boq_sample.csv" target="_blank" rel="noreferrer">
            BOQ CSV template
          </a>
          .
        </p>
        {isMockMode && (
          <button
            type="button"
            className="pill-link"
            onClick={() => {
              setRows(mockSamples.boqRows)
              setStatus('Loaded sample BOQ rows.')
            }}
          >
            Load sample BOQ
          </button>
        )}
        <button className="button" disabled={isCalculating} onClick={handleCalculate}>
          {isCalculating ? 'Calculating…' : 'Calculate bid'}
        </button>
        {status && <p>{status}</p>}
      </section>

      {rows.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h3>Preview ({rows.length} rows)</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Labor Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.description}-${index}`}>
                    <td>{row.description}</td>
                    <td>{row.unit}</td>
                    <td>{row.qty}</td>
                    <td>{row.labor_type ?? 'Default'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default UploadBOQ

