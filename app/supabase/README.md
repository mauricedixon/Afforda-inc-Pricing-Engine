# Supabase Schema Setup

1. Sign in to [Supabase](https://supabase.com/dashboard) and open your project.
2. Go to **SQL Editor → New query**.
3. Paste the contents of `schema.sql` and run it.
   - This creates the `material_prices`, `labor_rates`, `projects`, and `project_line_items` tables.
   - Trigger `set_updated_at` keeps `updated_at` columns in sync.
4. Confirm that Postgres now shows the four tables under the `public` schema.
5. Create a Storage bucket (Settings → Storage) named `pricing-engine-uploads` or whichever value you place in `VITE_SUPABASE_STORAGE_BUCKET`.
6. Add Row Level Security (RLS) policies once authentication is added. For the MVP you can leave RLS disabled while testing in a secure environment.

Re-run the script any time you need to recreate the schema in a fresh environment.
