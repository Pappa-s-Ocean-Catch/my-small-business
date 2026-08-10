# Marketplace POS Resolver Design

## Goal

Replace the text-based marketplace name mapping workflow with a separate,
blocking resolver wizard. Staff resolve every unmatched marketplace product and
modifier against the POS catalog before an order is added to the existing POS
checkout.

## User flow

1. Staff opens a marketplace order and presses **Add to POS**.
2. The importer builds a draft using existing mappings and automatic matches.
3. If every line and modifier resolves, the order continues directly to POS as
   it does today.
4. Otherwise, a full-screen Marketplace Resolver opens outside the POS screen.
   It shows one unresolved product first. Selecting a POS product immediately
   stores a product mapping and reveals that marketplace line's unresolved
   modifiers.
5. Each modifier is resolved in turn. Its choices are limited to active add-on
   items belonging to the selected POS product. A removal modifier may only be
   mapped to a removable ingredient of that product.
6. The resolver displays the original marketplace product/modifier names,
   quantities, and marketplace prices throughout. It does not edit any
   marketplace order values.
7. Once all entries are resolved and the mappings have been saved, the order is
   rebuilt and handed to the unchanged POS checkout flow. The existing draft
   importer continues to retain the marketplace line price as `override_price`
   and the marketplace requested time as `thirdPartyOrderAt`/order date.

## Mapping data

The existing `marketplace_name_mappings` table remains the source of truth.
Mappings will store internal POS IDs in addition to the display name so future
imports do not depend on duplicated names. A provider, entity type, normalized
marketplace name, and parent product context identify each mapping. Product
mappings have an empty parent context; add-on and ingredient mappings are
scoped to the marketplace product name, avoiding incorrect reuse when a
modifier has different meanings on different products.

Each mapping card also has a remove action. Removing it deletes the saved
mapping; the next import can then resolve it again. Resolved unmatched queue
rows are removed only after the mapping save succeeds.

## Boundaries and failures

The new resolver is its own Expo route and owns only resolver state and mapping
persistence. `pos.tsx` remains the final checkout/editor and receives only a
fully resolved marketplace draft. The resolver cannot continue, skip an item,
or add an order while unresolved entries remain. Failed catalog loads, mapping
saves, or rebuilding the draft keep the user on the resolver and show an error;
no partial POS order is created.

## Validation

Unit tests cover parent-scoped mappings, IDs taking precedence over names,
price/date preservation after a resolve-and-rebuild cycle, and the blocking
unresolved contract. Type-check/unit tests cover the importer changes.
