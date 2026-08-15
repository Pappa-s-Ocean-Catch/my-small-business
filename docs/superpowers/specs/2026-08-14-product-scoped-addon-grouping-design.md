# Product-Scoped Add-on Grouping Design

## Goal

Show repeated add-ons selected for one order product as a single quantity line when their names and prices match, including on order detail and printed receipts.

## Design

`groupAddons` already receives the add-ons belonging to one parent order item. It will group by `addon_item_name` and `addon_item_price`, but no longer by `addon_group_name`. Call sites remain unchanged, so choices attached to separate parent products stay separate.

## Rules

- Matching name and price within one parent product renders as one line with the combined quantity.
- A different price remains a distinct line.
- Add-on group names do not affect grouping.
- The first matching add-on retains the displayed name, group metadata, price, and section.
- Order-detail, kitchen, and customer receipt templates use the same helper.

## Verification

Unit tests cover merging the same named-and-priced choice from different add-on groups, keeping different prices separate, and not combining arrays belonging to distinct products.
