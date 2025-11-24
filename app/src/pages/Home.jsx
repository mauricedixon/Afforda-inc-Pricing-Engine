import { Link } from 'react-router-dom'

function Home() {
  return (
    <div>
      <header>
        <p className="eyebrow">Welcome back</p>
        <h1>Centralized Pricing Engine</h1>
        <p className="lede">
          Upload the cleaned labor + material spreadsheets once, then price every BOQ from a single
          workflow. You&apos;re always a few clicks away from an export-ready bid package.
        </p>
      </header>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Start a Project</h2>
          <p>Kick off a new bid and capture the project profit margin up front.</p>
          <Link to="/pricing/new-project" className="button">
            Create project
          </Link>
        </article>

        <article className="panel">
          <h2>Upload BOQ</h2>
          <p>Drop in the latest takeoff sheet to price it with the central data.</p>
          <Link to="/pricing/project/latest/upload" className="button">
            Upload takeoff
          </Link>
        </article>
      </section>
    </div>
  )
}

export default Home

