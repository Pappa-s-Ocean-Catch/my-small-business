# Pappa’s responsive redesign — v5

Start by opening **Pappas-Design-Atlas.html** in Chrome, Safari or another modern browser. No installation, internet connection or local server is required.

- Search/select any of the 114 source states or the two proposed views (full cart review and populated pre-orders).
- Switch between **iPad landscape**, **Small tablet**, **iPad portrait** and **Phone**.
- Use **View source** to compare the supplied original thumbnail.
- Scroll within a screen to inspect lower content. Choose 100% scale to review exact spacing.
- Sample navigation opens related designs. The ordering preview updates a local example cart; other actions show a preview-only notice. No business actions run.

Take Order preserves **Group → Tap product (adds immediately) → Update add-ons when available**. Continue returns to products in the same group; no second Add action is required. Search opens only from the header magnifier. Start at **010**, then **118**, then **018**. Open **P01 (Current order)** to inspect full cart hierarchy and editing controls. Groups occupy their own searchable, scrolling grid; no top-of-screen category strip.

Orders keeps **Live · On the way · Completed** as persistent tabs. **Pre-orders** is a fourth tab only while upcoming orders exist; see **P02** for the populated example.

The additional cart/pre-order screens were designed from your clarification and are labelled proposed because they were absent from the source captures.

v4 uses a shared 56-unit header with matching icons. The shop-name line and large POS stepper are removed. Groups / Quick List are in the header, and Orders filters stay collapsed until opened.

**POS Layout now drives the preview and POS tiles.** In screen 013, select a group/product, change background/text/size/order, then Apply to This POS and Open POS. Save Layout and device Apply remain separate.

For your developer:

- **DEVELOPER-HANDOFF.md**: tokens, responsive rules, interactions, components, business behaviour to preserve, uncaptured states and acceptance criteria.
- **SCREEN-COVERAGE.md**: complete ID mapping and per-screen requirements.
- **design-tokens.json**: machine-readable visual values.
- **screen-data.json**: screen definitions and original thumbnails.
- **screens/**: static image exports for every source state in each reference device size.
- **VERIFICATION.json**: layout and artifact checks actually run.

The HTML is a visual reference and design proposal, not production app code or an editable Figma file. It uses representative local data and intentionally performs no payments, sends, printing or configuration changes. Unknown backend rules and uncaptured screens are identified in the handoff.

Revision 5 adds direct printer buttons, compact tappable cart items, small level Back controls, Continue to the same group, and full-size contextual order detail modals. See **INTERACTIONS-V5.md** for the current developer contract.
