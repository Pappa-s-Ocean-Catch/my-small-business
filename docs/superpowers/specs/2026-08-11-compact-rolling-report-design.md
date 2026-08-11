# Compact Rolling Report Design

## Goal

Make report selection compact and add a rolling Last X Days report with a preceding equal-length comparison period.

## Tile layout

- Report tiles show titles only; remove descriptions and the `Viewing now`/`Open report` action text.
- Remove the `More reports coming soon` tile.
- Each tile has an info icon that opens a modal with its description.

## Period navigation

- Daily shows Previous/Next and shifts one day.
- Weekly shifts one complete week.
- Monthly shifts one complete month.
- Last X Days is anchored to yesterday and does not show Previous/Next or the date picker.

## Last X Days

- Add `rolling` as a report type and a Last X Days tile.
- Offer 7, 15, 30, and 90-day presets plus a custom numeric input limited to 1–180 days.
- Current range is inclusive: yesterday through X days ago.
- Comparison range is the immediately preceding equal number of calendar days.
- Example: X=15: current is yesterday through 15 days ago; comparison is 16 through 30 days ago.
- It uses existing sales summary, trend chart, breakdowns, printer capture, and POS image printing. The receipt continues to include only the selected current-period data.

## Verification

Unit tests cover rolling range boundaries for preset and custom lengths, plus source-level checks for compact tiles, info action, and Daily navigation visibility. Run the complete app unit suite. Leave all changes uncommitted.
