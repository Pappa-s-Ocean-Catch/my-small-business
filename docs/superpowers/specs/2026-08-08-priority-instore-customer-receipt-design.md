# Priority In-store Customer Receipt Design

## Goal

Automatically print a customer receipt as the highest-priority print job when a newly created in-store POS order is paid by cash, card, or SmartPay.

## Scope

- Add POS-register-local settings for this workflow: enabled state, selected printer, and an optional daily enabled-from/enabled-to time window.
- Use the existing customer receipt template.
- Print exactly one combined customer receipt; it is never split by kitchen section.
- Start the print only after `savePosOrder` has returned the newly created order successfully.
- Apply it only to the cash/card and SmartPay in-store checkout creation paths, and only when their payment status is `paid`.
- Do not print for unpaid in-store orders, edited orders, other POS channels, failed saves, or later payment-status updates.

## Settings

The new settings are stored with the existing device-local app settings so each POS register can have its own configuration:

- `instoreCustomerReceiptAutoPrintEnabled`: defaults to `false` to avoid changing current production behavior.
- `instoreCustomerReceiptPrinterTarget`: nullable saved-printer target selected by the register.
- `instoreCustomerReceiptEnabledFromTime` and `instoreCustomerReceiptEnabledToTime`: optional `HH:mm` values. When both exist, use the existing inclusive-start/exclusive-end daily-window semantics, including overnight ranges; equal values mean all day.

The settings UI appears in the printer configuration. It provides the enable switch, printer selector, and from/to time controls. It identifies the output as a combined customer receipt.

## Print Flow and Priority

After a qualifying checkout save succeeds:

1. Load the effective local settings and verify the feature is enabled, a selected printer still resolves, and the time window is currently active.
2. Render the existing `CustomerReceiptTemplate` for the saved order.
3. Capture it for the selected printer or simulator.
4. Enqueue one receipt job with explicit priority ahead of the normal kitchen jobs for that order on this device.

The print is best-effort: a receipt-print failure is surfaced/logged but does not roll back the successful order or block POS navigation. The checkout path awaits the priority receipt enqueue/dispatch before leaving the POS, preserving its precedence over subsequent kitchen work.

## Boundaries

- This is a dedicated checkout flow, not a change to the global new-order auto-print listener.
- Existing kitchen routing, default customer-copy assignments, and manual customer receipt printing remain unchanged.
- No automatic trigger is added to `updatePaymentStatus`, so marking an existing order paid cannot produce a receipt.

## Testing

Unit tests cover settings normalization/defaults, time-window eligibility, and the predicate selecting only newly created paid in-store cash/card/SmartPay orders. Print-queue tests verify the receipt job is scheduled as priority. Existing print and POS tests remain green.

## Acceptance Criteria

- A paid cash, card, or SmartPay in-store POS order created during its configured window produces one combined customer receipt on the configured register printer before kitchen jobs.
- Turning off the setting, leaving the printer unset, or being outside its configured window prevents the automatic receipt.
- An unpaid in-store order and any later update of an order's payment status do not automatically print a customer receipt.
- Manual customer receipt printing and existing kitchen printer automation keep their current behavior.
