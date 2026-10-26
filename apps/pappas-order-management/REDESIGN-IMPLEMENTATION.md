# Pappa’s v2 implementation

Branch: `pos-redesigned`. Design source: `Pappas-Redesign/DEVELOPER-HANDOFF.md`, v2 ordering/tab amendments and screen atlas, dated 18 October 2026.

## Shared presentation

- `lib/redesign.ts`: supplied semantic colors, spacing, radii, touch/font values and responsive workspace calculations.
- `lib/redesign-theme.ts`: shared React Native Paper theme.
- `components/ui`: native panels, page/section headings, metrics, status badges, fields, loading/error presentation and keyboard-aware editor sheets.
- `components/navigation`: common rail/bottom navigation, More destinations and Orders workspace tabs. Standalone stack routes use `WorkspaceShell`.
- `components/orders/presentation.ts`: independent fulfilment/payment presentation; unknown upcoming count is never treated as zero.
- `components/pos/pos-draft.ts`: explicit configured-line add/update transaction with stale-line protection.

Production route/state coverage below maps every selected atlas ID to its native implementation. These are shared route states, not independent screen copies. The mapping is an implementation index; it does not claim device screenshots or end-to-end validation for every state.

## Atlas mapping

| Area | Atlas IDs | Native implementation |
|---|---|---|
| orders | 001, 002, 003, 004, 005, 006, 007, 008, 032, 108, 112, 113, 115, P02 | `app/(drawer)/(tabs)/{live-orders,on-the-way,completed,orders}.tsx`, `app/(drawer)/pre-orders.tsx`, `components/{LiveOrderListItem,HistoryOrderListItem,OrderDetailModal,OrderFiltersModal}.tsx` |
| pos | 010, 011, 012, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 118, 119, 120, 121, P01 | `app/pos.tsx`, `components/pos/*`, `components/CashTenderModal.tsx` |
| settings | 013, 014, 015, 016, 017, 066, 067, 068, 069, 070, 071, 072, 073, 074, 075, 076, 101, 102, 103, 104, 105, 106, 107 | `app/(drawer)/(tabs)/settings.tsx`, `app/{pos-layout-settings,POS-intergation}.tsx`, `components/settings/*`, `components/PrintLogsModal.tsx` |
| navigation | 031, 096, 097, 098 | `components/navigation/*`, `components/CustomDrawerContent.tsx`, `app/_layout.tsx`; app-open prompts remain OS-owned |
| customers | 033, 034, 035, 036, 037, 114 | `app/(drawer)/customers.tsx`, `components/customers/*`, `components/CustomerModal.tsx` |
| marketing | 039, 040, 041, 042 | `app/(drawer)/marketing.tsx` |
| coupons | 043, 044, 045 | `app/(drawer)/coupons.tsx` |
| marketplace | 046, 047, 048, 049, 050, 051, 052, 053, 117 | `app/(drawer)/marketplace.tsx`, `app/marketplace-resolver.tsx` |
| deliveries | 054, 055, 056 | `app/(drawer)/delivery-management.tsx`, `components/delivery-management/*` |
| reports | 057, 058, 059, 060, 061, 062, 063, 064 | `app/(drawer)/report.tsx`, `components/PrintSimulatorModal.tsx` |
| catalogue | 077, 078, 079, 080, 081, 082, 083, 084, 085, 086, 087, 088 | `app/{menu-management,addons-management}.tsx` |
| calls | 089, 090, 091 | `app/(drawer)/call-history.tsx` |
| about | 092 | `app/(drawer)/about.tsx` |
| tv-menu | 093, 094, 095 | `app/(drawer)/tv-menu.tsx`; file selection remains native |
| auth | 099, 100 | `app/login.tsx` |

## Behaviour preserved and intentional changes

The existing service, authentication, checkout, pricing, integration and printing code remains authoritative. Example catalogue/customer/report values from the designer were not copied into production data.

Take Order keeps group browsing, product browsing, optional/required modifiers and Quick List. An item editor now holds a draft until Add/Update. Cancel leaves the cart line intact; simultaneous quantity/note/removal controls for that edited line are locked. Stable line IDs prevent duplicate updates. Dirty navigation asks before discard; active payment/order submission blocks ambiguous departure. Draft fields/search live above responsive views, so resizing does not recreate the order. Compact review scrolls all controls on short displays; tablet totals remain pinned.

Orders keeps Live/On the way/Completed destinations, plus a conditional upcoming tab driven by confirmed/cached count. Existing filters/details/actions remain routed through their current handlers. Reports measure actual panel width; customer refresh errors preserve existing rows and usable controls.

## Verification

- Standard `pnpm --filter pappas-order-management test:unit`: **332 passed, 0 failed** after adding emitted-workspace alias resolution to the unit runner.
- Responsive boundary tests cover 320–1366 logical widths, medium single-pane fallback and large text; POS tests cover stable updates, stale IDs, required/optional groups and existing post-save print/mirror/refresh ordering.
- Integration review identified and fixed edited-line conflicts, report chart overflow and customer-data disappearance on failed refresh.
- Web export succeeds. Browser startup/login and required-field validation verified at 375×812 and 1366×1024 with no horizontal overflow. Authenticated screens were not exercised in the browser.
- `git diff --check`: clean.
- Full TypeScript with explicit `--types react,node` still reports the pre-existing QRCode option and Caller ID provider/native-module type errors. No errors remain in redesigned UI files. Default TypeScript also encounters the repository’s implicit `minimatch` type configuration issue.

Web preview pins React DOM to the app’s React 19.1 version and uses a web-only telemetry entry to avoid importing native New Relic views. Native instrumentation remains unchanged.

Still requires authenticated iPad landscape/portrait and phone visual acceptance across all atlas states, VoiceOver/TalkBack and keyboard checks, and safe test payment/printer/marketing integrations. No production payments, printing, campaigns or configuration writes were performed during implementation.
