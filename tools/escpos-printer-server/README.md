# ESC/POS Printer Server

Local TCP ESC/POS simulator for testing receipt printers without physical hardware.

It listens like a network thermal printer on port `9100` by default, accepts raw TCP print jobs, parses common ESC/POS commands, and writes each print job to:

- `.svg` receipt preview
- `.json` metadata with unsupported commands and captured structure

## What it is good for

- Testing raw TCP printer integration against `ip:9100`
- Verifying receipt text layout
- Inspecting common ESC/POS command sequences
- Capturing raster image print jobs that use `GS v 0`

## What it does not guarantee

This is not a perfect hardware emulator.

It currently aims to support the common commands most apps send:

- text bytes
- `ESC @` reset
- `ESC a` alignment
- `ESC E` bold
- `ESC M` font select
- `ESC d` feed lines
- `GS !` text scaling
- `GS V` cut
- `GS v 0` raster bit image

Anything unsupported is logged into the generated `.json` file so we can extend the parser as needed.

## Run

From repo root:

```bash
pnpm escpos-sim
```

Or directly:

```bash
pnpm --dir tools/escpos-printer-server start
```

## Config

Environment variables:

```bash
ESCPOS_SIM_HOST=0.0.0.0
ESCPOS_SIM_PORT=9100
ESCPOS_SIM_OUTPUT_DIR=./tools/escpos-printer-server/output
ESCPOS_SIM_PAPER_WIDTH=80mm
```

Example:

```bash
ESCPOS_SIM_PORT=9100 pnpm escpos-sim
```

Paper width options:

- `80mm` default, renders at `576` dots wide
- `58mm`, renders at `384` dots wide

Example with 58mm:

```bash
ESCPOS_SIM_PAPER_WIDTH=58mm pnpm escpos-sim
```

## Test commands

With the simulator running, you can send built-in sample jobs:

```bash
pnpm --dir tools/escpos-printer-server test:basic
pnpm --dir tools/escpos-printer-server test:kitchen
pnpm --dir tools/escpos-printer-server test:alignment
```

Override host or port when needed:

```bash
ESCPOS_SIM_HOST=192.168.1.50 ESCPOS_SIM_PORT=9100 pnpm --dir tools/escpos-printer-server test:basic
```

## Use from the POS app

On the same network, add a manual printer using:

- IP: your computer's LAN IP
- Port: `9100`

If you are testing on the same machine with another client, point it to:

- `127.0.0.1:9100`

## Output

Generated files are written under:

```text
tools/escpos-printer-server/output
```

Each print job creates:

- `*.svg`
- `*.json`

The SVG is the printable visual output.
The JSON helps debug unsupported ESC/POS commands and payload details.
