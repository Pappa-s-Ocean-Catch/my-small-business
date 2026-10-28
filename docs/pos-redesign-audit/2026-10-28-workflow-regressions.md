# POS workflow regression fixes — 28 October 2026

Branch: `pos-redesigned`.

The existing staff workflow takes priority over omissions in static design exports.

## Live cards

- Tapping the card body opens the existing order-detail controller. The separate View order button is removed.
- Unpaid, active orders use the tappable Unpaid badge for quick payment changes, retaining the existing Card/Cash/SmartPay choice handlers.
- SmartPay has a direct button. It stays disabled without a paired terminal, while existing handler checks still guard payment execution and stale order state.
- Payment, customer, status and printer controls stop propagation so their taps do not also open detail.
- Paid/closed/busy guards remain in place. No payment service or persistence logic was replaced.

Native check: tapped the body of real live order P019 and opened its detail modal; closed back to Live. Tapped the Unpaid badge on real unpaid P021 and observed Card/Cash/SmartPay, then cancelled. Confirmed the direct SmartPay button is visible for that unpaid order. Did not start a terminal transaction, change payment or change order status.

## Category hierarchy

- Category taps again inspect child categories and the existing `showProductsOnTopLevel` setting.
- Drinks → Can → Can products is restored; Back returns Products → Drinks subcategories → Groups.
- Modifier Continue/Back, search and cart editing retain a product's child category and parent group, including virtual layout groups.
- Explicitly configured flattened groups still work.
- Restored subcategory screens reuse the same configurable group tiles for spacing, readable text colour and responsive columns.

Native check: Drinks displayed six real subcategories. Can displayed only canned products. Both Back transitions returned to the expected level.

## Staff add-ons

- Removed the POS-only required-add-on checkout validator from every checkout path, including SmartPay, pickup, delivery, third-party and edited orders.
- Removed its unused tracking and helper. Staff modifier groups are labelled Optional.
- Online catalogue `is_required` data, selection multiplicity, selected add-on prices and kitchen routing metadata remain intact. No online-order validation or shared catalogue records were changed.

Native check: added one temporary Small Chips line, saw Salt Option as Optional, selected no add-ons, used Continue, returned to Chips and opened checkout with that plain line intact. Did not submit an order. A later simulator observation showed a different Flake Pack For One draft; that draft was left intact.

## Verification

- Unit suite: **358 passed, 0 failed**. Added actual live-card render/handler tests, hierarchy and virtual-group return tests, and the staff-only add-on policy check.
- TypeScript: the existing 13 errors remain in ReceiptQrCode/caller-ID code; no errors in files changed for these regressions.
- iOS JavaScript export: passed (exit 0). Whitespace check: passed.
- Native screenshots: `artifacts/pos-regressions-2026-10-28/`.

No backend order/payment changes, terminal charges or physical print actions were performed during validation.

## Consistent live-card heights

The card now reserves the same height for its identity, item preview, View more row, primary action and print-feedback slot. Item count, wrapped names, customer metadata and print state no longer move the action rows or card bottom. Long identity/item content remains scrollable within its section. View more opens the existing detail modal. The configured preview count is retained, including 8/12-item previews, inside the bounded viewport. Compact landscape cards use smaller fixed sections.

The actual component render/handler tests cover 1, 5 and 10 items, long names, print feedback, overflow navigation, larger preview settings and compact size. Full unit suite: 361 passed. Explicit TypeScript still reports the same 13 existing ReceiptQrCode/caller-ID errors. The simulator Live tab was empty during this change, so a populated native screenshot comparison remains pending. No live orders, payments or print state were modified for validation.


### Product fallback palette and borders

- Replaced the six pastel fallback fills with the exact 16 colours from the layout editor, using one shared palette. Stable product-ID hashing allows every preset without changing colours between renders or preview/live views.
- Product borders now use a darker shade of the effective tile fill instead of a fixed gold stripe. Configured global/product colours and explicit text colours retain priority. Automatic text chooses the higher-contrast foreground; quantity badges retain their own readable foreground.
- Verification: 366 unit tests passed, including all 16 reachable colours, unique coordinated borders, automatic contrast of at least 4.5:1, and configuration precedence. Full app typecheck still reports the same 13 existing receipt/caller-ID errors; no new errors. `git diff --check` passed.
- Reloaded the simulator through localhost after its saved LAN server address became stale. Visually checked the CHIPS catalogue with saturated fills, coordinated borders and readable labels/prices. Screenshot: `artifacts/pos-regressions-2026-10-28/product-16-colour-palette.png`. Cart stayed empty; no order/payment/status actions performed.
