# Capture coverage and follow-up

Broad read-only coverage; this is not an exhaustive capture of every condition, error or page viewport.

## Routes

| Route source | Evidence IDs | Status |
|---|---|---|
| (drawer)/(tabs)/completed | 6, 7, 8 | captured representative states |
| (drawer)/(tabs)/live-orders | 1, 2, 3, 4, 108 | captured representative states |
| (drawer)/(tabs)/menu | 10, 118, 119 | redirect to pos captured |
| (drawer)/(tabs)/on-the-way | 5 | captured representative states |
| (drawer)/(tabs)/orders | 112, 113, 114, 115 | captured representative states |
| (drawer)/(tabs)/settings | 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 101, 102, 103, 104, 105, 106, 107 | captured representative states |
| (drawer)/about | 92 | captured representative states |
| (drawer)/call-history | 89, 90, 91 | captured representative states |
| (drawer)/coupons | 43, 44, 45 | captured representative states |
| (drawer)/customers | 33, 34, 35, 36, 37, 114 | captured representative states |
| (drawer)/delivery-management | 54, 55, 56 | captured representative states |
| (drawer)/marketing | 39, 40, 41, 42 | captured representative states |
| (drawer)/marketplace | 46, 47, 48, 49, 50, 51, 52, 53 | captured representative states |
| (drawer)/pre-orders | 32 | captured representative states |
| (drawer)/report | 57, 58, 59, 60, 61, 62, 63, 64 | captured representative states |
| (drawer)/settings | 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 101, 102, 103, 104, 105, 106, 107 | captured representative states |
| (drawer)/tv-menu | 93, 94, 95 | captured representative states |
| POS-intergation | 76 | captured representative states |
| addons-management | 86, 87, 88 | captured representative states |
| index | — | redirect no unique screen |
| login | 99, 100 | captured representative states |
| marketplace-resolver | 117 | captured representative states |
| menu-management | 77, 78, 79, 80, 81, 82, 83, 84, 85 | captured representative states |
| order-detail | 3, 115 | shared modal only standalone route unverified |
| pos-layout-settings | 13, 14, 15, 16, 17 | captured representative states |
| pos | 10, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 118, 119, 120, 121 | captured representative states |

## Remaining gaps

### Data-changing actions

Intentionally not triggered. Saving catalogue/customer/settings changes; creating or updating orders; sending marketing, payment links, or delivery requests; refunds, deletions, status changes, sign-out, physical printing and terminal pairing. Their success/failure/confirmation states cannot all be captured in a read-only session.

### Integration-dependent screens

Unavailable or error state captured. Marketplace credentials are not configured; delivery lists failed to load. No credentials were entered or integrations reconfigured.

### Long-page content

Partially captured. Printer scrolling succeeded through section routing and receipt options (103–106), and the journal is captured in 107. Paper-quality and instant-ticket controls below the receipt section are not captured. Later swipes did not move the visible view, including report content; customer rewards/coupons and product overview content below the current viewport are not confirmed.

### Nested catalogue actions

Blocked by interaction. Tapping nested add-on item/group edit and add-item icons selected/toggled the parent group instead of opening the form, with both computer control and Maestro. New group form is captured; individual add-on item forms and populated edit variants are not confirmed.

### Conditional checkout overlays

Not all triggered. In-store payment choice (120) and cash tender (121) are captured and cancelled. Smartpay processing, payment errors, pending online payments, free-item eligibility and pay-by-link states depend on data or business actions and are not all triggered.

### Standalone order-detail route

Not independently verified. The shared order-detail modal is captured for unpaid pickup and completed marketplace orders. The separate route requires an order ID and is not claimed as captured.

## Notes for the designer

- Screens represent real app data on the capture dates. Repeated rows/products are represented by sample content, rather than one image per record.
- Marketplace history has a development warning banner in one capture; it is retained as observed. Delivery load failures are captured as observed. The offline overlay was observed during recovery, but no screenshot of it is included.
- Main gallery excludes seven failed-scroll/duplicate attempts. Original names remain in the raw folders; manifest.json records corrected display names and exclusions.
- New/edit forms that were opened were cancelled. Populated edit variants are not comprehensively captured.
- Screen 042 contains an unsent local marketing preview. The draft text and recipient were cleared without sending.
