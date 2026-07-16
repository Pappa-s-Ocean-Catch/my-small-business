# `@my-small-business/escpos-printer`

Shared ESC/POS printer library for the monorepo.

Current scope:
- Raw TCP transport for LAN printers
- ESC/POS byte helpers for styled text, feed, cut, raw bytes, and raster image nodes
- Network discovery by IP scan + TCP probe on port `9100`
- Small, testable API surface intended to become the common printer facade

Not included yet:
- React Native bindings
- Epson SDK adapter
- PNG decoding / capture integration
- Bluetooth discovery / pairing
- Vendor-specific status polling

## Why this package exists

The app currently mixes:
- printer selection and routing
- raw TCP networking
- ESC/POS command generation
- Epson SDK integration
- React Native capture / image conversion

This package is the first extraction step so printer logic can move behind a stable interface before the app is migrated.

## Design goals

1. Raw TCP is the primary LAN transport.
2. Discovery is implementation-agnostic and testable.
3. The public API is small and explicit.
4. Future drivers such as Epson SDK can be added behind the same facade.

## Public API

### Create a client

```ts
import { createEscPosPrinterClient } from "@my-small-business/escpos-printer";

const client = createEscPosPrinterClient();
```

### Probe a single printer

```ts
const result = await client.probe({
  host: "192.168.0.208",
  port: 9100,
});
```

### Scan a subnet

```ts
const printers = await client.discoverNetworkPrinters({
  subnet: "192.168.0",
  hostRange: { start: 1, end: 254 },
  port: 9100,
  concurrency: 32,
  timeoutMs: 400,
});
```

### Print text

```ts
await client.printText({
  host: "192.168.0.208",
  port: 9100,
  lines: ["TEST PRINT", "Hello world"],
  cut: true,
  style: {
    align: "center",
    bold: true,
    widthScale: 2,
    heightScale: 2
  }
});
```

### Print a rich document

```ts
import {
  buildCutNode,
  buildFeedNode,
  buildImageNode,
  buildTextNode,
} from "@my-small-business/escpos-printer";

await client.printDocument({
  host: "192.168.0.208",
  document: {
    initialize: true,
    nodes: [
      buildTextNode("KITCHEN COPY", {
        align: "center",
        bold: true,
        widthScale: 2,
        heightScale: 2,
      }),
      buildFeedNode(1),
      buildTextNode("2x Fish Burger", {
        bold: true,
        font: "B",
      }),
      buildTextNode("NO PICKLES"),
      buildImageNode({
        kind: "raster",
        width: 384,
        height: 80,
        data: rgbaBytes,
        align: "center",
      }),
      buildFeedNode(3),
      buildCutNode(),
    ],
  },
});
```

### Use a fluent session

```ts
const session = client.openSession({
  host: "192.168.0.208",
  port: 9100,
});

await session
  .addLine("KITCHEN COPY", {
    align: "center",
    bold: true,
    widthScale: 2,
    heightScale: 2,
  })
  .addFeed(1)
  .addLine("2x Fish Burger", { bold: true, font: "B" })
  .addText("NO PICKLES")
  .addFeed(2)
  .addCut()
  .close();
```

The fluent session is useful when:
- callers want to print incrementally without hand-building a document object
- a wrapper API wants a chainable builder
- you want `addText`, `addImage`, `cut`, then `close`

Current session behavior:
- commands are buffered locally
- `print()` sends the current buffer
- `close()` sends the current buffer and clears the session
- this is a logical print session, not a permanently open TCP socket

### Supported document nodes

- `text`
- `feed`
- `cut`
- `image`
- `raw`

### Fluent session methods

- `addText(text, style?, { newline? })`
- `addLine(text, style?)`
- `addFeed(lines?)`
- `addCut(partial?)`
- `addImage(image)`
- `addRaw(data)`
- `reset()`
- `toDocument()`
- `toBytes()`
- `print()`
- `close()`

### Supported style options

- `align`
- `bold`
- `underline`
- `invert`
- `font`
- `widthScale`
- `heightScale`

### Print raw bytes

```ts
await client.printBytes({
  host: "192.168.0.208",
  port: 9100,
  data: new Uint8Array([0x1b, 0x40]),
});
```

## Suggested migration path

1. Keep the existing app code unchanged.
2. Migrate raw TCP text test print to this package.
3. Migrate raw TCP image print encoding into this package.
4. Add an Epson adapter package or submodule when ready.
5. Move app printer routing to depend only on this facade.

## Commands

```bash
pnpm --filter @my-small-business/escpos-printer type-check
pnpm --filter @my-small-business/escpos-printer test
pnpm --filter @my-small-business/escpos-printer build
```
