# Compact Rolling Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact report tiles and a configurable rolling Last X Days report with equal preceding-period comparison.

**Architecture:** Extract report-period range calculations into pure helpers in `report.tsx` or a focused `report-periods.ts` module. Extend the existing selected-report state with `rolling` and a 1–180-day value, while retaining the current data loading, chart, breakdown, and receipt pathways.

**Tech Stack:** React Native, React Native Paper, TypeScript, Node unit runner.

## Global Constraints

- Last X Days current range ends yesterday and includes X calendar days.
- Comparison is the immediately preceding equal-length range.
- Presets are 7, 15, 30, and 90; custom values are integers 1–180.
- Rolling reports have no date picker or Previous/Next controls.
- Daily navigates one day; Weekly/Monthly retain their existing full-period shifts.
- Leave changes uncommitted.

---

### Task 1: Implement and test rolling date ranges

**Files:**
- Create: `apps/pappas-order-management/lib/report-periods.ts`
- Create: `apps/pappas-order-management/test/report-periods.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces `getRollingReportRanges(today: string, days: number): { current: DateRange; compare: DateRange }`.

- [ ] **Step 1: Write failing range tests**

```ts
test('uses yesterday through fifteen days ago and the preceding fifteen-day comparison', () => {
  assert.deepEqual(getRollingReportRanges('2026-08-11', 15), {
    current: { start: '2026-07-27', end: '2026-08-10' },
    compare: { start: '2026-07-12', end: '2026-07-26' },
  });
});
test('clamps custom rolling days to one through 180', () => {
  assert.equal(getRollingReportRanges('2026-08-11', 0).current.start, '2026-08-10');
  assert.equal(getRollingReportRanges('2026-08-11', 999).current.start, '2026-02-12');
});
```

- [ ] **Step 2: Run the unit suite; expect module-not-found failure.**

Run: `pnpm --filter pappas-order-management test:unit`

- [ ] **Step 3: Implement pure helpers**

Use the existing local-date `addDate` pattern. Clamp `days` with `Math.min(180, Math.max(1, Math.trunc(days)))`; current end is `addDate(today, -1, 'day')`, current start is `addDate(currentEnd, -(days - 1), 'day')`, compare end is `addDate(currentStart, -1, 'day')`, and compare start is `addDate(compareEnd, -(days - 1), 'day')`.

- [ ] **Step 4: Run the suite; expect PASS.**

### Task 2: Compact tiles and add rolling-period controls

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

- [ ] **Step 1: Write failing source checks**

```ts
test('report tiles are compact and rolling reports use bounded controls', () => {
  const reportSource = source('app/(drawer)/report.tsx');
  assert.match(reportSource, /type ReportType = 'daily' \| 'weekly' \| 'monthly' \| 'rolling'/);
  assert.match(reportSource, /Last X days/);
  assert.match(reportSource, /maximumValue={180}/);
  assert.doesNotMatch(reportSource, /More reports coming soon|Open report|Viewing now/);
  assert.doesNotMatch(reportSource, /selectedReport !== 'daily'/);
});
```

- [ ] **Step 2: Run the suite; expect failure.**

Run: `pnpm --filter pappas-order-management test:unit`

- [ ] **Step 3: Implement state and controls**

Add `rolling` to `ReportType`, a 15-day initial value, preset chips (7/15/30/90), and a numeric Paper `TextInput` for 1–180. Use `getRollingReportRanges(getTodayDateString(), rollingDays)` for current/compare ranges. Hide date picker and Prev/Next when selected report is rolling; remove the daily guard around Prev/Next. Add an info-icon button per tile that opens a modal containing its existing description. Remove descriptions/action text from tile bodies and remove the placeholder tile.

- [ ] **Step 4: Ensure rolling labels and charts fit the range**

Use `Last ${rollingDays} days` as the report title and a range label built from the rolling current range. Use the existing daily bucket builder only for daily; use `buildRangeBuckets` for rolling. Treat rolling like weekly/monthly for date breakdown and current-vs-comparison subtitle.

- [ ] **Step 5: Run complete verification**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: no new errors in report-period or report files; unrelated existing errors may remain.
