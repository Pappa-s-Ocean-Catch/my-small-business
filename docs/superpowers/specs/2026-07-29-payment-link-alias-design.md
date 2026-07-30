# Payment link alias design

All customer-facing payment links use an eight-character uppercase alphanumeric token at `/pay/<token>`. A `payment_links` row maps that token to the Stripe Checkout URL and order, expires after 24 hours, and is resolved server-side by a public redirect route. POS Pay by Link and delivery pending-payment SMS share the same server helper. Stripe Checkout metadata and the existing payment webhook remain unchanged.
