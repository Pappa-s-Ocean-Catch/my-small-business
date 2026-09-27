# Independent Marketplace Provider Sync Implementation Plan

> **Note on Git:** User requested: "change on main branch live it un commit". Do not execute git commits during this task; leave all changes uncommitted on the main branch.

**Goal:** Decouple DoorDash and Uber Eats marketplace synchronization in the POS app so each provider can be independently enabled/disabled and assigned a separate polling interval on each device, running on independent timer loops.

**Architecture:** Split `AppSettings` to hold independent flags and intervals for DoorDash and Uber Eats with legacy migration fallback. Update `createMarketplaceSyncCoordinator` in `lib/marketplace-sync.ts` to manage separate provider loops with isolated timers and in-flight locks. Update `MarketplaceSyncGate` and `MarketplaceSyncProvider` to drive both coordinators. Update `settings.tsx` UI to expose independent controls.

**Tech Stack:** React Native, Expo, TypeScript, node:test / tsx.

**Spec:** `docs/superpowers/specs/2026-09-26-independent-marketplace-provider-sync-design.md`

## Global Constraints
- Target directory: `apps/pappas-order-management`
- Leave code uncommitted on the main branch
- Maintain backward compatibility for existing settings stored in AsyncStorage
- Preserve shared operating window (11:00 to 20:30 Melbourne time) and fetch mode (`api` vs `local`)

---

### Task 1: Update AppSettings & Normalization (`lib/settings.ts`)

**Files:**
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Test: `apps/pappas-order-management/test/marketplace-auto-sync-settings.test.ts`

**Interfaces:**
- Produces in `AppSettings`:
  - `marketplaceDoorDashSyncEnabled: boolean`
  - `marketplaceDoorDashSyncIntervalSec: number`
  - `marketplaceUberSyncEnabled: boolean`
  - `marketplaceUberSyncIntervalSec: number`
- Preserves legacy fields in `AppSettings` as optional for backward compatibility:
  - `marketplaceAutoSyncEnabled?: boolean`
  - `marketplaceSyncIntervalSec?: number`

- [ ] **Step 1: Write test cases for per-provider settings and legacy migration**

Add tests to `apps/pappas-order-management/test/marketplace-auto-sync-settings.test.ts` verifying:
1. `DEFAULT_APP_SETTINGS` has both providers enabled and defaulting to 30s.
2. Normalization migrates legacy `marketplaceAutoSyncEnabled: false` to both `marketplaceDoorDashSyncEnabled: false` and `marketplaceUberSyncEnabled: false`.
3. Normalization migrates legacy `marketplaceSyncIntervalSec: 15` to both providers.
4. Independent values are preserved when explicitly set.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/marketplace-auto-sync-settings.test.ts`
Expected: FAIL due to missing properties on `DEFAULT_APP_SETTINGS`.

- [ ] **Step 3: Update `lib/settings.ts`**

Update `AppSettings` type, `DEFAULT_APP_SETTINGS`, and `normalizeLoadedAppSettings` to support the new fields and migration fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/marketplace-auto-sync-settings.test.ts`
Expected: PASS.

---

### Task 2: Decouple Marketplace Sync Coordinator (`lib/marketplace-sync.ts`)

**Files:**
- Modify: `apps/pappas-order-management/lib/marketplace-sync.ts`
- Test: `apps/pappas-order-management/test/marketplace-sync.test.ts`

**Interfaces:**
- Consumes: `dependencies`
- Produces:
  - Per-provider coordination in `createMarketplaceSyncCoordinator`:
    - Can configure `providers: { [provider in MarketplaceProvider]?: { enabled: boolean; intervalMs: number } }` or independent provider schedules.
    - Each provider has its own `intervalHandle`, its own `inFlight` state, and runs independently.
    - `start()`, `stop()`, `poll(provider?)`.

- [ ] **Step 1: Write failing test in `test/marketplace-sync.test.ts`**

Add unit tests verifying:
1. DoorDash and Uber Eats can run on distinct intervals (e.g. 15s and 60s).
2. Disabling DoorDash allows Uber Eats to continue polling, and vice versa.
3. A slow or hanging request in Uber Eats does not block DoorDash's inFlight lock or schedule.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/marketplace-sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement per-provider loops in `lib/marketplace-sync.ts`**

Update `createMarketplaceSyncCoordinator` so each provider manages its own timer, interval, and in-flight execution flag.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/marketplace-sync.test.ts`
Expected: PASS.

---

### Task 3: Update `MarketplaceSyncGate` & `MarketplaceSyncProvider`

**Files:**
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncGate.tsx`
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`

**Interfaces:**
- `MarketplaceSyncGate`: passes per-provider settings (`doorDash` and `uberEats`) to `MarketplaceSyncProvider`.
- `MarketplaceSyncProvider`: coordinates starting and stopping each provider independently.

- [ ] **Step 1: Update `MarketplaceSyncGate.tsx`**

Pass `doorDash={{ enabled: settings.marketplaceDoorDashSyncEnabled, intervalMs: settings.marketplaceDoorDashSyncIntervalSec * 1000 }}` and `uberEats={{ enabled: settings.marketplaceUberSyncEnabled, intervalMs: settings.marketplaceUberSyncIntervalSec * 1000 }}`.

- [ ] **Step 2: Update `MarketplaceSyncProvider.tsx`**

Update coordinator initialization and `AppState` / enabled changes to start/stop the providers independently. Clear alerts for specific providers when disabled.

- [ ] **Step 3: Run unit tests**

Run: `npx tsx --test test/marketplace-sync.test.ts test/marketplace-pos-order.test.ts`
Expected: PASS.

---

### Task 4: Update Settings UI (`app/(drawer)/(tabs)/settings.tsx`)

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`

- [ ] **Step 1: Update Settings State & Handlers**

Add states for `marketplaceDoorDashSyncEnabled`, `marketplaceDoorDashSyncIntervalSec`, `marketplaceUberSyncEnabled`, `marketplaceUberSyncIntervalSec`. Update `handleSaveSettings` and `handleResetSettings`.

- [ ] **Step 2: Render Provider Cards in Marketplace Section**

Render:
- DoorDash Sync card: Switch + Interval selector chips `[15s] [30s] [60s] [120s]`.
- Uber Eats Sync card: Switch + Interval selector chips `[15s] [30s] [60s] [120s]`.
- Operating Hours & Fetch Mode.

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Run complete marketplace test suite**

Run: `npx tsx --test test/marketplace-sync.test.ts test/marketplace-pos-order.test.ts test/marketplace-auto-sync-settings.test.ts`
Expected: All tests pass.

- [ ] **Step 2: Confirm git status shows changes uncommitted on main branch**

Run: `git status`
Expected: Modified files present, uncommitted.
