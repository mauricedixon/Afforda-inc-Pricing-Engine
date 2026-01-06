# Deployment Guide - Render

This guide walks you through deploying the Afforda SmartBid to Render.

## Prerequisites

- ✅ Your code pushed to GitHub (or GitLab/Bitbucket)
- ✅ Supabase project created and configured
- ✅ Environment variables ready (see below)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your code is committed and pushed to your Git repository. Render will pull from here.

### 2. Create Render Account & Static Site

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Static Site"**
3. Connect your Git provider (GitHub/GitLab/Bitbucket)
4. Select your repository
5. Render should auto-detect the `render.yaml` configuration

### 3. Configure Environment Variables

In the Render dashboard, go to **Environment** section and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Your Supabase anonymous/public key |
| `VITE_SUPABASE_STORAGE_BUCKET` | ❌ No | Defaults to `pricing-engine-uploads` if not set |
| `VITE_USE_MOCK_DATA` | ❌ No | Set to `true` for demo mode (no Supabase connection needed) |

**Where to find Supabase credentials:**
- Go to your Supabase project dashboard
- Settings → API
- Copy the **Project URL** → `VITE_SUPABASE_URL`
- Copy the **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 4. Build Settings (Auto-Configured)

The `render.yaml` file automatically configures:
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Node Version**: `22.12.0`

### 5. Deploy

1. Click **"Create Static Site"**
2. Render will:
   - Install dependencies
   - Run the build
   - Deploy your site
3. You'll get a URL like: `https://afforda-pricing-engine.onrender.com`

### 6. Post-Deployment Setup

#### Update Supabase CORS Settings

1. Go to your Supabase project dashboard
2. Settings → API
3. Under **"Allowed Origins"**, add your Render domain:
   - `https://your-app-name.onrender.com`
   - Or your custom domain if you set one up

This allows your frontend to make API calls to Supabase.

### 7. Test Your Deployment

1. Visit your Render URL
2. Try creating a project
3. Upload a BOQ
4. Verify data is saving to Supabase

## Custom Domain (Optional)

1. In Render dashboard → Settings → Custom Domain
2. Add your domain
3. Follow DNS configuration instructions
4. Render provides free SSL certificates

## Troubleshooting

### Build Fails

- Check the build logs in Render dashboard
- Ensure Node.js version matches (22.12.0)
- Verify all dependencies are in `package.json`

### Environment Variables Not Working

- Make sure variables start with `VITE_` (required for Vite)
- Rebuild the site after adding new variables
- Check for typos in variable names

### Supabase Connection Errors

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase CORS settings (allowed origins)
- Ensure your Supabase project is active

### 404 Errors on Routes

- This is a Single Page Application (SPA)
- Render should handle this automatically with `render.yaml`
- If issues persist, contact Render support

## Cost

**Free Tier** (Perfect for MVP):
- ✅ Static sites are free on Render
- ✅ Automatic SSL certificates
- ✅ Custom domains supported
- ✅ Unlimited bandwidth

**Paid Plans** (if you need):
- Faster builds
- Priority support
- More concurrent builds

## Next Steps

- Share your deployment URL with mentors/clients
- Monitor usage in Render dashboard
- Set up custom domain if needed
- Consider setting up staging environment for testing

## Support

- Render Docs: https://render.com/docs
- Render Support: support@render.com
- Supabase Docs: https://supabase.com/docs



