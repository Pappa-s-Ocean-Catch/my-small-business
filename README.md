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

# Run mobile app
pnpm mobile:dev
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
- `pnpm mobile:dev` - Start mobile app development server
- `pnpm mobile:ios` - Build iOS app
- `pnpm mobile:android` - Build Android app

## Documentation

- [Monorepo Structure](./MONOREPO.md) - Detailed monorepo documentation
- [Mobile App Setup](./apps/pappas-order-management/SETUP.md) - Mobile app setup guide

## Workspaces

This project uses pnpm workspaces. Each app and library is a separate workspace:

- `@my-small-business/types` - Shared types
- `@my-small-business/supabase` - Shared Supabase configs
