# Daily report current-time marker

Today's daily sales comparison chart shows a vertical dashed line and a Now/time label in Melbourne time. The position interpolates between half-hour buckets, updates every minute and refreshes when the app returns to the foreground. It does not refetch sales data or intercept chart touches. Historical/non-daily reports and times outside the plotted 10:00–21:00 range omit the marker.

Automated coverage verifies 4pm and fractional positions, first/last plotted times, summer/winter timezone offsets, historical reports, narrow/wide chart geometry and retained chart interactions. Full unit suite: 447 tests passed. Typecheck retains 13 existing QR/caller-ID errors; no report-related errors. Device visual validation remains outstanding. No live transactions were modified.
