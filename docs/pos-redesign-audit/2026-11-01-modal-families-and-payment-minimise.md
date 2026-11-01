# Modal families, payment waiting and Journal access

Order details, customer details, marketplace order details, payment waiting and Journal use full-screen windows with a shared dark header. Order loading/not-found states also provide the same header and close action. Customer/order navigation callbacks and return context remain intact.

Inputs, customer/settings editors, selections, printer choices and confirmations share a 75%-width tablet policy, with full width on phones or short landscape displays. Heights are bounded by the safe area; bodies scroll and action bars remain outside the scrolling body. Customer search uses a bounded non-scrolling editor body around its virtualized list. Its recent-call editor stays inside the presenting window when opened from search.

Payment waiting has explicit Minimise controls and existing reopen controls. POS SmartPay minimises immediately without an extra confirmation; monitoring and existing processing guards continue. Online waiting is presented in a native modal so it stays above navigation windows. Its address editor is nested inside that window. The payment action bar no longer overlays content; phone columns stack. Minimized sessions scroll when needed and avoid the navigation rail and phone bottom controls.

A temporary order-read/network error previously marked an online waiting session failed, removing it from both active and minimized views. Failed reads now leave the session pending so subsequent polls can recover. Only confirmed paid responses finish monitoring. Tests verify minimize/reopen keeps the same order, amount and payment link.

Journal opens directly from the tablet navigation rail and drawer, using the existing journal feature flag. Opening it does not navigate away from or close a POS draft.

Verification:

- 442 unit tests passed, including modal dimensions, full-screen presentation/header, immediate SmartPay minimise, online minimize/reopen and transient polling failures, and local Journal opening.
- `git diff --check` passed.
- Typecheck retains 13 existing ReceiptQrCode/caller-ID errors; no new errors in the changed files. The customer reward-link nativeID now belongs to its View wrapper, resolving the prior TouchableOpacity typing error while preserving focus restoration.
- Device interaction and visual validation remain outstanding. No live order, payment, status or print action was performed.
