# POS API Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a valid staff or admin session for POS-only HTTP actions while preserving public customer checkout.

**Architecture:** A server-only helper validates Bearer tokens and staff/admin roles. POS-only routes call it before side effects; mobile callers include the current Supabase access token. Shared public checkout APIs remain unchanged.

**Tech Stack:** Next.js route handlers, Supabase, Expo/React Native, TypeScript, Node test runner.

## Global Constraints

- Keep checkout-session, delivery quote, fee, and Places APIs public for customer checkout.
- Keep public `/api/orders/status-email` for customer `placed` messages.
- Permit exactly `staff` and `admin` on POS-only routes; return 401 without a valid token and 403 for customers.
- Do not touch unrelated password-recovery changes.

---

## File Structure

- `apps/web/src/lib/staff-api-auth.ts`: shared server-only staff/admin authorization.
- `apps/web/src/lib/staff-api-auth.test.ts`: pure role-predicate test.
- `apps/web/src/lib/marketplace-credentials.ts`: delegate marketplace authentication to the helper.
- `apps/web/src/app/api/pos/send-payment-link-sms/route.ts`: protected SMS route.
- `apps/web/src/app/api/pos/orders/status-email/route.ts`: new protected status-email route.
- `apps/pappas-order-management/lib/delivery.ts`: send a session token for POS SMS.
- `apps/pappas-order-management/hooks/useOrderActions.ts`: send a session token to the new POS email route.

### Task 1: Centralize server authorization

**Files:**

- Create: `apps/web/src/lib/staff-api-auth.ts`
- Create: `apps/web/src/lib/staff-api-auth.test.ts`
- Modify: `apps/web/src/lib/marketplace-credentials.ts`

**Interfaces:**

- Produces: `isStaffOrAdmin(role: string | null | undefined): boolean`.
- Produces: `authenticateStaffApiRequest(request: Request)` returning either `{ supabase, profile }` or `{ error, status }`.

- [ ] Write a failing Node test:

```ts
assert.equal(isStaffOrAdmin('staff'), true);
assert.equal(isStaffOrAdmin('admin'), true);
assert.equal(isStaffOrAdmin('customer'), false);
assert.equal(isStaffOrAdmin(null), false);
```

- [ ] Run `cd apps/web && node --experimental-strip-types --test src/lib/staff-api-auth.test.ts`; expect module-not-found failure.
- [ ] Implement the predicate and helper: require `Authorization: Bearer`, resolve its user with `createServiceRoleClient().auth.getUser`, fetch `profiles.role_slug`, return 401 for a missing/invalid token, 500 for profile lookup failure, 403 unless the role is staff/admin.
- [ ] Update `authenticateMarketplaceRequest` to delegate to the shared helper without changing its public result shape.
- [ ] Re-run the helper test; expect PASS.
- [ ] Commit only Task 1 files with `git commit -m "feat: centralize staff API authorization"`.

### Task 2: Protect POS payment-link SMS

**Files:**

- Modify: `apps/web/src/app/api/pos/send-payment-link-sms/route.ts`
- Modify: `apps/pappas-order-management/lib/delivery.ts`
- Test: `apps/pappas-order-management/test/delivery-auth.test.ts`

**Interfaces:**

- Consumes: `authenticateStaffApiRequest(request)`.
- Produces: POS SMS requests with `Authorization: Bearer <access token>`.

- [ ] Write a failing test for an exported `buildStaffAuthorizationHeader('token-123')` returning `{ Authorization: 'Bearer token-123' }`.
- [ ] Run `pnpm --filter pappas-order-management test:unit`; expect a TypeScript failure because the helper is absent.
- [ ] Implement the pure header helper. Immediately before the POS SMS request, call `supabase.auth.getSession()`, throw `Missing authenticated session` without a token, and merge the header into the existing request headers.
- [ ] In the SMS route, authorize before parsing JSON; return `{ success: false, error: auth.error }` with `auth.status` on failure. Keep formatting and success payloads unchanged.
- [ ] Re-run `pnpm --filter pappas-order-management test:unit` and `pnpm --filter web lint`; expect PASS.
- [ ] Commit only Task 2 files with `git commit -m "fix: require staff authentication for POS SMS"`.

### Task 3: Protect POS status email without breaking public checkout

**Files:**

- Create: `apps/web/src/app/api/pos/orders/status-email/route.ts`
- Create: `apps/web/src/app/api/pos/orders/status-email/route.test.ts`
- Modify: `apps/pappas-order-management/hooks/useOrderActions.ts`

**Interfaces:**

- Consumes: `authenticateStaffApiRequest(request)`.
- Produces: `POST /api/pos/orders/status-email` with `{ orderId, status }`, accepting only `ready` and `completed`.

- [ ] Write a failing test for `isPosStatusEmailStatus`: `ready`/`completed` are true; `placed`/`cancelled` are false.
- [ ] Run `cd apps/web && node --experimental-strip-types --test src/app/api/pos/orders/status-email/route.test.ts`; expect module-not-found failure.
- [ ] Implement the route: authorize before input parsing, load the order with the service-role client, send only ready/completed emails, and reject any other status with 400.
- [ ] Update `triggerOrderStatusEmail` to read the mobile session, skip with a clear warning if none exists, and call `/api/pos/orders/status-email` with the Bearer token. Leave public checkout on `/api/orders/status-email`.
- [ ] Re-run the route test, `pnpm --filter pappas-order-management test:unit`, and `pnpm --filter web lint`; expect PASS.
- [ ] Commit only Task 3 files with `git commit -m "fix: protect POS order status emails"`.

### Task 4: Verify the authorization boundary

**Files:** none unless verification identifies a defect.

- [ ] Run `rg -n "api/(payments/create-checkout-session|orders/status-email|pos/send-payment-link-sms|pos/orders/status-email)" apps/pappas-order-management apps/web/src/app/order/checkout`; verify POS uses protected endpoints and public checkout remains on public endpoints.
- [ ] Run `pnpm --filter pappas-order-management test:unit`, `pnpm --filter web lint`, and `pnpm --filter web build`; expect zero exit codes.
- [ ] Manually verify staff success, missing-token 401, customer-token 403, and an unchanged customer checkout Stripe session plus placed-email flow.
