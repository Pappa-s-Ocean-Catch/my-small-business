# Print Debug Footer Design

## Goal

Make duplicate POS kitchen tickets diagnosable from the printed paper without changing print behavior.

## Settings

Add a register name field and a Print debug footer toggle. The toggle is off by default. The register name is device-local POS configuration.

## Footer

When enabled, every kitchen ticket includes a compact diagnostic footer:

- Register name and shortened stable device ID.
- Current POS session ID.
- Print trigger: realtime insert/status update, scheduled scan, retry, or manual reprint.
- Actual routing decision for that ticket: route/section label, assigned printer name/target, and separate or combined ticket mode.
- Effective number of copies for that print job.
- Auto-print enabled state and delay.
- Printed timestamp.

The values reflect the job actually queued, so two POS devices can compare their settings for the same ticket.

## Scope

Applies to kitchen tickets only. Customer receipts do not include diagnostics. The feature only displays debug context; it does not modify claim, routing, copies, or retry logic.

