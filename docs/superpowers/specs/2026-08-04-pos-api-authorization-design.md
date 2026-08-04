# POS API Authorization Design

## Goal

Require a valid Supabase session belonging to a `staff` or `admin` profile for every API endpoint that is exclusively invoked by the order-management app, without breaking public customer ordering.

## Scope and boundary

The order-management client invokes both POS-only and shared public APIs. The following endpoints are intentionally public because the customer checkout invokes them:

- `POST /api/payments/create-checkout-session`
- `POST /api/delivery/quote`
- `POST /api/payments/calculate-fees`
- `GET /api/places/autocomplete`
- `GET /api/places/details`

`POST /api/orders/status-email` is also shared: public checkout uses it for the `placed` email. It cannot be converted to staff-only without breaking online ordering.

## Design

1. Add one server-only authorization helper that reads a Bearer token, resolves the Supabase user with the service-role client, and permits only profiles whose role is `staff` or `admin`. It returns a 401 response for a missing or invalid token and a 403 response for authenticated non-staff users.
2. Apply that helper to `POST /api/pos/send-payment-link-sms`, which is called only by the POS delivery-payment flow.
3. Add `POST /api/pos/orders/status-email`, protected by the helper, and move the order-management client to it. The original `/api/orders/status-email` remains available for the public checkout's `placed` notification.
4. Update the POS delivery and status-email clients to retrieve the current Supabase access token and include it in the Authorization header. A missing local session fails before a request is sent with a clear re-authentication error.
5. Preserve existing authenticated endpoints and public checkout behavior. No role model or database policy changes are included.

## Error handling

- POS calls return or surface `Missing authenticated session` when the device has no access token.
- The server returns JSON 401 for missing/invalid Bearer tokens and JSON 403 for customer accounts.
- Existing delivery/SMS failure payloads remain unchanged after authorization succeeds.

## Tests

- Unit-test the extracted role predicate/authorization response behavior without live Supabase credentials.
- Add client tests for authenticated request headers where the existing test harness can compile them.
- Run the relevant unit tests, mobile TypeScript test compilation, and web lint/type validation.
