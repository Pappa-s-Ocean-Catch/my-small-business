# Orders tabs — v2

Live, On the way and Completed are frequent staff views and stay visible as persistent tabs within Orders, on iPad and phones.

- Default state: **Live | On the way | Completed**. See source 001.
- Upcoming pre-orders exist: **Live | On the way | Completed | Pre-orders (count)**. See proposed P02.
- A zero count in an always-visible tab does not hide Live, On the way or Completed.
- Do not show the conditional tab merely because the user can create a pre-order.
- Preserve each tab’s filters, dates and scroll position when switching.
- Failed/loading count requests must not be interpreted as zero.
- Do not discard an open order detail or in-progress action if the last pre-order disappears.
- On phones keep the four labels visible at normal text size with counts beneath when necessary; support large text without clipping.

The populated scheduled-order view is proposed from the user’s request, not a captured source state. The preview can switch to it from the atlas; navigating its tabs demonstrates the extra tab remaining available.

In v4 the frequent tabs remain, while the separate filter row is collapsed by default and toggled from the compact header. Active filters remain indicated by a badge.
