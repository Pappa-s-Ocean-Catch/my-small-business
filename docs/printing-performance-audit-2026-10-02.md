# Printing performance audit — 2 October 2026

## Implementation follow-up

The fixes below have now been implemented in this checkout; the audit findings that follow describe the original code.

- Android raw TCP text printing now uses the owned native transport, bypassing `react-native-tcp-socket`. Text and image sends close their sockets deterministically and share one watchdog thread, which closes stalled sockets at the send deadline.
- Store retention expires undispatched queued jobs, while in-flight jobs retain ownership until the real transport terminates. Clearing history preserves active work. Already-completed waits settle immediately, and jobs can only transition from queued to printing once.
- Receipt capture now produces immutable local images before enqueueing. Shared auto-print render surfaces are locked during render/capture and released before transmission. Text-only automation does not mount a receipt capture view.
- Captures are reference-counted across queued jobs, direct dispatches, and simulator previews; the final consumer releases the temporary file. Unowned captures left by interrupted preparation are pruned after ten minutes. Android resizes the bitmap before creating pixel arrays and runs conversion/raster work off Expo's shared module queue.
- iOS accepts immutable image sources, serializes actual print work, and clears connection handlers/timers on a serial callback queue. The iOS source was syntax-checked, but a full iOS build/device run has not been performed. Android native Kotlin/Java compilation passed.

Verification: a real loopback integration test sent **200 jobs with one additional shared watchdog thread**, and a stalled 32 MiB write terminated in approximately 154 ms with a 150 ms deadline. All 16 focused printing tests passed. The broader app suite had 274 passing tests and five failures; those same five failures were reproduced using the original printing modules. The broader TypeScript check reports unrelated errors outside the changed printing files.

These native API changes require a new app binary. Do not deploy the JavaScript changes alone to older native builds. Android text dispatch reports that an updated native build is required if `printRaw` is absent.

The original Node audit reproduction below intentionally asserted the old faulty behavior; use `test/printing-lifecycle.test.ts` for the fixed behavior. The dependency leak reproduction still demonstrates the unused Android dependency defect. The new owned transport can be checked with:

```sh
javac -d /tmp/raw-tcp-tests libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/RawTcpTransport.java tools/audits/RawTcpTransportTest.java
java -cp /tmp/raw-tcp-tests com.mysmallbusiness.nativerawtcpprinter.RawTcpTransportTest
```

Remaining device verification: print fidelity, actual Android idle memory/thread measurements, and Sunmi Binder behavior during hardware failure. Lower-priority audit findings such as bounded deduplication/history and Epson lifecycle are outside this patch.

## Outcome and confidence

The strongest code-level explanation for progressive degradation is **native TCP client and thread retention in `react-native-tcp-socket@6.4.1`**, which the app still uses for raw TCP **text** printing. Every successful text job creates a new native client, stores it in a long-lived map, and closes it without removing that map entry or shutting down its executor pools. This occurs during normal successful printing, not only printer failures.

User configuration: one POS uses Sunmi + raw TCP; other POS uses raw TCP for both printers. Both configurations use this leaking path when printing text to raw TCP. The configured receipt mode was not supplied; `lib/settings.ts:255` defaults to `text`. Customer receipts and reports also have image paths independent of the kitchen receipt mode. If the affected raw TCP jobs are exclusively images, the TCP dependency leak is not their transport; see findings 2–5 instead.

The local Java reproduction retained **25 clients and 25 live writer threads after 25 successful writes and closes**. It executes constructor/write/destroy methods extracted verbatim from the installed dependency, with an in-memory socket and the same map insertion/close sequence. It does not execute Android JNI, the receiver loop, or a physical printer. Production connections also start a reader executor, so they can retain a second worker per successful connection.

This establishes a defective lifecycle and a credible root cause. A runtime trace of the affected POS is still needed to establish how much of the observed slowdown it accounts for. `adb devices -l` found no connected devices. No production code was changed by this audit.

## 1. Critical: raw TCP text printing retains native clients and executor threads

App entry points:

- `apps/pappas-order-management/lib/escpos-printer.ts:365`: raw TCP documents use `withRawTcpPrinter`, not the custom Kotlin native image module.
- `escpos-printer.ts:263`: `createConnection` creates a fresh socket for every document.
- Success calls `socket.end()`; failure and close fallback call `socket.destroy()`.

Installed Android dependency:

- `node_modules/react-native-tcp-socket/android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketModule.java:48`: module owns a `ConcurrentHashMap<Integer, TcpSocket>`.
- `TcpSocketModule.java:99`: inserts each client using its unique connection ID.
- `TcpSocketModule.java:139–153`: both `end` and `destroy` reach `socketClient.destroy()`. Neither removes the client from `socketMap`.
- The only `socketMap.remove` in that module is in `close`, which handles **servers**, not clients.
- `TcpSocketClient.java:32–33`: every client owns `newSingleThreadExecutor()` for listening and writing.
- `TcpSocketClient.java:184`: `destroy` closes/nulls the socket, but does not shut down either executor or release the receiver task.
- `TcpEventListener.onClose` emits an event; it does not remove clients from the module map.

The map keeps the client and its executor wrappers reachable, so relying on garbage collection of the wrappers cannot close these executors. Closing a file descriptor is insufficient: the Java client and worker resources remain owned by the module. Removing JS event subscriptions on close also does not release this native map.

**Why it matches the symptom:** retained resources grow with total successful printing volume, including while the print queue is empty. A POS printing for all registers reaches this condition sooner. Ordinary queue-history pruning and bitmap recycling do not touch this ownership chain.

**Repair direction:** send raw TCP text bytes through the owned native module with deterministic socket close and a real write deadline, eliminating the leaking dependency from this print path. Alternatively, maintain a reproducible dependency patch that removes clients on every terminal path and shuts down both executors safely. Do not edit only `node_modules`; that will disappear on reinstall/build.

## 2. High: native raw TCP image writes have no enforced write deadline

`libs/native-raw-tcp-printer/android/src/main/java/com/mysmallbusiness/nativerawtcpprinter/NativeRawTcpPrinterModule.kt:122` specifies a connection timeout and `socket.soTimeout`, then performs blocking `OutputStream.write`/`flush`.

`SO_TIMEOUT` applies to input reads, not output writes. [Java Socket API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/net/Socket.html#setSoTimeout(int)). A connected but stalled printer/network can therefore hold the I/O worker, socket, native printer mutex, payload bytes, and unresolved JS invocation beyond the requested 30 seconds.

`Socket().use` closes the socket when the block exits. It does not force a blocked write to exit. Similarly, wrapping a blocking write in a coroutine `withTimeout` alone is insufficient unless cancellation actively closes the socket or the transport uses deadline-aware nonblocking writes.

**Repair direction:** enforce a total send deadline, close the active socket when that deadline/cancellation occurs, and verify the worker and per-printer lock actually release before accepting another job.

## 3. High: store timeout leaves the real queue running and accepting more work

- `stores/printerAutomationStore.ts:75`: after ten minutes, retention converts active jobs to failed and strips their payloads.
- `lib/print-queue.ts:72`: the workflow waiter returns after two minutes but does not stop the transport.
- `lib/escpos-printer.ts:177`: a second queue holds promise chains and job closures. It drains only when those transport promises settle.
- Store selection uses job `status`, so once an operation is labeled failed, another job can start despite the original operation still running.

The local reproduction uses the actual store, dispatcher, and transport queue with a blocked native print mock. Five jobs were marked timed out while only the first reached native dispatch. The other four remained behind the unresolved promise. On releasing the mock, **all four timed-out jobs still dispatched**.

This retains closures/payload references outside the store, permits stale printing, and makes the visible queue disagree with the physical transport. Subsequent late completions can also overwrite failure state if the history record remains present. A failed job disappearing from history is not evidence its transport has stopped.

**Repair direction:** make a single owner responsible for dispatch, terminal status, native cancellation, and payload disposal. Cancel undispatched expired jobs; for in-flight jobs, release the printer only after the transport has terminated. Distinguish uncertain delivery from safe-to-retry failure to avoid duplicates. Bound pending work and report congestion explicitly.

## 4. High: queued native images reference mutable/unmounted receipt views

`lib/printer-image.ts:16` returns a view tag for raw TCP; it does not take a snapshot. Native capture happens later, when the lower printer queue runs.

Two concrete lifetime problems exist in `providers/PrinterAutomationProvider.tsx`:

1. `printInstoreCustomerReceipt` enqueues that view tag at line 186 and unmounts its receipt in `finally` at line 209 without waiting for dispatch.
2. `quickPrintAutoOrder` changes one shared receipt view for each section/template at lines 400–402, collects sources, and only enqueues them at line 516. Several sources can therefore refer to the same view tag with its final content rather than their intended section content. Separate orders can also execute this workflow concurrently: the guards prevent the same order from overlapping, but there is no cross-order receipt-render mutex.

The per-printer send queue does not protect the shared receipt-render phase. A busier dedicated printing POS increases the chance of view replacement/unmount before dispatch. Failures and retries can amplify the queue problems, and receipts can contain the wrong content.

**Repair direction:** create an immutable payload while the correct receipt owns the render surface, then enqueue it. Serialize ownership of each shared receipt surface through render and capture. The native API should separate capture/preparation from queued transmission or accept an owned immutable source. A view tag is not a queued image.

## 5. Medium: high raster allocation pressure and shared native queue contention

The custom Android image module allocates:

- an ARGB bitmap at `view.width × view.height × captureScale²` on the UI thread;
- an equally sized `IntArray`;
- an equally sized RGBA `ByteArray`;
- another resized RGBA buffer;
- the ESC/POS output stream buffer and its `toByteArray` copy.

For a physical view of 576×2000 pixels captured at scale 2, the initial bitmap, pixel array, and RGBA array each use about **17.6 MiB**. These three allocations overlap during conversion (~52.7 MiB before overhead). This example is illustrative, not a measured receipt size. High quality is enabled by default. View dimensions on Android are physical pixels, so the actual allocation depends on measured view size as well as capture scale.

The bitmap is already recycled in `finally` at lines 35–38. The arrays are ordinary managed allocations: this is allocation pressure, not proof they leak permanently. Stalled operations and overlapping preparation can extend lifetimes.

Conversion/resize/raster generation runs on Expo's default modules queue, rather than explicitly on a CPU dispatcher. The installed Expo implementation uses a single `HandlerThread` for that queue (`AppContext.kt:66`; `SuspendFunctionComponent.kt`). Large raster jobs can delay other native module work on that thread. Image preparation also happens before acquiring the native per-printer mutex.

**Repair direction:** bound capture dimensions/area; move CPU conversion off the shared modules queue; rasterize directly from a printer-sized bitmap or process rows/strips instead of materializing multiple full-size RGBA copies. Limit simultaneous preparation across printers. Preserve print fidelity in regression comparisons.

## 6. Medium: Sunmi receipt files accumulate despite correct bitmap recycling

- `lib/printer-image.ts:27` and `:37` use `captureRef(... result: 'tmpfile')`.
- There are no `releaseCapture` calls in the app source.
- Clearing queue image references and dismissing simulator state does not delete those files.
- Installed `react-native-view-shot` cleans cache files at module invalidation, and exposes `releaseCapture` for earlier deletion (`RNViewShotModule.java:46–62`). Normal long-running printing does not invoke that module invalidation cleanup.

This is retained **disk cache**, not proof of retained bitmap RAM. It affects Sunmi image receipts, Epson images, and simulator/report previews. Raw TCP native-view receipts do not generate these PNGs.

Sunmi's native code already closes its input stream, recycles source/scaled/strip bitmaps, and unbinds the service in a noncancellable cleanup block. No normal-path persistent bitmap or bind leak was established there. It decodes/scales before acquiring the Sunmi mutex, and its timeout is cooperative: blocking Binder calls still need device investigation if they hang. Disconnect after connection does not directly fail an outstanding transaction deferred; its timeout provides the fallback.

**Repair direction:** explicit image ownership/release after all consumers finish, including errors, previews, and replaced simulator images. Captures can be shared between multiple jobs; do not delete the file after only the first consumer.

## Additional defects and lower-priority retention

- **Raw TCP text promise ignores early close:** `escpos-printer.ts:315` ignores `close` unless already waiting for post-write close. A close before connection/write completion without an error leaves the promise unresolved. Reproduced with event mocks; occurrence on the affected device remains unmeasured.
- **False write success:** `writeRawBytes` resolves after 150 ms even without a write callback. The installed Android TCP dependency's `end` closes the socket through a different executor from its writer. It can therefore close while writing is still pending. A guessed timer is not delivery evidence.
- **Invalid job transitions:** `markPrintJobStarted` does not require `queued`, and allows the same `printing` job to start again. Starting a successful job after its payload is stripped was reproduced. Current normal selectors reduce exposure, but the API itself is unsafe.
- **Waiter misses current state:** `waitForPrintJobs` subscribes only to future store changes. An already-completed job waits for another update or the two-minute timeout. Reproduced.
- **Unbounded deduplication sets:** provider `processedOrderIdsRef`, `soundedOrderIdsRef`, and `autoPrintedOrderIdsRef` retain successful IDs for the provider lifetime. They contain IDs rather than full receipt images, so their memory contribution is likely smaller; TTL eviction must preserve database claim/deduplication behavior.
- **History processing grows with recent throughput:** every job transition scans history, groups orders, and sorts groups; retention is time-based (30 minutes), without a count cap. This adds JS CPU and provider rendering under heavy throughput but does not explain unlimited growth by itself.
- **Native lock map:** Android's custom raw TCP map retains a mutex per unique endpoint. Fixed two-printer configurations keep this small; it is not a per-print image leak.
- **iOS, secondary to this configuration:** native `PrinterQueues.run` chains a task that only waits for the previous waiter, not the previous print work, so actor reentrancy allows overlapping sends. Connection callbacks/timeouts share unsynchronized settlement state, and state-handler captures may retain connections until cleared. These require separate native verification; no iOS runtime reproduction was performed.
- **Epson, secondary to this configuration:** the installed JS/native implementations cache printers per target, so `new Printer` per job does not create a new cached printer for a fixed target. Android `addImage` decodes/scales without explicit recycle, and connect happens outside our cleanup `try`. These are separate concerns, not the strongest explanation for the reported Sunmi/raw TCP setup.

## Verification and next repair sequence

Run from the repository root:

```sh
python3 tools/audits/native-tcp-lifecycle-repro.py
node tools/audits/printing-lifecycle-repro.cjs
```

Both passed on this checkout. The Java result is a source-extracted lifecycle reproduction; the Node result runs application TypeScript with mocked native I/O and an accelerated clock. Neither measures real Android memory nor actual printer output.

Repair order:

1. Eliminate the TCP text client/thread retention and add a genuine transport deadline.
2. Tie queue terminal state to transport cancellation; prevent expired jobs from dispatching later.
3. Capture immutable receipts under exclusive render ownership before enqueueing.
4. Add capture file ownership/release and reduce raster peak memory.
5. Bound remaining runtime history/deduplication and correct job/waiter transition defects.

Device acceptance should cover Sunmi + TCP and two TCP printers, both text and image modes. Sample native/Java memory, OS thread count, open file descriptors, receipt-cache count/bytes, queue length, in-flight age, and capture/send duration before printing, during repeated batches, and after idle. Exercise a printer that connects but stops reading, an early close, paper-out/disconnect, burst arrivals, multi-section receipts, and customer receipts queued behind slow work. Confirm threads/cache stop growing, deadlines release resources, timed-out jobs do not print later, and section/order content stays correct. A stable idle memory baseline after garbage collection is more informative than a temporary allocation peak.
