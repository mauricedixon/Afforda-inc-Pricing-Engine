import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const normalizeHeader = (header) =>
  header
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^\w]+/g, '_')

const HEADER_ALIASES = {
  item_name: ['item_name', 'item', 'description', 'detail'],
  unit: ['unit', 'units'],
  qty: ['qty', 'quantity', 'qty_', 'qty__'],
  labor_type: ['labor_type', 'labour_type', 'labor'],
  cost_per_unit: ['cost_per_unit', 'unit_price', 'cost_unit', 'unit_cost'],
  full_description: ['full_description', 'notes'],
  vendor: ['vendor', 'supplier'],
  unit_price: ['unit_price', 'unit_rate', 'unit_cost'],
  material_amount: ['material', 'material_cost', 'material_amount', 'material_total'],
  labour_amount: ['labour', 'labor', 'labour_cost', 'labour_total'],
  total_price: ['total_price', 'total', 'amount'],
  profit_amount: ['profit', '20%_profit', 'markup'],
}

export const normalizeRow = (row, customAliases = {}) => {
  const aliasEntries = [
    ...Object.entries(customAliases),
    ...Object.entries(HEADER_ALIASES),
  ]
  const mapped = {}
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key)
    const target = aliasEntries.find(([, aliases]) => aliases.includes(normalizedKey))
    const finalKey = target ? target[0] : normalizedKey
    if (finalKey) {
      mapped[finalKey] = value
    }
  })
  return mapped
}

const buildAliasMap = (customAliases = {}) => {
  const customEntries = Object.entries(customAliases).map(([key, aliases]) => [
    key,
    aliases.map((alias) => normalizeHeader(alias)),
  ])
  const aliasMap = {}
  customEntries.forEach(([key, normalizedAliases]) => {
    aliasMap[key] = normalizedAliases
  })
  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    if (aliasMap[key]) return
    aliasMap[key] = aliases.map((alias) => normalizeHeader(alias))
  })
  return aliasMap
}

const findHeaderInfo = (rows, aliasMap, requiredHeaders = []) => {
  const required = requiredHeaders.map((header) => normalizeHeader(header))
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!Array.isArray(row)) continue
    const headerMap = {}
    row.forEach((cell, colIdx) => {
      const normalized = normalizeHeader(cell)
      if (!normalized) return
      const match = Object.entries(aliasMap).find(([, aliases]) => aliases.includes(normalized))
      headerMap[colIdx] = match ? match[0] : normalized
    })
    if (!Object.keys(headerMap).length) continue
    const headerValues = Object.values(headerMap)
    const hasRequired = required.length === 0 || required.every((req) => headerValues.includes(req))
    if (hasRequired) {
      return { index, headerMap }
    }
  }
  return null
}

const recordsFromMatrix = (rows, headerInfo) => {
  if (!headerInfo) return []
  const dataRows = rows.slice(headerInfo.index + 1)
  return dataRows
    .map((row) => {
      if (!Array.isArray(row)) return null
      const record = {}
      let hasData = false
      Object.entries(headerInfo.headerMap).forEach(([colIndex, key]) => {
        const value = row[colIndex]
        if (value !== undefined && value !== null && value !== '') {
          record[key] = value
          hasData = true
        }
      })
      return hasData ? record : null
    })
    .filter(Boolean)
}

export function parseCsvText(text, { header = true, skipEmptyLines = true, transform } = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header,
      skipEmptyLines,
      transformHeader: normalizeHeader,
      complete: (result) => {
        if (result.errors?.length) {
          reject(result.errors[0])
          return
        }

        const data = transform ? result.data.map(transform) : result.data
        resolve(data)
      },
      error: reject,
    })
  })
}

export function parseCsvFile(file, options = {}) {
  const {
    detectHeader = false,
    requiredHeaders = [],
    customAliases = {},
  } = options
  const aliasMap = buildAliasMap(customAliases)
  const normalizeRecords = (records) => records.map((row) => normalizeRow(row, customAliases))

  return new Promise((resolve, reject) => {
    const extension = file.name?.split('.').pop()?.toLowerCase()
    if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target?.result, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          if (detectHeader) {
            const matrix = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: '',
              raw: false,
            })
            const headerInfo = findHeaderInfo(matrix, aliasMap, requiredHeaders)
            if (!headerInfo) {
              reject(
                new Error(
                  `Could not locate headers: ${requiredHeaders.join(', ') || 'required columns'}`,
                ),
              )
              return
            }
            resolve(normalizeRecords(recordsFromMatrix(matrix, headerInfo)))
          } else {
            const json = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
              header: 0,
              raw: false,
            })
            resolve(normalizeRecords(json))
          }
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
      return
    }

    Papa.parse(file, {
      header: !detectHeader,
      skipEmptyLines: true,
      transformHeader: detectHeader ? undefined : normalizeHeader,
      complete: (result) => {
        if (result.errors?.length) {
          reject(result.errors[0])
          return
        }
        if (detectHeader) {
          const matrix = result.data
          const headerInfo = findHeaderInfo(matrix, aliasMap, requiredHeaders)
          if (!headerInfo) {
            reject(
              new Error(
                `Could not locate headers: ${requiredHeaders.join(', ') || 'required columns'}`,
              ),
            )
            return
          }
          resolve(normalizeRecords(recordsFromMatrix(matrix, headerInfo)))
        } else {
          resolve(
            normalizeRecords(
              result.data.map((row) => {
                const normalizedRow = {}
                Object.entries(row).forEach(([key, value]) => {
                  normalizedRow[key] = value
                })
                return normalizedRow
              }),
            ),
          )
        }
      },
      error: reject,
    })
  })
}

export function validateColumns(rows, requiredColumns) {
  const missing = requiredColumns.filter((column) => rows[0]?.[column] === undefined)
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`)
  }
}

export const safeNumber = (value, fallback = 0) => {
  if (typeof value === 'string') {
    value = value.replace(/[$,\s]/g, '')
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

