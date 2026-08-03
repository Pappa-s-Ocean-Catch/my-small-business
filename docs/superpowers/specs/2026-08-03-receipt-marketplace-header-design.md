# Receipt Marketplace Header Design

## Goal

Make kitchen receipts immediately distinguish Uber Eats, DoorDash, and direct order channels at the top of each ticket.

## Receipt header

- A third-party order whose `delivery_partner_name` identifies Uber Eats or DoorDash displays its matching local asset (`assets/ubereats-logo.png` or `assets/doordash-logo.png`) at the very top of every printed ticket.
- The line immediately beneath either marketplace logo is `DELIVERY`, rendered large and bold.
- Direct orders display no marketplace logo. Their top label is rendered large and bold as `INSTORE`, `PHONE PICKUP`, or `PHONE DELIVERY` according to the order channel.
- The existing date and payment row remains below the new header.
- The marketplace logo has 16px of space beneath it before the header label, and the header label uses a 48px bold type size.

## Customer section

- The customer name, phone number, and any delivery details are grouped in one black panel.
- Text within that panel is white, with internal padding, so the customer information is visually separated from the receipt metadata and order items.

## Mapping

| Order channel | Partner | Header logo | Header label |
| --- | --- | --- | --- |
| `third_party` | Uber Eats | Uber Eats | `DELIVERY` |
| `third_party` | DoorDash | DoorDash | `DELIVERY` |
| `instore` | any | none | `INSTORE` |
| `phone_pickup` | any | none | `PHONE PICKUP` |
| `phone_delivery` | any | none | `PHONE DELIVERY` |

## Implementation and verification

Keep the mapping in a testable receipt-header helper used by `ReceiptTemplate`. Unit tests will cover marketplace-logo identification and direct-order labels; the existing TypeScript unit test command will verify the build.
