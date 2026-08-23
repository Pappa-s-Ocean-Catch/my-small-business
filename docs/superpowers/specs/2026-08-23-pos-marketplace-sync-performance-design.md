# POS Marketplace Sync and Live Orders Performance Design

## Goal

Keep the POS responsive during the dinner peak while preserving marketplace order correctness. Staff will manage one chronological live-order queue, and each tablet will be able to opt out of automatic Uber Eats and DoorDash polling so one designated POS can remain the marketplace synchroniser.

## Confirmed Product Decisions

- Live Orders has one list only. It no longer groups orders into Overdue, Needs action, Ready, or other sections.
- Marketplace auto-sync is a per-tablet setting and defaults to enabled, preserving the current rollout for existing devices.
- When auto-sync is disabled on a tablet, that tablet performs no automatic marketplace polling, importing, or automatic marketplace status reconciliation. Manual marketplace actions continue to work.
- Disabling the setting is the operational isolation switch: staff can leave it enabled on one POS and disable it on all other POS terminals while investigating peak-time load.
- Realtime order-list refresh, manual refresh, printer automation, manual marketplace import/status actions, and normal POS order mutations remain available regardless of this setting.

## Current Bottlenecks

The approximately 2,200 requests to each provider's `/active` endpoint in six hours is consistent with two terminals polling both providers every 15 seconds: the theoretical maximum is 2,880 requests per provider. It is not evidence of a duplicate interval by itself.

The current automatic run is nevertheless expensive at peak time:

1. Each `/active` request performs POS authentication and credential lookup before waiting for the external marketplace API.
2. For every active or missing open marketplace order, the client starts a detail request and POS import/status sync without a concurrency limit.
3. The import path reads a complete local order with all items and add-ons even when it ultimately finds no status change.
4. Each order mutation advances `order_sync_state`, causing every active tablet to invalidate and refetch order-list queries.
5. Live Orders currently fetches every candidate order with all items/add-ons, filters old terminal orders on-device, renders nested scroll views, and rerenders the entire screen every second for elapsed-time labels.

`fetch` itself is asynchronous and does not block the React Native JS thread while it waits. The visible freeze is the combined effect of large responses, JSON/object mapping, many simultaneous completion callbacks and cache invalidations, then a non-virtualized list rerender.

## Architecture

### 1. Per-tablet auto-sync setting

Add `marketplaceAutoSyncEnabled: boolean` to the existing AsyncStorage-backed `AppSettings`, defaulting to `true`. Older stored settings normalise to `true`.

The Settings screen exposes a Marketplace auto-sync switch with copy explaining that it controls automatic background checks only and leaves manual refresh/import/status actions available. Saving applies immediately through the existing app-settings store and listener.

The root layout keeps authentication access separate from the device preference. A small controller inside `AppSettingsProvider` passes `authenticated && marketplaceAutoSyncEnabled` to `MarketplaceSyncProvider`; therefore settings hydration cannot start an unwanted poll before the persisted preference is known.

Turning the switch off stops the interval immediately and invalidates the coordinator's current automatic-run generation. Requests already in flight cannot safely be force-cancelled through the current marketplace interfaces, but they are prevented from importing or changing local status after the switch is turned off. Turning it on while the app is active starts one immediate normal poll, then resumes its interval.

### 2. Bounded marketplace poll work

Keep the existing single coordinator, foreground-only behaviour, business-hour guard, and no-overlapping-poll guard. Change a poll from unbounded `Promise.all` fanout to a shared, bounded work queue with at most two detail/import/status jobs at a time across both providers.

For each active marketplace ID, perform a lightweight local identity-and-status lookup first. If the local order exists and its mapped marketplace status is unchanged, do not fetch/import the full local order graph and do not write to `orders`. New orders still fetch detail and use the existing full importer; changed existing orders still use the existing status-only update path. The legacy trimmed-ID fallback stays intact.

History reconciliation remains, but uses the same bounded queue and only considers non-terminal local marketplace orders absent from the active response. Per-provider and per-order failures continue to be isolated and retried on a later poll. Manual `syncMarketplaceOrderOnDemand` remains outside this automatic coordinator and is deliberately not disabled or throttled by the tablet setting.

### 3. Lean live-order query and list contract

Create a dedicated live-order list read rather than changing general `getAllOrders`, so history, detail, printing, and edit flows retain their full-order contract. The new query:

- selects only fields needed by the live-order card and its actions; it does not embed `order_items` or `order_item_addons`;
- applies the live pickup window at the source: ASAP orders plus scheduled orders due by the existing 30-minute cutoff;
- excludes terminal statuses and `pending_online_payment` at the source; and
- orders by the existing display timestamp so the client only applies the shared eligibility guard and stable chronological ordering.

The shared live eligibility helper remains the correctness backstop for timezone and scheduled-pickup rules. Opening an order, printing it, or performing an action that requires items continues to use `getOrder(id)` and fetches the full detail on demand. `order_sync_state` continues to invalidate only order-list caches; it does not touch cart, route, modal, or draft state.

### 4. One virtualized live-order queue

Replace grouped sections and nested `ScrollView`s with one `FlatList` over the chronological eligible orders. Preserve the existing card actions, pull-to-refresh, empty/error/loading states, status colouring, delivery information, and optional display-card style. Remove group headers and group-specific scrolling entirely.

Memoize list rows and stabilise their callbacks. Replace the screen-wide one-second `nowMs` state with an isolated elapsed-time label that refreshes at the minimum useful cadence, so updating a time label does not cause every live-order card or the whole list to render. Keep list keys stable and retain FlatList virtualization settings appropriate for the tablet form factor.

## Observability

Instrument automatic polls with provider-level active-request duration, active-order count, queued work count, jobs skipped as unchanged, jobs completed, and failures. Add server-side timing around authentication, credentials retrieval, and external provider fetch for `/active`, emitting structured duration data that can be correlated with New Relic traces. The device setting state must be included in client-side diagnostic events but must never expose credentials or customer data.

This will distinguish an external-provider slowdown from local database/auth time and make the one-POS-versus-two-POS isolation test measurable.

## Failure and Safety Behaviour

- A disabled tablet cannot start another automatic poll or write a marketplace update from an invalidated automatic run.
- A failed provider, individual detail request, or local status update does not stop the other provider or manual staff work.
- Full marketplace import remains idempotent through the existing provider-plus-trimmed-external-ID identity and database uniqueness protection.
- No automatic path overwrites locally managed order items, prices, customer data, notes, payment information, or marketplace financial snapshots on an existing order.
- Realtime signals caused by a synchronising tablet remain the source of truth for other tablets' Live Orders; they only make their smaller list query refresh.

## Verification

Automated coverage will prove settings migration/defaults, immediate coordinator stop/start, disabled-run write suppression, retained manual sync, the queue concurrency limit, unchanged-status skipping, and failure isolation. Query tests will prove terminal orders and full item graphs are absent from the list read while ASAP and eligible scheduled orders remain.

Focused UI tests will prove one `FlatList` is used without group headers/nested list scrolling and that list-row props remain stable across elapsed-time updates. Run the POS unit suite and TypeScript check.

Manual release checks use two physical POS terminals during a busy-order simulation: disable auto-sync on terminal B, confirm only terminal A makes `/active` calls and imports/status-reconciles marketplace orders, confirm B receives live-list updates through realtime, and confirm manual marketplace refresh/status action still works on B. Compare New Relic timing and JS/UI responsiveness with one synchroniser versus two before enabling the setting fleet-wide.
