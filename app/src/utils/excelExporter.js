import * as XLSX from 'xlsx'
import { normalizeName } from './pricingEngine.js'

export function exportBOQToExcel({ project, lineItems }) {
  if (!project || !Array.isArray(lineItems)) {
    throw new Error('Project and line items are required for export')
  }

  const headers = [
    'Description',
    'Unit',
    'QTY',
    'Material Cost',
    'Labour Cost',
    'Total Cost',
    `${Math.round((project.profit_margin ?? 0.2) * 100)}% Profit`,
    'Matched?',
  ]

  const rows = lineItems.map((item) => {
    const profit = item.total_cost * (project.profit_margin ?? 0.2)
    return [
      item.description,
      item.unit,
      item.quantity,
      toCurrency(item.material_cost),
      toCurrency(item.labor_cost),
      toCurrency(item.total_cost),
      toCurrency(profit),
      item.matched ? 'Yes' : 'Manual Review',
    ]
  })

  const sheet = XLSX.utils.aoa_to_sheet([['Project', project.project_name], headers, ...rows])
  autoFitColumns(sheet, headers.length)

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'BOQ')

  const filename = `${normalizeName(project.project_name || 'afforda_pricing')}_BOQ.xlsx`
  XLSX.writeFile(workbook, filename)
}

const toCurrency = (value) =>
  value == null ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

function autoFitColumns(sheet, columnCount) {
  const colWidths = Array.from({ length: columnCount }, () => ({ wch: 12 }))
  const range = XLSX.utils.decode_range(sheet['!ref'])

  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 12
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = sheet[cellAddress]
      if (!cell) continue
      const cellValue = cell.v?.toString() ?? ''
      maxWidth = Math.max(maxWidth, cellValue.length + 2)
    }
    colWidths[C] = { wch: maxWidth }
  }

  sheet['!cols'] = colWidths
}

