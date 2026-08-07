# Raw TCP Print Performance and Safety Design

## Goal

Reduce the time to prepare an Android raw-TCP receipt image without changing the bytes that produce the printed receipt. Establish repeatable measurements before enabling any faster transport.

## Current Path and Evidence

For a raw-TCP printer, `captureReceiptForPrinter` creates two captures in parallel: a PNG preview file and a PNG base64 payload. The payload is decoded in JavaScript, optionally resized, converted into ESC/POS bit-image rows, then sent over TCP. The image capture loop for section-routed tickets is sequential because each ticket updates and captures the same mounted receipt template. Jobs sent to different printer targets already run concurrently; jobs for the same target are serialized by `enqueuePrinterJob`.

`react-native-view-shot` supports Android `raw` capture as ARGB. Its documented fast form is `raw` plus `zip-base64`, which requires zlib/deflate inflation after base64 decoding. The existing raw parser handles only uncompressed base64, so compressed raw data must never be passed to it unchanged.

## Scope

- Instrument the raw-TCP preparation path: native capture, base64 decode/inflate, PNG decode where applicable, resize, rasterization, and TCP send.
- Add deterministic unit coverage for the image-to-ESC/POS conversion, including ARGB channel order and compressed raw decoding.
- Add an Android diagnostic comparison mode that prepares the established PNG path and a candidate raw path, compares their raster outputs, and does not print the candidate output.
- Preserve PNG as the default transport until the diagnostic passes on the target tablet and a physical receipt is approved.
- Preserve the one-job-per-printer queue; do not parallelize captures that share the mounted receipt view.

## Non-goals

- No change to ESC/POS command format, luminance threshold, paper width, printer routing, or printer queue ordering.
- No parallel sends to the same physical printer.
- No raw transport rollout on iOS.

## Design

### Performance measurement

Introduce a small, dependency-free timing helper that receives named phase durations and image metadata. Debug-journal entries will record one structured record per raw-TCP print: capture type, dimensions, source bytes, raster bytes, and each phase duration. The existing PNG route supplies the initial baseline on the actual tablet.

### Pure image preparation boundary

Extract image preparation behind a testable function that produces ESC/POS payload bytes and optional diagnostics. The function will accept existing PNG base64 and raw ARGB source objects. It will retain the present resize and monochrome-raster rules exactly. Tests will use tiny known images to prove a PNG fixture and its equivalent ARGB fixture generate the same final ESC/POS byte sequence.

Compressed raw is a separate source type: decode base64, inflate with the already-installed `pako`, validate exactly `width * height * 4` decoded bytes, then interpret channels as ARGB. Invalid metadata or byte count rejects the raw candidate.

### Guarded raw diagnostic

An opt-in print-performance diagnostic will run only on Android raw-TCP printing. It captures both reference PNG and raw candidate for the same settled receipt, prepares both payloads, and compares the exact ESC/POS payload bytes. It records durations and a pass/fail result. The printer receives only the reference PNG payload in this mode. A mismatch, unsupported raw capture, or decode error logs the reason and retains PNG.

The first candidate is plain `raw + base64` so there is no compression ambiguity. Only after it achieves exact equality and a physical receipt review will `raw + zip-base64` be exercised by the same comparison mechanism. Compressed raw becomes eligible for production only after it also passes.

### Production rollout

Production selection remains PNG by default. A separately persisted, explicit setting may enable a validated raw mode after diagnosis; it must fall back to PNG upon any raw error. The setting is not enabled automatically by timing results alone.

### Concurrency

Receipt captures remain sequential while one React Native receipt view is mutated between section tickets. Once jobs are prepared, the existing print queue may continue processing distinct printer targets concurrently. The implementation will assert this invariant in tests; it will not introduce JS worker threads or unbounded `Promise.all` for CPU rasterization, which would contend on a tablet's JavaScript thread and risk reordered output.

## Testing and Acceptance

1. Unit tests show known PNG and raw ARGB images yield byte-identical ESC/POS payloads.
2. Unit tests reject malformed raw dimensions, incomplete pixel data, and invalid compressed raw payloads.
3. The baseline diagnostics record every phase for a PNG raw-TCP job.
4. Diagnostic mode never sends candidate raw bytes when reference and candidate differ.
5. On the target Android tablet, a complete diagnostic run reports exact payload equality; the subsequent physical receipt is legible and matches the PNG receipt before enabling any raw production mode.
6. Existing unit tests and type checking remain green.
