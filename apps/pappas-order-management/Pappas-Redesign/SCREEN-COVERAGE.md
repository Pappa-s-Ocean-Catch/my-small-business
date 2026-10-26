# Screen coverage — 114 captured states + 2 proposed views (v5)

Shared compact header across all working screens. Order filters collapsed by default; POS Layout configuration is shared by preview and POS.

| ID | Area | Source state | Redesign | Primary action |
|---|---|---|---|---|
| 001 | orders | live / default | Live orders | Mark ready |
| 002 | orders | live / filter-menu | Orders · Filters expanded | Hide filters |
| 003 | orders | detail / unpaid-pickup | Order details | Mark ready |
| 004 | orders | detail / print-type-prompt | Print order | Choose copy |
| 005 | orders | on-the-way / empty | On the way | Refresh |
| 006 | orders | completed / today-loaded | Order history | View order |
| 007 | orders | completed / date-picker | Choose date | Apply date |
| 008 | orders | completed / filters-modal | Filter order history | Apply filters |
| 010 | pos | take-order / empty-cart | Take order · Choose group | Choose group |
| 011 | pos | catalogue / search | Search menu | Tap result to add |
| 012 | pos | cart / salt-option-modal | Salt preference | Use preference |
| 013 | settings | pos-layout / item-preview | POS layout | Apply to this POS |
| 014 | settings | pos-layout / layout-selector | POS layout | Apply to this POS |
| 015 | settings | pos-layout / custom-colour-modal | POS layout | Apply to this POS |
| 016 | settings | pos-layout / groups | POS layout | Apply to this POS |
| 017 | settings | pos-layout / create-virtual-group-modal | Create virtual group | Create group |
| 018 | pos | item / customisation | Take order · Update item | Continue |
| 019 | pos | item / note-modal | Item note | Save note |
| 020 | pos | checkout / pickup | Checkout | Save changes |
| 021 | pos | checkout / discount-modal | Apply a discount | Apply discount |
| 022 | pos | checkout / pre-order | Checkout | Save changes |
| 023 | pos | customer / phone-keypad-modal | Customer phone | Use phone number |
| 024 | pos | customer / name-keyboard-modal | Customer name | Use name |
| 025 | pos | checkout / delivery | Checkout | Save changes |
| 026 | pos | checkout / third-party | Checkout | Save changes |
| 027 | pos | checkout / instore | Checkout | Save changes |
| 028 | pos | customer / search-modal | Find a customer | Use selected customer |
| 029 | pos | customer / recent-calls-modal | Recent calls | Use selected number |
| 030 | pos | cart / clear-draft-confirmation | Clear this draft? | Clear draft |
| 031 | navigation | drawer / expanded | More | Choose destination |
| 032 | orders | pre-orders / empty | Pre-orders | Refresh |
| 033 | customers | directory / default | Customers | New customer |
| 034 | customers | add / form-modal | Add customer | Save customer |
| 035 | customers | profile / overview | Customer profile | Edit customer |
| 036 | customers | profile / edit-name-modal | Edit customer name | Save name |
| 037 | customers | profile / adjust-rewards-panel | Adjust reward points | Save points |
| 039 | marketing | campaign / empty | Create a campaign | Choose recipients |
| 040 | marketing | recipients / directory | Choose recipients | Review campaign |
| 041 | marketing | recipients / filters-sort-modal | Recipient filters & sort | Apply filters |
| 042 | marketing | review / unsent-preview | Review campaign | Send email · 1 recipient |
| 043 | coupons | directory / all | Coupons | View coupon |
| 044 | coupons | detail / modal | Coupon details | Done |
| 045 | coupons | directory / active-filter | Coupons | View coupon |
| 046 | marketplace | orders / uber-active | Marketplace | Configure connection |
| 047 | marketplace | settings / uber-cookies-modal | Connect Uber Eats | Save connection |
| 048 | marketplace | settings / doordash-modal | Connect DoorDash | Save connection |
| 049 | marketplace | mapping / unmatched-names | Resolve menu names | Save mapping |
| 050 | marketplace | orders / history | Marketplace | Configure connection |
| 051 | marketplace | orders / status-menu | Filter marketplace status | Apply status |
| 052 | marketplace | orders / date-menu | Marketplace date range | Apply range |
| 053 | marketplace | orders / scheduled | Marketplace | Configure connection |
| 054 | deliveries | list / today-load-error | Deliveries | Try again |
| 055 | deliveries | list / last-seven-days-load-error | Deliveries | Try again |
| 056 | deliveries | new / address-form | New delivery | Get delivery quote |
| 057 | reports | sales / overview | Sales reports | Print report |
| 058 | reports | sales / date-modal | Report date | Apply date |
| 059 | reports | weekly / overview | Sales reports | Print report |
| 060 | reports | monthly / overview | Sales reports | Print report |
| 061 | reports | last-x-days / overview | Sales reports | Print report |
| 062 | reports | print / printer-picker-modal | Choose a report printer | Print report |
| 063 | reports | print / simulator-preview | Report print preview | Download / share |
| 064 | reports | last-x-days / help-modal | About rolling reports | Got it |
| 066 | settings | hub / default | Settings | Save settings |
| 067 | settings | store-information / modal | Store information | Save store information |
| 068 | settings | refresh-interval / modal | Refresh interval | Done |
| 069 | settings | order-sound / modal | Order sound | Done |
| 070 | settings | live-order-cards / modal | Live order cards | Done |
| 071 | settings | marketplace-auto-sync / modal | Marketplace auto-sync | Done |
| 072 | settings | caller-id / modal | Caller ID | Done |
| 073 | settings | print-diagnostics / modal | Print diagnostics | Done |
| 074 | settings | kitchen-printer / overview | Kitchen printers | Add printer |
| 075 | settings | kitchen-printer / edit-saved-printer | Kitchen printers | Add printer |
| 076 | settings | smartpay / pairing | Smartpay pairing | Pair terminal |
| 077 | catalogue | menu-management / products | Menu products | Add product |
| 078 | catalogue | product-new / overview-modal | New product | Save product |
| 079 | catalogue | product-new / seo-tab | New product | Save product |
| 080 | catalogue | product-new / ingredients-tab | New product | Save product |
| 081 | catalogue | product-new / inventory-picker-modal | Select inventory product | Add ingredient |
| 082 | catalogue | product-new / bundle-tab | New product | Save product |
| 083 | catalogue | product-new / addons-tab | New product | Save product |
| 084 | catalogue | menu-management / categories | Menu categories | Add category |
| 085 | catalogue | category-new / modal | New category | Save category |
| 086 | catalogue | addons-management / groups | Add-on groups | Add group |
| 087 | catalogue | addons-group-new / modal | New add-on group | Save group |
| 088 | catalogue | addons-management / group-expanded | Add-on groups | Add group |
| 089 | calls | history / today | Call history | Call back |
| 090 | calls | history / yesterday | Call history | Call back |
| 091 | calls | history / all-time | Call history | Call back |
| 092 | about | app-information / default | About this register | Check for update |
| 093 | tv-menu | management / default | TV menus | Upload menu image |
| 094 | tv-menu | preview / image-modal | Preview menu image | Download image |
| 095 | tv-menu | upload / system-file-picker | Choose menu image | Choose file |
| 096 | navigation | profile / information-prompt | Your profile | Done |
| 097 | navigation | sign-out / confirmation | Sign out of this register? | Sign out |
| 098 | navigation | deep-link / system-open-prompt | Open an app link | Open app |
| 099 | auth | login / default | Welcome back | Sign in |
| 100 | auth | login / required-fields-validation | Welcome back | Sign in |
| 101 | settings | order-sound / selection-prompt | Choose notification sound | Use selected sound |
| 102 | settings | hub / storage-and-integrations | Settings | Save settings |
| 103 | settings | kitchen-printer / saved-printers | Kitchen printers | Add printer |
| 104 | settings | kitchen-printer / section-routing-01 | Printer section routing | Done |
| 105 | settings | kitchen-printer / section-routing-02 | Printer section routing | Done |
| 106 | settings | kitchen-printer / receipt-options | Receipt & print behaviour | Done |
| 107 | settings | kitchen-printer / journal | Print journal | View event |
| 108 | orders | live / empty | Live orders | Refresh |
| 112 | orders | history-route / empty | Order history | Change date |
| 113 | orders | history-route / loaded | Order history | View order |
| 114 | customers | summary / missing-contact | Customer not found | Back to order |
| 115 | orders | detail / completed-marketplace | Order details | View marketplace order |
| 117 | marketplace | resolver-route / empty | Menu name resolver | Back to Marketplace |
| 118 | pos | catalogue / category-items | Take order · Choose product | Tap product to add |
| 119 | pos | catalogue / quick-list | Quick list | Tap product to add |
| 120 | pos | checkout / in-store-payment-choice | Complete in-store order | Continue |
| 121 | pos | checkout / cash-tender-modal | Cash tender | Confirm cash payment |
| P01 | pos | cart-review / proposed-expanded-hierarchy | Current order · Full item details | Checkout |
| P02 | orders | pre-orders / proposed-upcoming-orders | Orders · Pre-orders | View order |

## Screen-specific requirements

### 001 — Live orders

Source: `001__orders__live__default.png`.

Show elapsed preparation time separately from payment state. Mark Ready changes fulfilment only; payment remains unchanged. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Mark ready.

### 002 — Orders · Filters expanded

Source: `002__orders__live__filter-menu.png`.

Order filters are collapsed by default. This view shows the inline panel opened from the header filter icon. Hiding the panel retains the active filter, indicated by a badge on the icon. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Fields/options: All; Needs action; Unpaid; Ready; Scheduled.

Primary action: Hide filters.

### 003 — Order details

Source: `003__orders__detail__unpaid-pickup.png`.

Keep customer, items, fulfilment and payment visible as separate sections. Completed marketplace orders are read-only; preserve the existing third-party link. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Mark ready.

### 004 — Print order

Source: `004__orders__detail__print-type-prompt.png`.

Selecting a copy does not start printing until the explicit Print action. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Fields/options: Kitchen ticket; Customer copy; Order ticket.

Primary action: Choose copy.

### 005 — On the way

Source: `005__orders__on-the-way__empty.png`.

No deliveries are currently on the way. Retain refresh and current filters. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Refresh.

### 006 — Order history

Source: `006__orders__completed__today-loaded.png`.

Show totals only for the selected date and active filters. Separate order count, gross sales, cash, card and marketplace. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: View order.

### 007 — Choose date

Source: `007__orders__completed__date-picker.png`.

Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Apply date.

### 008 — Filter order history

Source: `008__orders__completed__filters-modal.png`.

Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Fields/options: Order status: All, Pending, Waiting for payment, Confirmed, Preparing, Ready, On the way, Completed, Cancelled, Refunded; Payment status: All, Pending, Paid, Failed, Refunded; Order source: All, Online, At counter.

Primary action: Apply filters.

### 010 — Take order · Choose group

Source: `010__pos__take-order__empty-cart.png`.

Level 1 is a vertically scrolling group grid. Search is a compact header icon that opens an on-demand search surface; no permanent search field. All groups remain discoverable regardless of count.

Primary action: Choose group.

### 011 — Search menu

Source: `011__pos__catalogue__search.png`.

Search opens on demand from a compact header icon, with the field focused. Show product and group matches. Close restores the previous ordering level, group and scroll. Product result taps add immediately, then show add-ons only when available.

Primary action: Tap result to add.

### 012 — Salt preference

Source: `012__pos__cart__salt-option-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Chicken salt; Salt; Both salts; A bit chicken salt; A bit salt; A bit both salts; No salt at all; Extra salt; Extra chicken salt; Extra both salts.

Primary action: Use preference.

### 013 — POS layout

Source: `013__settings__pos-layout__item-preview.png`.

Combined live layout editor. Select a group or product in the preview, change background/text colour, label, text size/weight/alignment, tile height, visibility or order, and inspect the shared renderer immediately. Save the layout separately from applying it to this POS. Includes saved layout selection and tablet/phone columns.

Fields/options: Layout name; Quick-size items; Pack separators; Item label; Item colour; Sort order; Show in quick list.

Primary action: Apply to this POS.

### 014 — POS layout

Source: `014__settings__pos-layout__layout-selector.png`.

Combined live layout editor. Select a group or product in the preview, change background/text colour, label, text size/weight/alignment, tile height, visibility or order, and inspect the shared renderer immediately. Save the layout separately from applying it to this POS. Includes saved layout selection and tablet/phone columns.

Fields/options: Layout: Default POS Layout, Default Chip Layout; Layout name; Quick-size items; Pack separators.

Primary action: Apply to this POS.

### 015 — POS layout

Source: `015__settings__pos-layout__custom-colour-modal.png`.

Combined live layout editor. Select a group or product in the preview, change background/text colour, label, text size/weight/alignment, tile height, visibility or order, and inspect the shared renderer immediately. Save the layout separately from applying it to this POS. Includes saved layout selection and tablet/phone columns.

Fields/options: Hex colour; Colour palette; Brightness.

Primary action: Apply to this POS.

### 016 — POS layout

Source: `016__settings__pos-layout__groups.png`.

Combined live layout editor. Select a group or product in the preview, change background/text colour, label, text size/weight/alignment, tile height, visibility or order, and inspect the shared renderer immediately. Save the layout separately from applying it to this POS. Includes saved layout selection and tablet/phone columns.

Fields/options: Layout name; Quick-size items; Pack separators; Group label; Group colour; Group order.

Primary action: Apply to this POS.

### 017 — Create virtual group

Source: `017__settings__pos-layout__create-virtual-group-modal.png`.

Virtual groups organise POS shortcuts; they do not create or duplicate catalogue products.

Fields/options: POS group name; Included menu groups.

Primary action: Create group.

### 018 — Take order · Update item

Source: `018__pos__item__customisation.png`.

The product is already in the cart before this view opens. Selecting add-ons or changing quantity updates that exact stable line immediately. Continue returns to products in the same group; it never inserts another item. Back leaves the item in the cart. Retain all modifier constraints and existing checkout validation.

Fields/options: Salt preference; Add vinegar.

Primary action: Done.

### 019 — Item note

Source: `019__pos__item__note-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Quick notes: Pack separately, Well done & crispy, Undercooked, Add vinegar, Lemon; Item note.

Primary action: Save note.

### 020 — Checkout

Source: `020__pos__checkout__pickup.png`.

Preserve draft across fulfilment switches; validate only the active branch. Keep Checkout, Complete and Smartpay meanings distinct.

Primary action: Save changes.

### 021 — Apply a discount

Source: `021__pos__checkout__discount-modal.png`.

One discount mode at a time. Show before/after totals and coupon validation; use the existing discount calculation and eligibility rules.

Fields/options: Discount type: Percent, Fixed amount, Coupon; Percentage; Fixed amount; Coupon code.

Primary action: Apply discount.

### 022 — Checkout

Source: `022__pos__checkout__pre-order.png`.

Preserve draft across fulfilment switches; validate only the active branch. Keep Checkout, Complete and Smartpay meanings distinct.

Primary action: Save changes.

### 023 — Customer phone

Source: `023__pos__customer__phone-keypad-modal.png`.

Use a native telephone keyboard on phones; the iPad touch keypad is optional.

Fields/options: Phone number.

Primary action: Use phone number.

### 024 — Customer name

Source: `024__pos__customer__name-keyboard-modal.png`.

Use the operating-system keyboard. Keep the focused field and footer above the keyboard.

Fields/options: Customer name.

Primary action: Use name.

### 025 — Checkout

Source: `025__pos__checkout__delivery.png`.

Preserve draft across fulfilment switches; validate only the active branch. Keep Checkout, Complete and Smartpay meanings distinct.

Primary action: Save changes.

### 026 — Checkout

Source: `026__pos__checkout__third-party.png`.

Preserve draft across fulfilment switches; validate only the active branch. Keep Checkout, Complete and Smartpay meanings distinct.

Primary action: Save changes.

### 027 — Checkout

Source: `027__pos__checkout__instore.png`.

Preserve draft across fulfilment switches; validate only the active branch. Keep Checkout, Complete and Smartpay meanings distinct.

Primary action: Save changes.

### 028 — Find a customer

Source: `028__pos__customer__search-modal.png`.

Selection attaches the customer to the draft; it does not submit an order.

Primary action: Use selected customer.

### 029 — Recent calls

Source: `029__pos__customer__recent-calls-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Alex Taylor · 04xx xxx 120 · 2 min ago; Jordan Lee · 04xx xxx 321 · 12 min ago; Unknown caller · 03xx xxx 010 · 24 min ago.

Primary action: Use selected number.

### 030 — Clear this draft?

Source: `030__pos__cart__clear-draft-confirmation.png`.

Remove all draft items and customer details from this local order? This cannot be undone.

Primary action: Clear draft.

### 031 — More

Source: `031__navigation__drawer__expanded.png`.

Group all secondary destinations without removing any existing route. Back returns to the previous work area.

Primary action: Choose destination.

### 032 — Pre-orders

Source: `032__orders__pre-orders__empty.png`.

No upcoming orders. Show the next scheduled collection time when data exists. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Refresh.

### 033 — Customers

Source: `033__customers__directory__default.png`.

Preserve existing fields and behaviour using the shared components.

Primary action: New customer.

### 034 — Add customer

Source: `034__customers__add__form-modal.png`.

At least one contact method is required. Keep entered values when validation fails.

Fields/options: Name; Email; Phone.

Primary action: Save customer.

### 035 — Customer profile

Source: `035__customers__profile__overview.png`.

Show contact, orders, spend, rewards history and associated coupons. Missing contact information is explicit, never invented.

Primary action: Edit customer.

### 036 — Edit customer name

Source: `036__customers__profile__edit-name-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Customer name.

Primary action: Save name.

### 037 — Adjust reward points

Source: `037__customers__profile__adjust-rewards-panel.png`.

Keep the signed change, reason, resulting balance and Save Points action together.

Fields/options: Points change; Reason.

Primary action: Save points.

### 039 — Create a campaign

Source: `039__marketing__campaign__empty.png`.

Generate Copy and Generate Image remain optional existing actions. Preview is a local draft; sending is a separate final action.

Fields/options: Discount %; Email subject; Email body (HTML allowed); SMS body.

Primary action: Choose recipients.

### 040 — Choose recipients

Source: `040__marketing__recipients__directory.png`.

Preserve search, per-recipient selection, select visible, clear selection, pagination and total selected across pages.

Primary action: Review campaign.

### 041 — Recipient filters & sort

Source: `041__marketing__recipients__filters-sort-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Contact channel: Email, Phone; Send history: All customers, Never contacted, Never emailed, Never sent SMS; Sort: Best recipients, Never contacted first, Inactive customers first, Last SMS, Last email, Total orders.

Primary action: Apply filters.

### 042 — Review campaign

Source: `042__marketing__review__unsent-preview.png`.

Final review shows exact content, channels and recipient counts. Existing Send SMS stays separate; require an explicit confirmation with the count before sending.

Primary action: Send email · 1 recipient.

### 043 — Coupons

Source: `043__coupons__directory__all.png`.

Preserve All, Active, Inactive and Expired filters, pagination, code copy and per-coupon status toggle. Toggle changes require a pending state and rollback on failure.

Primary action: View coupon.

### 044 — Coupon details

Source: `044__coupons__detail__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Coupon code: WELCOME10; Description: Welcome back offer; Discount: 10%; Minimum subtotal: $20.00; Usage count / limit: 0 / 1; Per-user limit: 1; Starts: 17 Oct 2026; Ends: 31 Oct 2026; Active status.

Primary action: Done.

### 045 — Coupons

Source: `045__coupons__directory__active-filter.png`.

Preserve All, Active, Inactive and Expired filters, pagination, code copy and per-coupon status toggle. Toggle changes require a pending state and rollback on failure.

Primary action: View coupon.

### 046 — Marketplace

Source: `046__marketplace__orders__uber-active.png`.

Configuration state is separate from an empty order list. Preserve Uber Eats / DoorDash and Active / Scheduled / History views.

Primary action: Configure connection.

### 047 — Connect Uber Eats

Source: `047__marketplace__settings__uber-cookies-modal.png`.

Mask credential input, allow deliberate reveal, never show stored cookies in logs or design sample data.

Fields/options: Cookie header value.

Primary action: Save connection.

### 048 — Connect DoorDash

Source: `048__marketplace__settings__doordash-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Business ID; Store ID; DD API key; Cookie header value.

Primary action: Save connection.

### 049 — Resolve menu names

Source: `049__marketplace__mapping__unmatched-names.png`.

Show each external product, type, suggested internal matches and an explicit per-row Save Mapping. Keep unresolved items visible until confirmed.

Primary action: Save mapping.

### 050 — Marketplace

Source: `050__marketplace__orders__history.png`.

Configuration state is separate from an empty order list. Preserve Uber Eats / DoorDash and Active / Scheduled / History views.

Primary action: Configure connection.

### 051 — Filter marketplace status

Source: `051__marketplace__orders__status-menu.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: All statuses; Pending; Confirmed; Preparing; Ready; Completed; Cancelled.

Primary action: Apply status.

### 052 — Marketplace date range

Source: `052__marketplace__orders__date-menu.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Today; Yesterday; This week; This month; Last 7 days; Last 30 days; Last 12 weeks.

Primary action: Apply range.

### 053 — Marketplace

Source: `053__marketplace__orders__scheduled.png`.

Configuration state is separate from an empty order list. Preserve Uber Eats / DoorDash and Active / Scheduled / History views.

Primary action: Configure connection.

### 054 — Deliveries

Source: `054__deliveries__list__today-load-error.png`.

Could not load deliveries. Keep the selected range and search; Retry must not create a duplicate delivery.

Primary action: Try again.

### 055 — Deliveries

Source: `055__deliveries__list__last-seven-days-load-error.png`.

Could not load deliveries. Keep the selected range and search; Retry must not create a duplicate delivery.

Primary action: Try again.

### 056 — New delivery

Source: `056__deliveries__new__address-form.png`.

Look up the optional order first. Show quote and final Request Delivery as separate stages; never request a courier on field entry.

Fields/options: POS order reference (optional); Address line 1; Address line 2 (optional); City; State; Postcode.

Primary action: Get delivery quote.

### 057 — Sales reports

Source: `057__reports__sales__overview.png`.

Preserve gross sales, net sales, paid orders, average order, discounts and comparison period. Daily uses 30-minute buckets; weekly, monthly and rolling use date buckets.

Primary action: Print report.

### 058 — Report date

Source: `058__reports__sales__date-modal.png`.

Preserve existing fields and behaviour using the shared components.

Primary action: Apply date.

### 059 — Sales reports

Source: `059__reports__weekly__overview.png`.

Preserve gross sales, net sales, paid orders, average order, discounts and comparison period. Daily uses 30-minute buckets; weekly, monthly and rolling use date buckets.

Primary action: Print report.

### 060 — Sales reports

Source: `060__reports__monthly__overview.png`.

Preserve gross sales, net sales, paid orders, average order, discounts and comparison period. Daily uses 30-minute buckets; weekly, monthly and rolling use date buckets.

Primary action: Print report.

### 061 — Sales reports

Source: `061__reports__last-x-days__overview.png`.

Preserve gross sales, net sales, paid orders, average order, discounts and comparison period. Daily uses 30-minute buckets; weekly, monthly and rolling use date buckets.

Primary action: Print report.

### 062 — Choose a report printer

Source: `062__reports__print__printer-picker-modal.png`.

Selecting a printer is not a print command. The simulator produces a preview only.

Fields/options: Till; Simulator; TM-m30II; Shop printer; Test.

Primary action: Print report.

### 063 — Report print preview

Source: `063__reports__print__simulator-preview.png`.

Show a paper-width preview and close action. Keep simulator output distinct from a physical print.

Primary action: Download / share.

### 064 — About rolling reports

Source: `064__reports__last-x-days__help-modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Rolling sales period includes the selected complete days and compares against the immediately preceding period of equal length..

Primary action: Got it.

### 066 — Settings

Source: `066__settings__hub__default.png`.

Group catalogue, register, printing, storage and integrations. Distinguish immediate device settings from explicit-save configuration.

Primary action: Save settings.

### 067 — Store information

Source: `067__settings__store-information__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Shop name; Legal company name; ABN; Address line 1; Address line 2; Phone; Website; Logo URL; Opening hours.

Primary action: Save store information.

### 068 — Refresh interval

Source: `068__settings__refresh-interval__modal.png`.

Current source allows 5–300 seconds. Show unit and bounds beside the field; reject out-of-range values.

Fields/options: Refresh interval (seconds).

Primary action: Done.

### 069 — Order sound

Source: `069__settings__order-sound__modal.png`.

Retain Preview Sound. Preview changes no order or notification state.

Fields/options: Sound notifications; Notification sound; Play count.

Primary action: Done.

### 070 — Live order cards

Source: `070__settings__live-order-cards__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Display mode: Vertical, Horizontal; Cards per screen: 3, 4; Items to preview: 3, 6, 9, 12.

Primary action: Done.

### 071 — Marketplace auto-sync

Source: `071__settings__marketplace-auto-sync__modal.png`.

Retain each service’s interval presets and custom value. Disabled integrations keep their last values.

Fields/options: DoorDash enabled; DoorDash interval (seconds); Uber Eats enabled; Uber Eats interval (seconds); Opening time; Closing time; Request mode: Local device, Server.

Primary action: Done.

### 072 — Caller ID

Source: `072__settings__caller-id__modal.png`.

Preserve diagnostic outcomes: None, Trying, Ringing, Trying + Ringing, OK, Trying + OK, Busy (486), Unavailable (480). These belong in a Diagnostics disclosure.

Fields/options: Caller ID listener enabled; AI call assistant enabled; SIP UDP port; Inactivity timeout (seconds); Busy-line response.

Primary action: Done.

### 073 — Print diagnostics

Source: `073__settings__print-diagnostics__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Register name; Print diagnostic footer.

Primary action: Done.

### 074 — Kitchen printers

Source: `074__settings__kitchen-printer__overview.png`.

Discover, add, edit, set default and remove are separate actions. Preserve saved printer selection and simulator support.

Fields/options: Epson printer enabled; Connection: TCP / IP, Simulator; Printer IP address; Port; Printer name (optional).

Primary action: Add printer.

### 075 — Kitchen printers

Source: `075__settings__kitchen-printer__edit-saved-printer.png`.

Discover, add, edit, set default and remove are separate actions. Preserve saved printer selection and simulator support.

Fields/options: Epson printer enabled; Connection: TCP / IP, Simulator; Printer IP address; Port; Printer name (optional).

Primary action: Add printer.

### 076 — Smartpay pairing

Source: `076__settings__smartpay__pairing.png`.

Keep Save configuration separate from Pair. Show last pairing result and terminal state; no successful pairing is implied by saving.

Fields/options: Smartpay base URL; Pairing code; POS register ID; Simulator; Business name; POS vendor name; Contact name; Address; City; State; Postcode; Phone; Email.

Primary action: Pair terminal.

### 077 — Menu products

Source: `077__catalogue__menu-management__products.png`.

Preserve existing fields and behaviour using the shared components.

Primary action: Add product.

### 078 — New product

Source: `078__catalogue__product-new__overview-modal.png`.

One unsaved product draft across tabs. Save validates all tabs and reveals the first invalid tab without losing input.

Primary action: Save product.

### 079 — New product

Source: `079__catalogue__product-new__seo-tab.png`.

One unsaved product draft across tabs. Save validates all tabs and reveals the first invalid tab without losing input.

Primary action: Save product.

### 080 — New product

Source: `080__catalogue__product-new__ingredients-tab.png`.

One unsaved product draft across tabs. Save validates all tabs and reveals the first invalid tab without losing input.

Primary action: Save product.

### 081 — Select inventory product

Source: `081__catalogue__product-new__inventory-picker-modal.png`.

Search and select an inventory product. Return the selection to the Ingredients tab without saving or losing the product draft.

Primary action: Add ingredient.

### 082 — New product

Source: `082__catalogue__product-new__bundle-tab.png`.

One unsaved product draft across tabs. Save validates all tabs and reveals the first invalid tab without losing input.

Primary action: Save product.

### 083 — New product

Source: `083__catalogue__product-new__addons-tab.png`.

One unsaved product draft across tabs. Save validates all tabs and reveals the first invalid tab without losing input.

Primary action: Save product.

### 084 — Menu categories

Source: `084__catalogue__menu-management__categories.png`.

Preserve existing fields and behaviour using the shared components.

Primary action: Add category.

### 085 — New category

Source: `085__catalogue__category-new__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Name; Description; Kitchen section: Fried, Grilled, Till; Sort order; Parent category.

Primary action: Save category.

### 086 — Add-on groups

Source: `086__catalogue__addons-management__groups.png`.

Use separate disclosure, Add Item, Edit and Delete targets. Nested controls must not toggle the parent group.

Primary action: Add group.

### 087 — New add-on group

Source: `087__catalogue__addons-group-new__modal.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Name; Description; Sort order; Required; Allow multiple; Active.

Primary action: Save group.

### 088 — Add-on groups

Source: `088__catalogue__addons-management__group-expanded.png`.

Use separate disclosure, Add Item, Edit and Delete targets. Nested controls must not toggle the parent group.

Primary action: Add group.

### 089 — Call history

Source: `089__calls__history__today.png`.

Show direction/status, customer or unknown caller, phone, date and time. Make repeat-call and customer-profile actions distinct.

Primary action: Call back.

### 090 — Call history

Source: `090__calls__history__yesterday.png`.

Show direction/status, customer or unknown caller, phone, date and time. Make repeat-call and customer-profile actions distinct.

Primary action: Call back.

### 091 — Call history

Source: `091__calls__history__all-time.png`.

Show direction/status, customer or unknown caller, phone, date and time. Make repeat-call and customer-profile actions distinct.

Primary action: Call back.

### 092 — About this register

Source: `092__about__app-information__default.png`.

Show version, build date, revision, local IP and memory diagnostics. Restart and Check Update are explicit actions; memory is diagnostic information only.

Primary action: Check for update.

### 093 — TV menus

Source: `093__tv-menu__management__default.png`.

Preserve enable/disable, move up/down, preview, download and delete per image. Reordering must have accessible button alternatives to drag.

Primary action: Upload menu image.

### 094 — Preview menu image

Source: `094__tv-menu__preview__image-modal.png`.

Preserve existing fields and behaviour using the shared components.

Primary action: Download image.

### 095 — Choose menu image

Source: `095__tv-menu__upload__system-file-picker.png`.

Use the native iOS/Android file picker. Its visual appearance is owned by the OS; the design defines the upload entry, return, progress and failure states.

Primary action: Choose file.

### 096 — Your profile

Source: `096__navigation__profile__information-prompt.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: Signed in as: staff@example.invalid; Role: Store operator.

Primary action: Done.

### 097 — Sign out of this register?

Source: `097__navigation__sign-out__confirmation.png`.

Your current session will end. If there is an unsaved draft, show Save Draft only if supported, or warn explicitly before discarding.

Primary action: Sign out.

### 098 — Open an app link

Source: `098__navigation__deep-link__system-open-prompt.png`.

The operating system owns the Open App prompt. Validate the destination in the existing routing layer; Cancel returns to the current order.

Primary action: Open app.

### 099 — Welcome back

Source: `099__auth__login__default.png`.

Use inline field errors plus an accessible summary. Preserve the entered email on failure, support password managers and show/hide password.

Fields/options: Email; Password.

Primary action: Sign in.

### 100 — Welcome back

Source: `100__auth__login__required-fields-validation.png`.

Use inline field errors plus an accessible summary. Preserve the entered email on failure, support password managers and show/hide password.

Fields/options: Email; Password.

Primary action: Sign in.

### 101 — Choose notification sound

Source: `101__settings__order-sound__selection-prompt.png`.

Preserve existing fields and behaviour using the shared components.

Fields/options: No Problem Notification Sound; Be Proud Notification; Wopwopwop.

Primary action: Use selected sound.

### 102 — Settings

Source: `102__settings__hub__storage-and-integrations.png`.

Group catalogue, register, printing, storage and integrations. Distinguish immediate device settings from explicit-save configuration.

Primary action: Save settings.

### 103 — Kitchen printers

Source: `103__settings__kitchen-printer__saved-printers.png`.

Discover, add, edit, set default and remove are separate actions. Preserve saved printer selection and simulator support.

Fields/options: Epson printer enabled; Connection: TCP / IP, Simulator; Printer IP address; Port; Printer name (optional).

Primary action: Add printer.

### 104 — Printer section routing

Source: `104__settings__kitchen-printer__section-routing-01.png`.

Each section has printer, Combine/Separate mode, Kitchen/Customer Copy template and enabled From/To time window. Remove a route without deleting the saved printer.

Fields/options: Default route; Fried; Grilled; Till.

Primary action: Done.

### 105 — Printer section routing

Source: `105__settings__kitchen-printer__section-routing-02.png`.

Each section has printer, Combine/Separate mode, Kitchen/Customer Copy template and enabled From/To time window. Remove a route without deleting the saved printer.

Fields/options: Default route; Fried; Grilled; Till.

Primary action: Done.

### 106 — Receipt & print behaviour

Source: `106__settings__kitchen-printer__receipt-options.png`.

Paper-quality and instant-ticket controls were not captured. Keep their existing implementation accessible under Advanced until verified.

Fields/options: Auto-print new orders; Handle in-store printing on this POS; In-store print delay (seconds); Enable automatic customer receipt; Receipt printer; Receipt time from; Receipt time to.

Primary action: Done.

### 107 — Print journal

Source: `107__settings__kitchen-printer__journal.png`.

Retain chronological events, timestamp, severity and expanded technical detail. Logs must redact customer data and credentials.

Primary action: View event.

### 108 — Live orders

Source: `108__orders__live__empty.png`.

You’re all caught up. New orders will appear here. Keep the refresh control and connection indicator visible. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Refresh.

### 112 — Order history

Source: `112__orders__history-route__empty.png`.

No orders match this date. Change date or clear filters; do not imply a load error. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: Change date.

### 113 — Order history

Source: `113__orders__history-route__loaded.png`.

Show totals only for the selected date and active filters. Separate order count, gross sales, cash, card and marketplace. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: View order.

### 114 — Customer not found

Source: `114__customers__summary__missing-contact.png`.

No customer is linked to this order. Return to the order; link a customer only if the existing app supports that action.

Primary action: Back to order.

### 115 — Order details

Source: `115__orders__detail__completed-marketplace.png`.

Keep customer, items, fulfilment and payment visible as separate sections. Completed marketplace orders are read-only; preserve the existing third-party link. Keep persistent Live / On the way / Completed tabs. Show an additional Pre-orders tab only when upcoming orders exist; its absence must not hide the three frequent staff views.

Primary action: View marketplace order.

### 117 — Menu name resolver

Source: `117__marketplace__resolver-route__empty.png`.

Nothing to resolve. Return to Marketplace; do not imply that service credentials are configured.

Primary action: Back to Marketplace.

### 118 — Take order · Choose product

Source: `118__pos__catalogue__category-items.png`.

Tapping any product immediately adds it to the draft cart. Then, if add-on groups exist, open level 3 targeting that already-added line. Products without add-ons keep the user browsing. No second Add to Order action. Search opens from a header icon.

Primary action: Tap product to add.

### 119 — Quick list

Source: `119__pos__catalogue__quick-list.png`.

Quick List preserves immediate product-tap insertion. Available add-ons open against the new cart line; products without add-ons stay in Quick List. Search remains behind the header icon.

Primary action: Tap product to add.

### 120 — Complete in-store order

Source: `120__pos__checkout__in-store-payment-choice.png`.

Continue opens the selected branch. Cash opens tender; card uses the existing payment flow. Unpaid requires deliberate confirmation.

Fields/options: Cash; Card; Unpaid.

Primary action: Continue.

### 121 — Cash tender

Source: `121__pos__checkout__cash-tender-modal.png`.

Tender must cover the amount due. Calculate change in integer cents, never floating point; prevent duplicate confirmation while saving.

Fields/options: Amount tendered.

Primary action: Confirm cash payment.

### P01 — Current order · Full item details

Proposed; no original capture.

Additional design based on the user’s clarification, not a captured source screen. Every line shows Group > Product > selected add-on groups and values, quantity, per-unit/line price, note and distinct Edit Add-ons/Note/Remove actions. Use on phones, and optionally open on tablets.

Primary action: Checkout.

### P02 — Orders · Pre-orders

Proposed; no original capture.

Additional proposed design based on the user’s instruction. Live, On the way and Completed are always visible as order tabs. Pre-orders appears only when the upcoming-order count is greater than zero; this example has two. Keep the tabs accessible on phones and show collection times clearly.

Primary action: View order.

