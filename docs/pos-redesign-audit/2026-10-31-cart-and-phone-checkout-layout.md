# Cart and phone checkout layout

The cart header, items, totals and action buttons now share one FlatList on phones and tablets. Previously the tablet header/footer were separate siblings of the scrolling list, leaving the action area outside the scrollable content. Cart and list containers explicitly allow shrinking within the available height. The expanded review remains a single scroll view.

Phone pickup checkout keeps its existing submit action below the scrollable form. The action remains visible while customer details, rewards, discounts, scheduling or notes grow. The existing unpaid submission callback and validation/processing guards are preserved. The Back control is a labelled 48-point icon on phones.

Phone customer details use smaller padding and gaps, side-by-side fields that can shrink on a 320-point screen, accessible search/recent-call icons in the header, and compact wrapping statistics. All customer/reward actions and information remain available. Pickup spacing and the default note field height are reduced. The reserved 80-point space for the floating cart entry is removed when viewing the cart or checkout; the workspace continues to handle the bottom safe area.

Verification:

- 431 unit tests passed, including five-item phone/tablet edit carts, fixed pickup actions at 320/390/599-point widths, customer-field layout and existing submit guards.
- `git diff --check` passed.
- Typecheck reports no errors in the files changed for this fix. Existing errors remain in CustomerModal, ReceiptQrCode and caller-ID code.
- Device interaction and visual validation remain outstanding. No live order, payment, status or print action was performed.
