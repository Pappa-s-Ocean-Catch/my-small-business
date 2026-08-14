# In-store instant ticket and SmartPay order-number design

## Goal

Give staff the real ticket number as soon as an in-store SmartPay sale begins, and optionally print a fast text-only ticket immediately. This must not replace the existing image-based customer receipt.

## Current behavior

- SmartPay starts the terminal transaction before creating the order, so the UI has no real order number while waiting.
- SmartPay polls the terminal result every two seconds (with a two-second minimum).
- The automatic in-store customer receipt is rendered as a raster image before it is queued, which is appropriate for its detailed layout but adds visible delay.
- `savePosOrder` initially stores new POS orders as `pending_online_payment`; the printer automation deliberately ignores that staging state until the order changes to confirmed.

## Approved design

### Pending SmartPay order lifecycle

1. On SmartPay checkout, save the in-store order and its items first using `payment_status: pending`. The existing POS save path keeps it in `pending_online_payment`, which remains non-printable to kitchen automation.
2. Retain the returned order ID and order number in the POS checkout state. The SmartPay wait dialog displays that real, friendly order number with the amount.
3. Start the SmartPay transaction and continue polling every two seconds.
4. On approved payment, update the same order to `payment_status: paid`, `payment_method_detail: SmartPay`, and `order_status: confirmed`. Existing customer-receipt eligibility then allows the detailed image receipt to print.
5. On decline, cancellation, timeout, or request failure, retain the same pending order and cart state. A later SmartPay retry or a cash/card completion updates this existing order rather than inserting another order. No automatic kitchen/customer receipt is produced until paid.

### Instant ticket printing

- Add an independent In-store Instant Ticket setting with an enable switch and saved-printer selector. It can be enabled at the same time as the existing automatic customer receipt, and may target a different printer.
- After the pending order is saved and its number is known, immediately submit a native direct ESC/POS text job when this setting is enabled.
- The ticket contains a prominent `ORDER #<friendly order number>` followed by one line for each item name. It excludes receipt imagery, modifiers, notes, prices, totals, and customer data.
- It uses the existing direct-printer pathway and print queue/journal facilities where applicable, but it does not wait for React Native receipt rendering or image capture.
- The detailed customer receipt remains unchanged and is only requested after successful payment.

## Error handling and safeguards

- Missing/disabled/unavailable ticket printer skips only the instant ticket and reports the printer error; the payment flow continues.
- Saving the pending order must succeed before the terminal transaction begins, so every shown or printed ticket number belongs to a persisted order.
- The POS must not start a second SmartPay transaction while one is processing.
- A pending order remains hidden from normal kitchen auto-printing. Its transition to paid/confirmed is the single event that makes it eligible for current paid-order workflows.
- Payment completion must be idempotent: if a network response arrives after a retry/fallback interaction, the current stored order state is checked before applying updates or printing a second customer receipt.

## Verification

- Unit tests cover ticket settings normalization and eligibility, text content/ESC-POS encoding, and no-image-capture use in the instant-ticket path.
- SmartPay flow tests cover pending order creation, visible order number, two-second polling, approved update, failed retry, and cash fallback using the original order ID.
- Manual simulator testing confirms the instant ticket is text-only and is emitted before the customer receipt, while both settings can be enabled independently.
