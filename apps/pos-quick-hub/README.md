# Pappa’s Launcher + Quick Hub

One APK, one existing package (`com.pappas.quickhub`): Android Home launcher,
POS shortcuts, app list, floating corner button and notification shortcuts.
Version 1.2.2 updates the existing Quick Hub installation when signed with the
same key. Do not uninstall to resolve a signature mismatch; rebuild with the
original signing key to preserve app data.

## Install on the SUNMI T2s

Build and copy the APK:

```sh
cd apps/pos-quick-hub
make update-install
```

Use the repository's `install/` server to download `pappas-quick-hub.apk` on
the terminal. Open **Pappa’s Launcher → Launcher setup → Default Home settings → Choose Home** and
select Pappa’s Launcher as the default/Always Home app. Press the physical
Home button, then reopen the app to check the Home status.

The setup dialog includes Android version, device model, current Home package,
and Device Owner availability. It uses Android's Home role chooser on Android
10+, with settings fallbacks on older or customized firmware.

If SUNMI still opens on Home, the APK alone has not overridden its device policy.
The floating button and notification shortcuts remain an alternative entry point,
subject to SUNMI allowing overlays and background services. Home status is checked
when the app resumes; this is not a background monitor and does not identify which
system service changed the preference.

## Home-button redirect without ADB

For firmware that opens SUNMI even while Pappa’s remains selected as default:

1. Install the updated APK from the existing install page.
2. Open **Launcher setup → SUNMI Home redirect → Select stock launcher**.
3. Select the SUNMI launcher that appears when pressing Home. The list displays
   app labels and package names; select only the stock launcher, not a POS app.
4. Tap **Accessibility settings**, open **Pappa’s Home redirect**, and enable it.
5. Return to Pappa’s and reopen redirect setup. Confirm redirect is ON and the
   accessibility service is enabled, then open a POS app and press Home.

The service reacts to window changes from the selected launcher and explicitly
opens Pappa’s. It does not intercept the Home key, read screen content, or require
USB/ADB. Opening the stock launcher manually also triggers the redirect. There
may be a brief flash of SUNMI. Events are throttled to one redirect per 500 milliseconds;
Home presses inside that interval may need to be repeated after it expires.

Disable it using **Launcher setup → SUNMI Home redirect → Turn off**, or disable
**Pappa’s Home redirect** in Android Accessibility settings. A user must enable
accessibility manually; installation cannot grant it. If SUNMI refuses or later
kills/disables the service, this workaround cannot guarantee Home redirection.
Do not disable SUNMI system packages to test this feature.

Hardware checks: Home from each POS app; settings access; unrelated apps staying
open; redirect off; reboot and confirm accessibility remains enabled. If SUNMI
is absent from the launcher picker, package detection needs device-specific work.

### If pressing Home does nothing

Open **Launcher setup → Redirect diagnostics** (version 1.2.1+). Clear the log,
open a POS app, wait three seconds, press Home, then return using the floating
button or notification. Reopen diagnostics and inspect the log:

- No window events: verify accessibility is enabled; toggle the service off/on.
- Window events but no target match: compare the window package after Home with
  the selected target. **Choose observed app** lets you explicitly select that
  package even if SUNMI does not list it as a Home app. Select only the stock
  launcher, never the POS app you used for the test.
- Target matched and launch requested, but SUNMI stays visible: the request is
  not proof Android displayed Pappa’s; firmware may block it or immediately
  bring SUNMI forward again. The log distinguishes thrown launch errors too.

The last 20 entries remain locally in app preferences. Entries contain package
and activity class names, times, service lifecycle and redirect attempts; no
screen content. Clear log removes entries and the recent observed package list.
Share the diagnostic text or a photo to continue device-specific diagnosis.

## Managed Home protection

The **Protect Home** button is available only when this package is already the
Android Device Owner. Installing it or activating ordinary Device Admin does not
grant that privilege. Provision through the device administrator's supported
Android Enterprise/SUNMI process. Devices with an existing owner may need that
owner to configure Home instead; this app does not remove another manager.

Protection requires explicit opt-in in Launcher setup. It registers a persistent
preferred Home activity with `DevicePolicyManager`, reapplies it on app resume,
boot and package updates, and can be disabled from the same dialog. It does not
use lock-task mode or disable/uninstall SUNMI packages. Firmware or vendor policies
may still take precedence; validate on the actual T2s before operational use.

## Verification

```sh
./gradlew testDebugUnitTest assembleRelease lintDebug
```

Unit tests cover Home replacement reporting, managed enforcement permissions,
redirect package filtering, opt-in and event throttling. Hardware checks still required: select Home; press Home;
launch/return from each POS app; reboot; grant/deny overlay and notification access;
test protection enable/disable on a properly provisioned test device.

The release build retains the existing debug signing configuration for internal
installation. Use a stable private signing key for wider deployment.

Version 1.2.2 removes accessibility event batching and requests no transition animation.
Diagnostics include event age and time to Pappa’s resume; a manual return can also
produce the resume entry. SUNMI event generation and activity startup may still add delay.
