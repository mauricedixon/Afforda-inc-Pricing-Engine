import * as XLSX from 'xlsx'
import { normalizeName } from './pricingEngine.js'

export function exportBOQToExcel({ project, lineItems }) {
  if (!project || !Array.isArray(lineItems)) {
    throw new Error('Project and line items are required for export')
  }

  // Calculate totals using divisor formula
  const hardCosts = lineItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
  const profitMargin = project.profit_margin ?? 0.2
  const bondRate = project.bond_rate ?? 0.03
  const totalMarkup = profitMargin + bondRate
  
  // Divisor formula: Grand Total = Hard Costs / (1 - Total Markup)
  const grandTotal = totalMarkup >= 1 ? hardCosts : hardCosts / (1 - totalMarkup)
  const bondTotal = grandTotal * bondRate
  const profitTotal = grandTotal * profitMargin

  const headers = [
    'Description',
    'Unit',
    'QTY',
    'Material Cost',
    'Labour Cost',
    'Total Cost',
    'Matched?',
  ]

  const rows = lineItems.map((item) => {
    return [
      item.description,
      item.unit,
      item.quantity,
      toCurrency(item.material_cost),
      toCurrency(item.labor_cost),
      toCurrency(item.total_cost),
      item.matched ? 'Yes' : 'Manual Review',
    ]
  })

  // Add summary section
  const summaryRows = [
    [],
    ['Summary'],
    ['Subtotal (Hard Costs)', '', '', '', '', toCurrency(hardCosts), ''],
    [`Bond (${Math.round(bondRate * 100)}%)`, '', '', '', '', toCurrency(bondTotal), ''],
    [`Profit (${Math.round(profitMargin * 100)}%)`, '', '', '', '', toCurrency(profitTotal), ''],
    ['Grand Total', '', '', '', '', toCurrency(grandTotal), ''],
  ]

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Project', project.project_name],
    [],
    headers,
    ...rows,
    ...summaryRows,
  ])
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

