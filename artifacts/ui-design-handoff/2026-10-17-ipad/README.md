# Pappas Order — iPad UI design handoff

Captured on **17–18 October 2026**, Australia/Melbourne, using the running iPad Pro 13-inch (M5) simulator, iOS 26.1, landscape. The app was initially built with npm run ios:ipad.

**114 selected screenshots** from 121 original captures. Coverage spans orders, POS, customers, marketing, coupons, marketplace, deliveries, reports, settings, catalogue management, calls, TV menu, About and login, including accessible modals, prompts and empty/error states. **Some conditional dialogs and lower-page sections remain uncaptured**; see [coverage.md](coverage.md).

## Start here

- Open [index.html](index.html) in a browser for the searchable gallery. Click a thumbnail for the full image.
- Give the designer [designer-screenshots/](designer-screenshots/) and [contact-sheets/](contact-sheets/). The images have simulator chrome removed; native captures have their landscape orientation normalized.
- [screenshots.csv](screenshots.csv) lists each selected capture. [manifest.json](manifest.json) maps selected files to originals, exclusions, dimensions and SHA-256 checksums.
- [coverage.md](coverage.md), [coverage-gaps.json](coverage-gaps.json) and [source-inventory.json](source-inventory.json) document coverage and follow-up work.

## Naming

`NNN__area__screen__state.png`

Example: `121__pos__checkout__cash-tender-modal.png`. Numbers preserve capture order; gaps indicate excluded duplicates. Filenames describe the visible state, not a proposed new design.

## Read-only handling

Navigation and unsaved local drafts were used to open forms. No orders, payments, deliveries, marketing messages, catalogue changes, customer changes or settings were submitted. No physical print or terminal pairing was requested. Temporary cart and marketing drafts were cleared; the final POS cart showed zero items and a $0.00 total. The app was left signed in on its home screen.

This folder contains observed business/customer data and was saved locally only. Nothing was uploaded or sent to a designer.

## Original files

- `screenshots/`: original Simulator-window captures (1752 × 1456).
- `native-captures/`: original Maestro simulator images; EXIF orientation retained.
- `captures.json`: original capture log. Some original filenames were inaccurate; use the gallery/manifest for reviewed names.
- `review/`: earlier working contact sheets, retained as capture evidence.
- `prepare-handoff.cjs`: local artifact generator using the workspace's installed Sharp package. It only processes saved images and does not control the app.

The selected CUA images are cropped to the device display at 1622 × 1217; native images are 2752 × 2064. These are screenshot references, not editable design files.
