# About Build Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a drawer About screen that identifies the installed build/update and safely restarts or downloads and applies an available EAS Update.

**Architecture:** A Node build wrapper derives the timestamp and Git revision at command execution and passes them as `EXPO_PUBLIC_*` variables to the existing release build and EAS Update commands. A pure metadata/update-state module keeps the About UI testable, while a thin Expo Updates adapter owns the runtime API calls and never changes order or Supabase behavior.

**Tech Stack:** Expo Router, Expo Constants, Expo Updates, React Native Paper, Node built-in test runner, Node `child_process`/environment variables.

## Global Constraints

- Timestamp format is exactly `YYYYMMDD-HHMM` in the local build/update timezone.
- Revision is exactly the first eight Git SHA characters; append `(+)` if `git status --porcelain` has any output.
- Public metadata must be injected before `eas build` and `eas update`; it must be safe to display in the APK.
- The About screen must never query/mutate orders, POS, Supabase, push-notification setup, printers, or authentication.
- Restart occurs only after explicit confirmation; automatic restart occurs only after a successfully downloaded EAS Update.
- Check/download/reload failures and unavailable updates must leave the current app running.
- Preserve the user’s uncommitted working tree; do not commit this work.

---

### Task 1: Create deterministic build metadata tooling

**Files:**
- Create: `apps/pappas-order-management/scripts/run-with-build-metadata.mjs`
- Create: `apps/pappas-order-management/test/build-metadata.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`
- Modify: `apps/pappas-order-management/package.json`

**Interfaces:**
- Produces `resolveBuildMetadata({ gitHead, gitStatus, now }): { buildDate: string; gitSha: string }` and a CLI wrapper that starts its child command with `EXPO_PUBLIC_BUILD_DATE` and `EXPO_PUBLIC_GIT_SHA`.
- Consumes the existing `release:android:production` and `update:android:production` commands.

- [ ] **Step 1: Write failing tests for clean/dirty metadata**

```ts
test('formats clean build metadata from the commit and local date', () => {
  assert.deepEqual(resolveBuildMetadata({
    gitHead: '287eda32d994', gitStatus: '', now: new Date(2026, 7, 8, 12, 30),
  }), { buildDate: '20260808-1230', gitSha: '287eda32' });
});

test('adds a dirty suffix when the workspace has any status entry', () => {
  assert.equal(resolveBuildMetadata({
    gitHead: '287eda32d994', gitStatus: ' M app.tsx', now: new Date(2026, 7, 8, 12, 30),
  }).gitSha, '287eda32(+)');
});
```

- [ ] **Step 2: Run the test and verify it fails because the helper is absent**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript reports the missing metadata module/export.

- [ ] **Step 3: Implement the helper and CLI wrapper**

The wrapper must execute `git rev-parse HEAD` and `git status --porcelain`, calculate local zero-padded date/time, then spawn its remaining arguments with inherited stdio and these two environment variables. It must exit with the child exit code and fail clearly when it receives no command.

Update scripts to invoke it:

```json
"release:android:production": "dotenv -e release.env -- node scripts/run-with-build-metadata.mjs eas build --platform android --profile production --local",
"update:android:production": "dotenv -e release.env -- node scripts/run-with-build-metadata.mjs eas update --channel production --environment production --platform android"
```

- [ ] **Step 4: Run unit verification and inspect a metadata-only command**

Run: `pnpm --filter pappas-order-management test:unit && node apps/pappas-order-management/scripts/run-with-build-metadata.mjs node -e "console.log(process.env.EXPO_PUBLIC_BUILD_DATE, process.env.EXPO_PUBLIC_GIT_SHA)"`

Expected: all tests pass and the command prints the timestamp and SHA with `(+)` when the workspace is dirty.

### Task 2: Add a safe Expo Updates controller

**Files:**
- Create: `apps/pappas-order-management/lib/about-updates.ts`
- Create: `apps/pappas-order-management/test/about-updates.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces `getBuildMetadata(env, appVersion)` and `checkAndApplyUpdate(client): Promise<UpdateResult>`.
- Consumes an injected `UpdatesClient` with `isEnabled`, `checkForUpdateAsync`, `fetchUpdateAsync`, and `reloadAsync`.

- [ ] **Step 1: Write failing tests for unavailable/no-update/update/failure states**

```ts
test('does not call Expo Updates when updates are disabled', async () => {
  const result = await checkAndApplyUpdate(disabledClient);
  assert.equal(result.kind, 'unavailable');
});

test('downloads then reloads only when an update is available', async () => {
  const calls: string[] = [];
  const result = await checkAndApplyUpdate(availableClient(calls));
  assert.equal(result.kind, 'applied');
  assert.deepEqual(calls, ['check', 'fetch', 'reload']);
});
```

- [ ] **Step 2: Run the tests and verify the imports fail**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript reports missing `about-updates` exports.

- [ ] **Step 3: Implement the pure controller**

`getBuildMetadata` returns `Unknown` for missing public metadata. `checkAndApplyUpdate` returns `unavailable`, `up-to-date`, `applied`, or `failed`; it catches all exceptions, calls reload only after `fetchUpdateAsync` succeeds, and returns an error message instead of throwing. Add a `restartApp(client)` helper that only wraps `reloadAsync` and returns a result for the UI.

- [ ] **Step 4: Run full unit tests**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS, including every no-op/failure state and no calls to external order code.

### Task 3: Build the About drawer screen

**Files:**
- Create: `apps/pappas-order-management/app/(drawer)/about.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/_layout.tsx`
- Modify: `apps/pappas-order-management/test/about-updates.test.ts`

**Interfaces:**
- Consumes Task 2 helpers, `expo-constants`, and `expo-updates` via a small adapter object.
- Produces drawer navigation item `About` and a screen with version/metadata/restart/update actions.

- [ ] **Step 1: Add a failing source-level route test**

```ts
test('registers the About drawer route', () => {
  const drawerSource = readFileSync(join(process.cwd(), 'app/(drawer)/_layout.tsx'), 'utf8');
  assert.match(drawerSource, /name="about"/);
});
```

- [ ] **Step 2: Run the test and verify it fails because the route is absent**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL with the route assertion.

- [ ] **Step 3: Implement the Paper screen and route**

Add `About` to the existing drawer with `information-outline`. The screen uses an Appbar menu action, Paper Cards/List rows for Version, Build/update date, Revision, and update ID/channel where available. `Restart app` uses `Alert.alert` confirmation before calling `restartApp`. `Check for update` disables both actions while active, calls `checkAndApplyUpdate`, and displays the returned state through an Alert. Use a `try/catch` adapter around Expo Updates runtime calls so a development build remains usable.

- [ ] **Step 4: Verify the app config and tests**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec expo config --type public`

Expected: PASS. The About route is present and `expo-updates` remains enabled in the resolved config.

### Task 4: Manual release/update verification

**Files:**
- Modify: `apps/pappas-order-management/README.md`

**Interfaces:**
- Consumes production build/update scripts and deployed EAS Update channel.
- Produces reproducible release verification instructions.

- [ ] **Step 1: Document the exact smoke test**

```md
1. Run `pnpm --filter pappas-order-management release:android:production`.
2. Install the APK and confirm About shows `YYYYMMDD-HHMM` and eight-character SHA, with `(+)` only for a dirty workspace.
3. Publish a JS-only change with `pnpm --filter pappas-order-management update:android:production`.
4. Tap Check for update; confirm it downloads and restarts only after the update is available.
5. Confirm no-update and offline/error checks leave the app running.
```

- [ ] **Step 2: Run final automated checks**

Run: `pnpm --filter pappas-order-management test:unit && git diff --check`

Expected: PASS; no whitespace errors and no unplanned order/Supabase changes.

## Plan self-review

- Spec coverage: Task 1 stamps each build/update, Task 2 makes update behavior safe and testable, Task 3 exposes it in the drawer, and Task 4 verifies release and OTA behavior.
- Placeholder scan: no incomplete requirements remain.
- Type consistency: `EXPO_PUBLIC_BUILD_DATE`, `EXPO_PUBLIC_GIT_SHA`, `checkAndApplyUpdate`, and `restartApp` are used consistently.
