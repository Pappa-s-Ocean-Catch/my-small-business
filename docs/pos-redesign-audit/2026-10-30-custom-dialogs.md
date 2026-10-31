# Custom app dialogs

Application-owned system alerts now use `lib/app-dialog.ts` and a shared themed `AppDialogOverlay`. All prior alert call sites keep their titles, messages, buttons, cancellation callbacks and asynchronous business actions. Multiple messages queue instead of replacing each other; choosing an action removes that request before invoking its callback, preventing duplicate taps and allowing follow-up errors to appear as custom dialogs.

A root host handles startup messages. Focused routes host their own dialogs, including native-stack modal routes. `AppModal` wraps existing native modal windows and registers a higher-priority host; nested editors/previews therefore render alerts in the correct native window. Android Back and web Escape cannot accidentally close the editor underneath an alert. Background touches and accessibility are suppressed while its host owns a dialog. Long action lists scroll with Cancel separate, and native screen readers focus the heading.

Dirty-editor discard prompts use the same custom confirmation on web, iOS and Android. The legacy controlled ConfirmationDialog uses the shared EditorSheet frame. The pending delivery-address editor was also moved from a Paper portal modal to EditorSheet so alerts appear above it reliably.

Platform permission requests, OS share sheets and payment-terminal interfaces remain platform-owned. These changes replace app-owned alerts, not platform security UI.

Validation: 408 unit tests passed; automated source scans prohibit native Alert imports, window.confirm/window.alert and bypassing the modal host. Full TypeScript checking reports the same 13 existing receipt/caller-ID errors. Diff check passed. Native POS visual validation remains outstanding; the available simulator is running another project. No live orders, payments, printer jobs or settings were changed during verification.
