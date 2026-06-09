# Voice to Order

## Goal

Add a microphone workflow to the POS screen so staff can speak an order and have the app add items, quantities, add-ons, removals, and notes to the cart.

This should sit on top of the existing POS cart logic. Voice should produce order actions; the app should still validate every action against the cached catalog before changing the cart.

## First Version

Use push-to-talk:

1. Staff taps the mic button.
2. POS listens until staff taps stop.
3. Speech is transcribed to text.
4. A parser converts the transcript into structured JSON actions.
5. The POS validates each action against products, search terms, add-ons, and removable ingredients.
6. Valid actions are applied to the cart.
7. Ambiguous or low-confidence actions ask for confirmation.

Avoid always-on listening for the first version. The shop environment is noisy, and push-to-talk is easier to control and easier for staff to trust.

## Suggested Architecture

```text
Microphone audio
  -> speech-to-text
  -> order intent parser
  -> structured JSON actions
  -> deterministic catalog validation
  -> existing POS cart functions
```

Recommended model split:

- Speech-to-text model for fast transcription.
- LLM with structured output for understanding the transcript and returning JSON.
- Local deterministic resolver for matching product IDs, add-on IDs, and removable ingredient names.

## Catalog Context for Parser

Send only the data needed to understand POS commands:

- Product ID
- Product name
- Product `search_term`
- Category name
- Add-on group names
- Add-on item IDs and names
- Removable ingredient names
- Common shop phrases and aliases

Do not use product descriptions or pack includes as search context. For example, searching or speaking "flake" should not match Dinner Box only because Dinner Box includes flake.

## Example Commands

- "Two flakes and one minimum chips"
- "One burger, no onion, extra cheese"
- "Add seafood stick"
- "One crab stick"
- "Make that two"
- "Remove the last chips"
- "Add note to burger, no sauce on top"

## Example JSON Output

```json
{
  "actions": [
    {
      "type": "add_item",
      "product_id": "product-flake",
      "quantity": 2,
      "addons": [],
      "remove_ingredients": [],
      "note": null
    },
    {
      "type": "add_item",
      "product_id": "product-burger",
      "quantity": 1,
      "addons": ["addon-extra-cheese"],
      "remove_ingredients": ["onion"],
      "note": null
    }
  ],
  "needs_confirmation": false,
  "clarifying_question": null
}
```

## Action Types

Initial action types:

- `add_item`
- `increase_item_quantity`
- `decrease_item_quantity`
- `remove_item`
- `set_item_note`
- `add_addon`
- `remove_addon`
- `remove_ingredient`
- `restore_ingredient`
- `clear_cart`

Potential later action types:

- `start_checkout`
- `set_customer_phone`
- `set_customer_name`
- `set_pickup_time`
- `set_order_note`

## Validation Rules

The app must validate:

- Product exists and is active.
- Product match is based on `name` and `search_term`, not description.
- Add-ons are allowed for the selected product.
- Required add-on groups are satisfied before checkout.
- Removed ingredients are actually removable for that product.
- Quantity is positive and reasonable.
- Destructive actions, such as `clear_cart`, require confirmation.

If validation fails, do not modify the cart. Show a short confirmation or correction prompt.

## Ambiguity Handling

If the parser is unsure, the POS should ask staff to choose rather than guessing.

Examples:

- "Did you mean Flake or Flake Pack?"
- "I found two matches for burger. Choose one."
- "Extra cheese is not available for this item."

The cart should show voice-added items immediately, and staff should be able to undo or modify them with the existing cart controls.

## UX Notes

Mic button states:

- Idle
- Listening
- Transcribing
- Applying
- Needs confirmation
- Error

Display the latest transcript in a small temporary area so staff can see what was heard.

Keep all voice actions reversible. The right-side cart remains the source of truth.

## Implementation Notes

- Reuse the existing POS catalog cache.
- Reuse the same quick-add and add-on selection logic as manual taps.
- Keep parser schema versioned, for example `voice_order_schema_v1`.
- Log transcript, parsed actions, validation result, and applied actions for debugging.
- Do not store raw audio unless there is a clear operational reason and privacy policy support.

## Open Questions

- Should voice work only on the POS device, or also on web admin/order management?
- Should voice commands be one-shot only, or allow multi-turn correction?
- How should the UI show confidence and alternatives without slowing down staff?
- Do we need a custom phrase list for local menu names and staff shorthand?
