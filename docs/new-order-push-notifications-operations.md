# New Order Push Notifications: Safe Production Setup

## Safety boundary

The implementation does not change `public.orders`. The migration creates only two independent notification tables. The Database Webhook is configured by Supabase to run after an order `INSERT` has committed; it cannot reject, roll back, or delay the order/POS transaction.

If device registration, the webhook, the Edge Function, Expo, or Firebase fails, the order remains in Live Orders and follows the current payment, printing, and realtime flow. Only the push alert may be missed or retried.

## Deploy in this order

1. Review the migration and confirm it has no `ALTER TABLE public.orders`, `CREATE TRIGGER`, `REFERENCES public.orders`, or order policy/function.

2. Apply only the standalone migration:

```bash
supabase db push
```

3. Generate a long random value and set the Edge Function secrets. Do not put either secret in the APK, repository, `app.config.js`, or `google-services.json`.

```bash
supabase secrets set ORDER_PUSH_WEBHOOK_SECRET='<long-random-secret>'
supabase secrets set EXPO_ACCESS_TOKEN='<Expo access token>'
```

4. Deploy the function without Supabase JWT verification; it validates the separate secret header itself:

```bash
supabase functions deploy send-new-order-push --no-verify-jwt
```

5. In Supabase Dashboard → Database → Webhooks, create a webhook named `send-new-order-push`:

   - Table: `public.orders`
   - Event: `INSERT`
   - Method: `POST`
   - URL: `https://<project-ref>.supabase.co/functions/v1/send-new-order-push`
   - Header: `x-order-push-webhook-secret: <same long random secret>`

   This is intentionally a Dashboard Database Webhook, not a repository migration. It is asynchronous after the order has committed.

6. Add a Supabase Cron Job that POSTs `{ "retry": true }` to the same function once per minute with the identical secret header. This is only for notification retry jobs; it does not access `orders`.

7. In Expo, upload the Android FCM v1 service-account key to the project. Keep the private service-account JSON ignored by Git. `google-services.json` must stay available locally at `apps/pappas-order-management/google-services.json` for native builds.

8. Build a fresh Android APK, install it on every Order Management device, sign in as staff/admin, and grant notifications:

```bash
pnpm --filter pappas-order-management build:android:apk
```

An OTA update alone cannot add the native notification module or Android notification permission.

## Acceptance test

1. On two physical Android devices, install the new APK, sign in, and allow notifications.
2. Create one order through the normal POS/online/marketplace flow.
3. Confirm the order immediately appears in Live Orders and printing/payment continue normally.
4. Confirm both devices receive one `New order #...` alert and tapping it opens the matching order.
5. Temporarily disable the Dashboard webhook, create another order, and confirm Live Orders/printing/payment still work. Re-enable it after the test.
6. Reinstall one device app, create another order, and confirm an invalid prior device token is removed without affecting the other device.

## Rollback

Disable or delete the `send-new-order-push` Database Webhook in Supabase Dashboard. This immediately stops new notification attempts without modifying, deleting, delaying, or rolling back any orders. The independent notification tables can be left in place for audit/retry history.
