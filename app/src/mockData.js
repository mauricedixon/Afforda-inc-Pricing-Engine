export const isMockMode =
  (import.meta.env.VITE_USE_MOCK_DATA ?? '').toString().toLowerCase() === 'true'

const SAMPLE_PROJECT_ID = 'demo-project-001'

const sampleLaborRates = [
  {
    id: 'labor-1',
    trade: 'Carpenter',
    labor_type: 'Prevailing Wage',
    hourly_cost: 78,
    crew_size: 3,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'labor-2',
    trade: 'Flooring Installer',
    labor_type: 'Prevailing Wage',
    hourly_cost: 72,
    crew_size: 2,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'labor-3',
    trade: 'Masonry',
    labor_type: 'Union',
    hourly_cost: 85,
    crew_size: 3,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'labor-4',
    trade: 'General Labor',
    labor_type: 'Private',
    hourly_cost: 48,
    crew_size: 1,
    updated_at: new Date().toISOString(),
  },
]

const sampleMaterialPrices = [
  {
    id: 'material-1',
    item_name: 'Vinyl Base at Wall',
    search_name: 'vinyl base at wall',
    unit: 'LF',
    cost_per_unit: 2.6,
    vendor: 'FloorCo',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'material-2',
    item_name: 'LVT Flooring',
    search_name: 'lvt flooring',
    unit: 'SF',
    cost_per_unit: 12.4,
    vendor: 'FloorCo',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'material-3',
    item_name: 'Transition Strip',
    search_name: 'transition strip',
    unit: 'LF',
    cost_per_unit: 5.5,
    vendor: 'Hardware Hub',
    updated_at: new Date().toISOString(),
  },
]

const sampleBOQRows = [
  {
    description: 'Vinyl Base at Walls',
    unit: 'LF',
    qty: 517,
    labor_type: 'Prevailing Wage',
  },
  {
    description: 'Vinyl Base Replacement',
    unit: 'LF',
    qty: 287,
    labor_type: 'Prevailing Wage',
  },
  {
    description: 'LVT Flooring',
    unit: 'SF',
    qty: 3352,
    labor_type: 'Prevailing Wage',
  },
  {
    description: 'Transition Strips',
    unit: 'LF',
    qty: 45,
    labor_type: 'Private',
  },
]

// Generate past dates for history testing
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const generateMockProjects = () => {
  const statuses = ['draft', 'review', 'approved', 'rejected']
  const projects = []
  
  // Create 15 past projects
  for (let i = 0; i < 15; i++) {
    const days = Math.floor(Math.random() * 45) // Past 45 days
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const value = 15000 + Math.floor(Math.random() * 85000) // 15k - 100k
    
    projects.push({
      id: `mock-hist-${i}`,
      project_name: `Project ${String(i + 1).padStart(3, '0')} - ${status.toUpperCase()}`,
      profit_margin: 0.2,
      bond_rate: 0.03,
      general_requirements: Math.floor(Math.random() * 5000),
      status,
      total_value: value,
      created_at: daysAgo(days),
      submitted_at: status === 'approved' ? daysAgo(days - 1) : null,
      updated_at: daysAgo(days),
    })
  }
  
  // Add the main demo project
  projects.push({
    id: SAMPLE_PROJECT_ID,
    project_name: 'Sample Demo Project',
    profit_margin: 0.2,
    bond_rate: 0.03,
    general_requirements: 2500,
    status: 'draft',
    total_value: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  
  return projects
}

const mockState = {
  laborRates: [...sampleLaborRates],
  materialPrices: [...sampleMaterialPrices],
  projects: generateMockProjects(),
  projectLineItems: {
    [SAMPLE_PROJECT_ID]: [],
  },
}

const clone = (value) => JSON.parse(JSON.stringify(value))

export const mockDb = {
  listLaborRates: () => clone(mockState.laborRates),
  upsertLaborRates: (rows) => {
    mockState.laborRates = clone(rows)
  },
  listMaterialPrices: () => clone(mockState.materialPrices),
  upsertMaterialPrices: (rows) => {
    mockState.materialPrices = clone(rows)
  },
  listProjects: () => clone(mockState.projects),
  createProject: ({ project_name, profit_margin, bond_rate = 0.03, general_requirements = 0, labor_type = 'Prevailing Wage' }) => {
    const project = {
      id: crypto.randomUUID ? crypto.randomUUID() : `demo-${Date.now()}`,
      project_name,
      profit_margin,
      bond_rate,
      general_requirements,
      labor_type,
      status: 'draft',
      total_value: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockState.projects.push(project)
    mockState.projectLineItems[project.id] = []
    return clone(project)
  },
  getProjectById: (id) => clone(mockState.projects.find((project) => project.id === id)),
  updateProject: (id, updates) => {
    const idx = mockState.projects.findIndex(p => p.id === id)
    if (idx > -1) {
        mockState.projects[idx] = { ...mockState.projects[idx], ...updates, updated_at: new Date().toISOString() }
        return clone(mockState.projects[idx])
    }
    return null
  },
  deleteProject: (id) => {
    const idx = mockState.projects.findIndex(p => p.id === id)
    if (idx > -1) {
        mockState.projects.splice(idx, 1)
        delete mockState.projectLineItems[id]
        return true
    }
    return false
  },
  saveProjectLineItems: (projectId, items) => {
    mockState.projectLineItems[projectId] = clone(items)
  },
  getProjectLineItems: (projectId) => clone(mockState.projectLineItems[projectId] ?? []),
}

export const mockSamples = {
  boqRows: sampleBOQRows,
  projectId: SAMPLE_PROJECT_ID,
}
