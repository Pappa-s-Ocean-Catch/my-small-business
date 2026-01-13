# Vercel Deployment Configuration for Monorepo

After restructuring to a monorepo, Vercel needs to be configured to build from the `apps/web` directory.

## Option 1: Using vercel.json + Dashboard Settings (Required)

A `vercel.json` file has been created in the root directory with build configuration. However, **you must also set the Root Directory in the Vercel Dashboard** (see Option 2 below).

The `vercel.json` configuration:
- Uses pnpm for installation
- Builds the web workspace using pnpm filters
- Note: `rootDirectory` must be set in Vercel Dashboard (not in vercel.json)

## Option 2: Vercel Dashboard Settings (REQUIRED)

**IMPORTANT**: You must configure the Root Directory in the Vercel Dashboard. This cannot be set in `vercel.json`.

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **General**
3. Update the following settings:

### Root Directory (REQUIRED)
- Set **Root Directory** to: `apps/web`
- This tells Vercel where your Next.js app is located in the monorepo

### Build & Development Settings
- **Framework Preset**: Next.js
- **Build Command**: `pnpm --filter web build` (normal build, not build:agent)
- **Output Directory**: `.next` (or leave default)
- **Install Command**: `pnpm install`
- **Node.js Version**: 18.x or higher

**Note**: The `build:agent` command is for CI/agent workflows. Vercel should use the normal `build` command for production deployments.

### Environment Variables
Make sure all environment variables are still set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_FROM`
- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_AI_API_KEY`
- And any other environment variables your app uses

## Important Notes

1. **pnpm is required**: Make sure Vercel is using pnpm. You can set this in:
   - Vercel Dashboard → Settings → General → Package Manager: `pnpm`
   - Or add `.npmrc` file (already created) with `package-manager=pnpm`

2. **Workspace Dependencies**: The build will automatically resolve workspace dependencies (`@my-small-business/types` and `@my-small-business/supabase`) because pnpm handles workspace linking.

3. **Build Command**: The build command uses `pnpm --filter web build` which:
   - Installs all workspace dependencies
   - Only builds the web app
   - Resolves shared library dependencies

## Testing the Build Locally

Before deploying, test the build locally:

```bash
# Install dependencies
pnpm install

# Build the web app
pnpm --filter web build

# Or use the root script
pnpm build
```

## Deployment

After updating the configuration:

1. **Push your changes** to your Git repository
2. Vercel will automatically detect the changes and redeploy
3. Or manually trigger a deployment from the Vercel dashboard

## Troubleshooting

### Build Fails with "Cannot find module"
- Ensure `pnpm install` runs before the build
- Check that workspace dependencies are properly linked
- Verify `pnpm-workspace.yaml` is in the root

### Build Fails with "Missing NEXT_PUBLIC_*"
- Check environment variables in Vercel dashboard
- Ensure all required variables are set for Production, Preview, and Development

### Build is Slow
- This is normal for monorepos as pnpm installs all workspace dependencies
- Consider using Vercel's build cache to speed up subsequent builds

## Why Root Directory Must Be in Dashboard

The `rootDirectory` property is **not supported** in `vercel.json` schema. It must be configured in the Vercel Dashboard under Settings → General → Root Directory.

The `vercel.json` file handles:
- Build command configuration
- Install command (pnpm)
- Framework detection

The Dashboard handles:
- Root directory path (`apps/web`)
- Package manager preference (can also be set via `.npmrc`)
