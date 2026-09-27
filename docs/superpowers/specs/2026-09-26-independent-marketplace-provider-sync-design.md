# Independent Marketplace Provider Sync Design (DoorDash vs Uber Eats)

## Goal

Decouple Uber Eats and DoorDash automatic synchronization in the POS app so that:
1. Each marketplace provider can be independently enabled or disabled per POS tablet.
2. Each provider can be configured with its own polling interval (e.g. DoorDash at 15s or 30s, Uber Eats at 60s).
3. The sync coordinators run on independent timers and in-flight locks so a slow Uber Eats response never bottlenecks or delays DoorDash polling.
4. Staff can partition the sync load across devices (e.g., POS 1 handles DoorDash, POS 2 handles Uber Eats), or disable either provider as needed.

## Confirmed Decisions

- **Shared operating window**: Both providers continue to respect the shared store operating window (11:00 to 20:30 Melbourne time) and fetch mode (`api` vs `local`).
- **Independent toggles and intervals**:
  - `marketplaceDoorDashSyncEnabled: boolean` (default `true`)
  - `marketplaceDoorDashSyncIntervalSec: number` (default `30`, min 15, max 600)
  - `marketplaceUberSyncEnabled: boolean` (default `true`)
  - `marketplaceUberSyncIntervalSec: number` (default `30`, min 15, max 600)
- **Backward compatibility**: If a device has legacy `marketplaceAutoSyncEnabled` or `marketplaceSyncIntervalSec`, both new provider settings initialize from those legacy values.
- **Independent coordinator loops**: DoorDash and Uber Eats will each run on separate timers, separate in-flight locks, and separate alert reporting.
- **Uncommitted on main branch**: User explicitly requested the changes be applied directly on the current branch and left uncommitted.

## Architecture

### 1. Settings Schema & Normalization (`apps/pappas-order-management/lib/settings.ts`)

Update `AppSettings`:
```ts
export type AppSettings = {
  // Legacy fields (optional / preserved for fallback):
  marketplaceAutoSyncEnabled?: boolean;
  marketplaceSyncIntervalSec?: number;

  // Per-provider fields:
  marketplaceDoorDashSyncEnabled: boolean;
  marketplaceDoorDashSyncIntervalSec: number;
  marketplaceUberSyncEnabled: boolean;
  marketplaceUberSyncIntervalSec: number;

  marketplaceSyncStartTime: string;
  marketplaceSyncEndTime: string;
  marketplaceFetchMode: MarketplaceFetchMode;
  // ... other fields
};
```

Defaults:
- `marketplaceDoorDashSyncEnabled: true`
- `marketplaceDoorDashSyncIntervalSec: 30`
- `marketplaceUberSyncEnabled: true`
- `marketplaceUberSyncIntervalSec: 30`

Normalization & migration logic:
```ts
const legacyEnabled = typeof (parsed as any)?.marketplaceAutoSyncEnabled === 'boolean'
  ? (parsed as any).marketplaceAutoSyncEnabled
  : true;
const legacyInterval = normalizeMarketplaceSyncIntervalSec((parsed as any)?.marketplaceSyncIntervalSec);

const marketplaceDoorDashSyncEnabled = typeof (parsed as any)?.marketplaceDoorDashSyncEnabled === 'boolean'
  ? (parsed as any).marketplaceDoorDashSyncEnabled
  : legacyEnabled;

const marketplaceUberSyncEnabled = typeof (parsed as any)?.marketplaceUberSyncEnabled === 'boolean'
  ? (parsed as any).marketplaceUberSyncEnabled
  : legacyEnabled;

const marketplaceDoorDashSyncIntervalSec = normalizeMarketplaceSyncIntervalSec(
  (parsed as any)?.marketplaceDoorDashSyncIntervalSec ?? legacyInterval
);

const marketplaceUberSyncIntervalSec = normalizeMarketplaceSyncIntervalSec(
  (parsed as any)?.marketplaceUberSyncIntervalSec ?? legacyInterval
);
```

### 2. Provider Sync Coordinator (`apps/pappas-order-management/lib/marketplace-sync.ts`)

Instead of iterating over `MARKETPLACE_PROVIDERS` inside a single shared `poll()` function with one timer:
- Provide `createMarketplaceProviderCoordinator(provider, options)` or a multi-provider coordinator `createMarketplaceMultiSyncCoordinator` that manages separate intervals and in-flight states for `uber_eats` and `doordash`.
- For each provider:
  - Separate `intervalMs`.
  - Separate `inFlight` boolean.
  - Separate `intervalHandle`.
  - Separate `start()` / `stop()` / `poll()`.
- Missing orders history reconciliation is filtered specifically for that provider's open orders, avoiding cross-talk.
- Slow network responses from Uber Eats cannot hold up DoorDash's execution.

### 3. Provider Integration (`MarketplaceSyncGate.tsx` & `MarketplaceSyncProvider.tsx`)

`MarketplaceSyncGate`:
- Reads `settings.marketplaceDoorDashSyncEnabled`, `settings.marketplaceDoorDashSyncIntervalSec`, `settings.marketplaceUberSyncEnabled`, `settings.marketplaceUberSyncIntervalSec`.
- Passes them to `MarketplaceSyncProvider`.

`MarketplaceSyncProvider`:
- Starts or stops DoorDash coordinator based on `doorDash.enabled`.
- Starts or stops Uber Eats coordinator based on `uberEats.enabled`.
- Handles `AppState` transitions (background/foreground) for both coordinators.

### 4. Settings UI (`apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`)

In the Marketplace Settings dialog:
- **DoorDash Card**:
  - Toggle: "DoorDash Auto-Sync" (Enabled on this tablet / Disabled on this tablet)
  - Interval selector chips: `[15s] [30s] [60s] [120s]`
- **Uber Eats Card**:
  - Toggle: "Uber Eats Auto-Sync" (Enabled on this tablet / Disabled on this tablet)
  - Interval selector chips: `[15s] [30s] [60s] [120s]`
- **Shared Hours & Fetch Mode**:
  - Start Time / End Time
  - Fetch Mode (API / Local)

### 5. Verification Plan

1. Settings unit test covering legacy migration and new fields (`test/marketplace-auto-sync-settings.test.ts`).
2. Coordinator unit tests covering independent timer schedules, independent stops/starts, and unblocking between DoorDash and Uber Eats (`test/marketplace-sync.test.ts`).
3. Running test suite via `npx tsx --test test/marketplace-sync.test.ts test/marketplace-pos-order.test.ts test/marketplace-auto-sync-settings.test.ts`.
