# Afforda Inc. Pricing Engine (Frontend)

React + Vite application that powers the MVP Pricing Engine described in the PRD.
It will provide:

- Admin tools for uploading labor rates & material prices (CSV/XLSX)
- Pricing workflow for uploading a BOQ, matching against the database, and exporting an Excel bid
- Supabase backend (PostgreSQL + Storage) for persistence

## Prerequisites

| Tool             | Version                 | Notes                                       |
| ---------------- | ----------------------- | ------------------------------------------- |
| Node.js          | `22.12.0` (see `.nvmrc`) | Required by Vite 7                          |
| npm              | `10+`                   | Ships with Node 22                          |
| Supabase account | Free tier is sufficient | Used for Postgres + Storage + Auth         |

## Getting Started

```bash
nvm use        # or install Node 22.12.0 manually
cp .env.example .env.local
npm install
npm run dev
```

Vite automatically loads environment variables from `.env.local` files that begin with `VITE_`.

### Optional: Mock Data Mode

If you want to demo the Pricing Engine without connecting to Supabase yet, add this flag:

```
VITE_USE_MOCK_DATA=true
```

When enabled:

- The sidebar shows a “Demo data” banner
- Labor/Material admin pages operate on in-memory sample data (safe to experiment)
- A sample project + BOQ are available via “Load sample BOQ” on the upload screen
- Pricing + Review screens reflect fully calculated numbers without Supabase

Turn the flag off once real Supabase credentials are configured.

## Supabase Setup

1. **Create a project**
   - Region close to NYC (e.g., us-east-1) keeps latency low
   - Copy the **Project URL** and **anon public key** into `.env.local`
     ```
     VITE_SUPABASE_URL="https://your-project.supabase.co"
     VITE_SUPABASE_ANON_KEY="public-anon-key"
     VITE_SUPABASE_STORAGE_BUCKET="pricing-engine-uploads"
     ```
2. **Enable Storage**
   - Create a bucket that matches `VITE_SUPABASE_STORAGE_BUCKET`
   - Restrict uploads to authenticated users if required later (MVP can stay public)
3. **Postgres**
   - The next tasks in the plan create the schema (material prices, labor rates, projects, line items)
4. **Service role key**
   - Not required in the frontend. Keep it server-side only if you add backend automation.

## Project Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| `npm run dev`   | Start Vite dev server            |
| `npm run build` | Production build                 |
| `npm run preview` | Preview the production build   |
| `npm run lint`  | Run ESLint                       |

## Directory Highlights

```
src/
  components/   // Reusable UI blocks
  pages/        // Route-level pages (admin + pricing)
  services/     // Supabase client & data helpers
  utils/        // CSV parsing, pricing logic, etc.
```

> See `afforda-pricing-engine.plan.md` for the full implementation roadmap.

## Deployment (Vercel)

1. Create a new project in [Vercel](https://vercel.com/new) and import this repo.
2. When prompted for environment variables add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET` (optional; defaults to `pricing-engine-uploads`)
3. Vercel automatically uses `vercel.json` which runs `npm install` and `npm run build`.
4. After the first deploy, update the Supabase dashboard with the Vercel domain for allowed origins.
5. Share the deployed URL with Sathi/Jabed for user testing.
