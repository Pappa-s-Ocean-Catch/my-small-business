# Report Daily Period Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Daily reports use the same visible Previous/Next navigation controls as Weekly and Monthly reports.

**Architecture:** The existing `shiftSelectedPeriod` function already shifts Daily by one day, Weekly by seven days, and Monthly by one month. This change removes only the JSX guard that hides the controls for Daily and records the behavior with a source-level regression test.

**Tech Stack:** React Native, React Native Paper, TypeScript, Node test runner.

## Global Constraints

- Daily navigation changes one selected date at a time.
- Weekly and Monthly navigation behavior must remain unchanged.
- The date picker, report loading, print snapshot, and comparison settings must remain unchanged.
- Leave all changes uncommitted.

---

### Task 1: Expose Daily Previous/Next controls

**Files:**
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx`

**Interfaces:**
- Consumes: `shiftSelectedPeriod(direction: 'previous' | 'next')` in `report.tsx`.
- Produces: the existing `Prev` and `Next` buttons for Daily, Weekly, and Monthly selections.

- [ ] **Step 1: Write the failing regression test**

```ts
test('report period navigation is available for daily weekly and monthly reports', () => {
  const reportSource = source('app/(drawer)/report.tsx');
  assert.match(reportSource, /shiftSelectedPeriod\('previous'\)/);
  assert.match(reportSource, /shiftSelectedPeriod\('next'\)/);
  assert.doesNotMatch(reportSource, /selectedReport !== 'daily'/);
  assert.match(reportSource, /setSelectedDate\(\(current\) => addDate\(current, amount, 'day'\)\)/);
  assert.match(reportSource, /setSelectedDate\(\(current\) => addDate\(current, amount \* 7, 'day'\)\)/);
  assert.match(reportSource, /setSelectedDate\(\(current\) => addDate\(current, amount, 'month'\)\)/);
});
```

- [ ] **Step 2: Run the suite to verify the test fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because the current JSX contains `selectedReport !== 'daily'` around the navigation buttons.

- [ ] **Step 3: Remove only the visibility guard**

Replace this conditional block:

```tsx
{selectedReport !== 'daily' && (
  <>
    <Button mode="outlined" compact icon="chevron-left" onPress={() => shiftSelectedPeriod('previous')}>Prev</Button>
    <Button mode="outlined" compact icon="chevron-right" contentStyle={styles.periodNextButtonContent} onPress={() => shiftSelectedPeriod('next')}>Next</Button>
  </>
)}
```

with the same two buttons rendered unconditionally in `periodActions`. Do not edit `shiftSelectedPeriod`.

- [ ] **Step 4: Run complete verification**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: it continues to report the existing unrelated type errors only; it must report no error in `app/(drawer)/report.tsx`.

- [ ] **Step 5: Leave changes uncommitted**

Run: `git status --short`

Expected: report navigation changes remain unstaged and uncommitted with the existing report-print work.
