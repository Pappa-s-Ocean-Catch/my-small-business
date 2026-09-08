# Delivery Management Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for assigned tasks and focused review.

**Goal:** View Shipday deliveries and book standalone courier jobs inside POS.
**Architecture:** Staff API proxies provider reads; durable delivery_requests records coordinate quote/create/estimate/assign and optional POS links. Shared TypeScript contracts connect independent provider, server and native UI modules.
**Tech Stack:** Expo, React Native Paper, TanStack Query, Next.js, Supabase, Shipday HTTP API.
**Spec:** docs/superpowers/specs/2026-09-07-delivery-management-design.md

## Global constraints

Keep work uncommitted, preserve existing work, do not apply migrations or book couriers. API keys remain server-side. No new food sales for standalone deliveries. Follow the exact shared types and endpoint contracts in the spec. Defaults: store pickup, all available quotes, ASAP delivery. New booking requires customer name/phone. No implicit SMS.

### Task 1: Provider client and shared contracts

Owner: provider worker. Files: libs/types/delivery-management.ts, libs/shipday/management.ts, libs/shipday/management.test.cjs. Read spec method signatures. Keep existing libs/shipday/index.ts behavior unchanged.
- [ ] Write fixture-driven failing tests that assert URL, request body, normalized output and rejection for unsuccessful mutation responses.
- [ ] Implement typed client with timeout, pagination, available quotes, create/estimate/assign and read reconciliation.
- [ ] Run node --test libs/shipday/management.test.cjs; hand off command and output.

### Task 2: Durable booking API

Owner: root. Files: supabase/migrations/20260907120000_add_delivery_requests.sql, apps/web/src/lib/delivery-management.ts, apps/web/src/lib/delivery-booking.ts, apps/web/src/lib/delivery-booking.test.cjs, apps/web/src/app/api/pos/delivery-management/**/route.ts; webhook integration.
- [ ] Add migration with unique request/reference, optional POS link, staff SELECT RLS and server-only mutation.
- [ ] Test booking through an in-memory repository and provider fixture: claim once, duplicate request returns existing state, higher price needs_confirmation, uncertain creation never retries blind, assignment timeout reads remote state.
- [ ] Implement repository-backed coordinator and staff endpoints using authenticateStaffApiRequest.
- [ ] Add webhook state recording for standalone requests and retain linked-order reconciliation.
- [ ] Run booking/provider/webhook tests and web TypeScript.

### Task 3: Native page and booking flow

Owner: UI worker. Files: apps/pappas-order-management/app/(drawer)/delivery-management.tsx, components/delivery-management/*, lib/delivery-management.ts, lib/delivery-management-state.ts, test/delivery-management.test.ts, drawer registration. Consume shared contracts and API endpoint definitions from spec.
- [ ] Test quote state invalidation, provider selection and duplicate-submit/uncertain state UI rules with hand-authored fixtures.
- [ ] Implement authorized API client, list/detail views, all provider data, date/status/search filters and pagination.
- [ ] Implement address autocomplete/manual input, recipient, optional order reference lookup, quotes and request/status recovery flow.
- [ ] Run focused emitted tests and check phone/tablet layout code, keyboard/scroll behavior and accessibility.

### Task 4: Integration and review

Owner: root plus scoped reviewer.
- [ ] Verify contracts match all producers and consumers.
- [ ] Review uncertain-state handling and linked-order behavior; fix concrete findings.
- [ ] Run web TypeScript and targeted POS tests; inspect application typecheck for changed-file errors.
- [ ] Document operational deployment requirements and honest visual/device/provider validation boundary.
