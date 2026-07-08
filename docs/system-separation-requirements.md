# System Separation Requirements

## Purpose

This document captures the recommended future architecture for separating the customer-facing online ordering website from the internal business management system.

The current repo already uses a monorepo and multiple apps, but `apps/web` still combines:

- public marketing pages
- public menu and checkout
- customer account pages
- admin dashboards
- staff tools
- shop/menu/inventory management
- internal API routes and server actions

That mix makes the codebase harder to reason about, increases deployment risk, and blurs access boundaries.

## Current State Summary

### Existing apps

- `apps/web`
  - Next.js app
  - currently contains both public storefront and internal back-office features
- `apps/pappas-order-management`
  - Expo app
  - focused on kitchen/order operations, printing, Smartpay, and live order handling
- `apps/pappas-ocean-catch`
  - separate mobile app, appears unrelated to the main separation problem

### Shared libraries that already help

- `libs/types`
  - shared domain types such as orders
- `libs/supabase`
  - shared Supabase client setup

### Main coupling points found

- `apps/web/src/app/admin/*`
- `apps/web/src/app/shop/*`
- `apps/web/src/app/staff/page.tsx`
- `apps/web/src/app/calendar/page.tsx`
- `apps/web/src/app/actions/*`
  - mixes customer flows with admin/staff/shop operations
- `apps/web/src/app/api/*`
  - public and internal concerns live together
- `apps/web/src/middleware.ts`
  - runs on the whole site and includes staff-linking behavior

## Recommended Target Architecture

### Recommendation

The best approach is to separate by product boundary, not by backend technology.

Keep:

- one monorepo
- one Supabase project
- shared domain packages

Split into separate deployable applications:

1. `apps/storefront-web`
   - public website
   - online ordering
   - menu browsing
   - checkout
   - customer login/profile/history/rewards
   - public reviews and marketing pages

2. `apps/backoffice-web`
   - admin and staff web portal
   - reporting
   - menu management
   - supplier/inventory/promotions/coupons
   - roster/calendar
   - announcements
   - settings
   - internal dashboards

3. `apps/pappas-order-management`
   - keep as the operations tablet/POS-style app
   - kitchen workflow
   - live orders
   - receipt printing
   - Smartpay/device integrations

This is better than keeping everything in one Next.js app because it creates clear ownership, safer deployments, simpler auth rules, and smaller mental load per app.

## Design Principles

### 1. Separate by user type

- customers should never load admin code, routes, or middleware
- staff/admin users should use a dedicated internal app
- kitchen/tablet operations remain separate from both

### 2. Separate by runtime responsibility

- public app should optimize for SEO, speed, checkout reliability, and branding
- back-office app should optimize for authenticated workflows and data management
- operations app should optimize for realtime handling, device integration, and resilience

### 3. Share domain logic through packages, not copied code

Do not duplicate order logic across apps.

Shared logic should move into dedicated libraries such as:

- `libs/domain-orders`
- `libs/domain-menu`
- `libs/domain-customers`
- `libs/domain-staff`
- `libs/domain-settings`
- `libs/ui` for truly shared design primitives if needed

### 4. Keep database central, but tighten access boundaries

- one Supabase instance is fine
- use stricter RLS and service-role boundaries per app
- internal workflows should not rely on public routes or customer-side middleware behavior

## Proposed App Responsibilities

### `apps/storefront-web`

Owns:

- homepage and marketing content
- menu pages
- order flow
- delivery and pickup selection
- checkout and payment
- customer auth
- order history and confirmation
- rewards and customer profile
- public review display

Must not own:

- admin dashboards
- inventory management
- supplier tools
- roster/staff management
- internal analytics pages
- printer/device workflows

### `apps/backoffice-web`

Owns:

- admin routes currently under `/admin`
- management routes currently under `/shop`
- staff portal routes
- roster/calendar
- user/role management
- reports, analytics, marketing operations
- store configuration and business settings
- internal maintenance actions and tools

Should expose:

- authenticated internal UI only
- internal API handlers/server actions needed by staff/admin workflows

### `apps/pappas-order-management`

Owns:

- live order board
- in-store order handling
- kitchen printing
- payment terminal integration
- order status transitions during service
- operational settings for device workflows

Should not become:

- the source of truth for back-office management
- the place for broad admin CRUD screens unless they are directly required on tablet

## Required Refactoring Strategy

### Phase 1: Split the current web app logically

Before creating new deployables, reorganize by domain inside the repo:

- public features
- customer account features
- back-office features
- shared server/domain modules

Suggested internal module structure:

- `libs/domain-orders`
- `libs/domain-menu`
- `libs/domain-auth`
- `libs/domain-staff`
- `libs/domain-reports`
- `libs/domain-settings`

Move business logic out of `apps/web/src/app/actions/*` when it is reusable or mixed.

### Phase 2: Create a dedicated back-office app

Create `apps/backoffice-web` and move these areas first:

- `/admin`
- `/shop`
- `/staff`
- `/calendar`
- internal-only API routes
- internal server actions

This should be the first app split because it removes the biggest source of complexity from the public site.

### Phase 3: Rename or rebuild the public app as `apps/storefront-web`

After internal routes are moved out, the remaining app becomes the customer storefront.

It should contain only:

- public pages
- customer account pages
- order flow
- customer-safe APIs/actions

### Phase 4: Extract shared domain packages

Move cross-app logic into packages, especially:

- order creation and status rules
- menu/category/addon models
- customer/reward models
- settings/store hours logic
- delivery integration contracts

Avoid direct DB queries spread across every app page.

## Authentication and Authorization Requirements

### Public app

- customer auth only
- anonymous browsing and guest checkout allowed if required
- no admin/staff route handling in public middleware

### Back-office app

- admin/staff auth required globally except login/reset routes
- role checks enforced server-side
- internal middleware should be isolated to this app

### Operations tablet app

- admin/staff auth only
- use a dedicated access policy for device workflows
- no dependence on customer-session cookies

## API and Server Action Requirements

### Separate public and internal server surfaces

Public server functions:

- menu retrieval
- customer auth/profile
- cart/checkout/order creation
- order status lookup for customer
- public reviews

Internal server functions:

- admin order queries
- product/menu CRUD
- supplier/inventory CRUD
- promotions/coupons management
- roster and staff management
- reporting and analytics jobs

Requirement:

- internal actions must not live in the same broad action namespace as public actions long term
- avoid one large `actions` folder mixing all roles and domains

## Data and Shared Package Requirements

### Keep shared packages lightweight and stable

Recommended package set:

- `libs/types`
  - DTOs and shared type contracts only
- `libs/supabase`
  - client creation helpers only
- `libs/domain-*`
  - reusable business logic
- optional `libs/config`
  - shared environment/config parsing

### Avoid putting app-specific UI into shared libs too early

Only share UI if both apps genuinely use the same component patterns.

## Non-Functional Requirements

### Security

- public bundle must not include internal admin pages or internal workflow code
- internal endpoints must be isolated and authenticated
- service-role usage must stay server-only and be limited to required cases

### Performance

- storefront deploy should be smaller and easier to optimize for SEO/performance
- back-office deploy can prioritize authenticated productivity over public SEO

### Deployment

- public storefront and back-office should deploy independently
- internal changes should not risk public checkout deployment unless shared domain packages changed

### Maintainability

- each app must have a clear owner and purpose
- route names, folders, and package names should reflect business domains

## Migration Priorities

### Highest priority

1. Move `/admin`, `/shop`, `/staff`, and `/calendar` out of the customer-facing app.
2. Extract mixed server actions into domain modules.
3. Create app-specific middleware for public vs internal apps.

### Medium priority

1. Extract shared order/menu/customer logic into `libs/domain-*`.
2. Introduce clearer internal API boundaries.
3. Standardize auth/role guards across internal apps.

### Lower priority

1. Unify design primitives only where useful.
2. Revisit whether some tablet-only settings should be managed from back-office instead.

## Explicit Future Implementation Decisions

### Decision 1

Use a monorepo with multiple deployable apps, not multiple unrelated repositories.

Reason:

- shared schema and domain logic already exist
- splitting repos now would add overhead without solving the real boundary issue

### Decision 2

Create a dedicated back-office web app first.

Reason:

- the public web app is currently overloaded mainly because internal features live inside it
- this gives the biggest reduction in complexity with the least disruption

### Decision 3

Keep Supabase shared, but formalize domain/service layers.

Reason:

- the database is not the main problem
- application boundaries and mixed responsibilities are the main problem

## Success Criteria

The separation is successful when:

- customer storefront contains only customer/public functionality
- internal staff/admin web tools run in a separate app
- kitchen/tablet workflows remain separate and focused
- shared business rules live in reusable packages
- public deployments are safer and smaller
- internal changes no longer increase public app complexity

## Suggested First Implementation Ticket

Create `apps/backoffice-web` and migrate:

- auth pages for staff/admin
- `/admin/*`
- `/shop/*`
- `/staff`
- `/calendar`
- internal middleware
- internal-only server actions used by those routes

Then leave `apps/web` temporarily as the storefront until a rename to `apps/storefront-web` is convenient.
