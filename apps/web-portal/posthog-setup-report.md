<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. Six analytics events were instrumented across four files — covering the full customer journey from product discovery through checkout and order completion. Client-side events use `posthog-js` directly; server-side events in Next.js Server Actions use the `posthog-node` client via `getPostHogClient()` with `await posthog.shutdown()` to flush before the function returns.

| Event | Description | File |
|---|---|---|
| `product_viewed` | Fired when a user views a product detail page | `src/app/order/product/[id]/ProductDetailsClient.tsx` |
| `add_to_cart` | Fired when a user adds a product to their cart | `src/app/order/product/[id]/ProductDetailsClient.tsx` |
| `checkout_cancelled` | Fired when a user cancels their checkout/order | `src/app/order/checkout/page.tsx` |
| `checkout_error` | Fired when an error occurs during checkout or order submission | `src/app/order/checkout/page.tsx` |
| `promotion_applied` | Fired when a user applies a promotion/coupon code during checkout | `src/app/order/checkout/page.tsx` |
| `reward_points_applied` | Fired when a user applies reward points toward an order | `src/app/actions/reward-points.ts` |
| `order_created` | Fired server-side when a new order record is successfully created | `src/app/actions/orders.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/352885/dashboard/1415684
- **Purchase Funnel: View → Cart → Order** (conversion funnel): https://us.posthog.com/project/352885/insights/krzReg6N
- **Daily Orders** (order volume trend): https://us.posthog.com/project/352885/insights/anQjfWUo
- **Checkout Errors** (error rate trend): https://us.posthog.com/project/352885/insights/741xVUjn
- **Reward Points Usage** (loyalty engagement trend): https://us.posthog.com/project/352885/insights/Wcib3uqA
- **Promotions Applied** (promotion uptake trend): https://us.posthog.com/project/352885/insights/5v9kInhl

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
