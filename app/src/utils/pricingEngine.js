import { supabase } from '../services/supabaseClient.js'
import { safeNumber } from './csvParser.js'

export const normalizeName = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .replace(/[,/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const UNIT_TO_HOURS = {
  lf: 0.05, // 20 lf / hour
  sf: 0.08, // 12.5 sf / hour
  ea: 0.75,
  ls: 6,
}

const defaultHoursMultiplier = 1

const estimateLaborHours = (unit = 'ea', quantity = 1) => {
  const multiplier = UNIT_TO_HOURS[unit.toLowerCase()] ?? defaultHoursMultiplier
  return quantity * multiplier
}

export const buildMaterialIndex = (materials = []) => {
  const map = new Map()
  for (const material of materials) {
    map.set(material.search_name ?? normalizeName(material.item_name), material)
  }
  return map
}

export const buildLaborIndex = (laborRates = []) => {
  const map = new Map()

  for (const rate of laborRates) {
    const key = `${normalizeName(rate.trade)}|${normalizeName(rate.labor_type)}`
    map.set(key, rate)
  }

  return map
}

const determineLaborRate = (laborIndex, itemName, laborType) => {
  const primary = laborIndex.get(`${itemName}|${laborType}`)
  if (primary) return primary

  for (const [key, value] of laborIndex.entries()) {
    const [tradeKey, typeKey] = key.split('|')
    if (typeKey === laborType && (itemName.includes(tradeKey) || tradeKey.includes(itemName))) {
      return value
    }
  }

  return laborIndex.get(`default|${laborType}`) ?? laborIndex.get(`${itemName}|default`)
}

const findMaterial = (materialIndex, searchName) => {
  if (materialIndex.has(searchName)) {
    return materialIndex.get(searchName)
  }
  for (const [key, value] of materialIndex.entries()) {
    if (searchName.includes(key) || key.includes(searchName)) {
      return value
    }
  }
  return null
}

export function calculateLineItem({
  row,
  lineNumber,
  materialIndex,
  laborIndex,
  defaultLaborType = 'prevailing wage',
}) {
  const description = row.description ?? row.item_name ?? ''
  const searchName = normalizeName(row.item_name ?? description)
  const unit = row.unit ?? 'EA'
  const quantity = safeNumber(row.qty ?? row.quantity ?? row.length ?? 0, 0)

  const material = findMaterial(materialIndex, searchName)
  const laborType = normalizeName(row.labor_type ?? defaultLaborType)
  const labor = determineLaborRate(laborIndex, searchName, laborType)

  const materialCost = material ? safeNumber(material.cost_per_unit, 0) * quantity : null
  const laborHours = estimateLaborHours(unit, quantity)
  const hourlyRate = labor ? safeNumber(labor.hourly_cost, 0) * (labor.crew_size ?? 1) : null
  const laborCost = hourlyRate != null ? hourlyRate * laborHours : null

  const totalCost = (materialCost ?? 0) + (laborCost ?? 0)
  const warnings = []

  if (!material) warnings.push('material_not_found')
  if (!labor) warnings.push('labor_not_found')

  return {
    line_number: lineNumber,
    description,
    item_name: row.item_name ?? description,
    search_name: searchName,
    unit,
    quantity,
    material_price_id: material?.id ?? null,
    labor_rate_id: labor?.id ?? null,
    material_cost: materialCost,
    labor_cost: laborCost,
    total_cost: totalCost,
    matched: warnings.length === 0,
    warnings,
  }
}

export const processRows = (rows, materialIndex, laborIndex) =>
  rows.map((row, index) =>
    calculateLineItem({
      row,
      lineNumber: index + 1,
      materialIndex,
      laborIndex,
    }),
  )

export async function runPricingEngine({ projectId, rows }) {
  const [{ data: materials, error: materialError }, { data: laborRates, error: laborError }] =
    await Promise.all([
      supabase.from('material_prices').select('*'),
      supabase.from('labor_rates').select('*'),
    ])

  if (materialError) throw materialError
  if (laborError) throw laborError

  const materialIndex = buildMaterialIndex(materials)
  const laborIndex = buildLaborIndex(laborRates)

  const lineItems = processRows(rows, materialIndex, laborIndex)

  const payload = lineItems.map((item) => ({
    project_id: projectId,
    line_number: item.line_number,
    description: item.description,
    item_name: item.item_name,
    search_name: item.search_name,
    unit: item.unit,
    quantity: item.quantity,
    material_price_id: item.material_price_id,
    labor_rate_id: item.labor_rate_id,
    material_cost: item.material_cost,
    labor_cost: item.labor_cost,
    total_cost: item.total_cost,
    matched: item.matched,
    warnings: item.warnings,
  }))

  await supabase.from('project_line_items').delete().eq('project_id', projectId)

  const chunkSize = 500
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from('project_line_items').insert(chunk)
    if (error) throw error
  }

  return lineItems
}

export function calculateGrandTotal({ lineItems = [], profitMargin = 0.2, bondRate = 0.03 }) {
  const hardCosts = lineItems.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
  const material = lineItems.reduce((sum, item) => sum + (item.material_cost ?? 0), 0)
  const labor = lineItems.reduce((sum, item) => sum + (item.labor_cost ?? 0), 0)
  
  const totalMarkup = profitMargin + bondRate

  // Divisor formula: Grand Total = Hard Costs / (1 - Total Markup)
  const grandTotal = totalMarkup >= 1 ? hardCosts : hardCosts / (1 - totalMarkup)
  const bondTotal = grandTotal * bondRate
  const profitTotal = grandTotal * profitMargin

  return {
    hardCosts,
    material,
    labor,
    bond: bondTotal,
    profit: profitTotal,
    grandTotal,
  }
}
