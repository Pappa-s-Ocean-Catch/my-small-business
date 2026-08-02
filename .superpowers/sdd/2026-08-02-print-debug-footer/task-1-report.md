# Task 1: Persist diagnostic settings — report

## Scope

Implemented only device-local app settings persistence and the Settings screen controls for `registerName` and `printerDebugFooter`. No printing templates, providers, routing, or print pathways were changed.

## Changes

- Added `registerName: string` and `printerDebugFooter: boolean` to `AppSettings`.
- Added defaults of an empty register name and diagnostic footer disabled (`false`).
- Load validation trims a string register name and falls back to `''`; it accepts the footer only when stored as a boolean, otherwise falls back to `false`.
- Save normalization trims the register name and coerces the footer preference to boolean.
- Added a Register > Print diagnostics settings panel with Register name input and Print diagnostic footer toggle. Both hydrate from the current settings and are included in the existing Save payload.

## RED evidence

Before production changes, ran:

```text
pnpm --filter pappas-order-management test:unit
```

The new focused contract test failed as expected:

```text
not ok 40 - settings preserve a blank register name and disable the diagnostic footer by default
error: The input did not match the regular expression /registerName:\s*string;/
```

The companion Settings UI contract also failed, giving 39 passing and 2 failing tests in total. The failure occurred because neither requested setting nor UI existed.

## GREEN evidence

After implementation, ran:

```text
pnpm --filter pappas-order-management test:unit
```

Result: 41 tests passed, 0 failed (including both `print-debug-settings.test.ts` contracts).

Also ran:

```text
git diff --check
```

Result: exit 0 with no whitespace errors.

Attempted full app type-check:

```text
pnpm --filter pappas-order-management exec tsc --noEmit
```

Result: exit 2 before evaluating the scoped changes because the current dependency installation lacks `@types/minimatch` (`TS2688: Cannot find type definition file for 'minimatch'`). The unit suite's TypeScript compilation still succeeded.

## Files changed

- `apps/pappas-order-management/lib/settings.ts`
- `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- `apps/pappas-order-management/test/print-debug-settings.test.ts`

## Self-review

- Existing persisted settings remain backward-compatible: absent new fields receive safe defaults.
- Register-name input is normalized at the persistence boundary so whitespace-only values remain blank.
- The diagnostic toggle has no effect on printing in this task; later printing work consumes it.
- The only new UI state is synchronized from the settings query and included in the existing save operation.

## Concern

The unit harness cannot execute `lib/settings.ts` directly because it depends on React Native device storage. The added test is a focused source contract, matching the existing suite’s source-contract approach. A full application type-check is currently blocked by the missing `minimatch` type definition described above.
