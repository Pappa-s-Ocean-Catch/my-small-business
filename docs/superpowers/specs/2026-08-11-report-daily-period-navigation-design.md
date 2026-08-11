# Report Daily Period Navigation Design

## Goal

Make the Report screen show Previous and Next controls for Daily reports as well as Weekly and Monthly reports.

## Behavior

- Daily Previous/Next changes the selected date by one calendar day.
- Weekly Previous/Next changes the selected date by seven calendar days, resolving to the adjacent Monday-to-Sunday reporting range.
- Monthly Previous/Next changes the selected date by one calendar month, resolving to the adjacent full-month reporting range.
- The date picker, report loading, printed report snapshot, and comparison settings remain unchanged.

## Implementation

Reuse the existing `shiftSelectedPeriod` function, which already has the required daily fallback. Remove only the Report screen condition that suppresses the Prev/Next controls for `daily` reports.

## Verification

Add a source-level regression test that confirms the Report screen renders the Prev/Next controls without a `selectedReport !== 'daily'` guard. Run the complete existing unit suite.
