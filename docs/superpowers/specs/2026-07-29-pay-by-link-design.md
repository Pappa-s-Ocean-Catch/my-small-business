# Pay by Link design

## Goal

Let staff collect payment for an unpaid POS order by SMSing a Stripe-hosted checkout URL to the customer. Immediately show the same URL as a QR code on the iPad. Stripe's signed webhook is the source of truth for payment completion.

## iPad flow

1. Show **Pay by Link** from order details only for unpaid, non-cancelled orders.
2. Resolve the customer in the iPad app using the existing Supabase customer lookup by phone.
   - If the order already has a customer and phone, use them.
   - Otherwise collect an Australian phone number.
   - If that phone belongs to an existing customer, associate that profile with the order.
   - If no customer is found, collect a name, create a customer profile, and associate it with the order.
3. Persist `user_id`, customer name, and normalized phone on the order before requesting a payment link.
4. Request one authenticated server operation to create the Stripe Checkout Session and send its URL by SMS.
5. On success, show a dismissible iPad dialog with the QR code, amount, and confirmation that the SMS was sent. Staff can request a new link if necessary.

## Server flow

The new POS payment-link endpoint accepts an order ID only, authenticates the staff user, and obtains the current order plus order items with server-side credentials. It rejects paid, completed, and cancelled orders. It creates a Stripe Checkout Session using persisted values, attaches the order ID in metadata, sends the URL to the order's persisted customer phone, and returns the URL to the iPad.

The client never provides the amount, line items, or destination phone for the server operation.

## Stripe and data updates

Stripe Checkout Sessions are used instead of static Stripe Payment Links because each payment needs order-specific totals and metadata. Add order fields to retain the latest checkout session ID and its creation time. Re-generation replaces those fields with the current session.

The existing signed Stripe webhook remains the payment authority. On Checkout completion (and its Payment Intent fallback), it marks the order paid, marks online payment as the tender detail, and confirms the order only when it remains in a pending state. It is safe to receive duplicate events and preserves existing Shipday and reward-point processing.

## Failure handling

- No SMS or QR is produced until customer association succeeds.
- Server validation failures, Stripe errors, and SMS errors are surfaced to staff without incorrectly marking the order paid.
- Payment completion is never inferred from opening/scanning the URL; only the verified Stripe webhook changes payment status.

## Verification

- Unit tests cover request validation, persisted-order pricing, session metadata, SMS destination, and webhook transitions/idempotency.
- iPad type/unit verification covers customer association and QR/link state.
- Run the targeted app and web checks after implementation.
