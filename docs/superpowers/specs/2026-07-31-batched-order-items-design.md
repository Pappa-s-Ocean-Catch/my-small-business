# Batched Order Item Loading Design

## Goal

Reduce refresh time on the admin orders page by retrieving items for the selected day's orders in one database request.

## Data Flow

`getAllOrders` will continue to apply date, status, and payment filters to the `orders` query. After it receives the filtered order IDs, it will retrieve all matching `order_items` through one `IN` query. The server will group items by `order_id` and return the existing `Order[]` response shape, so the page needs no client-side data transformation.

## Error Handling and Performance

An empty order result skips the item query. An item-query failure retains the existing behaviour of returning each order with an empty item list while logging the database error. The existing indexes on `orders.created_at` and `order_items.order_id` support the two queries.

## Testing

A unit test will verify that items are attached to their matching order IDs and that orders with no items receive an empty list. This protects the grouping behaviour independently from Supabase network access.
