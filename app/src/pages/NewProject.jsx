import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient.js'
import { saveLatestProjectId } from '../utils/storage.js'
import { isMockMode, mockDb } from '../mockData.js'

function NewProject() {
  const [projectName, setProjectName] = useState('')
  const [profitMargin, setProfitMargin] = useState(20)
  const [bondRate, setBondRate] = useState(3)
  const [generalRequirements, setGeneralRequirements] = useState(0)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!projectName.trim()) {
      setStatus('Project name is required.')
      return
    }

    setIsSubmitting(true)

    if (isMockMode) {
      const project = mockDb.createProject({
        project_name: projectName.trim(),
        profit_margin: Number(profitMargin) / 100,
        bond_rate: Number(bondRate) / 100,
        general_requirements: Number(generalRequirements),
      })
      saveLatestProjectId(project.id)
      setStatus('Project created! Redirecting…')
      setIsSubmitting(false)
      navigate(`/pricing/project/${project.id}/upload`)
      return
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name: projectName.trim(),
        profit_margin: Number(profitMargin) / 100,
        bond_rate: Number(bondRate) / 100,
        general_requirements: Number(generalRequirements),
      })
      .select()
      .single()
    setIsSubmitting(false)

    if (error) {
      setStatus(`Error creating project: ${error.message}`)
      return
    }

    saveLatestProjectId(data.id)
    setStatus('Project created! Redirecting…')
    navigate(`/pricing/project/${data.id}/upload`)
  }

  return (
    <div>
      <header>
        <p className="eyebrow">Pricing Workflow</p>
        <h1>New Project</h1>
        <p className="lede">
          Each BOQ belongs to a project. Set the title, profit margin, and bond rate for downstream
          calculations.
        </p>
      </header>

      <form className="panel" style={{ marginTop: '1.5rem' }} onSubmit={handleSubmit}>
        <label>
          Project Name
          <input
            type="text"
            placeholder="College of Staten Island TV Studio Renovation"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
          />
        </label>

        <label>
          General Requirements ($)
          <span className="helper-text" style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
            Fixed soft costs (Mobilization, Insurance, Supervision)
          </span>
          <input
            type="number"
            min={0}
            step={100}
            value={generalRequirements}
            onChange={(event) => setGeneralRequirements(event.target.value)}
          />
        </label>

        <label>
          Profit Margin (%)
          <input
            type="number"
            min={0}
            max={80}
            step={0.5}
            value={profitMargin}
            onChange={(event) => setProfitMargin(event.target.value)}
          />
        </label>

        <label>
          Bond Rate (%)
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={bondRate}
            onChange={(event) => setBondRate(event.target.value)}
          />
        </label>

        <button type="submit" disabled={isSubmitting} className="button">
          {isSubmitting ? 'Creating…' : 'Create project'}
        </button>

        {status && <p>{status}</p>}
      </form>
    </div>
  )
}

export default NewProject

