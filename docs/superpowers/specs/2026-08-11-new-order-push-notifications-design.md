# New Order Push Notifications Design

## Goal

Notify every signed-in Pappas Order Management device when a new order is created, including when the app is backgrounded or closed, without allowing notification failures to affect order creation, POS checkout, payment, printing, or realtime order updates.

## Architecture

The Order Management Expo app registers its Expo push token after a staff user signs in and keeps the token in a dedicated, staff-only `order_management_push_devices` table. Token registration is best-effort and never changes authentication or navigation behaviour.

Supabase Dashboard Database Webhook configuration observes `INSERT` on `public.orders` only after the order row has committed. It invokes a `send-new-order-push` Edge Function with the inserted order record. The function creates and updates notification jobs in its own isolated table, sends the notification to every active device token through the Expo Push Service, removes tokens that Expo reports as unregistered, and records retryable failures.

There is no application-owned database trigger, schema constraint, foreign key, or database function attached to `public.orders`. The webhook/Edge Function path is explicitly outside the order creation path. A webhook failure, unavailable Expo API, invalid token, or Edge Function error can only leave a job pending or failed; it must never reject, roll back, delay, or alter an order.

## Data model

### `order_management_push_devices`

- One active Expo token per installed Order Management app instance.
- Stores the Expo push token, optional authenticated staff user ID, last-seen timestamp, and created/updated timestamps.
- Restrict client writes to the currently authenticated staff user and deny general reads; only the server-side function can enumerate tokens.
- Token upserts are idempotent so app restarts and token rollovers are safe.

### `push_notification_jobs`

- One `new_order` job per webhook-received order, protected by a unique `order_id` value with no foreign key to `orders`.
- Stores only operational order details needed for the notification: order ID, order number, channel, total, current status, delivery state, attempt count, last error, and timestamps.
- Tracks `pending`, `sending`, `sent`, and `failed` status. Failed temporary sends remain retryable; terminal invalid device tokens are removed.

## Notification behaviour

- Title: `New order #<order number>`.
- Body: compact source and amount summary; do not include customer contact details or the full item list in the push payload.
- Data includes the order ID and a `new_order` event type.
- Tapping the notification navigates the staff app to that order.
- When foregrounded, the app registers a notification handler so staff see the alert consistently. Existing realtime and local sound behaviour stays unchanged as the fallback for an open app.

## Failure isolation and recovery

- The application does not install a database trigger or function on `orders`.
- The Supabase-managed webhook runs asynchronously after the database transaction and does not block it.
- The Edge Function uses an Expo access token stored as a Supabase secret; it is never bundled into the APK.
- Job transitions use short, bounded retries with recorded error details. A later retry invocation may resend only jobs still pending/failed; the unique order job prevents duplicate logical jobs.
- Failure to register a device token, receive a token, send a push, inspect receipts, or navigate from a notification is caught and logged without crashing the app.
- Invalid or unregistered Expo tokens are deleted so future sends are not wasted.

## Native app configuration

- Install `expo-notifications` and add its Expo config plugin.
- Add the Android Firebase `google-services.json` configuration and notification channel/icon settings.
- Build a new APK after native configuration changes.
- Configure Android FCM v1 credentials with the Expo project before production testing.

## Testing

- Unit-test notification payload construction and safe deep-link parsing.
- Unit-test token upsert and notification registration wrappers using dependency injection; registration failure must resolve safely.
- Test database schema constraints and trigger insertion with a local Supabase database where available.
- Test the Edge Function with fake Expo responses for: all sends accepted, temporary failure retry, and `DeviceNotRegistered` cleanup.
- Manually verify on two physical Android devices that one new online/POS/marketplace order creates an order even when Expo delivery is unavailable, and that both devices receive the alert once service is available.

## Deployment requirements

- Apply only the isolated notification tables migration before deploying the Edge Function and mobile build; it does not modify `orders`.
- Set the Expo access token as a Supabase Edge Function secret.
- Create the Supabase Database Webhook only after the function is deployed and authenticated with a secret header.
- Upload FCM v1 credentials to the Expo project, build/install a fresh Android APK, grant notification permission, and sign in once on each staff device.
