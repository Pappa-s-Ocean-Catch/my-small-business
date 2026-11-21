# Completed net sales

**Goal:** Display net sales in the Completed header using the existing Report financial calculation.
**Requirements:** Store/phone pickup/card sales less 10%; marketplace recorded payout less 10%; missing payout estimated at gross less 30% commission then less 10%. Explicit zero payout is valid. Exclude unpaid/cancelled/refunded sales consistently with Report. Use the requested 10% deduction convention.
**Approach:** Keep Report's existing `buildChannelFinancialBreakdown`, which already implements the requested policy. Extract Completed summary into a testable helper and replace its total-sales field with net sales derived from that breakdown. Retain actual gross payment collection figures and label them explicitly. Update both compact and regular layouts.

- [x] Add Report policy assertions and Completed summary tests (recorded/missing/zero payout, channels, exclusions, rounding, empty orders).
- [x] Run new tests and observe missing Completed behavior.
- [x] Implement shared-report-based summary and wire both Completed layouts.
- [x] Run POS unit tests, TypeScript, diff check and independent review. Leave changes uncommitted and do not deploy.


## Verification results

- New regression tests were run before implementation and failed because the new summary helper did not exist.
- Focused Report/Completed tests: 18 passed.
- Full POS unit suite: 517 passed, zero failures; includes compilation of the new helper and tests.
- Full POS TypeScript with explicit react/node types: the same 13 existing QR/Caller ID diagnostics seen before this task; no diagnostics in changed files.
- `git diff --check`: clean.
- Independent read-only code review: no concrete correctness or regression findings.
- No device visual smoke test or deployment performed.
