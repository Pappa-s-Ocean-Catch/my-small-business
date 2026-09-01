# POS Live Order Performance Validation

## Database plan check

Do not apply the migration from the POS client. In a production-like Supabase SQL environment, inspect the candidate query before rollout:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at, scheduled_pickup_at, order_status, payment_status
FROM public.orders
WHERE created_at >= now() - interval '14 days'
  AND order_status NOT IN ('completed', 'cancelled', 'refunded', 'pending_online_payment')
  AND payment_status <> 'refunded'
ORDER BY created_at DESC;
```

The expected index is `idx_orders_open_candidate_created_at`. If the query plan does not use it, retain the output and adjust the index from that evidence; do not add speculative indexes.

## Tablet capture

At a busy period, collect redacted `live-orders-query` console records. Each record contains only:

- `candidateDurationMs`
- `hydrationDurationMs`
- `candidateCount`
- `eligibleCount`
- `hydratedCount`

Confirm that `hydratedCount` matches the visible Live Order cards. Then validate a future preorder, a preorder entering the 30-minute live window, auto-print, on-the-way removal, and delivery refresh. Do not include order, customer, cookie, token, or authorization data in the capture.
