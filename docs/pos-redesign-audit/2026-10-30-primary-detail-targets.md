# Primary labels open details

Customer names and customer-directory rows now open customer details without a separate View button. Order references, history rows, scheduled-order cards and recent orders in customer profiles open order details directly. Customer taps inside order cards stop propagation so they do not also open the order.

Order-detail header and customer-summary names both open the customer profile. Reward-history order references open their linked order; a separate chevron retains reward expansion. Coupon titles open coupon details while Copy code remains independent. The phone cart entry remains available with an Order label.

Existing navigation callbacks, return context and independent payment, printing and status controls are retained.

## Verification

- Unit suite: 424 passed, 0 failed.
- Added callback tests for compact/full history rows, customer-directory rows, scheduled-order rows, linked reward orders and both customer-name targets in order details.
- Source guard checks that redundant View customer / View order buttons do not return in these surfaces.
- `git diff --check` passed.
- Typecheck retains the 13 existing ReceiptQrCode / caller-ID errors; no errors reported in the changed UI files.
- Native simulator interaction and visual validation remain outstanding. The available simulator was running an unrelated app. No live order, payment or print action was performed.
