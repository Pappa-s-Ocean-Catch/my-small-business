# Monorepo Architecture

This document describes the structure and architectural rules for the Pappas Ocean Catch monorepo.

## Applications

1. **`apps/web` (Frontend)**
   - The main public-facing website.
   - Contains customer pages, ordering flow, and public menus.

2. **`apps/web-portal` (Backend/Admin)**
   - The admin panel and staff-facing application.
   - Contains `/admin` and `/staff` routes, including the shop management (`/admin/shop`).

3. **`apps/api` (API)**
   - The dedicated API server.
   - Contains all REST endpoints (`/api/...`) used by external integrations, webhooks, and the POS systems.

4. **Mobile Apps / Others**
   - `apps/pappas-ocean-catch`: React Native POS application.
   - `apps/menu-display-tv`: Android native menu display application.
   - `apps/pappas-order-management`: Mobile order management application.

## Database Access Rules

- **Next.js Apps (`web` and `web-portal`)**: 
  - Allowed to communicate directly with the database via Server Actions and the Supabase client.
  - Do NOT need to use `fetch` to talk to `apps/api` for internal data operations unless it crosses a system boundary or requires specific shared logic that resides only in the API.
- **API App (`api`)**:
  - Exposes REST endpoints. Must be used when external clients (e.g. mobile POS, webhooks, third-party integrations) need to access the database or trigger actions.

*Note for AI/LLMs: When working on Next.js frontend or backend apps, prefer using Next.js Server Actions for database mutations and data fetching directly, in line with the established patterns in the codebase.*
