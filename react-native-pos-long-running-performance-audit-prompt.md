# React Native POS --- Deep Long-Running Performance & Stability Audit

I need you to perform a **deep production-level audit of this entire
React Native POS application**.

## Problem

The application initially runs fast and smoothly, but after being left
running and actively used for a long period --- typically several hours
--- it becomes progressively:

-   Slow
-   Laggy
-   Less responsive
-   Slow when navigating
-   Slow when pressing buttons
-   Slow when updating orders/cart
-   Potentially slow around printing and database operations

Restarting the application generally restores performance.

Do **NOT** assume this is a memory leak.

Memory usage does not currently show an obvious conventional memory
leak. I want you to investigate **every plausible cause of performance
degradation over long-running sessions**.

This is a production POS application, so it may remain open for **8--16+
hours continuously** and process hundreds or thousands of operations.

------------------------------------------------------------------------

## Architecture Context

The application uses technologies/features including:

-   React Native
-   Supabase
-   Supabase Realtime
-   Database queries/mutations
-   Large in-memory application cache
-   Product/catalog cache
-   Orders
-   Cart
-   Customers
-   Printing
-   Native printer integration/modules
-   Android
-   Long-running POS sessions
-   Background/foreground transitions
-   Network reconnection
-   Realtime database updates

The architecture intentionally keeps much of the required POS data
**pre-cached in memory after login** so normal POS operations can be
extremely fast.

Cache invalidation/refresh may happen through:

1.  Manual refresh
2.  Supabase realtime events
3.  Database mutations
4.  Login/application initialization

Do NOT simply recommend removing the cache. Determine whether its
**implementation or update strategy** is causing degradation.

------------------------------------------------------------------------

# Your Mission

Inspect the **entire repository**, not only the obvious POS screen.

Trace the application lifecycle from:

``` text
App startup
    ↓
Authentication
    ↓
Data preload/cache creation
    ↓
POS screen
    ↓
Order creation
    ↓
Order modification
    ↓
Database writes
    ↓
Printing
    ↓
Realtime events
    ↓
Cache updates
    ↓
Navigation
    ↓
Background/foreground
    ↓
Network disconnect/reconnect
    ↓
Long-running operation
```

Look for anything whose cost, count, queue size, subscription count,
state size, render count or retained resources can **increase over
time**.

------------------------------------------------------------------------

# 1. React Lifecycle / useEffect Audit

Inspect EVERY:

-   `useEffect`
-   `useLayoutEffect`
-   custom hook
-   component mount/unmount lifecycle

Look specifically for effects that:

-   execute more often than intended
-   have incorrect dependencies
-   recreate subscriptions
-   recreate timers
-   recreate event listeners
-   trigger state updates that retrigger themselves
-   perform expensive work unnecessarily
-   don't clean up resources
-   create closures retaining large objects

For every suspicious effect, trace exactly:

``` text
What causes it to execute?
How frequently can it execute?
What does it create?
What cleans it up?
Can multiple copies coexist?
What happens after 8 hours?
```

------------------------------------------------------------------------

# 2. Supabase Realtime Audit --- HIGH PRIORITY

Find EVERY Supabase realtime subscription/channel.

Check for:

-   duplicate subscriptions
-   channels created repeatedly
-   missing `removeChannel()`
-   missing unsubscribe
-   reconnect creating additional listeners
-   login creating duplicates
-   navigation creating duplicates
-   foreground/background creating duplicates
-   network reconnect creating duplicates
-   stale subscriptions surviving screen changes
-   multiple components subscribing to the same data
-   subscription callbacks causing unnecessary queries
-   subscription callbacks rebuilding the entire cache
-   realtime event loops

Trace channel lifecycle:

``` text
create
→ subscribe
→ receive event
→ update state/cache
→ cleanup
```

Determine whether one database event could eventually trigger the same
callback multiple times.

Add diagnostics if necessary so we can see:

``` text
active channel count
channel names
subscription creation count
subscription destruction count
events received/minute
callbacks/event
```

There should never silently be 20 listeners when architecture expects 1.

------------------------------------------------------------------------

# 3. Timer Audit

Search the entire repository for:

-   `setInterval`
-   `setTimeout`
-   `requestAnimationFrame`
-   polling
-   retry loops
-   debounce
-   throttle
-   background timers

Verify all timers are correctly cancelled.

Look for timer multiplication caused by:

-   component remount
-   navigation
-   login
-   reconnect
-   foreground/background
-   error retry

Determine whether timer count can increase over time.

------------------------------------------------------------------------

# 4. Event Listener Audit

Find EVERY event listener including:

-   `AppState`
-   `NetInfo`
-   keyboard
-   Dimensions
-   navigation
-   device events
-   native event emitters
-   printer events
-   websocket events
-   custom EventEmitter
-   Supabase events

For every:

``` js
addEventListener(...)
```

find and verify the corresponding cleanup.

Look for anonymous callbacks that cannot be correctly removed.

------------------------------------------------------------------------

# 5. React Re-render Audit --- HIGH PRIORITY

Find unnecessary component renders.

Pay particular attention to:

-   POS screen
-   product grid
-   product buttons
-   categories
-   cart
-   cart rows
-   order totals
-   customer UI
-   navigation
-   modals

Investigate:

-   Context providers
-   Redux/Zustand/etc. selectors
-   global stores
-   unstable object references
-   unstable array references
-   inline objects
-   inline callbacks
-   incorrect selectors
-   broad subscriptions to global state
-   state stored too high in component hierarchy

Determine whether changing one small property causes hundreds/thousands
of components to rerender.

Example:

``` text
cart quantity changes
        ↓
global POS state changes
        ↓
entire POS tree rerenders
        ↓
1,000 product buttons rerender
```

Identify this even if individual renders appear inexpensive.

------------------------------------------------------------------------

# 6. State Growth Audit

Find every array/map/object that can grow during the application's
lifetime.

Examples:

-   orders
-   completed orders
-   logs
-   events
-   notifications
-   print jobs
-   failed requests
-   pending requests
-   product changes
-   realtime events
-   transaction history
-   navigation history
-   search history
-   cached API responses

Look for patterns such as:

``` js
setSomething(prev => [...prev, item])
```

Determine whether data is ever removed.

For each potentially unbounded structure estimate:

``` text
startup size
1 hour
8 hours
16 hours
```

Do not only consider memory.

Also consider the increasing CPU cost of:

``` js
map()
filter()
find()
reduce()
sort()
JSON.stringify()
JSON.parse()
```

against growing collections.

------------------------------------------------------------------------

# 7. In-Memory Cache Audit --- HIGH PRIORITY

Review the entire caching architecture.

Determine:

-   how cache is initialized
-   cache size
-   cache structure
-   how entries are accessed
-   how cache is updated
-   how cache invalidation works
-   whether updates clone large objects
-   whether entire collections are rebuilt for tiny changes
-   whether old versions remain referenced
-   whether indexes/maps are rebuilt unnecessarily

Look especially for:

``` js
{
   ...hugeCache,
   products: [...products]
}
```

being executed frequently.

Prefer targeted updates where appropriate.

Check whether realtime updates cause full cache rebuilds.

------------------------------------------------------------------------

# 8. Async Operation / Promise Audit

Find operations that can overlap or accumulate.

Examples:

``` text
database requests
order saving
printing
cache refresh
realtime refresh
network retry
printer status
authentication refresh
```

Look for:

-   unresolved promises
-   promises stored indefinitely
-   fire-and-forget operations
-   operations started faster than they finish
-   recursive retries
-   retry storms
-   duplicated requests
-   race conditions

Consider:

``` text
operation duration = 2 seconds
new operation every 1 second
```

This creates an ever-growing queue even without a traditional memory
leak.

------------------------------------------------------------------------

# 9. Database / Supabase Query Audit

Find queries whose performance can deteriorate during a session.

Look for:

-   repeated identical queries
-   N+1 queries
-   unnecessary refreshes
-   realtime callback → database query patterns
-   full-table queries
-   missing limits
-   growing local datasets
-   excessive transformations after queries
-   serial queries that could safely execute concurrently

Trace critical operations such as:

``` text
create order
save order
update order
checkout
payment
print
product refresh
```

Measure how many database calls each operation causes.

------------------------------------------------------------------------

# 10. Printing Audit --- EXTREMELY IMPORTANT

Perform a deep audit of the entire printing pipeline.

Find:

-   receipt generation
-   image conversion
-   bitmap generation
-   base64
-   ESC/POS generation
-   native printer calls
-   printer queues
-   retries
-   printer status polling
-   callbacks
-   promises

Check whether large print buffers are retained.

Look for:

``` text
JS
→ bridge
→ native
→ printer
```

Determine whether print jobs can accumulate.

Check whether callbacks/listeners are released after printing.

Check for repeated native module registrations.

Check whether large byte arrays/base64 strings remain referenced.

Check whether failed print operations remain in a queue.

Instrument:

``` text
print jobs created
print jobs completed
print jobs failed
current queue length
average job size
largest job size
average print duration
pending native callbacks
```

------------------------------------------------------------------------

# 11. JS Thread Blocking

Identify expensive synchronous work occurring on the JS thread.

Search for:

-   large loops
-   large JSON parsing
-   JSON serialization
-   sorting
-   filtering
-   receipt generation
-   image processing
-   base64
-   data transformations
-   expensive selectors
-   synchronous storage operations

Look for operations whose execution time increases as application state
grows.

------------------------------------------------------------------------

# 12. Native / React Native Bridge

Inspect custom native modules.

Look for:

-   retained callbacks
-   retained promises
-   event emitters
-   large bridge payloads
-   repeated module initialization
-   listener accumulation
-   native queues
-   resources not released
-   bitmap retention
-   byte buffer retention

Do not restrict analysis to JavaScript.

Inspect Kotlin/Java/Swift/Objective-C code where applicable.

------------------------------------------------------------------------

# 13. Logging

Audit logging.

Look for excessive:

``` js
console.log()
console.debug()
JSON.stringify(largeObject)
```

Especially inside:

-   render functions
-   realtime callbacks
-   loops
-   database responses
-   print operations

Determine whether development/debug logging could significantly degrade
long-running performance.

------------------------------------------------------------------------

# 14. Navigation

Check whether navigation leaves screens mounted unexpectedly.

Determine whether repeated navigation creates:

``` text
POS
POS
POS
POS
```

instances instead of replacing/reusing screens.

Check modal lifecycle as well.

Look for hidden components that remain subscribed to global state.

------------------------------------------------------------------------

# 15. Background / Foreground Lifecycle

Simulate:

``` text
launch
→ use POS
→ background
→ foreground
→ background
→ foreground
```

Check whether each foreground event creates new:

-   subscriptions
-   timers
-   network listeners
-   printer listeners
-   refresh operations
-   caches

This application may experience many such transitions every day.

------------------------------------------------------------------------

# 16. Network Reconnection

Simulate unstable connectivity.

Check:

``` text
WiFi disconnect
→ reconnect
→ disconnect
→ reconnect
```

Determine whether Supabase/WebSocket/network infrastructure duplicates:

-   connections
-   subscriptions
-   retries
-   requests
-   callbacks

Look specifically for exponential retry/reconnection behavior.

------------------------------------------------------------------------

# 17. Garbage Collection Pressure

Even if there is no memory leak, investigate excessive temporary
allocations.

Examples:

``` js
products.map(...)
products.filter(...)
[...largeArray]
{...largeObject}
JSON.parse(JSON.stringify(...))
large base64 strings
```

Frequent allocation of large temporary structures can trigger constant
garbage collection and make React Native appear progressively sluggish.

------------------------------------------------------------------------

# 18. Object Reference / Closure Retention

Look for closures retaining:

-   entire product catalogs
-   orders
-   images
-   print buffers
-   database responses
-   React component state

Pay attention to callbacks stored in:

-   event emitters
-   subscriptions
-   timers
-   promises
-   global stores

------------------------------------------------------------------------

# 19. Add Performance Instrumentation

Where useful, implement a development-only diagnostics system.

I want to be able to observe something similar to:

``` text
POS PERFORMANCE

Uptime:                   08:42:17

JS Heap:                  182 MB
Native Memory:            490 MB

Active Supabase Channels: 3
Realtime Events/min:      12

Active Timers:            5
Active Event Listeners:   14

Pending Requests:         0
Pending Promises:         2

Print Queue:              0
Print Jobs Total:         143

Orders Cached:            218
Products Cached:          1842

JS FPS:                   59
UI FPS:                   60

Renders/min:
POSScreen                 2
ProductGrid               3
ProductButton             118
Cart                      14
CartRow                   43
```

Compare:

``` text
Fresh launch
30 minutes
2 hours
4 hours
8 hours
```

The diagnostics themselves must have minimal performance overhead.

------------------------------------------------------------------------

# 20. Instrument Critical Operation Timing

Add development instrumentation around critical workflows.

For example:

``` text
ADD PRODUCT

state update:       3ms
price calculation:  1ms
React render:      12ms
DB operation:       0ms

TOTAL:             16ms
```

And:

``` text
CHECKOUT

order generation:    8ms
database write:     82ms
receipt generation: 21ms
native print call:  14ms

TOTAL:             125ms
```

This will allow us to compare fresh-session performance against an
8-hour session.

------------------------------------------------------------------------

# 21. Look for Compound Problems

Do not search only for one catastrophic bug.

Long-running degradation may result from several small problems:

``` text
2 duplicate realtime subscriptions
+
growing order cache
+
unnecessary product-grid rerenders
+
print callback accumulation
+
GC pressure
=
POS unusable after 8 hours
```

Identify interactions between problems.

------------------------------------------------------------------------

# Required Audit Method

Do NOT start changing random code immediately.

First:

1.  Map the architecture.
2.  Identify application lifecycle.
3.  Locate global stores/caches.
4.  Locate all realtime subscriptions.
5.  Locate all timers.
6.  Locate all event listeners.
7.  Locate printing/native modules.
8.  Locate database access.
9.  Locate expensive React components.
10. Locate potentially unbounded data structures.

Then build hypotheses.

For every issue report:

``` text
FILE:
LINE/FUNCTION:

SEVERITY:
Critical / High / Medium / Low

CATEGORY:
Realtime / React Render / Cache / Timer / Native / Printing / DB / Async / etc.

PROBLEM:

WHY IT CAN DEGRADE OVER TIME:

EVIDENCE FROM CODE:

HOW TO REPRODUCE/CONFIRM:

RECOMMENDED FIX:

RISK OF FIX:

TEST REQUIRED:
```

Do not label something a bug merely because it looks unusual. Explain
the mechanism by which it could cause long-running degradation.

------------------------------------------------------------------------

# Priority Classification

## P0 --- Critical

Can directly explain severe degradation, data corruption, crashes,
duplicated transactions or duplicated printing.

## P1 --- High

Strong candidate for progressive performance degradation.

## P2 --- Medium

Performance problem but unlikely to independently explain the entire
issue.

## P3 --- Optimization

Useful improvement but not likely root cause.

Do NOT waste time optimizing P3 issues while P0/P1 issues remain.

------------------------------------------------------------------------

# Important: Do Not Break POS Behaviour

This is a production POS application.

Performance changes MUST NOT break:

-   order creation
-   order saving
-   order editing
-   checkout
-   payment
-   printing
-   product/catalog refresh
-   realtime synchronization
-   offline/reconnect behaviour

Do not make large architectural rewrites unless there is strong evidence
they are required.

Prefer targeted, measurable fixes.

------------------------------------------------------------------------

# Final Deliverables

## A. Executive Summary

Explain the most likely reasons the application becomes slower over
time.

## B. Architecture Map

Show the important runtime components and data flow.

## C. Findings

List every confirmed or strongly suspected problem, grouped by
P0/P1/P2/P3.

## D. Top Root-Cause Candidates

Identify the strongest candidates, but base this ranking on code
evidence rather than assumptions.

## E. Instrumentation Added

Explain what measurements were added and how to use them.

## F. Reproduction Plan

Create a practical long-running stress test covering:

``` text
500+ orders
1000+ cart modifications
200+ print jobs
network disconnect/reconnect
background/foreground cycles
Supabase reconnects
navigation cycles
manual refreshes
```

## G. Fix Plan

Provide a staged fix plan so we can fix one category at a time and
measure whether degradation disappears.

## H. Verification

For every implemented fix, verify:

``` text
Before
vs
After
```

using measurable performance data.

------------------------------------------------------------------------

# Most Important Instruction

Do not give me generic React Native performance advice.

**Inspect the actual repository and trace the actual code paths.**

I want evidence such as:

> `useRealtimeOrders()` creates a Supabase channel whenever X changes,
> but cleanup only occurs on component unmount. X changes repeatedly
> during normal POS operation, allowing subscriptions to accumulate.

rather than:

> "Make sure subscriptions are cleaned up."

Search broadly first, trace the relationships between modules, and only
then propose or implement fixes.

The goal is to determine **what becomes progressively more expensive as
this POS remains alive for many hours**, prove it with instrumentation
where possible, and fix the root causes without changing existing POS
functionality.
