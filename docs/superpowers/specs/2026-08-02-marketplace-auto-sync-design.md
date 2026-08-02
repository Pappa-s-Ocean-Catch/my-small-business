# Marketplace Auto-Sync to POS Design

## Goal

While an authenticated POS app is open, automatically import new active Uber Eats and DoorDash orders into POS every 30 seconds, then keep only their internal POS status synchronized with the marketplace.

## Scope

The sync runs in the foreground POS application only. It does not run as a server-side background job and it makes no update when the app is closed.

## Polling and provider data

A single app-level sync provider starts after POS authentication and polls every 30 seconds. Each run fetches active orders for Uber Eats and DoorDash, then fetches full detail for each active order.

Runs cannot overlap. Per-provider or per-order errors are logged and do not prevent other orders from being processed on that run; a failed order retries on the next interval.

## New orders

For an active marketplace order that has no matching local third-party order (provider plus trimmed external ID), the sync creates the full POS order through the same reusable importer as manual Add to POS:

- Products, add-ons, eligible ingredient removals, customer data, marketplace financial snapshot, and initial mapped status are saved once.
- The new order uses the normal POS order-save pathway, so existing printer automation receives it as a normal eligible live order.
- The existing database uniqueness index is the final idempotency guard for concurrent polls/devices.

## Existing orders

For a marketplace order already in POS, each poll may update only `orders.order_status`.

It must never overwrite order items, customisations, prices, discounts, notes, customer fields, payment data, or marketplace financial snapshots because staff may have changed those after import.

## Status mapping and delivery flow

Add a POS `on_the_way` status and render it in the existing On the way tab.

The shared status mapper uses normalized provider state, status description, and state-change timeline:

- Accepted, pending, or restaurant preparation: `confirmed` or `preparing`.
- Ready for courier pickup: `ready`.
- Courier/driver picked up, en route, or out for delivery: `on_the_way`.
- Delivered or completed: `completed`.
- Cancelled: `cancelled`.
- Refunded: `refunded`.

DoorDash detail already yields `PICKED_UP`, `DELIVERED`, and `COMPLETED` timeline events. Uber detail includes `orderJobState`, `statusDescription`, and `orderStateChanges`; the mapper applies the same normalized lifecycle rules to all three sources.

## Data flow

```text
POS open → every 30s → active Uber + DoorDash lists
  → full marketplace detail per active order
  → no local provider/ID match: create full POS order → normal auto-print
  → local match: map current provider lifecycle → update only order_status
```

## Verification

Tests cover status mapping for ready, picked-up/on-the-way, delivered/completed, cancelled, and refunded states; idempotent new-order detection; status-only updates; and interval overlap prevention. Manual verification confirms a newly imported confirmed order follows existing printer automation and an on-the-way order appears in the delivery tab.

