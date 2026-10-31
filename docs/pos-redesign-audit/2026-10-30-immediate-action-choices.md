# Immediate action choices

## Changes

- POS Complete/Update payment choices invoke the selected existing checkout flow immediately. New and edited orders offer Cash, Card, SmartPay and Unpaid. SmartPay is disabled without pairing or while processing; new-order SmartPay uses the existing terminal checkout handler. Cash retains tender entry and its confirmation. Edited orders retain cash/card/smartpay/no_pay mappings.
- Shared SelectionSheet now renders action buttons with one-tap dispatch, disabled choices, a duplicate-tap guard, and an explicit Cancel footer. Salt preferences, online/Uber/DoorDash sound choice and printer-section choice reuse this behavior. Settings still use the hub's Save settings and editor cancel semantics.
- Recent caller selection applies the number/name immediately. Cancel leaves customer input unchanged.
- Print copy types already advanced on tap and printers already dispatched on tap. Preserved those actions and added explicit Cancel printing, alongside existing close/back controls and in-flight duplicate protections. Simulator preview still waits for native picker dismissal from the earlier fix.

## Validation

397 unit tests passed. New tests exercise the actual shared selector, POS dialog configuration, POS payment handlers, and printer picker handlers against mocks. Coverage includes one-tap action and dismissal, disabled SmartPay, cancellation without dispatch, duplicate taps, cash/terminal/edited-order routing, and type-to-printer dispatch without a second confirmation. Diff check passed. Full TypeScript check retains 13 pre-existing receipt/caller-ID errors and adds no errors in changed files.

Native end-to-end POS validation remains outstanding: the available simulator is running another project. No live order, payment, saved setting or physical print was changed by these checks. Destructive confirmations and payment-detail entry were intentionally retained.
