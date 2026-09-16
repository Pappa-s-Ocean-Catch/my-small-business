# POS Mirror Design

## Goal

Add a standalone Expo React Native app named `pos-mirror` that shows a live, customer-facing summary of the cart being edited on a selected mother POS register. The first release targets iOS and Android, uses a full-screen landscape-first layout, and does not support web.

The mother POS publishes a compact cart snapshot to Supabase. The mirror fetches and subscribes to the row whose `register_id` matches the ID configured in the mirror app. After a checkout workflow completes successfully, the POS clears the snapshot and the mirror returns to its idle presentation.

## Scope

The first release includes:

- a new Expo SDK 54 app at `apps/pos-mirror`;
- the existing Supabase email/password sign-in flow;
- the existing staff-or-admin authorization rule;
- local configuration of the mother POS Register ID;
- a full-screen active-cart and idle display;
- a Supabase table, RLS policies, and Realtime publication;
- non-blocking cart publication from `apps/pappas-order-management`;
- reset after successful checkout and explicit cart clearing;
- focused tests for payloads, synchronization, settings, and lifecycle behavior.

The first release does not include web support, remote device management, pairing by QR code, multiple registers on one mirror, customer interaction, advertising rotation, or the final idle artwork. The idle screen will use a replaceable branded placeholder until the final image is supplied.

## Existing Register Identity

The integration reuses `SmartpayPairingSettings.posRegisterId`, which is already generated once and persisted locally for each mother POS device. No second register identifier is introduced.

The POS Integration screen remains the place where staff can view and copy this value. The mirror settings screen accepts the same value and stores it locally with AsyncStorage.

Loading the Smartpay pairing settings creates the ID when it does not exist. Mirror synchronization does not require the register to be paired with a Smartpay terminal.

## Architecture

The chosen approach is a durable Supabase row plus Realtime updates.

The mother POS builds a versioned JSON snapshot from its current cart and upserts it into one row keyed by `posRegisterId`. The mirror performs an initial row fetch, subscribes to updates for that register, and displays the latest valid snapshot. This fetch-plus-subscribe design lets a newly opened or reconnected mirror recover the current cart instead of relying on an ephemeral event.

Alternative approaches were rejected:

- An RPC-only write path adds complexity without improving the initial two-column data contract.
- Realtime Broadcast can lose the current cart when the mirror opens late or reconnects.

## Database Contract

Create `public.pos_mirror_state` with exactly two application columns:

```sql
register_id text primary key,
current_order jsonb not null default '{}'::jsonb
```

The table is added idempotently to the `supabase_realtime` publication and uses full replica identity for reliable update payloads.

RLS is enabled. Authenticated users whose profile role is `staff` or `admin` may select, insert, and update rows. Anonymous users, customers, and other roles have no access. Delete access is not needed because clearing uses `current_order = '{}'`.

The app uses the public anon key plus the signed-in user session. It never contains a service-role key.

## Snapshot Contract

An active cart is represented by a JSON object with this initial shape:

```json
{
  "version": 1,
  "updatedAt": "2026-09-16T00:00:00.000Z",
  "itemCount": 3,
  "items": [
    {
      "id": "cart-line-id",
      "name": "Product display name",
      "quantity": 2,
      "unitPrice": 12.5,
      "lineTotal": 25
    }
  ],
  "subtotal": 30,
  "discount": 5,
  "total": 25
}
```

`itemCount` is the sum of quantities, not the number of distinct lines. Currency values are finite, non-negative numbers rounded to two decimal places. The display name uses the same customer-readable product naming already prepared by the POS, including relevant selected customizations where the current POS display-name helper includes them.

An idle register is represented only by `{}`. The JSON parser treats malformed, unsupported, or structurally invalid data as unavailable and does not crash the display. The `version` field permits additive evolution later.

## Mother POS Publication

A focused mirror synchronization module owns:

- snapshot construction and normalization;
- resolving the existing `posRegisterId`;
- debounced, latest-value publication;
- explicit clearing;
- warning-only error reporting.

The POS screen observes the cart and calculated totals. Cart or total changes schedule a short debounced upsert so rapid quantity changes do not create unnecessary writes. Empty carts publish `{}`. The publisher prevents an older in-flight write from becoming the final state after a newer snapshot by serializing writes and retaining the latest requested value.

Publication is fail-open. Mirror network or database errors must never block cart editing, checkout, payment, order persistence, navigation, or printing. Errors are logged without secrets and later cart changes trigger another attempt.

All successful checkout paths clear the mirror after the workflow reaches its user-visible success point. For Smartpay, creating or reusing a temporary pending order is not success; the cart remains visible through terminal approval and clears after the payment/order workflow completes. Failed or cancelled checkouts retain the current cart. Explicit Clear Cart also publishes `{}` through the normal cart observer.

When the POS screen unmounts, it does not automatically clear the remote snapshot: unmounting can occur during navigation or app lifecycle transitions and must not erase an active customer display accidentally.

## Mirror App Flow

On launch, the app restores the Supabase session and applies the same staff-or-admin authorization check as the current order-management app.

- No valid session: show login.
- Authenticated but unauthorized: sign out and show an access error.
- Authorized with no configured Register ID: open mirror settings.
- Authorized with a configured Register ID: open the display and connect to that row.

The login screen uses email and password. The settings screen stores a trimmed Register ID in AsyncStorage, allows it to be changed, and offers sign-out. A missing row is valid and means the display is waiting for the mother POS to publish its first snapshot.

The display first subscribes, then fetches and reconciles the current row so an update that occurs during startup is not overwritten by an older fetch result. Snapshot `updatedAt` values are used to retain the newest valid state. On Realtime channel reconnection, the app fetches the row again.

## Customer-Facing UI

The app keeps the screen awake and hides normal navigation chrome. Its layout is optimized for a landscape customer display but remains usable if an iOS or Android device rotates.

The active state contains:

- a clear order-summary heading;
- a large, scrollable list of item name, quantity, unit price, and line total;
- an item count;
- subtotal and discount rows when applicable;
- a visually dominant final total;
- high contrast, large touch-independent typography, and safe-area handling.

The idle state contains a branded placeholder, welcome message, and reserved image area that can later be replaced by the supplied artwork without changing synchronization logic.

An unobtrusive settings control, or a deliberate long-press target, allows staff to leave display mode. Settings access must not visually compete with order information.

Connection status behavior:

- Initial loading uses a neutral loading state.
- A missing row shows “Waiting for this register”.
- During temporary disconnection, the last valid snapshot remains visible with a discreet reconnecting banner.
- Authentication loss returns to login.
- Invalid snapshot data shows the idle presentation plus a non-sensitive configuration warning.

## App Structure

The new app will use small modules with clear boundaries:

- app routes for login, display, and settings;
- a React Native Supabase client with AsyncStorage session persistence;
- an authorization helper matching the existing staff/admin policy;
- local mirror-settings load/save/validation;
- pure snapshot parsing and validation;
- a subscription coordinator that combines initial fetch, filtered Realtime updates, reconnection fetches, and cleanup;
- presentational idle and active-order components.

Shared business contracts that genuinely serve both apps may live in a small workspace library or an app-independent module. Native app configuration and UI remain inside each app. The existing Next.js-oriented `@my-small-business/supabase` package is not reused for React Native because it depends on browser/server clients and Next.js.

## Testing and Verification

Development follows focused test-first increments.

Automated coverage will include:

- snapshot construction, rounding, item counts, empty carts, and malformed values;
- snapshot parsing, unsupported versions, and invalid JSON shapes;
- debouncing, serialized writes, and latest-value-wins behavior;
- initial fetch and Realtime race ordering;
- reconnect fetch and subscription cleanup;
- Register ID trimming and persistence;
- authentication and role gating structure;
- SQL assertions for schema, RLS roles, and Realtime publication;
- POS explicit clear and successful-checkout reset hooks, including the Smartpay pending-order boundary.

Verification will run the new app's focused unit tests, TypeScript checks, Expo configuration checks, relevant mother POS focused tests, SQL tests when local Supabase/PostgreSQL is available, and `git diff --check`.

The existing full POS unit suite may remain blocked by unrelated native printer TypeScript errors. If so, that boundary will be reported separately rather than presented as feature failure or success.

Simulator/build checks do not prove kiosk presentation, safe-area behavior, text sizing, rotation, keep-awake behavior, or long-running Realtime recovery on physical hardware. Final release acceptance therefore requires fresh iOS and Android builds installed on representative customer-display devices, plus a mother POS, to exercise add/edit/remove, clear, successful checkout, failed checkout, Smartpay approval, background/foreground, and network reconnection.

## Acceptance Criteria

- `apps/pos-mirror` launches on iOS and Android and has no web target or web script.
- Staff/admin users can sign in; other users cannot access mirror data.
- The configured Register ID persists across restarts and can be changed or cleared.
- A new mirror fetches the current cart and then reflects later cart edits without manual refresh.
- Only changes for the configured Register ID affect the display.
- The active display shows item names, quantities, prices, item count, discounts, and total from a validated versioned snapshot.
- Explicit cart clearing returns the mirror to idle.
- A completed checkout returns the mirror to idle, while a failed checkout or a temporary Smartpay pending-order save does not.
- Mirror synchronization failures never prevent core POS operations.
- Reconnection retains the last valid view and then reconciles with Supabase.
- No service-role credential or other secret is stored in either app bundle.
