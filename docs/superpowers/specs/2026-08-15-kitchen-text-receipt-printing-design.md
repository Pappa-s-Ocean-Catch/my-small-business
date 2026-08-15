# Kitchen Text Receipt Printing Design

## Goal

Improve kitchen/order receipt print time by allowing full receipts to be sent as ESC/POS text rather than captured images, while preserving the existing image path as a setting-controlled fallback.

## Scope

- Add one global kitchen receipt print-mode setting: `text` or `image`.
- Default the setting to `text`.
- Apply the setting to every full kitchen/order receipt session: manual printing, automatic printing, and section-routed printing.
- Keep customer receipts image-only. Their QR code and existing visual styling must remain unchanged.
- Reproduce the information hierarchy of `ReceiptTemplate` in the text output as closely as ESC/POS capabilities allow.

## Architecture

### Settings

`AppSettings` gains a `printerReceiptMode` field with the values `text` and `image`. Settings migration/normalization treats missing or invalid values as `text`. The Print behavior panel exposes a two-option selector. The setting is read immediately before a print session is prepared, so changing it affects subsequent manual and auto print sessions without changing existing customer receipt behavior.

### Text receipt builder

A pure receipt-document builder converts an `Order` plus the same print options currently accepted by `ReceiptTemplate` into an `EscPosDocument`. It reuses the existing receipt utilities for headers, promotions, item grouping, totals, section copies, and debug lines. It emits structured ESC/POS nodes for alignment, emphasis, separators, and feeds, with width-aware wrapping for 58 mm and 80 mm paper.

The text receipt contains the same meaningful content as the image template:

- marketplace/header label, ticket counter, preorder banner, date, and payment method;
- customer identity, delivery fields, order notes, and order options;
- section headings, item quantities/prices, free-item treatment, removed ingredients, add-ons, and item notes;
- totals, payment status, order number, footer, and optional debug footer.

Images and colour-only treatments are represented with text emphasis and labels rather than raster graphics. Marketplace logos are represented by their header label.

### Print pipeline

Kitchen/order print preparation branches on `printerReceiptMode`:

1. `text`: build the receipt document and enqueue/send it through the existing document/ESC-POS transport. No receipt view is mounted or captured.
2. `image`: keep the current off-screen `ReceiptTemplate` capture and image print dispatch unchanged.

The queue supports either a document or an image payload and dispatches to the corresponding printer method. A physical-printer capability check applies to text documents; simulator sessions continue using image capture because the simulator previews images.

Customer-receipt preparation always stays on the current image capture and image dispatch path, independent of `printerReceiptMode`.

## Error Handling

- A missing/invalid print mode resolves to `text` so stored older settings remain printable.
- Text documents sent to a simulator fail with a clear capability error or fall back to the existing image path for simulator preview; the selected behaviour is logged.
- Existing queue, transport, toast, and journal error handling remains in place for both payload types.
- An image-mode failure retains existing errors and performance logging without invoking the text builder.

## Testing

- Unit-test settings defaults and normalization for both modes.
- Unit-test text receipt documents for representative order details, sections, delivery data, totals, preorder text, and debug footer.
- Unit-test routing/queue dispatch selects document printing for text mode and image printing for image mode.
- Test that customer receipts remain image-only regardless of the kitchen print-mode setting.
- Run the order-management test suite and TypeScript validation relevant to the changed modules.

## Out of Scope

- Changing customer receipt appearance or QR-code printing.
- Per-printer or per-section receipt rendering modes.
- Replacing or removing the existing image-print path.
- Adding graphical logos or QR codes to text receipts.
