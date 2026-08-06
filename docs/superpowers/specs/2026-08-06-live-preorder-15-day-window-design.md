# Live Preorder 15-Day Window Design

## Goal

Keep a scheduled preorder visible and eligible for automatic printing when it reaches
the 30-minute live window, even if it was created more than 24 hours ago. Limit this
scheduled-order lookback to 15 days.

## Current Problem

Pre-orders are removed from the Pre-orders tab when pickup is 30 minutes or less
away. Live Orders currently fetches only rows created in the last 24 hours, so a
preorder created earlier can disappear from both tabs at that boundary. The auto-print
scan already uses scheduled pickup time rather than creation time, creating a
different visibility and automation data set.

## Design

Keep the existing 24-hour `created_at` query for ordinary unscheduled live orders.
Add a scheduled-order query for pickup times from `now - 15 days` through
`now + 30 minutes`. Combine and de-duplicate the two result sets by order ID, then
apply the shared live-order predicate and existing pickup-time sorting.

Use one exported `PREORDER_AUTOMATION_LOOKBACK_MS` value for the scheduled query so
Live Orders and automatic printing use the same 15-day window.

## Behavior

- A scheduled order more than 30 minutes ahead remains in Pre-orders.
- At or inside 30 minutes, a scheduled order is removed from Pre-orders and appears
  in Live Orders, regardless of when it was created, provided its pickup time is no
  more than 15 days in the past.
- Ordinary unscheduled orders remain limited to 24 hours by creation time.
- Scheduled orders older than 15 days do not appear in Live Orders or the automatic
  print scan.

## Testing

Add unit tests for the shared scheduled range at 15 days and for merging a week-old,
currently-live scheduled order into the Live Orders result. Retain the exact
30-minute boundary test.

## Scope

No changes to printer routing, claims, receipt rendering, or order status handling.
