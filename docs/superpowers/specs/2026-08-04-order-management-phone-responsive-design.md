# Order Management Phone Responsive Design

## Goal

Make every route and reusable overlay in `apps/pappas-order-management` usable at portrait phone widths while preserving the existing landscape-oriented POS experience.

## Scope

- Review every app route: POS, order detail, menu and add-on administration, drawer/tabs for orders, completed, live orders, on-the-way, menu, settings, plus customers, reports, marketplace, marketing, pre-orders, and settings.
- Review shared cards, lists, dialogs, print overlays, customer components, POS panes, checkout forms, and drawer navigation.
- Do not alter business logic, order/payment behavior, server APIs, or the landscape/tablet visual hierarchy.

## Responsive Behaviour

- Treat widths below 600 logical pixels as compact portrait layouts.
- Every page and overlay has one clear vertical scroll owner. Long content, forms, lists, and dialogs must remain reachable, including with the software keyboard open.
- Desktop rows and multi-pane layouts change to a vertical sequence on compact screens. Fixed-width content, tables, and dense action rows either reflow into cards/key-value rows or use intentional horizontal rails where their sequence matters.
- Compact action labels, filter chips, navigation tabs, and buttons use a single line with truncation or horizontal scrolling. They must not grow controls into excessively tall labels.
- Detail values and long customer/menu text remain readable and may wrap inside their scrolling parent. Primary action labels remain concise and one line.

## Architecture

Introduce a small shared responsive utility layer that centralizes the compact-width breakpoint and reusable layout style decisions. Apply it route by route rather than adding global overrides, so each screen preserves its present desktop behavior and can select the appropriate mobile structure.

The existing `useWindowDimensions`, `ScrollView`, `FlatList`, React Native Paper, Expo Router, and StyleSheet patterns remain the implementation model. No dependency changes are required.

## Acceptance Criteria

At 320, 375, and 414 pixel portrait widths, all in-scope routes and overlays:

- have no clipped primary controls or unreachable content;
- vertically scroll when content exceeds the viewport;
- avoid unintentional horizontal overflow;
- retain readable long-form information;
- keep compact labels/buttons/chips to a predictable single-line height; and
- retain existing layout and functionality at tablet/landscape widths.

## Verification

- Add focused tests for the shared compact breakpoint/style selectors.
- Run the app typecheck and existing app test suite.
- Use the app in a portrait browser/device viewport to inspect every route and representative long-content dialog/modal at 320, 375, and 414 widths.

## Constraints

- Work directly on `main`.
- Leave all changes uncommitted.
- Preserve unrelated working-tree changes.
