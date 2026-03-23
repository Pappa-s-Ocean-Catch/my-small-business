<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the OperateFlow Next.js App Router application. PostHog is initialized client-side via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), with a server-side client in `src/lib/posthog-server.ts` for API routes and Server Actions. A reverse proxy is configured in `next.config.ts` to route PostHog requests through `/ingest`. User identity is captured at login (password and magic link) and customer signup, and is passed to both client and server-side events for full correlation.

## Action required: install packages

Due to a sandbox restriction, `posthog-js` and `posthog-node` were added to `package.json` but the package manager could not run automatically. Please run the following from the monorepo root before starting the dev server:

```
pnpm install
```

## Files created

| File | Purpose |
|------|---------|
| `instrumentation-client.ts` | Client-side PostHog initialization (Next.js 15.3+ pattern) |
| `src/lib/posthog-server.ts` | Server-side PostHog singleton for API routes and Server Actions |

## Files modified

| File | Change |
|------|--------|
| `next.config.ts` | Added `/ingest` reverse proxy rewrites + `skipTrailingSlashRedirect` |
| `package.json` | Added `posthog-js` and `posthog-node` dependencies |
| `.env.local` | Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` |

## Events instrumented

| Event | Description | File |
|-------|-------------|------|
| `user_logged_in` | User successfully logs in with password; includes `posthog.identify()` | `src/app/(auth)/login/page.tsx` |
| `magic_link_sent` | Magic link email successfully sent | `src/app/(auth)/login/page.tsx` |
| `auth_callback_completed` | User completes magic link authentication; includes `posthog.identify()` | `src/app/auth/callback/page.tsx` |
| `customer_signed_up` | New customer account created (server-side); includes `posthog.identify()` | `src/app/actions/customer-auth.ts` |
| `add_to_cart` | Item added to cart from the order menu | `src/app/order/page.tsx` |
| `add_to_cart` | Item added to cart from product detail page | `src/app/order/product/[id]/ProductDetailsClient.tsx` |
| `checkout_started` | User submits the checkout form (top of checkout funnel) | `src/app/order/checkout/page.tsx` |
| `payment_method_selected` | User selects online or in-store payment | `src/app/order/checkout/page.tsx` |
| `order_placed` | Order successfully created for in-store payment | `src/app/order/checkout/page.tsx` |
| `checkout_session_created` | Stripe checkout session created for online payment (server-side) | `src/app/api/payments/create-checkout-session/route.ts` |
| `payment_completed` | Stripe webhook confirms successful payment (server-side critical event) | `src/app/api/webhooks/stripe/route.ts` |
| `order_confirmed` | User lands on order confirmation page after payment | `src/app/order/confirmation/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://us.posthog.com/project/352885/dashboard/1387743)
- **Insight**: [Order Funnel: Cart → Checkout → Confirmed](https://us.posthog.com/project/352885/insights/ZguBRwSs)
- **Insight**: [Daily Orders vs Payments Completed](https://us.posthog.com/project/352885/insights/CKuBpV4T)
- **Insight**: [User Acquisition: Logins & Signups](https://us.posthog.com/project/352885/insights/iEd51Jqc)
- **Insight**: [Payment Method Preference](https://us.posthog.com/project/352885/insights/Km2WCF8j)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
