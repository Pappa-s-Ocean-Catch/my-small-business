# POS family — latest reference audit

Reference audit: 2026-10-20. All 26 IDs below were visually inspected with `view_image` in four-device contact sheets made from `Pappas-Redesign/screens/{landscape,smalltablet,portrait,phone}`. These are reference comparisons, not claims that the running native app was verified. The parent agent owns native/simulator verification.

Additional full-size inspection: 010 landscape/phone, 018 landscape/phone, 013 landscape, 012 landscape, 019 phone, 020 landscape, 021 landscape, 023 phone, 121 landscape. Source inspected: `screen.css`, including final V4/V5 overrides, and `render.js` POS, customization, cart, checkout and search functions. Contact sheets are `/tmp/pos-reference-0.jpg` through `/tmp/pos-reference-5.jpg`.

| ID | Latest reference structure | Implementation response / remaining check |
|---|---|---|
| 010 | 56px header, Groups/Quick list beside title; phone hides title; 104px tiles with left accent, count/arrow footer; cart on tablets | Tabs use shared leading slot. Removed invented second dark phone nav strip, added contextual bottom order bar. Centralized workspace geometry. Shared tiles compact and white by default. Native width/scroll check remains. |
| 011 | Search overlay, products followed by group grid; 2-column phone results | Products now precede matching shared group tiles; saved tile configuration applies. Native focus, scrolling and layout check remains. |
| 012 | Salt preference radio rows, Cancel/Use preference | Full-width radio choices draft until explicit confirmation. Existing configured notes retained. |
| 013 | Preview canvas + 300px desktop / 280px tablet inspector; 1 column phone | Fixed inspector width, compact appearance controls, saved-layout/name before appearance, legacy settings expandable. Preview selected outline. Uses same configured tiles and live menu allocation. Native phone inspector scrolling remains. |
| 014 | Saved layout selector in same editor shell | Existing persisted layouts plus explicit draft examples, no automatic seed overwrite. |
| 015 | Latest exported state is the selected-tile editor; custom colour accessible through colour control | Removed generic workspace subtitle; compact colour fields open existing shared picker. Picker is production extension to the exported selected state. |
| 016 | Groups editor shares preview and inspector | Same renderer, selected outline, hidden restore, configurable ordering and appearance. |
| 017 | Create virtual group, name, source checkboxes, Cancel/Create | Existing virtual group rules and persistence retained in shared modal. Source list is real catalog data. |
| 018 | Compact product context, modifier group cards, 2-column tablet / 1-column phone, current-item summary, quantity/note/price/Continue | Reduced context padding/height, selected badge, compact group/options, summary before footer, separate running price. Removed duplicate removals copy. Existing choices and historical prices retained. |
| 019 | Quick notes, item note, Cancel/Save note | Quick presets exposed both in cart-note dialog and modifier editor; shared modal header/footer. No sample-note seeding. |
| 020 | Checkout tabs, customer card, discount row, pickup card, order note | Existing real customer/order forms retained; shared secondary buttons and centralized menu/cart geometry. |
| 021 | Presets, discount type, percentage/fixed/coupon fields, preview total, Cancel/Apply | Rebuilt shared discount editor around explicit Apply. Existing validation, coupon lookup and targeted-customer callbacks retained. Displayed estimate uses actual cart subtotal. |
| 022 | Pickup Pre-order adds real date/time controls | Existing production date/time rules retained. Native date/time control styling differs from HTML by platform. |
| 023 | Customer phone modal, input, 3×4 keypad, Cancel/Use phone number | Replaced custom old overlay with shared sheet; reference keypad order, validation and native phone input retained. |
| 024 | Customer name modal with one input, Cancel/Use name | Removed invented on-screen QWERTY; shared sheet and native text entry. |
| 025 | Delivery tab, customer, address/instructions, quote/review flow | Production quote and delivery validation retained. Shared controls and compact geometry. Real quote state requires runtime data. |
| 026 | Third-party tab, customer, external source/order ID | Production source/time/ID fields preserved. Shared controls and compact geometry. |
| 027 | In-store checkout, optional customer, payment selection | Production payment choices retained. Shared controls; payment dialog explicit confirmation below. |
| 028 | Find a customer workspace with list and recent calls action | Replaced large custom heading/eyebrow with shared compact workspace header; existing async directory lookup preserved. Native return/focus check remains. |
| 029 | Recent calls radio list, Cancel/Use selected number | Replaced unshared floating dropdown with shared sheet and explicit selected-call confirmation. |
| 030 | Clear this draft? shared confirm, warning, Cancel/Clear draft | Replaced native Alert with shared confirmation. Existing pending saved-order lock, edited-order guard and draft reset logic retained. |
| 118 | Compact group Back/title and product grid | Compact context, shared product tiles, actual aliases/price/config retained. |
| 119 | Quick list uses same product grid and compact context | Shared tile configuration retained; no price/membership seeding. |
| 120 | Payment radio choices, Cancel/Continue | Local draft radio state; Continue calls existing payment-choice handler once. Editing-only Smartpay choice retained. |
| 121 | Cash tender, navy totals, presets, keypad, Cancel/Confirm | Existing accurate cents parsing/duplicate-confirm guard retained. Removed invented workspace eyebrow and adopted shared secondary buttons. |
| P01 | Expanded current order, wrapped modifier summary, separate quantity/note/remove controls | Existing exact-line editor/navigation preserved. Compact 36px tablet visual controls with enlarged touch hit areas; phone accessibility/runtime review remains. |

## Verification and limits

- Targeted layout normalization/scope/geometry and catalog saved-versus-applied tests use isolated `/tmp` output, never shared `dist-test`.
- Full TypeScript run uses `--types node,react` to avoid the environment's ambient `minimatch` type issue. Receipt QR and caller-ID baseline errors remain external to this family.
- This pass has not operated the simulator. Native screenshot parity, keyboard overlap, scroll restoration, modal focus and font-scale overflow still require the parent's runtime checks.
- Production datasets, live prices, saved appearance overrides, real customer results, delivery quoting, coupons and payment processing remain dynamic. Reference sample names/prices never replace production data.
