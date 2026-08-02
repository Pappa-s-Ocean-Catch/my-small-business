# Marketplace Payment Statistics Design

## Goal

Prevent completed marketplace orders from being reported as cash payments, while retaining their contribution to paid-order and gross-sales totals.

## Scope

This change applies to every existing POS screen that groups paid orders by payment method:

- Completed-order quick statistics and its Card/Cash filters.
- The sales report's Payment method breakdown.

It does not alter the existing channel breakdown or marketplace financials panel, which already report Uber Eats and DoorDash separately.

## Classification

Introduce one shared payment-stat classification with three values: `card`, `cash`, and `marketplace`.

- An order whose normalized `order_channel` is `third_party` is `marketplace`, regardless of its payment-method fields.
- Non-marketplace orders remain `card` when paid online or when their payment method/detail identifies a terminal card payment (card, EFTPOS, SmartPay, Visa, or Mastercard).
- All remaining non-marketplace orders are `cash`.

This intentionally gives marketplace channel precedence: marketplaces collect payment themselves, so their imported POS orders are neither cash takings nor direct card takings.

## UI and data flow

The completed-order screen will calculate its Cards, Cash, and new Marketplace amount from the common classifier. The Card, Cash, and Marketplace tiles will filter using the same classifier, and the order list will therefore never show a marketplace order under Cash.

The sales report's payment-method breakdown will also use the same classifier, rendering the labels Card, Cash, and Marketplace. Its existing channel breakdown and channel-financial rows remain unchanged.

All three buckets continue to include only orders already considered paid by each screen; paid-order counts and gross-sales totals do not change.

## Testing

Unit tests will verify classifier precedence for Uber Eats and DoorDash orders, normal card and cash classification, and the shared labels used by reporting. The POS unit suite and TypeScript checks will run after the change.
