# Pay by Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SMS a Stripe Checkout link for an unpaid order, show that link as a QR code on iPad, and update the order from Stripe webhooks.

**Architecture:** The iPad resolves or creates a customer through its existing Supabase client, then saves the customer association on the order. An authenticated server endpoint receives only the order ID, reads persisted order data, creates/sends the checkout link, and returns it for QR display. Stripe webhook events are the only source of paid status.

**Tech Stack:** Expo React Native, Supabase, Next.js route handlers, Stripe Checkout, Mobile Message SMS, TypeScript.

## Global Constraints

- Customer lookup/creation occurs in the authenticated iPad client.
- The server never trusts client totals, products, or destination phone numbers.
- The QR is displayed only after Stripe session creation and SMS delivery both succeed.
- Existing Shipday and reward behavior stays intact.

---

### Task 1: Implement and test iPad payment-link helpers

**Files:** Create `apps/pappas-order-management/lib/pay-by-link.ts` and `apps/pappas-order-management/test/pay-by-link.test.ts`; modify `apps/pappas-order-management/tsconfig.test.json`.

**Consumes:** existing `Customer`, `Order`, Supabase client and `getApiUrl`.

**Produces:** `canPayByLink(order)`, `associateCustomerWithOrder(orderId, customer)`, and `createPayByLink(orderId)`.

- [ ] Write a failing test that returns true for pending/confirmed unpaid orders and false for paid, completed, and cancelled orders.
- [ ] Implement `canPayByLink` as `order.payment_status !== 'paid' && !['cancelled', 'completed'].includes(order.order_status)`.
- [ ] Implement association by updating `user_id`, `customer_name`, `customer_phone`, and `updated_at` through the app Supabase client, returning the refreshed order.
- [ ] Implement the API client to obtain the authenticated session token, POST `{ orderId }` to `/api/pos/create-payment-link`, and throw parsed error responses.
- [ ] Add helper/test files to the test tsconfig; run `pnpm --filter pappas-order-management test:unit` and `pnpm --filter pappas-order-management exec tsc --noEmit`; commit.

### Task 2: Build the iPad Pay by Link / QR modal

**Files:** Create `apps/pappas-order-management/components/PayByLinkModal.tsx`; modify `apps/pappas-order-management/components/OrderDetailModal.tsx`.

**Consumes:** existing `findCustomerByPhone`, `createCustomerIfNotExists`, Task 2 helpers, and `ReceiptQrCode`.

**Produces:** a controlled modal that calls the parent refresh callback after successful association.

- [ ] Collect/validate phone when the order has no linked customer/phone. Use `findCustomerByPhone`; for a miss, require name and call `createCustomerIfNotExists`.
- [ ] Associate the resulting customer before calling `createPayByLink`; stop with a visible error if any step fails.
- [ ] Render the resulting checkout URL through `ReceiptQrCode`, the amount, and “SMS sent to [phone]”.
- [ ] Add “Pay by Link” to the detail action bar only when `canPayByLink(order)` returns true. Refresh the parent order after association.
- [ ] Typecheck and manually verify an existing customer, a new customer, and absence of action on paid/cancelled/completed orders; commit.

### Task 3: Create server-authoritative payment link endpoint

**Files:** Create `apps/web/src/app/api/pos/create-payment-link/route.ts`.

**Consumes:** a Bearer token and `{ orderId: string }`.

**Produces:** `{ success: true, sessionId, paymentUrl }`.

- [ ] Validate the Bearer token, resolve its Supabase user, and require an admin/staff profile; return 401/403 for failures.
- [ ] Read the order with service credentials. Reject absent, paid, cancelled, completed, or customer-less/phone-less orders with 409/422.
- [ ] Create `stripe.checkout.sessions.create` from persisted `order.total` in cents, metadata `{ order_id, total }`, `payment_intent_data.metadata.order_id`, and normal confirmation/cancel URLs.
- [ ] Record session ID/time and `payment_method: 'online'`; send SMS using the persisted customer phone and session URL; return URL/session ID only after SMS success.
- [ ] Run `pnpm --filter web lint` and `pnpm --filter web build`; commit.

### Task 4: Final verification

- [ ] Run `pnpm --filter pappas-order-management test:unit`, iPad `tsc --noEmit`, web lint/build, and `git diff --check`.
- [ ] Create a Stripe test-mode link, verify SMS and QR URLs match, pay with `4242 4242 4242 4242`, and confirm iPad polling displays paid.
