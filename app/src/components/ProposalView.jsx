import './ProposalView.css'
import AffordaLogo from './AffordaLogo.jsx'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)

function ProposalView({ project, items, onClose }) {
  if (!project) return null

  const material = items.reduce((sum, item) => sum + (item.material_cost ?? 0), 0)
  const labor = items.reduce((sum, item) => sum + (item.labor_cost ?? 0), 0)
  const hardCosts = items.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
  const generalRequirements = project?.general_requirements ?? 0
  const profitMargin = project?.profit_margin ?? 0.2
  const bondRate = project?.bond_rate ?? 0.03
  const totalMarkup = profitMargin + bondRate
  
  // Divisor formula: Grand Total = (Hard Costs + Soft Costs) / (1 - Total Markup)
  const totalCostBasis = hardCosts + generalRequirements
  const grandTotal = totalMarkup >= 1 ? totalCostBasis : totalCostBasis / (1 - totalMarkup)
  const bondTotal = grandTotal * bondRate
  const profitTotal = grandTotal * profitMargin

  const today = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="proposal-overlay">
      <div className="proposal-card printable-content">
        <div className="proposal-controls no-print">
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" onClick={onClose} style={{ marginLeft: '0.5rem' }}>
            Close
          </button>
        </div>

        <header className="proposal-header">
          <div className="proposal-brand">
            <AffordaLogo className="proposal-logo" />
          </div>
          <div className="proposal-meta">
            <p>{today}</p>
            <p>Proposal #: {project.id?.slice(0, 8)}</p>
          </div>
        </header>

        <section className="proposal-section">
          <h2>Project Information</h2>
          <p>
            <strong>Project:</strong> {project.project_name}
          </p>
          <p>
            <strong>Status:</strong> {project.status}
          </p>
          {project.notes && (
            <p>
              <strong>Notes:</strong> {project.notes}
            </p>
          )}
        </section>

        <section className="proposal-section">
          <h2>Investment Summary</h2>
          <table className="proposal-summary-table">
            <tbody>
              <tr>
                <td>Material</td>
                <td>{formatCurrency(material)}</td>
              </tr>
              <tr>
                <td>Labor</td>
                <td>{formatCurrency(labor)}</td>
              </tr>
              <tr>
                <td>Subtotal (Hard Costs)</td>
                <td>{formatCurrency(hardCosts)}</td>
              </tr>
              <tr>
                <td>General Requirements (Soft Costs)</td>
                <td>{formatCurrency(generalRequirements)}</td>
              </tr>
              <tr>
                <td>Bond ({Math.round(bondRate * 100)}%)</td>
                <td>{formatCurrency(bondTotal)}</td>
              </tr>
              <tr>
                <td>Overhead and Profit ({Math.round(profitMargin * 100)}%)</td>
                <td>{formatCurrency(profitTotal)}</td>
              </tr>
              <tr className="total">
                <td>Grand Total</td>
                <td>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="proposal-section">
          <h2>Scope Breakdown</h2>
          <table className="proposal-line-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((item) => (
                <tr key={`${item.id}-${item.line_number}`}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 30 && (
            <p className="proposal-footnote">
              Showing first 30 lines. Full export available upon request.
            </p>
          )}
        </section>

        <section className="proposal-section proposal-footer">
          <p>We appreciate the opportunity to bid on this project.</p>
          <div className="signature-line">
            <span>Signature</span>
          </div>
          <p>Thank you for your business.</p>
        </section>
      </div>
    </div>
  )
}

export default ProposalView

