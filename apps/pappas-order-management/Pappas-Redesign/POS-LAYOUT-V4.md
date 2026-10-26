# POS Layout — configure, preview, apply

1. Open atlas screen 013 (POS Layout).
2. Choose Groups or Products and tap the tile to edit.
3. Set background, text colour, size/weight/alignment, label, minimum tile height, visibility and order. Choose Selected Tile or All Tiles appearance scope.
4. Inspect the same renderer in small-tablet, large-tablet and phone preview. Use Show Hidden to edit/restore hidden tiles. Product preview has a group selector. Saved layouts include Default POS and Default Chip examples.
5. Save Layout when you want to retain a named layout. Apply to This POS changes the local active configuration. Open POS shows the applied render.

No changes create a business order or change menu prices. Draft edits stay separate from the active POS until Apply. The interactive reference stores settings only in the preview session; production must use existing persistence, permissions, stable IDs and dirty-state guards.

Load the current saved app layout as the initial value; the example defaults must never overwrite existing staff settings.

The example config supports global appearance plus per-group/per-product overrides, ordered ID collections, visibility, quick-list membership and responsive columns. Production must preserve current quick-size, separator, virtual-group and other existing settings rather than replacing the schema from screenshots.

Verification should compare the selected tile in editor preview with its actual POS tile after Apply: fill colour, label colour, font size, label alias, order and visibility. The v3 tap-to-add and same-line modifier behaviour remains unchanged.
