# My Small Business - Monorepo

A monorepo for managing a small business with web and mobile applications.

## Structure

- **apps/web**: Next.js web application for business management
- **apps/pappas-order-management**: React Native (Expo) app for kitchen tablet order management
- **libs/types**: Shared TypeScript type definitions
- **libs/supabase**: Shared Supabase client configurations

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

# Run mobile app (dev client)
npm run app:dev-client
```

### Building

```bash
# Build web app
pnpm build

# Build mobile app
pnpm mobile:ios    # iOS
pnpm mobile:android  # Android
```

## Workspace Scripts

- `pnpm dev` - Start web app development server
- `pnpm build` - Build web app
- `pnpm mobile:dev` - Start mobile app Metro server (JS only)
- `npm run app:prebuild` - Generate native projects for the mobile app (required for dev client)
- `npm run app:run:android` - Build & install dev client on Android emulator/device
- `npm run app:run:ios` - Build & install dev client on iOS simulator/device
- `npm run app:dev-client` - Start Metro for the dev client (`expo start --dev-client`)

### Mobile (important)

This repo includes native modules (e.g. ESC/POS printer support). That means:

- Expo Go will NOT work for the mobile app when those native modules are enabled.
- Use a Development Build (Dev Client) instead.

Quick flow:

```bash
pnpm install

# Generate native projects (applies permissions + Info.plist)
npm run app:prebuild

# Build/install the Dev Client app once
npm run app:run:android   # or: npm run app:run:ios

# Start Metro in dev-client mode
npm run app:dev-client
```

If you change native dependencies or app config/plugins, re-run `npm run app:prebuild` and rebuild the dev client.

## Documentation

- [Monorepo Structure](./MONOREPO.md) - Detailed monorepo documentation
- [Mobile App Setup](./apps/pappas-order-management/SETUP.md) - Mobile app setup guide

## Workspaces

This project uses pnpm workspaces. Each app and library is a separate workspace:

- `@my-small-business/types` - Shared types
- `@my-small-business/supabase` - Shared Supabase configs
