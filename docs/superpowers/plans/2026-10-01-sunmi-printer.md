# Sunmi built-in printer support

Implement a separate Android Sunmi service driver without modifying existing Epson, TCP or simulator dispatch behavior.

1. Add regression tests for legacy driver selection, Sunmi identity and saved settings round trips.
2. Add a fixed SUNMI:BUILTIN target and Android-only settings entry, with no network fields.
3. Add a native Expo module in the existing native-printer package; bind Sunmi SDK on demand, enforce timeouts, serialize jobs, and report service errors. Print captured PNG receipts using the SDK bitmap API and text document bytes through sendRAWData.
4. Add explicit Sunmi dispatch branches and journal labels. Keep existing capture behavior and existing dispatch branches unchanged.
5. Run unit suite, TypeScript checks and Android native compilation. Document hardware checks and build requirements.

Hardware acceptance: test receipt images, instant text tickets, multiple copies, cut/feed, missing paper, disconnected service, and queue recovery after errors. No printer output is considered hardware verified without a connected T2s.

## Implementation and validation

Implemented the Sunmi native module alongside the TCP module in the existing Expo workspace package. Existing receipt capture remains unchanged: Sunmi uses the captured PNG through the SDK bitmap API. Text tickets send the existing document encoder's ESC/POS bytes. Service binding and transaction completion have a 30-second timeout; jobs serialize under both the JS target queue and a native mutex. Jobs are never automatically retried, avoiding duplicate receipts after uncertain failures.

Requires a newly built Android APK; an OTA JavaScript update alone cannot add the native module. In Settings → Kitchen printer → Add printer manually, select Sunmi built-in, add it, choose routing and save settings. The fixed target identifies the printer on the device running the app; it cannot print to another Sunmi over LAN.

Validation: Android native Kotlin compilation passed. Sunmi identity, legacy driver selection, settings backup, dispatch isolation, image options and failure recovery passed. Existing image-only and text queue checks passed. Wider emitted unit suite: 279 passed, 3 unrelated failures (marketplace-local-client, Settings catalogue test source-path lookup, pos-mirror-publisher). The regular unit command is blocked by an existing customer-queue test type error; full app TypeScript also has existing errors. Final focused printer run: 19 passed, zero failures. Final native Kotlin compilation and app manifest merge passed; Expo autolinking includes SunmiPrinterModule. Hardware output remains unverified.
