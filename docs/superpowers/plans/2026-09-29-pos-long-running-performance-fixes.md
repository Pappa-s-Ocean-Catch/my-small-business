# POS Long-Running Performance & Stability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate progressive degradation, lagging, and UI freezing during 8–16+ hour POS shifts without altering any existing business logic, checkout flows, or print behavior.

**Architecture:**
- Targeted architectural fixes addressing: (1) unbounded full-day database queries, (2) native Android graphics memory leaks and GC object allocations, (3) background screen timer and query execution, (4) unbounded print queue Promise chains, (5) redundant auth re-subscriptions on navigation, (6) idle overlay timer waking, and (7) unmemoized POS menu button rendering.
- Maintain 100% compatibility with existing order saving, checkout, Smartpay, cash, print routing, and mirror publishing.

**Tech Stack:**
- React Native / Expo (SDK 54, React 19, React Native 0.81.5)
- Android Native Kotlin module (`NativeRawTcpPrinter`)
- Supabase Realtime & PostgREST
- TanStack React Query & Zustand
- React Navigation

**Spec:** `/Users/truongnguyen/source/my-small-business/react-native-pos-long-running-performance-audit-prompt.md`

## Global Constraints
- Do NOT alter any checkout flow (pickup, delivery, instore, third-party, smartpay).
- Do NOT change the 6 calls to `await clearMirrorAfterCheckout();` in `app/pos.tsx`.
- All changes must be strictly safe, additive or non-breaking optimizations.
- Verify TypeScript compilation and existing tests after each task.

---

### Task 1: Eliminate Full-Day `order_items` Query in Top Sellers

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx:570-670`
- Modify: `apps/pappas-order-management/stores/posCatalogCacheStore.ts:11`

**Interfaces:**
- Consumes: `posCatalogCacheStore`, `catalog.productsById`, Supabase `orders` / `order_items`
- Produces: Throttled, cached top-seller updates that do not query thousands of raw transaction items on every order event.

- [x] **Step 1: Increase top sellers cache TTL and add query cooldown in `stores/posCatalogCacheStore.ts`**
  Set `TOP_SELLERS_CACHE_TTL_MS = 15 * 60 * 1000` (15 minutes).
- [x] **Step 2: Update `loadTopSellersToday` and channel in `app/pos.tsx`**
  - Limit `order_items` query to active items or cache results with a 15-minute cooldown.
  - Remove the real-time trigger on raw `order_items` table changes (only keep a debounced 60s trigger or 15m periodic refresh).
  - Do not purge top sellers on every local checkout; allow the 15-minute TTL to govern refreshes.
- [x] **Step 3: Verify TypeScript and test execution**
  Run: `npx tsc --noEmit` or test scripts.
- [x] **Step 4: Commit**
  ```bash
  git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/stores/posCatalogCacheStore.ts
  git commit -m "perf: throttle and cache pos top sellers to eliminate full-day query churn"
  ```

---

### Task 2: Fix Android Native Raw TCP Printer Bitmaps and Byte Allocations

**Files:**
- Modify: `libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/NativeRawTcpPrinterModule.kt:33-97`

**Interfaces:**
- Consumes: Android `Bitmap`, `Canvas`, ESC/POS raster generation
- Produces: Cleaned-up native bitmap memory via `.recycle()` and primitive `ByteArrayOutputStream` avoiding 100k+ heap allocations per print.

- [x] **Step 1: Add `bitmap.recycle()` in `NativeRawTcpPrinterModule.kt`**
  Immediately after `val resized = resize(bitmapToRgba(bitmap), options.width)`, invoke `bitmap.recycle()` on the captured bitmap.
- [x] **Step 2: Replace `ArrayList<Byte>()` with `ByteArrayOutputStream` in `escPos`**
  Use `val output = java.io.ByteArrayOutputStream(raster.height * (raster.width / 8 + 10))` and write primitive bytes directly (`output.write(...)`).
- [x] **Step 3: Verify code compiles**
  Review Kotlin syntax and imports.
- [x] **Step 4: Commit**
  ```bash
  git add libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/NativeRawTcpPrinterModule.kt
  git commit -m "perf: recycle native bitmaps and eliminate boxed byte allocations in raw tcp printer"
  ```

---

### Task 3: Deactivate Background Timers & Polling on Unfocused Screens

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx:110, 560-590`

**Interfaces:**
- Consumes: `@react-navigation/native` (`useIsFocused`), `usePrinterAutomationStore`
- Produces: Pauses 1s countdown and 30s query poll when the user is on the POS screen, and eliminates re-renders on journal writes.

- [x] **Step 1: Change journal subscription in `live-orders.tsx`**
  Change line 110 from `const journalEntries = usePrinterAutomationStore((state) => state.journalEntries);` to `const journalCount = usePrinterAutomationStore((state) => state.journalEntries.length);`.
  Update line 848 to use `journalCount`.
- [x] **Step 2: Gate intervals with `isFocused`**
  Import `useIsFocused` from `@react-navigation/native`.
  Only run `setInterval(() => setNowMs(Date.now()), 1000)` and `syncDeliveryStatuses` when `isFocused` is true.
- [x] **Step 3: Verify compilation**
  Run test script or compile check.
- [x] **Step 4: Commit**
  ```bash
  git add apps/pappas-order-management/app/\(drawer\)/\(tabs\)/live-orders.tsx
  git commit -m "perf: pause live-orders intervals when blurred and decouple journal re-renders"
  ```

---

### Task 4: Reset Print Queue Promise Chains in `lib/escpos-printer.ts`

**Files:**
- Modify: `apps/pappas-order-management/lib/escpos-printer.ts:177-193`

**Interfaces:**
- Consumes: `SavedPrinter`, print jobs
- Produces: Self-draining print queue that removes completed promises from `printerQueues` when idle.

- [x] **Step 1: Implement queue drain cleanup in `enqueuePrinterJob`**
  When a queue job completes, if no newer jobs are pending on that queue key, remove the key from `printerQueues`.
- [x] **Step 2: Commit**
  ```bash
  git add apps/pappas-order-management/lib/escpos-printer.ts
  git commit -m "perf: drain and clear printer queue promise chains when idle"
  ```

---

### Task 5: Decouple Navigation Route Transitions from Root Auth Re-subscription

**Files:**
- Modify: `apps/pappas-order-management/app/_layout.tsx:35-105`

**Interfaces:**
- Consumes: Expo Router `segments`, Supabase Auth
- Produces: Single persistent auth subscription that does not re-authenticate, query `user_roles`, or upsert push tokens on every screen change.

- [x] **Step 1: Store `segments` in a ref in `RootLayout`**
  Read `segmentsRef.current` inside `routeForSession` instead of including `segments` in the `useEffect` dependency array.
- [x] **Step 2: Verify login/navigation behavior**
  Verify protected route redirects and login session routing.
- [x] **Step 3: Commit**
  ```bash
  git add apps/pappas-order-management/app/_layout.tsx
  git commit -m "perf: decouple root auth subscription from screen navigation segments"
  ```

---

### Task 6: Deactivate Unconditional 1s Timer in PendingOnlinePaymentsOverlay

**Files:**
- Modify: `apps/pappas-order-management/lib/PendingOnlinePaymentsOverlay.tsx:60-64`

**Interfaces:**
- Consumes: `sessions` from `pendingOnlinePaymentsStore`
- Produces: 1s interval only runs when `sessions.length > 0`.

- [x] **Step 1: Guard interval with `sessions.length > 0`**
  In `PendingOnlinePaymentsOverlay.tsx`, exit early in `useEffect` when `sessions.length === 0`.
- [x] **Step 2: Commit**
  ```bash
  git add apps/pappas-order-management/lib/PendingOnlinePaymentsOverlay.tsx
  git commit -m "perf: run pending payment timer only when active sessions exist"
  ```

---

### Task 7: Memoize POS Menu & Cart Grid with Pre-Indexed Quantities

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx:2580-2600`
- Modify: `apps/pappas-order-management/components/pos/PosMenuPane.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosCartPane.tsx`

**Interfaces:**
- Consumes: `cartItems`, `SaleProduct`
- Produces: O(1) quantity map lookup per button; memoized components that avoid full-screen reconciliation on button presses.

- [x] **Step 1: Compute `quantitiesByProductId` in `pos.tsx` using `useMemo`**
  Replace inline `quickQuantityForProduct` array scan with an O(1) Map lookup.
- [x] **Step 2: Wrap `PosMenuPane` and `PosCartPane` with `React.memo`**
  Export `React.memo(PosMenuPane)` and `React.memo(PosCartPane)`.
- [x] **Step 3: Verify POS behavior and tests**
  Confirm quantity badges update accurately when adding/incrementing items in the cart.
- [x] **Step 4: Commit**
  ```bash
  git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/components/pos/PosMenuPane.tsx apps/pappas-order-management/components/pos/PosCartPane.tsx
  git commit -m "perf: memoize pos menu and cart panes with indexed quantity lookups"
  ```

---

### Task 8: Fix Supabase Channel Cleanup in Pre-Orders

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/pre-orders.tsx:438-453`

**Interfaces:**
- Consumes: Supabase `RealtimeChannel`
- Produces: Proper channel deregistration via `supabase.removeChannel(subscription)`.

- [x] **Step 1: Call `supabase.removeChannel(subscription)` on unmount**
  Replace `subscription.unsubscribe();` with `void supabase.removeChannel(subscription);`.
- [x] **Step 2: Commit**
  ```bash
  git add apps/pappas-order-management/app/\(drawer\)/pre-orders.tsx
  git commit -m "fix: deregister pre-orders realtime channel using removeChannel"
  ```
