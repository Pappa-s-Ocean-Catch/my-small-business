# Uber order notes implementation plan

**Goal:** Preserve Uber `storeInstructions` as POS order notes for local and API fetches.

**Evidence:** The affected response supplied by the user contains order-level `storeInstructions`; item-level `specialInstructions` is empty. Delivery notes are explicitly out of scope.

**Approach:** Add the confirmed field to both shared Uber GraphQL queries and the adapter/detail contracts. Build one order-note string in the POS draft, including existing resolution warnings, and use it for automatic and manual imports. Existing imports retain their staff notes and status-only reconciliation.

## Tasks

- [x] Add regression tests for live/history shared fetches, local transport, POS draft and saved payload, empty notes, warning preservation, item-note separation, and existing staff-note preservation. Run them and confirm the expected failures.
- [x] Request and adapt `storeInstructions`; populate draft `orderNotes`; use that value in automatic import and manual POS draft initialization. Run the marketplace and POS unit suites, inspect the final diff, and report verification and limitations.

Work in the current checkout, preserving unrelated user edits. Do not change delivery fields or production data.

## Verification

- Regression tests failed first for missing query fields, adapter normalization, draft notes and saved order notes.
- Marketplace suite: 27 passed; POS unit suite: 493 passed.
- Marketplace type check and `git diff --check` passed.
- Independent code review found no actionable issues.
- Existing missed notes are not backfilled; delivery notes are out of scope. No deployment or production writes.
