# About Screen and Build Metadata Design

## Goal

Add an About screen reachable from the Order Management drawer that shows the app version, bundle build/update timestamp, and source commit identifier, and lets staff restart the JavaScript app or download and immediately apply an available EAS Update.

## Build metadata

The existing release Android build and EAS Update scripts will set two public Expo variables immediately before invoking Expo:

- `EXPO_PUBLIC_BUILD_DATE`: local timestamp formatted `YYYYMMDD-HHMM`.
- `EXPO_PUBLIC_GIT_SHA`: the first eight characters of `git rev-parse HEAD`, with `(+)` appended when `git status --porcelain` is non-empty.

The build script computes both values locally for an APK build. The update script computes them immediately before `eas update`, so an OTA bundle identifies its own date and commit rather than the native APK from which it started. The About screen reads only these embedded public values and has a clear `Unknown` fallback for development runs that do not supply them.

## Screen and navigation

Add a drawer route named `About`. It follows the app's existing Paper/Appbar styling and presents a compact, read-only Build information section:

- App version from Expo Constants.
- Build/update date from `EXPO_PUBLIC_BUILD_DATE`.
- Source revision from `EXPO_PUBLIC_GIT_SHA`.
- Current update identifier/channel where Expo Updates exposes one.

Two explicit actions are shown:

- **Restart app:** asks for confirmation, then calls Expo Updates reload. This reloads the JavaScript app; it does not force-stop Android or alter authentication/order data.
- **Check for update:** checks EAS Update. If an update exists, it downloads it and then reloads the app immediately. If no update is available, updates are disabled, the app is a development build, or the check/download fails, the current app remains running and an explanatory message is shown.

## Safety and failure handling

The screen is entirely local to the order/POS flow. It does not query or mutate orders, Supabase data, notification infrastructure, printer settings, or authentication state.

All Expo Updates operations are wrapped in `try/catch` with a visible busy state. `reloadAsync` runs only after a successful download. The app never reloads because a check failed or because there is no update.

## Testing

- Unit-test metadata formatting, dirty-workspace suffix, and unknown fallback.
- Unit-test update-state decisions: unavailable, no update, available-and-downloaded, and check/download failure.
- Verify release scripts produce the specified public variables with clean and dirty Git workspaces.
- Manually test the About drawer route on a release APK: no-update message, update download/restart path, and explicit restart confirmation.

## Scope

This feature introduces no native configuration, no database migration, no webhook, and no order-flow change. An APK build is only needed when release scripts or the native app version change; the About page and EAS Update logic can subsequently ship through compatible OTA updates.
