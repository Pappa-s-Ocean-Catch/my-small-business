# Report POS Printing Design

## Goal

Let a user print the currently selected Daily, Weekly, or Monthly sales report to a saved POS printer. Every print starts by asking the user to select a printer. The saved Print Simulator is a normal choice and opens the generated receipt image in the existing simulator.

## Scope

This change adds report printing only. It does not change the reporting calculations, save a preferred report printer, add comparison-period data to the printout, or print charts.

## User flow

1. The user chooses a report period on the Report screen and taps **Print report**.
2. The app displays the saved-printer picker every time. If there are no saved printers, it explains that a printer must be added in Settings.
3. The user selects one printer.
4. The app renders a dedicated report receipt at POS width, captures it with the existing view-shot image helper, and routes the image to the selected printer.
5. A simulator selection opens the existing Print Simulator modal with the same captured report image. A physical printer uses the existing `escposPrintOrderImage` transport, including Epson and raw-TCP handling, paper width, queueing, and errors.

## Receipt template

The new `ReportPrintTemplate` is a hidden, capture-only React Native view sized for 80 mm thermal paper. It is always captured at 576 dots for this report type, regardless of the configurable kitchen-receipt paper setting. It contains no chart and no comparison metrics.

Sections appear in this order:

- Store/report header: store name when available, `Sales Report`, report type, selected date/range, and generated timestamp.
- Summary: gross sales, paid orders, average order, and discounts.
- Gross sales by date: only on Weekly and Monthly reports; one line per date with sales total.
- Payment method: payment label, order count, and sales total.
- Channel: channel label, order count, and sales total.
- Channel financials: per channel gross sales, gross payout, commission, and net sales, preserving `N/A` where the current report does.
- Footer and receipt dividers.

Amounts use the existing Australian-dollar formatting and source data uses the current selected-period calculations only.

## Architecture

- Extract selected-period report snapshot data into a small, testable report-print model builder shared by the Report screen and receipt template.
- `ReportPrintTemplate` consumes only that model and renders the fixed receipt layout.
- The Report screen holds the template ref off-screen. After the printer choice it calls the existing printer-image capture helper at 576 dots, retaining the configured high-quality capture setting.
- For simulator selection, keep the preview URI in Report screen state and pass it to `PrintSimulatorModal`. The modal will support a report title/subtitle without requiring an `Order`.
- For physical printers, call the existing `escposPrintOrderImage` with one copy and the 576-dot 80 mm image width. No parallel printer routing or setting mutation is required.

## Error handling

- The print action is disabled while the report is loading or a report print is in progress.
- If no saved printers exist, do not open an empty picker; show an actionable message.
- Capture, connection, and transport failures display the existing formatted printer error and leave the report usable.
- A failed simulator capture also displays an error rather than opening an empty preview.

## Verification

Tests cover the report print model for Daily, Weekly, and Monthly snapshots, including absence of comparison data and date rows on Daily. They also cover printer-choice behavior, simulator recognition, and the physical-printer call contract. Type-checking and affected tests must pass.
