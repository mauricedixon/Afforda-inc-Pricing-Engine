/* eslint-env node */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsvText } from '../src/utils/csvParser.js'
import { buildLaborIndex, buildMaterialIndex, calculateLineItem, normalizeName } from '../src/utils/pricingEngine.js'
import { exportBOQToExcel } from '../src/utils/excelExporter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const readSample = async (fileName) => {
  const fullPath = path.join(root, 'public', 'samples', fileName)
  const raw = await fs.readFile(fullPath, 'utf8')
  return parseCsvText(raw, { header: true })
}

const enrichMaterial = (rows) =>
  rows.map((row, index) => ({
    id: `material-${index}`,
    item_name: row.item_name,
    search_name: normalizeName(row.item_name),
    unit: row.unit,
    cost_per_unit: Number(row.cost_per_unit),
    vendor: row.vendor ?? null,
  }))

const enrichLabor = (rows) =>
  rows.map((row, index) => ({
    id: `labor-${index}`,
    trade: row.trade,
    labor_type: row.labor_type,
    hourly_cost: Number(row.hourly_cost),
    crew_size: Number(row.crew_size ?? 1),
  }))

const run = async () => {
  const [materialCsv, laborCsv, boqCsv] = await Promise.all([
    readSample('material_prices_sample.csv'),
    readSample('labor_rates_sample.csv'),
    readSample('boq_sample.csv'),
  ])

  const materialIndex = buildMaterialIndex(enrichMaterial(materialCsv))
  const laborIndex = buildLaborIndex(enrichLabor(laborCsv))

  const lineItems = boqCsv.map((row, idx) =>
    calculateLineItem({
      row: {
        description: row.description,
        unit: row.unit,
        qty: row.qty,
        labor_type: row.labor_type,
      },
      lineNumber: idx + 1,
      materialIndex,
      laborIndex,
    }),
  )

  const subtotal = lineItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
  const project = {
    project_name: 'Sample Workflow Test',
    profit_margin: 0.2,
  }

  console.log('Calculated subtotal:', subtotal.toFixed(2))
  console.log('Matched rows:', lineItems.filter((item) => item.matched).length)

  exportBOQToExcel({ project, lineItems })
  console.log('Excel file generated in project root')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
