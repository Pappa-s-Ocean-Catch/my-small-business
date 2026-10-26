# Pappa’s Order Management — responsive redesign

Version 5 — direct printing, compact cart and contextual order details · 19 October 2026

The current interaction contract is **INTERACTIONS-V5.md**. It supersedes earlier return-navigation and print-selection descriptions.

## What this package contains

A proposed visual redesign of all **114 selected screen states** in the supplied screenshot handoff, plus **P01: full cart review** and **P02: populated pre-orders with the conditional tab**, added from the user’s clarifications about details absent from the captures. Every selected source ID maps to an individual view in the atlas, in large landscape tablet, small landscape tablet, portrait tablet and phone layouts. P01 and P02 are explicitly marked proposed, without a fabricated original screenshot. The package includes 116 designs × 4 viewport presets = 464 static frames. Repeated states intentionally share components. OS-owned file pickers and app-open prompts are represented by system-handoff specifications, not custom replicas.

Open **Pappas-Design-Atlas.html** in a desktop browser. It works offline. Select a screen, switch device, view the original thumbnail and read implementation intent. `index.html` is the equivalent multi-file version. `screens/` contains static exports grouped by device. The preview has sample navigation, selection controls and switches; it is not a functioning POS, a Figma file, or production application code.

The source contains 121 original captures, of which 114 were selected after duplicate/failed-scroll removal. We follow the reviewed CSV names rather than original filenames. Do not treat excluded captures 009, 038, 065, 109, 110, 111 or 116 as missing redesigned screens. The reviewed source ID 037 covers reward adjustments; 038 was an excluded attempt to scroll.

All rendered customer names, contact numbers and credentials are fictional or masked. Screen values demonstrate hierarchy and formatting. Report charts illustrate structure, not business performance. UI example menu prices do not constitute an instruction to change the production catalogue.

## Brief and assumptions

The app is used at a busy takeaway counter to take orders, coordinate preparation, collect payment and manage the store. The redesign must let a staff member read an order, recognise payment state and perform the next action quickly. All current routes and existing business operations remain available. The user explicitly requires iPad landscape, portrait and responsive phone designs suitable for a developer handoff.

Design assumptions: use the existing Pappa’s name; retain the app’s navy identity and use teal for primary actions; keep native fonts; target touch first; use a light interface for counter readability. Permissions, tax, rewards, pricing, discount logic, integrations and payment rules must come from the existing app. Proposed information groupings may change presentation without changing those rules. Validate assumptions with the shop before production implementation.

## Visual system

| Role | Value | Use |
|---|---|---|
| Navy | `#122E40` | Navigation, branding, cash due panel |
| Teal | `#087F82` | Main action, selected controls |
| Pressed teal | `#066467` | Pressed state, dark selected text |
| Canvas | `#F4F6F5` | App background |
| Surface | `#FFFFFF` | Cards, fields, toolbars |
| Text | `#172E3A` | Main text and numbers |
| Secondary | `#526773` | Metadata, explanatory text |
| Border | `#D7E0E2` | Component boundaries |
| Success | `#166647` on `#E6F4EC` | Paid, accepted, completed |
| Attention | `#88520B` on `#FFF2D6` | Preparing, missing configuration |
| Destructive | `#B53535` on `#FFF0EF` | Unpaid indicator, errors, destructive actions |

Use labelled status chips; colour alone is never sufficient. Preparing and unpaid may coexist. Category colour is a narrow product-card accent with a category name, not a full saturated tile. Do not use colour to distinguish prices or change menu meaning.

Typeface: SF Pro through the iOS system font; Roboto through Android’s system font. Body/input text 16 logical units; supporting text 14; screen titles 23–28; important totals 28–32; cash due 39. Weights 400, 600 and 700. Numbers use tabular figures. The atlas uses small text only for secondary navigation/metadata; the developer should honour Dynamic Type and test large accessibility sizes.

Spacing is based on 4, 8, 12, 16, 24, 32 and 48 units. Standard control radius 10; cards 16; tablet dialogs 24. Border 1 unit. Standard touch targets at least 48 × 48; primary actions 52 high. Chips may look 44 high but need an expanded 48 touch region in native implementation. Tiny labels and apparent 20-unit icons must never be their own unexpanded touch target.

Default feedback: subtle fill/border change on press; focus outline for hardware keyboard. Use a 150–180 ms opacity/translation transition for panels, and no motion when Reduce Motion is active. Never animate totals in a way that obscures their final value. Avoid background polling or animations just to decorate the UI.

## Layout contract

Use the current window’s available width in logical units, not device model, pixel density or orientation alone. Support iPad split view and resizing. The supplied source images are pixel captures; their dimensions must not be treated as native layout units.

| Width class | Navigation | Main content | POS cart |
|---|---|---|---|
| Compact: below 600 | Bottom navigation; More opens secondary routes | One column; 12 side padding; full-height editor sheets | Menu first; sticky order bar. Order review/checkout is a separate view |
| Medium: 600–1099 | 64-wide rail | 12 side padding; one/two columns according to usable space | 288-wide cart only when menu/form retains at least 300; otherwise use compact order flow |
| Expanded: 1100+ | 72-wide rail | 16 side padding; two/three columns; four product columns only with enough room | 352-wide cart with independent scroll and pinned total/actions |

Reference exported frames: 1366 × 1024 large landscape iPad, 1024 × 768 small tablet, 1024 × 1366 portrait iPad, 390 × 844 phone. These are representative, not exhaustive supported sizes. Verify 320, 375, 430, 600, 768, 820, 1024, 1100 and 1366 widths. At 600–699 widths use the single-pane POS exception described above; see acceptance checks.

Tablet portrait is a genuine rearrangement: product columns reduce, detail panels stack, report metrics wrap and the rail narrows. Phone tables become cards/rows showing the most important fields first; supplementary fields appear beneath. Never hide status, total or the primary action merely to fit width. Lists scroll vertically; horizontally scrolling filter chips are allowed with an obvious scroll affordance. POS groups are never represented by horizontal category tabs; they occupy their own level-1 grid. No full-page horizontal scrolling.

Safe areas: inset bottom navigation and sticky actions by the actual device inset. The native keyboard must resize the content region or be handled by a keyboard-aware container. The focused field and primary action stay reachable. On rotation preserve draft, selected customer, active tab, scroll anchor and filters; do not reconstruct the form with defaults.

### Modal and editor behaviour

Use a centred 460-wide confirmation, 620-wide form/dialog, or 920-wide product/image editor on tablets, capped by viewport minus 24–32 side margins. Header and footer do not scroll; body does. Phone editors occupy full available height, with a visible close/back affordance and persistent footer above the keyboard. Short confirmation prompts can use the native alert in production as long as labels and consequences match.

Opening a modal moves accessibility focus to its title; closing restores focus to its trigger. Trap focus in custom web dialogs; use native accessibility-modal semantics in React Native. Tap outside may close a clean, non-payment sheet, but never discards a dirty draft silently. Back/escape must ask before discarding changed data. Cash/card processing cannot be dismissed into an ambiguous paid state.

## Shared header and space budget (v5)

Every working screen uses the same **56-unit app header**. Remove the shop-name eyebrow, redundant register label, oversized New Order button and circular avatar. The page name is one line at 18 units; header icons use the same 20 × 20 viewbox, 1.8 stroke, 40 × 40 visual button and 8-unit corner radius. Use native hitSlop of 4 on each side (48 touch region) without increasing the visual header. A long page title can ellipsise while retaining its full accessible label. Do not truncate prices, product names or action meanings to fit the header.

Only contextually useful actions appear. Orders: filter toggle, refresh, New Order, register/profile. POS: Groups/Quick List view switch, search and register/profile. Other pages: page name and relevant register/profile access; their own business actions remain in content or editor footers. The register/profile surface owns normal account/register detail. An offline/error condition must still produce the existing visible connection banner; hiding the ordinary register label is not permission to hide faults.

Groups and Quick List are **two browse modes**, not the full group collection. Both sit in the POS header; no dedicated Quick List row or large numbered stepper below it. Level 1 opens the group grid directly below the header. Level 2 has only a compact selected-group label. Level 3 identifies the group/product in its compact item panel. The three navigation levels and v3 immediate-add contract remain unchanged. On phones, the two browse-mode controls replace the visible POS page title in the header while the accessible title and active bottom navigation identify Take Order.

Use 72-wide navigation rail on large screens, 64 at medium tablet sizes; 16 content padding on larger windows and 12 on smaller tablets/phones. Medium tablet cart is 288 wide, large is 352; use one-pane mode if the menu cannot retain useful width. Tile grids use the saved layout's responsive columns. Automatic medium columns fit at a minimum approximate 145-unit tile width. Reference the measured checks in VERIFICATION.json for 1024 × 768 and 1280 × 800 small tablets.

### Orders filters

Live / On the way / Completed tabs remain visible. Pre-orders remains conditional on an available upcoming count. **The quick filter row is collapsed by default** and leaves no blank spacer. The header filter icon expands/collapses an inline panel; source 002 is the expanded design. More Filters retains the full existing filter form (source 008). The descriptive demo banner above Live orders is removed because the tab already carries its count.

Collapsing a filter panel does **not** reset the chosen filter. Show an active-count badge on the icon and include that count in its accessible label. Reopening restores the selection. All Orders clears the quick filter. Production must retain the existing status/payment/source logic and keep filters per order view. A hidden panel must never make a filtered list look unfiltered. Header refresh replaces the duplicated body refresh on the live list.

## Navigation and core workflow

The rail/bottom bar gives fast access to Orders, Take Order, Customers, Reports and More. More preserves Pre-orders, Order History, Deliveries, Marketing, Coupons, Call History, Marketplace, Menu Catalogue, TV Menus, Settings, About, Profile and Sign Out. Settings remains a rail shortcut on larger windows.

### Orders — frequent staff tabs (v2)

**Live · On the way · Completed** remain visible as persistent tabs inside the Orders workspace on tablet and phone. These frequent destinations must never require opening More or reusing a generic status filter. Switching tabs preserves each view’s filters, date, list position and pending local work. Counts complement the labels; distinguish fulfilment counts from payment status.

Add **Pre-orders** as a fourth tab only when upcoming scheduled orders exist. Show its count. P02 demonstrates two upcoming orders and the extra tab; source 001 demonstrates the normal three-tab state. Pre-orders are a separate scheduled view, not a status filter hidden inside Live. The original empty pre-orders view (032) remains available from secondary navigation for completeness, but an empty pre-order tab does not occupy the frequent tab bar.

Phone: all three normal labels are visible at once. With four tabs, stack each count below its label and reduce padding so all four remain visible at normal text size. At accessibility text sizes, wrap or allow accessible scrolling rather than truncating a destination label. Keep tab positions stable: Live, On the way, Completed, then conditional Pre-orders. Use selected-state semantics and a strong selected underline.

Use a confirmed upcoming count (and cached state during refresh); do not interpret a failed/loading request as zero and flicker the tab. When the count changes to zero, remove the conditional tab without discarding an open order detail or an in-progress action. Retain user context and return to an appropriate persistent destination when leaving the last scheduled order.

### Take Order — immediate-add contract retained from v3

**The current app’s immediate-add behaviour is mandatory. Tapping a product is the add action.** The previous proposal’s extra Add to Order button introduced a counter-service block and is superseded. Maintain Group → Product → Add-ons as navigation levels while preserving that immediate insertion.

**Level 1 / source 010:** a dedicated grid of all POS groups, using the saved group label, colour accent and order, including virtual groups. No top category strip, permanent search bar or hard group-count limit. Scroll vertically; virtualise large collections. Preserve group position when returning. A compact magnifier in the screen header opens search only when requested. Groups/Quick List are shared-header controls, with no separate row below.

**Level 2 / source 118:** products within the selected group, with name and price. **Every product tap immediately inserts a line in the current local order draft using the existing default/merge rules.** The line identity is established before any navigation. If add-ons are available, move to level 3 targeting that exact line. If no add-ons are available, stay in the current product or Quick List view and show brief added feedback/quantity indication. Do not navigate to cart review as an extra step. Do not open a blank configuration draft waiting for a second Add action. Back to Groups preserves the order and browsing context.

**Level 3 / source 018 — Update item:** the product is already present in the cart and total. Show the existing/default choices, all applicable modifier groups, constraints, price effects, quantity and item note. Modifier selections and quantity changes update that same cart line immediately. The action is **Done** or **Back to products** for navigation only; it must not insert or duplicate the product. An Update Item label may describe the screen, but it is not a required second submission to put the product in the cart. Show “Already in order” feedback where useful.

**Back/close semantics:** leaving level 3 keeps the item and its applied choices in the cart. Do not silently remove it as though an unsaved Add form were cancelled. Removal is an explicit per-line Remove action. Preserve any separately staged note-edit semantics already in the app. Required choices and default values follow the current product rules: if required information is still missing, show an actionable state and use the app’s existing validation point before order submission/payment; do not reintroduce a delayed Add gate. Do not invent defaults for production merely to bypass constraints.

**Editing existing lines:** Edit Add-ons loads that stable line ID and its quantity/options/note into level 3. Updates apply to the same line, never a fresh insert. Returning to the previous cart/browse view retains them. Two lines with the same product and different modifiers remain separate under the existing merge logic. Group browsing never changes products already in the order.

**Cart:** remain beside every level on tablets; phones use View Order and P01. Show group → product → every selected add-on group/value, quantity, unit and line amount, modifier charges, note and distinct edit/remove actions. The cart updates immediately when the product is tapped and when modifiers change. “No salt” is a value, not an absent choice. Keep global salt, clear draft, Checkout, Complete and Smartpay semantics. Count configured lines separately from summed quantity.

**Search / source 011:** show a compact 44–48-unit magnifier in the POS screen header. There is no permanent input row on the group, product, Quick List or add-on screens. Tapping it opens a focused search overlay on tablets and a full-height search sheet on phones. Results retain their group context. Group results navigate to that group; product results follow immediate add → optional level 3. Close/Escape/back returns to the same level, selected group and scroll without changing the order. No-results and clear-query states are explicit. Keep keyboard focus on the query during search and use keyboard-aware insets. Search is a secondary tool, so default space belongs to menu content.

The HTML now demonstrates insertion, line-specific updates, quantities and immediate totals in a **local sample cart** so these behaviours can be reviewed. It is not the application’s inventory/order/payment engine. Modifier groups, stock, merge rules and all charged options still come from the existing app implementation; the preview’s included modifiers and sample prices are illustrative.

Keep Checkout, Complete and Smartpay as distinct existing operations until their semantics are verified in code. Do not relabel them into one ambiguous Pay button. Smartpay opens the terminal flow; cash tender is its own branch; unpaid completion must not set paid. Fulfilment status is independent of payment status. Mark Ready does not collect payment, and printing does not mark an order completed.

## Components for the developer

| Component | Required inputs and behaviour |
|---|---|
| App shell | Available width, current route, safe area; stable navigation and connection state |
| Screen toolbar | Heading, search, filters, date, contextual actions; wraps in compact layouts |
| Status badge | Separate domain and value, visible label, semantic colour; no status inferred only from colour |
| Product tile | Full label, price, category, availability, quantity badge, modifier requirement |
| Order card | Reference, customer, source, fulfilment/payment states, age, due time, lines, total, next action |
| Cart | Stable line IDs; full group/product/selected-modifier hierarchy; unit/line amounts; quantity, notes and editing actions; salt preference and authoritative totals |
| Form field | Stable label, value, required/optional, validation text, suitable keyboard, disabled/loading state |
| Choice group | Single/multiple mode, min/max choices, selected values, price changes, accessible selection state |
| Customer row | Name or fallback, masked/sample contact in demos, last visit, spend/points, distinct selection action |
| Dialog/sheet | Title, context, scrollable body, stable cancel/primary footer, dirty-state guard |
| Data state | Loading, empty, error, offline, stale and retry states as independent states |
| Printer route | Kitchen section, printer ID, mode, template, optional time window; independent from saved printer |
| Review step | Final content, recipients/amount, consequences and explicit commit action |

Screens share components rather than becoming 114 independent copies. Suggested native modules: `AppShell`, `ScreenHeader`, `FilterBar`, `OrderCard`, `OrderDetail`, `ProductTile`, `CartPane`, `CheckoutForm`, `EditorSheet`, `FormField`, `ChoiceGroup`, `StatusBadge`, `CustomerRow`, `MetricCard`, `PrinterRouteCard` and `AsyncState`.

Use existing route names from the supplied inventory. Styling should not require changing API contracts. Match identifiers to the existing source tree, not to display strings; internal source filenames in the screenshot package are evidence of routes, not proof that every standalone variant was tested.

## Domain details that must survive redesign

### Orders and checkout

- Preserve live, on-the-way, completed, pre-orders and all-order history routes; retain all filters, date selection, source and summary metrics. Card age and pickup time are separate.
- Detail shows items, customisations, customer, totals and correct available actions. A completed third-party order is read-only except explicitly supported links/printing. Order cancellation requires a reason/confirmation only if current business rules call for it.
- Customer checkout supports phone keypad, name entry, find customer and recent calls. Optional contact for in-store orders must remain optional; pickup/delivery requirements follow existing validation.
- Preserve in-store, pickup, delivery and third-party branches. Pickup supports ASAP/pre-order date/time; delivery supports address, instructions, quote and request; third-party supports provider, customer name, external order ID and order time.
- Discounts preserve preset 5/10/15/20/25% choices, custom percentage, fixed amount and coupon lookup. The redesign groups presets but retains all options. Show calculation feedback and prevent simultaneous conflicting discount modes.
- Salt options remain the exact ten source choices. Quick note presets remain available. Phone uses native input keyboards; the custom iPad phone keypad may be retained for touch-only service.
- In-store completion offers Cash, Card and Unpaid. Cash: show due, tender, change, exact and $5/$10/$20/$50/$100 presets, numeric input, backspace and clear. Preset chips can scroll horizontally; Clear Tender remains available below the keypad.
- Financial calculations use integer cents with existing tax/discount order. Show a single authoritative total. Disable final confirmation while submitting; the server/payment layer must protect against retries and duplicates.

### Customers, coupons and marketing

Keep name/email/phone add form, at-least-one-contact validation, profile statistics, history, rewards and associated coupons. Name editing is separate from contact management. Reward adjustment shows signed delta, reason, current and resulting points. The missing-contact state is not an empty customer record.

Marketing keeps all three steps, optional generated copy/image, email subject, HTML email body and SMS body. Recipient filters retain channel, contact history and sorting; selection survives paging. Review shows exact content and separate email/SMS counts. A final confirmation summarises channel and count before sending; failures identify what succeeded and what can safely be retried. No send-on-preview or send-on-navigation.

Coupon directory preserves pagination/page-size, All/Active/Inactive/Expired, code copying, details, usage/minimum/limits/date fields and active status. Enabling a coupon must show a pending state, then success or rollback. Coupon changes follow the current permission model.

### Marketplace, deliveries and reports

Keep Uber Eats/DoorDash service selection, credentials fields, active/scheduled/history, date presets, status filters and per-name mapping. Credentials are masked and excluded from logs. An unconfigured integration is different from zero results or a request error. The resolver empty route remains available. Do not replicate the captured development warning banner in the production UI.

Delivery list source captures are load failures, not proof of no deliveries. Keep Today/Last 7 Days and search when retrying. New delivery preserves optional POS order lookup and complete address. A quote never requests a courier automatically.

Reports preserve daily, weekly, monthly and rolling-period modes, comparison logic, presets/custom day count, date stepping and detailed lower-page payment/channel/date rows. Gross, net, paid orders, average order, discounts and difference remain separate. Charts require textual totals and an accessible data alternative. Prior-period series is dashed and labelled. Print goes through printer selection; simulator renders a preview with share/download.

### Catalogue and POS layout

Retain menu categories, product search/filter, add/edit/delete, price, description, kitchen section, till routing, search terms, image, sort order and preparation minutes. Product editor keeps Overview, SEO, Ingredients, Add-ons and Bundle. SEO: slug/title/description. Ingredients: stock warning/alert units and inventory picker. Bundle: included item and quantity. Add-ons: all existing modifier group assignments.

Category editor includes name, description, kitchen section, sort and parent category. Group editor includes name, description, sort, required, multiple and active. Expanded add-ons keep individual edit/delete controls. The uncaptured individual add-on editor must retain the fields in current source; proposed details below are not evidence of the current schema. Nested taps must not bubble to the disclosure action.

### POS Layout — settings drive rendering (v5)

The layout is data, not hardcoded colour/order in the POS component. Initialise from the user’s existing persisted layout and preserve its colours, labels and ordering; never reset it to the example design defaults on startup. The editor preview and live POS use the **same group and product tile renderers**. Source 013/014/015/016 now show the combined editor, with a saved-layout selector and Groups / Products preview modes. Source 017 retains the virtual-group creation form. Existing quick-size, pack separator, virtual group and sort semantics must remain mapped from the current app's configuration; screenshots alone do not define their schema.

Select a tile in the preview to edit it. The inspector supports:

| Setting | Preview and POS effect |
|---|---|
| Background colour | Selected group/product button fill, or global default when All Tiles is chosen |
| Text colour | Tile label, price and supporting tile text; separate from global app-header styling |
| Text size / weight / alignment | Tile label typography; long labels wrap and tile grows beyond minimum height |
| Minimum tile height | Density without clipping multi-line content |
| Display label | POS-only alias; does not rename the catalogue product or receipt business name |
| Visible / hidden | Include/exclude that tile from the appropriate POS collection |
| Move up / down | Saved group or product ordering; accessible alternative to drag |
| Quick List visibility | Product inclusion in the configured quick list |
| Large / small tablet columns and phone columns | Saved responsive grid preference; Auto uses available content width |

**Scope:** appearance can target Selected Tile or All Tiles. Per-tile values override global defaults. Label, visibility and quick-list membership are always per-tile. Selected tile is visibly outlined in the editor and identified in the inspector. Changing the preview device checks phone/small-tablet/large-tablet presentation without changing the saved active layout. Show Hidden keeps hidden choices selectable as ghost tiles in the editor so they can be restored; those tiles remain hidden on the applied POS. Preserve that distinction in production.

**Draft, save and apply:** edits first update the draft preview. Save Layout persists a named layout; Apply to This POS copies the reviewed draft into this device's active layout. They are separate actions. Applying must update the live group and product renderer without changing catalogue pricing or creating orders. The preview's saved layouts and active configuration are local session data only; the developer must wire the existing configuration persistence and permissions. Do not discard a dirty draft when selecting another saved layout without the current app's dirty-state guard.

**Stable identity:** the prototype uses readable sample group/product names as keys. Production must map these to existing stable group/product IDs. Reordering, relabelling or hiding must not change IDs, cart identity, product pricing or modifier lookup. Preserve quick-size items, pack separators, group definitions, sort values, custom colours, quick-list flags and all current layout settings even if their controls were not captured. A compact header does not flatten the group hierarchy.

`pos-layout-example.json` documents the reviewed configuration shape and a sample override. `POS-LAYOUT-V4.md` gives a short review/test guide. Apply a background/text change and move a group, then use Open POS to see the applied values. Actual price/modifier behaviour remains in the existing app services. The local design preview demonstrates colour, text, order, visibility and grid bindings; it is not a backend implementation.

### Settings, devices and TV

Store information retains shop/legal company/ABN/address/phone/website/logo/opening hours. Refresh interval retains 5–300 seconds. Sound retains enabled, sound, play count and preview. Card layout retains vertical/horizontal, cards per screen and item preview counts; the screenshot’s options should be read from the existing implementation before migrating saved preferences.

Marketplace sync retains per-service enabled/interval presets/custom value, opening/closing and Local/Server mode. Caller ID retains listener, AI assistant, port, inactivity and SIP diagnostic presets. Printer diagnostics retains register name and footer flag.

Printer management retains enabled, discovery, TCP/IP/simulator, IP, port, optional name, saved printer edit/remove/default, routing for Default/Fried/Grilled/Till, combined/separate, kitchen/customer template and time windows. Receipt behaviour retains auto-print new orders, on-device in-store printing, delay, automatic customer receipt, selected receipt printer and time window. Do not silently reset hidden settings when saving the redesigned screen.

Smartpay retains base URL, pairing code, register ID, simulator, business/vendor and store contact details. Save and Pair remain separate; pairing state is explicit. Storage retains refresh catalogue, export and import. Import previews impact and asks before replacing configuration. About retains build metadata, network, memory, restart and update.

TV menu management retains active state, image order, preview, download, delete and native file selection. Image upload should validate the existing supported types and maximum size, then show a preview before saving. Preserve aspect ratio with contain; do not stretch or crop menu text. File picker and open-app prompt are OS-owned surfaces.

## Additional states the developer must implement

The source explicitly leaves these conditions uncaptured. They are **proposed behaviour**, not verified current screens. They do not count toward the 114 source-mapped views.

| Situation | Required visible behaviour | Recovery / commit rule |
|---|---|---|
| First load | Skeleton of the intended card/list layout; labelled loading indicator | Never briefly show “No orders” before the request resolves |
| Refresh with loaded data | Retain current data and filter; show updating and last refresh time | Failure keeps prior data marked stale with Retry |
| Offline | Persistent connection banner; cached-data timestamp; meaningful action availability | Preserve local draft; never assume terminal success from lost network |
| Save pending | Keep editor values, disable duplicate Save, show progress | On failure retain values and display an actionable error |
| Save failure | Inline field errors plus summary; focus first failing field/tab | No false success toast or premature close |
| Smartpay processing | Amount, terminal label and current step with progress | Block duplicate charge; cancellation follows actual terminal support |
| Card declined | Exact safe failure wording, amount and Retry/Choose another method | Do not mark order paid; only retry after a confirmed failure |
| Terminal outcome unknown | “Checking payment status” with reference and reconciliation action | Never automatically retry charge; reconcile transaction first |
| Payment success | Paid amount, order reference, receipt choices and return-to-orders action | Confirm from authoritative terminal/server result |
| Pending online/payment link | Pending status, link expiry if available, refresh/resend as supported | Existing payment link/free-item eligibility needs code/schema verification |
| Coupon invalid | Code retained, precise eligibility/expiry feedback | Total remains unchanged until a valid coupon is applied |
| Delete/cancel | Entity-specific confirmation and impact text | Failure restores the row; no silent deletion |
| New/edit add-on item | Proposed label, price delta, inventory/product reference, active, sort and default choice | Verify exact existing fields/selection rules before implementation |
| Populated edit forms | Same editor with current values, entity identity and dirty indicator | Preserve fields not displayed; cancellation restores original values |
| Upload progress/failure | Filename, bounded progress or indeterminate state, Retry/Cancel | Save only a validated uploaded asset; duplicate retries must not create duplicate rows |
| Required modifier missing | Identify the missing group, scroll/focus it and show its selection limit | Keep the already-added line; enforce the existing validation point before submitting/paying the order |
| Sign out with a dirty draft | Explain whether the local draft will be lost | Offer supported recovery only; do not invent draft sync capability |

Unknowns to verify in app code before implementation: the separate order-detail route, payment-link/free-item eligibility, refunds, all permission checks, uncaptured product/customer lower sections, add-on item editors, printer paper quality/instant-ticket controls and all integration success/failure payloads. Keep current fields accessible until they have a mapped replacement. The source screenshots alone cannot establish these rules.

## Implementation guidance

For the existing Expo/React Native app, derive size class from `useWindowDimensions()` and safe-area insets. Use shared presentation components with the current business/state services. Keep API calls and payment effects out of layout components. Do not duplicate draft state into separate phone/tablet screens; both bind to the same draft identity.

Use virtualised product/customer/order/journal lists, stable keys and memoised row rendering. Never render the full customer directory inside a nested scroll view. Clean up polling, listeners and timers on lifecycle changes; suspend unnecessary work on backgrounding. Printing should generate appropriately sized receipt output, not a screenshot of the whole tablet UI. These are implementation guardrails, not a code audit or a claim that the current app violates them.

Keep online order refresh separate from cart editing. Protect a staff member’s current item, focus and selection when background order data updates. Search should debounce expensive remote queries while immediate local filtering remains responsive. Skeletons and timestamps must reflect request state, not decorative timers.

Roll out shared tokens and shell first, then orders and POS, checkout/payment, customer/marketing, catalogue, device settings and reporting/TV. At each stage compare behaviour against existing implementation; visual changes do not authorise integration or financial-rule changes.

## Acceptance checklist

1. Every selected source ID plus proposed P01/P02 has a mapped route/state in `SCREEN-COVERAGE.md`, and its controls are accounted for. All 114 source-mapped views and both proposed views open in all four atlas viewport presets. Level 1 accommodates 50+ groups without a category strip, large stepper or permanent search field; test with long translated labels.
2. No horizontal page overflow at 320, 375, 390, 430, 600, 768, 820, 1024, 1100 and 1366 logical widths. The POS switches to a single pane when its minimum content width cannot be met.
3. Checkout draft and the current order-selection level survive rotation, resizing, modal open/close, search, tabs and fulfilment changes. A product tap adds before level 3 opens. Modifier choices update immediately, Done never inserts, and no-modifier products remain in the browse view. Edit Add-ons updates the selected line with no duplicate. The search icon opens/closes search without changing browsing context. Dirty back/close cannot silently lose input.
4. Touch targets are at least 48; VoiceOver/TalkBack labels, selected states and errors are meaningful. Focus returns after closing dialogs. Large text does not truncate totals or hide actions.
5. Test order creation by all fulfilment branches and cash/card/unpaid/Smartpay paths using safe test integrations. Paid/unpaid and preparing/ready stay independent. Duplicate taps, timeouts and unknown terminal outcomes do not double-submit or double-charge.
6. Test integer-cent totals with discounts, coupons, quantities and chargeable add-ons against existing app calculations. Do not infer tax rules from display samples.
7. Test empty/loading/error/offline/stale states independently. Credentials never appear in logs; connection loss never looks like an empty successful response.
8. Test printer discovery/edit/default/section routing and receipt options using a simulator before physical printers. Verify each time window and template. Saving must preserve uncaptured settings.
9. Marketing preview is not send. Validate per-channel counts, permissions and confirmation. Test coupon state rollback and add-on nested tap targets.
10. Product editor validates across tabs and retains values. Product/category/group removal uses the existing impact/permission rules. TV image preview preserves original aspect ratio.

## Verification of this design package

See `VERIFICATION.json` for actual artifact checks, including header size, small-tablet density, collapsed-filter persistence and layout-to-renderer binding. Static layouts and a selection of sample navigation paths are verified here; production networking, payment, printing, accessibility APIs and the current app implementation cannot be verified from screenshots. This package is a reviewable design proposal for implementation, not a tested application release.
