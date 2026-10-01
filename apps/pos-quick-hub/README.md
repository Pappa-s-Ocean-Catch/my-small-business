# Pappa’s Launcher + Quick Hub

One APK, one existing package (`com.pappas.quickhub`): Android Home launcher,
POS shortcuts, app list, floating corner button and notification shortcuts.
Version 1.1.0 updates the existing Quick Hub installation when signed with the
same key. Do not uninstall to resolve a signature mismatch; rebuild with the
original signing key to preserve app data.

## Install on the SUNMI T2s

Build and copy the APK:

```sh
cd apps/pos-quick-hub
make update-install
```

Use the repository's `install/` server to download `pappas-quick-hub.apk` on
the terminal. Open **Pappa’s Launcher → Launcher setup → Choose Home** and
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

Unit tests cover Home replacement reporting and the permission/opt-in conditions
for managed enforcement. Hardware checks still required: select Home; press Home;
launch/return from each POS app; reboot; grant/deny overlay and notification access;
test protection enable/disable on a properly provisioned test device.

The release build retains the existing debug signing configuration for internal
installation. Use a stable private signing key for wider deployment.
