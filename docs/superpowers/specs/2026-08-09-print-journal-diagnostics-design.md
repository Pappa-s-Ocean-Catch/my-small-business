# Print Journal Diagnostics Design

Print journal completion and failure entries will report driver, effective transport, queue wait, capture/preparation, send, and end-to-end durations. Raw TCP entries distinguish native-enabled, native diagnostic with JS fallback, JS-only, and unavailable-native fallback. Epson and simulator entries retain their explicit driver labels. Native raw-TCP timing metadata is returned to the queue layer instead of being console-only. All changes stay uncommitted.
