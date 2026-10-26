# Native design and functional audit

The earlier 116-state mapping was an index, not evidence of fidelity. All states need native inspection. Existing uncommitted code remains on pos-redesigned.

## Confirmed simulator failures
- POS add-ons/cart: raw whitespace in fragment rendered as native text, causing LogBox error.
- Cart footer: wrapping flex buttons consumed available vertical space; primary action and shortcuts needed explicit layout rows.
- POS header: centered legacy Appbar instead of left-aligned brand/title hierarchy.
- Add-on groups: fieldset/oversize centered choices differ from supplied card title + requirement badge and left-aligned choices.

## Verification in progress
- [x] Reproduced native text error and oversized buttons in running iPad simulator.
- [x] Removed raw whitespace and confirmed error disappears on native Fast Refresh.
- [x] Verified corrected cart footer heights; Checkout, Complete, SmartPay all visible. No payment action submitted.
- [ ] Match POS reference states 010, 018, 118,119,P01, checkout 020–030,120–121.
- [ ] Inspect and match Orders states 001–008,032,108,112,113,115,P02.
- [ ] Inspect and match all remaining management/editor/settings states.
- [ ] Rotate and check phone layout; validate reachable controls and draft retention.

Screens are marked verified only after native inspection, not because source/unit tests pass. No real payment, order submission, marketing send, or settings save is performed without a safe test environment.

## Continued native audit
- POS: required add-on blocks Add; choosing salt and quantity 2 produces exactly one line with quantity 2; cancelling an edited add-on restores the existing line. Direct-add product stays in product browsing. Portrait rotation retained draft.
- Checkout: fixed oversized tabs; pickup customer fields, discount entry, timing, notes and submit footer are reachable. Discount dialog now bounded; all discount modes retained. Other checkout types still need native audit.
- Live Orders: rebuilt shared cards and filter toolbar against 001; native All/Unpaid filtering verified. Order detail uses shared navigation and a two-column tablet layout. More state and phone checks remain.
- On the way: native empty state inspected against 005.
- History: dense rows and real metrics; native displayed-number search caught and fixed a lookup mismatch (P069 now resolves). Dates, filters and short/phone layouts need further inspection.
- Settings: removed duplicate Orders header, shared list rows, full-page editors, fixed Save footer. Native Cancel restored interval 31 to 30 without saving. Added separate section routing and receipt-options entries; these still need native validation.
- Customers: native compact directory and bounded new-customer editor inspected; save disabled with missing details and Cancel closes. Profile now uses shared navigation, four metrics and two-column panels; full history remains expandable. Found a reward-balance lookup bug for profile IDs; regression/fix in progress.
- Current unit suite: 327 passed before the new reward-balance regression. Removed obsolete assertions against deleted JSX/style names; these were not visual tests.
- Full TypeScript check continues to report existing receipt/caller-ID errors; no success claim for repository-wide type checking.

Remaining: finish customer profile/editor checks; all marketing, coupon, marketplace, delivery, report, catalogue, call, TV, auth states; POS checkout variants; navigation, compact/phone and short-height coverage. The redesign is not yet complete or fully validated.

## 19 October continuation
- Customer reward balance regression fixed and verified natively: the same profile now agrees with the directory. Added regression coverage.
- Marketing: campaign, recipient selection, review and removal inspected with a local draft; subject/body cleared afterward. No message generated or sent.
- Coupons: native grid/filter/detail inspected; local Active toggle discarded. Active query now excludes expired/future coupons; regression tests added.
- Marketplace: both unconfigured-provider forms, mapping search and history menus inspected. No credentials or mappings saved. Delivery list still fails to load in this environment; designed retry state and local new-delivery validation inspected, no quote requested.
- Reports: daily, weekly, monthly and rolling reports loaded actual data. Seven-day rolling totals agree with weekly totals. Six metrics, chart axes, bounded date/help/printer dialogs corrected. Simulator printer generated a preview; shared preview size/header/footer corrected afterward. Need regenerate preview after Fast Refresh (the old cached image was released during code refresh), then compact/portrait coverage.
- Catalogue: products list, overview, SEO, empty/linked ingredients, inventory search/selection, empty bundle and add-on selection inspected. Corrected native modal nesting so inventory picker opens above product editor. New picker selection supplies quantity/unit defaults. Product and category editors now shared sheets with dirty/pending protection. Add-on groups use shared management rows; search/expanded items/new-group form inspected. Edited local group Cancel triggered discard confirmation; discarded without save.
- Unit suite: 330/330 passed before the latest report/catalogue UI changes. Type check after catalogue edits reports only the same 13 receipt/caller-ID baseline errors; final rerun still required.

Still incomplete: category form/native checks, add-on item editor, regenerated print preview, POS layout settings, calls/about/TV/auth, remaining POS checkout/settings/order states, phone/portrait/short-height checks and final verification. This is not completion of all 116 states.


## Resumed simulator validation, 19 October
- User explicitly returned simulator control. Branch remains `pos-redesigned`; no orders/payments/campaign sends/settings saves executed.
- Checkout cash: landscape and portrait inspected against 121. $11 due/$50 tender shows $39 change; $5 tender shows $6 short and disabled Confirm; first keypad digit replaces quick amount; Exact shows $0 change. Cancelled, temporary cart cleared. Hardware keyboard meant software-keyboard obstruction was not exercised.
- Order history filter: inspected against 008; applied Paid, reopened and confirmed it persisted, Reset/Apply restored All. Preorders empty state inspected; no scheduled records available to validate populated cards.
- More page: grouped navigation inspected. Replaced native profile alert with shared ProfilePrompt used by both header families and More; actual email/role display inspected and Done closes. Sign-out now follows warning/dialog design; final updated warning appearance still needs a fresh check. Sign-out itself not executed.
- Settings: added shared SettingsEditor (bounded small forms, full printer workspace, fixed footer), five printer tabs, reused saved-printer panel in Connections/Saved. Small refresh/sound/caller-ID forms inspected in portrait. Refresh draft 40 Cancel restored 30. Printer routing draft 16:00, switch to Receipts, Cancel, reopen Routing restored 17:00. Initial new printer-page render error was traced to importing ChoiceTabs from an index that does not export it; corrected direct import and native page rechecked successfully.
- Sound picker replaced native Alert with shared staged SelectionSheet, also reused for route sections/printers. Native sound picker opens above editor; changing selection then Cancel retains original sound. Native section/printer selection sheets still need direct interaction checks.
- Reports: fresh simulator-only daily receipt regenerated after changes; readable 320-wide long receipt verified with bounded scroll area and fixed actions in portrait. No hardware printer used.
- POS layout: shared product preview, layout dropdown, Groups/Item preview and custom colour dialog inspected in portrait. Corrected cramped nested editor boxes. Custom colour now hex field, five palette choices, brightness and preview per 015: invalid hex disables Apply, palette restores #087F82 and enables Apply; cancelled. Virtual-group empty form inspected; Create disabled; source choices now 48-high and Create requires at least two sources. No layout saved/applied. Simulator AX omits the underlying layout screen controls although visible coordinate interactions work; modal controls are exposed. Needs accessibility investigation and compact/short-height coverage.
- Prior continuation checks: About diagnostics refresh; Calls Today/Yesterday/All/search; TV actual-image preview/native upload picker Cancel; responsive web login desktop/phone/tablet empty validation. Calls now retain cached records if refresh fails and clear stale date-filter data when changing range; dirty EditorSheet close now works on web via confirm.
- Verification: latest unit run 329/329 (obsolete preorder JSX-layout test removed, header assertion updated). TypeScript reports same 13 receipt/caller-ID baseline errors. Web export passes; final export/type/unit rerun required after latest POS-layout additions. `git diff --check` clean at last check.

Outstanding: full 116-state fidelity is NOT complete. Remaining settings form specifics/journal/pairing, populated orders/preorders/detail/payment-link and checkout variants, category editor, marketplace resolver, compact/phone/short-height screens, layout accessibility, and final integration review need continued work. Do not treat the design state index or unit tests as screenshot coverage.


## Take Order v3 priority update
User clarified that the existing immediate-add UX must be retained and dynamic/conditional business behavior must take precedence over static design omissions. Read updated README, TAKE-ORDER-V3.md and handoff §§83–97.
- Product taps insert immediately before opening options; original plain merge rule retained, with free-item isolation and separate configured copies. Rapid taps use the latest local cart snapshot.
- Add-ons, removals, editor quantity and saved notes update the same line immediately. Done/Back navigate; no second Add or transaction-style Cancel. Cart-side quantity/note controls remain usable for the active line and explicit Remove still removes it. Quick List returns to its prior browse context.
- Required modifier validation occurs before checkout/payment, reopens the incomplete local line, and treats explicit zero-price No salt as a selected choice. Imported provider orders retain their provider-specific mappings; free promotion items retain their separate flow. Payment locks and existing checkout paths retained.
- Shared PosSearchSheet opens from header magnifier. No persistent group/product search fields. Group/product results reuse existing context and PosProductTile; plain adds keep search open, option editing closes it, closing search preserves the underlying browse level/scroll.
- Obsolete transaction-commit helper/tests removed; regression tests cover insertion, merge, promotion isolation, stable-line updates, totals and missing-line non-resurrection. Unit suite 329/329 passes. Web export and iOS Hermes bundle export pass; type checking still has the same 13 receipt/caller-ID baseline errors, no new errors at last check. Final rerun after minor label/reset edits pending.
- Native v3 validation is NOT complete: simulator was disconnected from old 192.168.0.94 development address after host network changed. Existing Metro /status responds locally. Simulator automation then failed to initialize its native pipe on three recovery attempts including a clean CUA session. No alternate simulator automation/CLI was used. Need reconnect to localhost:8081 and regain CUA control before claiming v3 interaction/visual verification.

- Follow-up business-flow review: required-choice checks target locally added/modified option lines only. Existing untouched order lines and pending SmartPay reconciliation are not reinterpreted against today's catalogue. Provider mappings and free promotion items remain exempt from this local option validation. Cart-side quantity/note changes stay synchronized with an open editor.


## 20 October validation retry
User reported simulator running. Native computer-use connection still fails before app inspection (`Sky Computer Use native pipe startup failed`). Retried the app binding, reset CUA, then requested full surface inventory: apps empty, browsers empty, native startup error. No new screen interactions or validation claims made. Need restore the computer-use connection; simulator availability alone does not restore it.

## 20 October — V4/V5 implementation and native validation

Supersedes the V3 editor return rule: Continue and small Back now return to the product's Level 2 group from search, Quick list or cart; they preserve the already-added line and modifiers. Level 2 Back returns to Groups.

Implemented:
- Shared 56-unit workspace headers without store/register labels; POS Groups/Quick list header tabs, on-demand search and retained order tools/New order/Caller ID/SmartPay resume actions.
- Collapsed order filters with retained selections and active-count badge. Existing order workspaces and conditional upcoming-order tab retained.
- Shared configurable group/product tile renderer across preview/live/search/Quick list; appearance, labels, visibility/order and device/pane-aware column configuration. Named Save is separate from local Apply. Catalogue cache respects applied snapshot.
- Compact cart preserving group, name, all modifier summaries, removals, notes and marketplace price context. Tap item opens same-line options; separate quantity/note/remove controls remain active. Historical unavailable modifiers/removals and charges survive unrelated edits.
- Near-full tablet/full-phone order detail with fixed header/footer. Native customer→order presentation now nests within the profile's modal, preserving caller state. Shared detail controller retains existing business actions. Busy guards include Android back/route removal.
- Immediate printer action buttons, copy-type context, synchronous in-flight lock and queue outcome reconciliation. Unknown outcomes cannot be silently retried; preview does not create physical jobs. Underlying detail controls are hidden/inert during nested sheets.

Native checks completed on running iPad Pro 13-inch iOS 26.1, landscape and portrait:
- Compact POS/header, Groups/Quick list, on-demand search with typed product query.
- Product tap immediately inserts one line; required zero-price selection reflected in cart; quantity change synchronizes editor; Continue returns to Sides with line/selection intact; cart tap restores selection; small Back returns to products.
- Search-origin add→options→Continue resolves actual product group. Local validation items removed afterward (cart 0).
- Live filters start collapsed; Unpaid gives badge 1, collapse/reopen retains selection. Restored All orders.
- Layout selected-tile colour changes preview; Apply changes live matching product. Original saved Default POS Layout reloaded and applied afterward; no named layout saved.
- Customer directory→profile→recent order opens near-full modal above profile; Close restores same profile. Repeated portrait check passes. Initial sibling-modal layering bug was reproduced and fixed.
- Print order→Customer copy→printer action list: Simulator tap locks actions then immediately opens readable receipt preview. Close restores same order. Final picker AX tree excludes underlying detail actions.

Verification after final data-preservation fixes: 346/346 unit tests pass; explicit-type TypeScript reports only the same 13 receipt/caller-ID baseline errors. iOS/web exports rerun after final changes (see tool logs). Whitespace checks pass.

Limits: phone/Android runtime and every 116 reference-state screenshot have not been exhaustively revalidated. No real order submission, payment, customer mutation, marketing send or physical printing performed. Native full-screen layout settings route intermittently exposes no AX tree; visual screenshot/coordinate verification used for that route.


## 20 October — latest header/modal fidelity pass

This pass compares the latest V5 references, including the final screen.css overrides. Detailed reference-by-reference reviews are in `pos-latest.md`, `orders-customers-latest.md` and `management-latest.md`. These documents distinguish source comparison from native verification; an audit row does not mean every device/state was exercised.

Shared fixes: outlined 40-unit header controls, 56-unit headers, POS mode tabs immediately beside the title, profile-only actions on ordinary management screens, narrow 72/64 navigation rail, 16/12 content gutters, dark-on-white secondary actions, and consistent EditorSheet dimensions/header/body/footer/close controls. Native backdrop uses the intended tint; web additionally uses blur. Native blur is not implemented.

Latest native checks on iPad Pro 13-inch (M5), iOS26.1:
- POS landscape header/group/product/modifier screens: tap immediately inserts, required Fried/No Salt choices update same line, Continue returns to FISH, cart tap restores selections, note modal Cancel works, clear confirmation removes only temporary draft. Group colors remain actual configured colors.
- Expanded cart review P01 now available on tablets from Order tools; shared cart rows/handlers provide separate summary/items/total panels. Empty and populated views checked; quantity1→2 updates $2→$4; Continue returns to SAUCES with the same item/quantity. Temporary item removed afterward; cart0.
- Portrait rotation settles into three product columns plus288-unit cart; header actions and checkout controls visible. Fixed Customers rail label wrapping into a stray final letter.
- Orders history006 now shows four paid-summary metrics/search while filters are collapsed, one rounded list frame. Date007 opens framed staged calendar; Cancel returns unchanged date/list.
- Order details003 open nearly full tablet size with items/customer/totals; Close restores original history. Customer033→035→recent order003→Close restores the same profile. Name036 editor Cancel preserves profile.
- Print004 copy-type rows→Customer copy→immediate printer action list→Simulator receipt preview. Preview renders; Close restores same order. No physical printer used.
- Settings066/Store067: compact header and full workspace two-column store form with sole Save footer; Cancel checked. Long production Logo URL field changed to proper multiline height.
- More031, Coupons043/detail044, Campaign039, recipients040, filter041, Marketplace046/connection047, Deliveries054/new056, Reports057/rolling061, Callhistory089, About092, TVgallery093/preview094 and Catalogue077/product078/079/080/081/082/083 inspected. Temporary campaign subject/body cleared; no recipients selected/sends.
- Recipient041 now bounded620-unit sheet with staged choices and Apply/Cancel. Inventory081 now wide sheet with labelled left-aligned rows and Select actions; closes to underlying product editor. Catalogue shared rows and call-history rows have rounded list frames.
- Found and corrected remaining old28-unit outer gutters in Marketplace, Coupons, Calls, TV, Pre-orders, On the way, About and Delivery list controls.

Service limits: current Deliveries data request fails, so native evidence covers its error/retry state and new form, not populated records. Marketplace connections are unconfigured, so connected history/status/date/order details are source-reviewed rather than populated native checks. No backend writes, real orders/payments, physical printing, marketing sends, TV reorder/delete/visibility changes or terminal pairing were performed.

Verification:347/347 unit tests pass after shared/cart/selection changes. Full TypeScript still reports exactly13 baseline receipt/caller-ID errors. iOS/web export and whitespace checks are recorded in the final tool results. Phone/Android runtime and exhaustive screenshots for every114 source state plus2 proposed states remain unverified; reference reviews cover those layouts without claiming native pixel parity.

Additional portrait checks after a full development-bundle reload: Refresh068, Sound069/selection101, Card layout070, Auto-sync071, Caller ID072, Diagnostics073, Printer connections074/edit075, Routing104, Receipt106, Journal107 and Smartpay076. Cancel returned to prior context without saving. Routing was still oversized: replaced full-width printer selectors with compact wrapping configured-printer buttons, kept No printer (skip), removed the redundant disabled Default-section input, separated route cards, and reduced mode/template controls to content width. Confirmed refreshed routing in native.

Reload also exposed a portrait Live-order regression: vertical FlatList inherited flex-start alignment intended for the horizontal rail, shrinking cards and clipping View/Print labels. Set vertical list alignment to stretch, retained horizontal rail alignment, and updated rail allocation for72/64 navigation. Native portrait now uses full-width readable cards with complete action labels. This fix was confirmed after refresh.


## 21 October — catalogue continuation

Restarted the stopped Metro development server and confirmed the authenticated simulator loaded the current bundle. Recovered a syntax error introduced during the last add-on switch styling edit; explicit-type TypeScript returned to the same13 receipt/caller-ID baseline errors.

Native iPad landscape checks: New add-on group087 now uses the full reference title, separated68-unit toggle rows, and centered native switches. Save remains disabled for an empty name; Required retains its production default (off). Cancel closes without saving. Add-on groups086/expanded088 were checked in portrait in the prior continuation.

Found two additional source-audit gaps in categories084: missing category search and disconnected square row frames. Added independent category search (product search remains separate); matching child categories retain their parent context. Native query600ml displays DRINKS plus600ml Bottle, with a continuous rounded frame; Clear restores all categories. New category085 retains kitchen sections, fallback help, sort order, parent-category selection and active state; Cancel returns unchanged.

Added shared CatalogueTabs to both catalogue routes, restoring the missing Products/Categories/Add-on groups navigation on the add-on screen. Native Add-on groups→Categories opens Categories directly. Route replacement avoids accumulating a new route for each tab transition. No catalogue/backend records saved or deleted.

Verification after the catalogue changes:347/347 unit tests pass; iOS and web exports both exit0. Explicit-type TypeScript exits2 with the same13 known receipt/caller-ID errors and no catalogue errors. git diff --check passes. Phone/Android runtime and every reference state remain outside the native evidence recorded so far; this continuation does not certify exhaustive pixel parity.

## 21 October — screenshot-led boundary and modal review

User identified missing separation beneath the header. Captured native Orders and compared an equally scaled header strip against reference006. Root cause: OrdersWorkspaceHeader duplicated its own title bar and placed a border only below the tabs. It now renders shared WorkspaceHeader, retaining filter/refresh/marketplace-status/New order/profile handlers and onNavigate behavior. This supplies the missing1-unit title-bar divider. Shared title line height/letter spacing and fixed height were aligned. Orders tab gaps, neutral/selected count badge dimensions and phone3-versus4-tab layout now follow the CSS. The real upcoming count exposed the conditional fourth tab; its loading state was checked, not a fabricated populated state.

Screenshot comparison also identified compact history title/meta/button sizing and shared badge typography; these were aligned to the source sizes. Native Completed list checked with real data.

POS cart header/footer dividers were inset because all sections lived inside a padded pane. Separated padded header/body/footer regions so the boundaries reach the card edges; footer uses #FAFCFB, with compact Clear/Change controls. Shared item rendering and business handlers remain intact. A negative-grid-margin experiment clipped tile corners in native and was reverted.

Salt012 was still using the old Paper compound dialog framing, despite earlier source-review claims. ResponsiveDialog now adapts its existing Title/Content/Actions API into EditorSheet. The salt, note, payment and other existing dialog handlers remain in place. Native selection of Chicken Salt followed by Cancel leaves Order salt: Not selected. Item note019 now uses horizontal preset chips without underlining and the shared externally labelled rounded FormField. Native note Cancel and payment-choice Cancel returned to the same local cart. Temporary $2 item removed afterward; cart0, total$0, no order/payment submitted.

Visual evidence: artifacts/pos-redesign-fidelity/orders-header-comparison.png and salt-modal-comparison.png, with raw captures and method/limitations README. Native blur and platform font rasterization remain distinct from browser references; this pass does not claim universal1:1 parity.

Final verification for this pass:347/347 unit tests, iOS export exit0, web export exit0, and git diff --check clean. Explicit-type TypeScript exits2 with the same13 receipt/caller-ID baseline diagnostics; no changed header/dialog/cart files appear in the diagnostics.
