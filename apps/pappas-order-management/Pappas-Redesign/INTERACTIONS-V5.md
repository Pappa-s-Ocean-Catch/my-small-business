# Revision 5 interaction contract

This revision supersedes earlier Done/return-target and printer radio-selection descriptions. Retain the shared compact header, collapsed order filters, persistent order tabs and configuration-driven POS renderer.

| Action | Required result |
| --- | --- |
| Tap a level 1 group | Open its level 2 products; support many groups in the dedicated grid. |
| Tap a product | Immediately insert one cart line. Open level 3 if add-ons exist; otherwise keep browsing. |
| Tap a cart item name or summary | Open that exact line, including existing selections, quantity and note. No separate Edit add-ons action. |
| Tap quantity or remove | Perform only that action, without opening the item. |
| Small Back on level 2 | Return to level 1 groups. Retain the draft. |
| Small Back on level 3 | Return to level 2 of that product’s group. Retain applied choices and the inserted line. |
| Continue on level 3 | Return to that same group’s products, including when opened from Quick list, search or cart review. Never add another line. |
| Open order details | Present a nearly full-size tablet modal, full-screen on phones, over the current screen. |
| Close order details | Restore the caller, scroll, filters and triggering control focus. Opening from a customer profile must return there. |
| Print order | Choose copy type, then display printer action buttons. |
| Tap a physical printer | Submit one job immediately; no radio selection and no extra Print button. Return to the caller with result feedback. |
| Tap Simulator | Show a preview for the current order or report; no physical job. Closing returns to the caller. |

## Density and accessibility

Cart rows show product, group, all selected modifier group/value pairs, notes, quantity, unit price and line total. Modifier summaries wrap rather than silently hiding options. Free modifiers do not repeat Included on each cart row. Name and summary form one accessible button, with separate quantity, note and remove controls. Back is a small icon with an accessible label and an expanded phone touch area.

Order modal header and footer remain visible; its body scrolls. Background is inert. Keyboard focus stays inside the active modal; Escape and Close dismiss it. Nested printing returns to the same order modal and preserves the underlying caller. Production integration must preserve order identity, permissions and current data, and restore the invoking control by stable identity after data refresh.

## Printing integration

The HTML records a local simulated job and visibly labels simulated success. It does not connect to a printer. In production disable all printer choices while submitting, use a request id to prevent duplicate jobs, show actual queue/transport status, and retain context on failure with an explicit retry. Do not silently retry an ambiguous job: reconcile its request id with the queue first. Copy type, order/report id and printer id belong to the job payload. Never use a displayed name as the printer’s persistent identifier.

## POS layout settings

Background, text colour, font, label, ordering, visibility and responsive grid choices continue to use the shared configuration and tile renderers. These navigation changes must not reset saved POS layouts, reorder production menu data or change current prices or modifier rules.

## Verification

See V5-INTERACTION-VERIFICATION.json for checks at 1366×1024, 1024×768, 1024×1366, 390×844 and 320×768. VERIFICATION.json records exports and overflow checks. Preview limitations: representative local data; no actual printing, payment or backend integration.
