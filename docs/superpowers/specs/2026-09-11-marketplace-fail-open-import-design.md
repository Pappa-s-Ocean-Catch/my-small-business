# Marketplace Fail-Open Import Design

## Goal

Every marketplace order whose detail payload reaches the POS importer must be persisted and printable even when POS products, add-ons, removable ingredients, mappings, or catalogue customization data cannot be resolved. Exact marketplace information that cannot be represented structurally must be retained in order and item notes.

## Resolution contract

- A matched product remains linked to its POS `product_id`.
- An unmatched product becomes a normal denormalized `order_items` row with a null `product_id`, the marketplace name, quantity, price, instructions, and customization details.
- A matched add-on or removable ingredient remains structured as it is today.
- An unmatched add-on or removal remains attached to its parent item as a note and is also summarized in the order note.
- A removal such as `No tomato` that is not configured as removable is treated as an unresolved normal marketplace option; it never blocks the parent item or order.
- Catalogue, mapping, or customization-read failures degrade to unresolved notes. Database persistence failure and inability to fetch marketplace order detail remain hard failures and retry on the next poll.
- Existing marketplace orders retain the current status-only reconciliation behavior.

## Data model

`order_items.product_id` becomes nullable. This matches the table's denormalized historical fields and its existing `ON DELETE SET NULL` foreign-key intent. No fake catalogue product is introduced.

Unmatched product rows use the marketplace item price as `base_price` and `override_price` when parseable, otherwise zero. The exact provider text is retained in the item name/comment. The order continues to store the provider financial snapshot independently.

## Notes and printing

Item notes contain exact unresolved option text, customization group, quantity, and supplied price. Order notes contain a concise list of every unresolved item and modifier plus catalogue/mapping warnings.

The existing receipt integrity warning additionally compares a third-party order's marketplace gross sales with its persisted POS total. This makes a provider/POS value difference visible even when the POS rows are internally self-consistent.

Because unmatched products are real order-item rows, normal printer automation does not reject an all-unmatched order as empty.

## Identity and failures

The importer uses the first available stable identity from external order ID, workflow UUID, or order UUID. Provider active-list normalization retains entries with a workflow UUID even when the display order ID is absent.

The initial duplicate lookup is advisory. If it fails, the importer proceeds and relies on the existing database uniqueness constraint as the final duplicate guard.

## Scope

This changes automatic import construction and shared printing integrity checks. The manual mapping resolver remains available for improving future matches; automatic import no longer waits for it. Provider detail-fetch failures and database write failures are not converted into incomplete shell orders.

## Validation

Tests cover unmatched removals, ordinary unmatched add-ons, mixed and all-unmatched products, catalogue/mapping/customization failures, stale mappings, identity fallback, provider-total warnings, printable non-empty drafts, both provider adapters, and unchanged existing-order reconciliation.
