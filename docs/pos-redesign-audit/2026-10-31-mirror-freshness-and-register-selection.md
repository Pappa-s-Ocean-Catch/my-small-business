# Mirror freshness and register selection

Both the React Native mirror and native Android mirror now check local expiry independently of network refreshes. Snapshot reads also check freshness. A cart whose original `updatedAt` is more than five minutes old is unavailable, including during a stalled request or websocket outage. Expired carts retain their timestamp watermark so duplicate or older payloads cannot revive them. The next fresh selected cart takes ownership, or the configured idle screen appears. The local timer checks every second and does not fetch data; Android only redraws when the displayed snapshot changes.

The register selector uses checkboxes for one, several, or all registers. All mode includes future registers. Unchecking an individual register in all mode converts the selection to the remaining known registers. Saved single-register and all-register configurations remain compatible. Fetches and realtime callbacks accept only the selected registers.

Verification:

- React Native mirror: 35 unit tests passed; TypeScript check passed.
- Tests exercise stale initial/realtime carts, expiry boundaries, duplicate payloads, handoff, expiry during a hung fetch, selected-register filtering, all mode and settings compatibility.
- Native Android mirror: 24 unit tests passed; `assembleDebug` succeeded.
- `git diff --check` passed.
- No device deployment, live transaction, or payment/status change performed. Device interaction and visual validation remain outstanding.
