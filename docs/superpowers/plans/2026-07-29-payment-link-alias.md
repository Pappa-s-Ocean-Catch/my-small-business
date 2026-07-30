# Payment Link Alias Implementation Plan

**Goal:** Replace long Stripe URLs in POS and delivery SMS/QR payment links with short `/pay/<token>` aliases.

1. Add `payment_links` schema with unique token, order ID, Stripe URL, expiry, and RLS/public lookup policy.
2. Add shared server helper to create collision-safe eight-character aliases.
3. Add `/pay/[token]` public resolver/redirect with expiry handling.
4. Apply helper to POS and delivery payment-link creation, then verify web typecheck/build and iPad tests.
