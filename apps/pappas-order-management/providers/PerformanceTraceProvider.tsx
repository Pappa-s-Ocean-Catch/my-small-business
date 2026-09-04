import { useEffect, type PropsWithChildren } from 'react';

import { formatPerformanceDuration, getTimerDelayMs, isSlowOperation } from '@/lib/performance-trace';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';

const EVENT_LOOP_SAMPLE_MS = 1_000;
const EVENT_LOOP_SLOW_MS = 250;
const EVENT_LOOP_LOG_COOLDOWN_MS = 10_000;

/**
 * Records only meaningful JavaScript timer stalls in the existing local Journal.
 * This is intentionally device-local and does not make any network or database calls.
 */
export function PerformanceTraceProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    let expectedAtMs = Date.now() + EVENT_LOOP_SAMPLE_MS;
    let lastLoggedAtMs = 0;

    const intervalId = setInterval(() => {
      const actualAtMs = Date.now();
      const delayMs = getTimerDelayMs(expectedAtMs, actualAtMs);
      expectedAtMs = actualAtMs + EVENT_LOOP_SAMPLE_MS;

      if (!isSlowOperation(delayMs, EVENT_LOOP_SLOW_MS)) return;
      if (actualAtMs - lastLoggedAtMs < EVENT_LOOP_LOG_COOLDOWN_MS) return;

      lastLoggedAtMs = actualAtMs;
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'decision',
        scope: 'performance',
        message: 'JavaScript event loop stalled',
        details: `timerDelay=${formatPerformanceDuration(delayMs)} threshold=${EVENT_LOOP_SLOW_MS}ms`,
      });
    }, EVENT_LOOP_SAMPLE_MS);

    return () => clearInterval(intervalId);
  }, []);

  return children;
}
