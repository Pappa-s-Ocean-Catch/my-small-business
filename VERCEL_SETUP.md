# Vercel Deployment Configuration for Monorepo

After restructuring to a monorepo, Vercel needs to be configured to build from the `apps/web` directory.

## Option 1: Using vercel.json (Recommended)

A `vercel.json` file has been created in the root directory with the correct configuration. This will automatically configure Vercel when you deploy.

The configuration:
- Sets `rootDirectory` to `apps/web`
- Uses pnpm for installation
- Builds the web workspace using pnpm filters

## Option 2: Vercel Dashboard Settings

If you prefer to configure via the Vercel dashboard:

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **General**
3. Update the following settings:

### Root Directory
- Set **Root Directory** to: `apps/web`

### Build & Development Settings
- **Framework Preset**: Next.js
- **Build Command**: `pnpm --filter web build`
- **Output Directory**: `.next` (or leave default)
- **Install Command**: `pnpm install`
- **Node.js Version**: 18.x or higher

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

## Alternative: Using Vercel's Monorepo Support

Vercel has built-in monorepo support. You can also:

1. Keep the root directory as the repository root
2. Set **Root Directory** to `apps/web` in Vercel settings
3. Vercel will automatically detect it's a monorepo and handle it correctly

The `vercel.json` file provides explicit configuration, but Vercel's automatic detection should also work.
