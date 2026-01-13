# Monorepo Structure

This project is organized as a pnpm monorepo with the following structure:

```
my-small-business/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── src/               # Source code
│   │   ├── public/            # Public assets
│   │   ├── package.json       # Web app dependencies
│   │   └── tsconfig.json      # TypeScript config
│   └── pappas-order-management/  # React Native (Expo) mobile app
│       ├── app/               # App screens
│       ├── lib/               # App-specific utilities
│       ├── package.json       # Mobile app dependencies
│       └── tsconfig.json      # TypeScript config
├── libs/
│   ├── types/                 # Shared TypeScript types
│   │   ├── order.ts          # Order-related types
│   │   ├── dashboard.ts      # Dashboard types
│   │   └── index.ts          # Type exports
│   └── supabase/             # Shared Supabase configuration
│       ├── client.ts         # Browser/client Supabase client
│       └── server.ts         # Server-side Supabase client
├── supabase/                  # Supabase migrations and config
├── pnpm-workspace.yaml       # pnpm workspace configuration
└── package.json              # Root package.json with workspace scripts
```

## Workspaces

### Apps

- **web**: Next.js web application for the main business management system
- **pappas-order-management**: React Native (Expo) app for kitchen tablet order management

### Libraries

- **@my-small-business/types**: Shared TypeScript type definitions
- **@my-small-business/supabase**: Shared Supabase client configurations

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies
pnpm install
```

### Development

```bash
# Run web app
pnpm dev

# Run mobile app
pnpm mobile:dev

# Run specific workspace
pnpm --filter web dev
pnpm --filter pappas-order-management start
```

### Building

```bash
# Build web app
pnpm build

# Build mobile app (iOS)
pnpm mobile:ios

# Build mobile app (Android)
pnpm mobile:android
```

## Adding New Shared Code

### Adding New Types

1. Create or update files in `libs/types/`
2. Export from `libs/types/index.ts`
3. Import in apps using: `import { TypeName } from '@my-small-business/types'`

### Adding New Shared Utilities

1. Create a new library in `libs/`
2. Add `package.json` with name `@my-small-business/your-lib`
3. Add to workspace dependencies in app `package.json` files
4. Import using: `import { ... } from '@my-small-business/your-lib'`

## Workspace Scripts

Root-level scripts (in root `package.json`):

- `pnpm dev` - Start web app development server
- `pnpm build` - Build web app
- `pnpm mobile:dev` - Start mobile app development server
- `pnpm mobile:ios` - Build iOS app
- `pnpm mobile:android` - Build Android app

## Dependencies

- Shared dependencies are managed at the workspace level
- App-specific dependencies are in each app's `package.json`
- Use `workspace:*` protocol for internal workspace dependencies

## TypeScript

Each workspace has its own `tsconfig.json` with path mappings to shared libraries:

```json
{
  "compilerOptions": {
    "paths": {
      "@my-small-business/types": ["../../libs/types"],
      "@my-small-business/supabase": ["../../libs/supabase"]
    }
  }
}
```

## Migration Notes

- Old imports like `@/lib/supabase/client` are now `@my-small-business/supabase/client`
- Old imports like `@/types/dashboard` are now `@my-small-business/types/dashboard`
- Order types are now shared between web and mobile apps

## Vercel Deployment

After moving to monorepo, Vercel needs to be configured. See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed instructions.

Quick setup:
1. The `vercel.json` file in the root is already configured
2. In Vercel Dashboard → Settings → General:
   - Set **Root Directory** to: `apps/web`
   - Set **Package Manager** to: `pnpm`
   - Build command will use `pnpm --filter web build:agent`
