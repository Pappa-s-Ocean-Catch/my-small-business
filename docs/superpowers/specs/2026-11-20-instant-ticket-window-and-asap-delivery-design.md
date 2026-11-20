# Instant ticket hours and ASAP delivery request time

## Intent

Add daily on/off hours to Instant Ticket Print, matching the existing Customer Receipt settings. For online ASAP delivery, request delivery from Shipday 30 minutes after order placement.

## Current behavior and evidence

- `apps/pappas-order-management/lib/instore-instant-ticket.ts` checks the toggle, payment, channel and saved printer, without a time window.
- Customer Receipt already stores From/To values and checks local device time, including overnight windows.
- `libs/shipday/scheduling.ts` calculates ASAP pickup as `created_at + 10 minutes`, then delivery as pickup plus `delivery_eta_minutes` (default 30). Checkout saves the provider quote's duration as that ETA. A 50-minute quote therefore produces a requested delivery time 60 minutes after placement.
- Shipday quote requests and the create-delivery fallback separately default to pickup plus 30 minutes, or 40 minutes total.
- This establishes that our app sets the requested time. No live order or Shipday account was inspected, so it does not prove the specific cause of any individual order's actual arrival time.

## Proposed behavior

### Instant ticket

- Add From/To inputs below the instant-ticket printer selection, using the existing settings layout.
- Persist `instoreInstantTicketEnabledFromTime` and `instoreInstantTicketEnabledToTime`; default both to null for existing installations.
- With the toggle on, print only within the daily window, using local device time, as Customer Receipt does. Start is inclusive; end is exclusive. Overnight windows work. Blank values or equal endpoints retain the existing Customer Receipt behavior of an all-day window.
- Require both fields or neither when saving; validate real 24-hour HH:MM values.
- Use the existing receipt time-window logic and normalization. Include window information in print diagnostics.

### Shipday

- For ASAP orders, requested delivery is exactly `created_at + 30 minutes`; pickup remains `created_at + 10 minutes`.
- Provider ETA remains provider information and must not extend our requested deadline.
- Align the quote request default to 30 minutes from quote creation and align the create-delivery fallback to 30 minutes from order placement.
- Preserve explicit scheduled pickup/delivery times selected by the customer, including delayed payment.
- This changes the requested deadline sent to Shipday; it cannot guarantee driver availability or actual arrival within 30 minutes.

## Approaches

Recommended: reuse the receipt time-window mechanism and change the shared Shipday scheduling policy plus its two defaults. This matches the requested existing UI and covers API/payment entry points using the shared library.

Alternative: introduce a generic schedule editor and configurable delivery deadline. This adds settings and broader changes beyond the two requested behaviors, so it is unnecessary here.

The user approved this recommendation and implementation on 2026-11-20.

## Verification

- Instant tickets: blank defaults, normalization, inside/outside hours, start/end boundaries, overnight hours, toggle off, and unchanged paid-order/printer eligibility.
- Settings: saved values survive loading and reopening; invalid/incomplete hours are rejected.
- Delivery: ASAP with missing, short and long provider ETA always requests placement +30 minutes; scheduled orders retain selected times; quote and fallback payloads agree with the new policy; date rollover works.
- Run existing print and delivery payment/quote tests, updating ASAP expectations while retaining scheduled expectations.
