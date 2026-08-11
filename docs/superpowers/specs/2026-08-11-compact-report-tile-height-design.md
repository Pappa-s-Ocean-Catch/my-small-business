# Compact Report Tile Height Design

## Goal

Remove the unused vertical space from title-only report tiles.

## Change

- Remove the fixed `minHeight` values from desktop and phone report tiles.
- Reduce tile padding and accent bottom margin so each card fits its accent, title, and information icon.
- Keep tile width, border, selected styling, and touch behavior unchanged.

## Verification

Run the app unit suite and confirm no fixed tile `minHeight` remains in the Report screen style.
