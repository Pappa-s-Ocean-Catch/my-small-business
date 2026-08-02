# Marketplace History Fallback Design

## Goal

Keep locally open marketplace orders synchronized after they disappear from a provider's active-order response.

## Data contract

Persist the provider workflow UUID on each imported third-party POS order. The UUID is saved only on creation and is never replaced by later status syncs.

## Reconciliation

On every foreground sync run, compare local open third-party orders with the active order IDs returned for their provider.

For each local order absent from the active response:

1. Fetch provider order detail with `mode: 'history'` using the persisted workflow UUID.
2. Map the returned state, description, and timeline through the shared lifecycle mapper.
3. Update only `orders.order_status`.
4. Leave all staff-managed and imported order data untouched.

If history detail cannot be fetched or has no terminal/corrected state, retain the local status and retry on the next 30-second run.

## Safety

The fallback applies only to third-party orders with a non-null workflow UUID and non-terminal POS status. It does not insert orders, change financial snapshots, or modify order items, notes, customers, prices, or payment fields.

