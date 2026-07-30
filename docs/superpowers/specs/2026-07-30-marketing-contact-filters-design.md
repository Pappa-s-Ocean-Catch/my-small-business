# Marketing contact filters

## Purpose

Let POS operators narrow the Marketing recipient list to customers eligible for email, SMS, or both before they select recipients.

## Scope

Add two independent checkboxes to the POS Marketing screen:

- **Email:** include customers with a non-empty email address.
- **Phone:** include customers with a non-empty phone number.

Filter semantics:

| Email | Phone | Visible recipients |
| --- | --- | --- |
| Off | Off | All customers |
| On | Off | Customers with email |
| Off | On | Customers with phone |
| On | On | Customers with both email and phone |

The filter applies before customer sorting, pagination, the visible-recipient count, and **Select all visible**. It does not remove recipients already selected when an operator changes a filter.

## Data flow and safeguards

The screen continues to load customer contact data with the existing customer queries and filters it locally. Existing server-side marketing delivery checks remain the authoritative safeguard for opt-out, missing contact data, and recent-send suppression.

## Testing

Extract or use a small predicate that covers the four filter states above. Add a regression test that verifies the exact inclusion rules. No API or database changes are required.

## Related SMS follow-up

Separately, marketing SMS defaults will remove the online link to help stay under 160 characters. The phone source is `NEXT_PUBLIC_STORE_PHONE` in the web environment; the correct replacement number is still required before that configuration is changed.
