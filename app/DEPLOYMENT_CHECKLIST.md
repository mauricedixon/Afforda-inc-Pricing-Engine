# Pre-Deployment Checklist

Use this checklist before deploying to Render to ensure everything is ready.

## ✅ Code Preparation

- [ ] All code is committed and pushed to your Git repository
- [ ] Build runs successfully locally (`npm run build`)
- [ ] No console errors in development mode
- [ ] All environment variables are documented

## ✅ Supabase Setup

- [ ] Supabase project is created and active
- [ ] Database schema is deployed (run migrations if needed)
- [ ] Storage bucket `pricing-engine-uploads` is created (if using storage)
- [ ] You have your Supabase credentials ready:
  - [ ] Project URL (`https://xxxxx.supabase.co`)
  - [ ] Anon/Public key

## ✅ Environment Variables

Prepare these values for Render:

- [ ] `VITE_SUPABASE_URL` - Your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- [ ] `VITE_SUPABASE_STORAGE_BUCKET` - (Optional) Defaults to `pricing-engine-uploads`
- [ ] `VITE_USE_MOCK_DATA` - (Optional) Set to `true` for demo mode

## ✅ Testing

- [ ] Test creating a new project
- [ ] Test uploading a BOQ
- [ ] Test reviewing/editing line items
- [ ] Test admin pages (labor rates, material prices)
- [ ] Test exporting to Excel
- [ ] Verify data persists in Supabase

## ✅ Render Configuration

- [ ] `render.yaml` file is in the repository
- [ ] `_redirects` file is in `public/` directory (for SPA routing)
- [ ] Build command works: `npm install && npm run build`
- [ ] Output directory is `dist`

## ✅ Post-Deployment

After first deployment:

- [ ] Add Render domain to Supabase allowed origins
- [ ] Test the deployed site
- [ ] Verify all routes work (no 404s on refresh)
- [ ] Check browser console for errors
- [ ] Test on mobile device (if needed)

## 🚨 Common Issues to Watch For

1. **CORS Errors**: Make sure Render domain is in Supabase allowed origins
2. **404 on Refresh**: The `_redirects` file should handle this, but verify
3. **Environment Variables**: Double-check they're set correctly in Render dashboard
4. **Build Failures**: Check Node version matches (22.12.0)

## 📝 Quick Deploy Steps

1. Push code to GitHub
2. Create Static Site in Render
3. Connect repository
4. Add environment variables
5. Deploy
6. Update Supabase CORS settings
7. Test!

