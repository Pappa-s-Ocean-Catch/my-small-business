# Image-Only Printing and Preorder Live-Window Design

## Goal

Use captured receipt images for every order receipt print, and automatically print a preorder once its scheduled pickup is within 30 minutes.

## Scope

- Remove receipt text/ESC-POS, ePOS XML, and HTML/system-print fallback paths.
- Keep the existing image capture, section routing, printer queue, simulator, and database print-claim behavior.
- Use one shared definition of whether a scheduled order is live: pickup is at or before `now + 30 minutes`.
- Add a provider-owned recurring check so a preorder becomes visible in Live Orders and enters auto-printing without requiring a new database event.

## Architecture

`useLiveOrdersQuery` owns the shared live-window predicate. It is used by `fetchLiveOrders` and exported for the automation provider. The Live Orders screen retains its existing 24-hour creation-time query. Separately, the provider performs an immediate check on mount and then repeats every 60 seconds, querying only scheduled orders with pickup times from seven days ago through 30 minutes ahead. It invalidates the Live Orders and Pre-orders queries, and runs each pending or confirmed eligible order through the existing claim-protected image auto-print workflow.

The print pipeline remains:

1. Render `ReceiptTemplate` or `CustomerReceiptTemplate` off-screen.
2. Capture a PNG appropriate for the target printer.
3. Enqueue a prepared image job.
4. Print through `escposPrintOrderImage`.

## Behavior

- A preorder with a pickup time more than 30 minutes away stays in Pre-orders and is not printed.
- At the first automation tick where it enters the 30-minute window, it appears in Live Orders when it is within that screen's existing 24-hour creation window, is removed from the Pre-orders list by the shared filter, and is eligible for automatic image printing.
- The automation scan considers scheduled pickup times from seven days in the past through 30 minutes in the future, so long-lead preorders are found without broadening the Live Orders history query indefinitely.
- The existing database print claim remains the authority for exactly-once printing across POS devices and app restarts.
- If auto-print is disabled or no image-print capability is configured, the order is not printed; it can be retried when configuration changes or a later relevant event occurs.
- Manual printing always captures and prints an image. It no longer falls back to text receipt commands or the device system-print dialog.

## Error Handling

- Image capture and queue failures continue to surface through the existing print journal and toast/error UI.
- The recurring check logs fetch failures but continues on the next tick.
- An order that is no longer pending or confirmed is skipped by the existing scheduler guard.

## Testing

- Unit-test the exported live-window predicate at just outside, exactly at, and inside 30 minutes.
- Unit-test the eligible-order selector used by the provider: only printable statuses within the live window are selected.
- Run the order-management unit test suite and TypeScript test compilation.

## Out of Scope

- Server-side scheduled printing.
- Changes to printer routing, receipt layout, simulator rendering, or print-claim schema.
