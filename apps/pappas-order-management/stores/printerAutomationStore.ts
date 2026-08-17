import { create } from 'zustand';
import type { Order } from '@my-small-business/types';
import type { SavedPrinter } from '@/lib/escpos-printer';
import type { PrinterImageSource } from '@/lib/printer-image';
import type { EscPosDocument } from '@/lib/instore-instant-ticket';
import { JOURNAL_LOGS_ENABLED } from '@/lib/journal-config';
import { selectReadyPrintJobIds } from '@/lib/print-job-priority';

export type JournalLevel = 'info' | 'decision' | 'success' | 'error';
export type PrintJobStatus = 'queued' | 'printing' | 'success' | 'failed';
export type PrintJobSource = 'manual' | 'auto' | 'customer-copy' | 'test';

export type JournalEntry = {
  id: string;
  timestamp: number;
  level: JournalLevel;
  scope: string;
  message: string;
  orderId?: string | null;
  orderNumber?: string | null;
  details?: string | null;
};

export type PrintJob = {
  id: string;
  createdAt: number;
  updatedAt: number;
  orderId: string | null;
  orderNumber: string | null;
  source: PrintJobSource;
  priority: 'normal' | 'customer-receipt';
  scope: string;
  label: string;
  printer: SavedPrinter;
  image: PrinterImageSource | null;
  document: EscPosDocument | null;
  copies: number;
  width: number;
  status: PrintJobStatus;
  attemptCount: number;
  startedAt?: number | null;
  completedAt?: number | null;
  error?: string | null;
  silentSuccess?: boolean;
};

export type OrderPrintState = {
  orderId: string;
  orderNumber: string | null;
  status: 'queued' | 'printing' | 'success' | 'failed';
  source: PrintJobSource;
  label: string;
  updatedAt: number;
  jobIds: string[];
  error?: string | null;
};

const LOG_RETENTION_MS = 30 * 60 * 1000;
const ACTIVE_JOB_STALE_MS = 10 * 60 * 1000;

function buildId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripCompletedJobPayload(job: PrintJob): PrintJob {
  if (job.status === 'queued' || job.status === 'printing') return job;
  if (job.image == null && job.document == null) return job;
  return {
    ...job,
    image: null,
    document: null,
  };
}

function normalizeJobsForRetention(jobs: PrintJob[], now: number): PrintJob[] {
  return jobs.map((job) => {
    if ((job.status === 'queued' || job.status === 'printing') && now - job.updatedAt > ACTIVE_JOB_STALE_MS) {
      return stripCompletedJobPayload({
        ...job,
        status: 'failed',
        updatedAt: now,
        completedAt: now,
        error: job.error || 'Print job timed out before completion',
      });
    }

    return stripCompletedJobPayload(job);
  });
}

function pruneJobs(jobs: PrintJob[], now: number): PrintJob[] {
  return normalizeJobsForRetention(jobs, now).filter((job) => {
    if (job.status === 'queued' || job.status === 'printing') return true;
    return now - job.updatedAt <= LOG_RETENTION_MS;
  });
}

function pruneJournalEntries(entries: JournalEntry[], now: number): JournalEntry[] {
  return entries.filter((entry) => now - entry.timestamp <= LOG_RETENTION_MS);
}

function deriveOrderPrintStates(jobs: PrintJob[], now: number): Record<string, OrderPrintState> {
  const activeJobs = jobs.filter((job) => job.orderId && (job.status === 'queued' || job.status === 'printing' || now - job.updatedAt <= LOG_RETENTION_MS));
  const grouped = new Map<string, PrintJob[]>();

  for (const job of activeJobs) {
    if (!job.orderId) continue;
    const current = grouped.get(job.orderId) || [];
    current.push(job);
    grouped.set(job.orderId, current);
  }

  const states: Record<string, OrderPrintState> = {};

  for (const [orderId, group] of grouped.entries()) {
    const sorted = [...group].sort((left, right) => right.updatedAt - left.updatedAt);
    const printingJob = sorted.find((job) => job.status === 'printing') || null;
    const queuedJob = sorted.find((job) => job.status === 'queued') || null;
    const failedJob = sorted.find((job) => job.status === 'failed') || null;
    const successJob = sorted.find((job) => job.status === 'success') || null;
    const sourceJob = printingJob || queuedJob || failedJob || successJob || sorted[0];

    if (!sourceJob) continue;

    const status = printingJob
      ? 'printing'
      : queuedJob
        ? 'queued'
        : failedJob
          ? 'failed'
          : 'success';

    states[orderId] = {
      orderId,
      orderNumber: sourceJob.orderNumber,
      status,
      source: sourceJob.source,
      label: sourceJob.label,
      updatedAt: (printingJob || queuedJob || failedJob || successJob || sourceJob).updatedAt,
      jobIds: sorted.map((job) => job.id),
      error: failedJob?.error ?? null,
    };
  }

  return states;
}

type PrinterAutomationState = {
  autoPrintToast: {
    visible: boolean;
    message: string;
    level: JournalLevel;
  };
  journalEntries: JournalEntry[];
  printJobs: PrintJob[];
  activePrintJobIdsByPrinter: Record<string, string>;
  orderPrintStates: Record<string, OrderPrintState>;
  preOrderSkipNotice: string | null;
  autoPrintSimulator: {
    visible: boolean;
    order: Order | null;
    imageUri: string | null;
    imageUris: string[];
    imageLabels: string[];
  };
  showToast: (message: string, level?: JournalLevel) => void;
  dismissToast: () => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  clearJournal: () => void;
  pruneRuntimeState: () => void;
  enqueuePrintJobs: (jobs: Array<Omit<PrintJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'attemptCount' | 'startedAt' | 'completedAt' | 'error' | 'priority'> & { priority?: PrintJob['priority'] }>) => PrintJob[];
  markPrintJobStarted: (jobId: string) => PrintJob | null;
  markPrintJobSucceeded: (jobId: string) => PrintJob | null;
  markPrintJobFailed: (jobId: string, error: string) => PrintJob | null;
  clearPrintHistory: () => void;
  setPreOrderSkipNotice: (message: string | null) => void;
  showAutoPrintSimulator: (payload: {
    order: Order;
    imageUri: string | null;
    imageUris?: string[] | null;
    imageLabels?: string[] | null;
  }) => void;
  dismissAutoPrintSimulator: () => void;
};

export const usePrinterAutomationStore = create<PrinterAutomationState>((set, get) => ({
  autoPrintToast: {
    visible: false,
    message: '',
    level: 'info',
  },
  journalEntries: [],
  printJobs: [],
  activePrintJobIdsByPrinter: {},
  orderPrintStates: {},
  preOrderSkipNotice: null,
  autoPrintSimulator: {
    visible: false,
    order: null,
    imageUri: null,
    imageUris: [],
    imageLabels: [],
  },
  showToast: (message, level = 'info') => set({
    autoPrintToast: {
      visible: true,
      message,
      level,
    },
  }),
  dismissToast: () => set((state) => ({
    autoPrintToast: {
      ...state.autoPrintToast,
      visible: false,
    },
  })),
  addJournalEntry: (entry) => set((state) => {
    if (!JOURNAL_LOGS_ENABLED) {
      return state;
    }
    const now = Date.now();
    const journalEntries = pruneJournalEntries([
      {
        id: buildId('journal'),
        timestamp: now,
        ...entry,
      },
      ...state.journalEntries,
    ], now);

    return {
      journalEntries,
    };
  }),
  clearJournal: () => set((state) => (
    JOURNAL_LOGS_ENABLED ? { journalEntries: [] } : state
  )),
  pruneRuntimeState: () => set((state) => {
    const now = Date.now();
    const printJobs = pruneJobs(state.printJobs, now);
    return {
      printJobs,
      journalEntries: JOURNAL_LOGS_ENABLED ? pruneJournalEntries(state.journalEntries, now) : [],
      orderPrintStates: deriveOrderPrintStates(printJobs, now),
    };
  }),
  enqueuePrintJobs: (jobs) => {
    const now = Date.now();
    const nextJobs: PrintJob[] = jobs.map((job) => ({
      ...job,
      priority: job.priority ?? 'normal',
      id: buildId('print-job'),
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      attemptCount: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    }));

    set((state) => {
      const printJobs = pruneJobs([...state.printJobs, ...nextJobs], now);
      return {
        printJobs,
        orderPrintStates: deriveOrderPrintStates(printJobs, now),
      };
    });

    return nextJobs;
  },
  markPrintJobStarted: (jobId) => {
    let startedJob: PrintJob | null = null;
    set((state) => {
      const now = Date.now();
      const targetJob = state.printJobs.find((job) => job.id === jobId) || null;
      if (!targetJob) {
        return state;
      }

      const printerTarget = targetJob.printer.target;
      if (state.printJobs.some((job) => (
        job.id !== jobId
        && job.printer.target === printerTarget
        && job.status === 'printing'
      ))) {
        return state;
      }

      const printJobs = pruneJobs(state.printJobs.map((job) => {
        if (job.id !== jobId) return job;
        startedJob = {
          ...job,
          status: 'printing',
          updatedAt: now,
          startedAt: now,
          attemptCount: job.attemptCount + 1,
          error: null,
        };
        return startedJob;
      }), now);

      return {
        printJobs,
        activePrintJobIdsByPrinter: startedJob
          ? {
              ...state.activePrintJobIdsByPrinter,
              [printerTarget]: jobId,
            }
          : state.activePrintJobIdsByPrinter,
        orderPrintStates: deriveOrderPrintStates(printJobs, now),
      };
    });
    return startedJob;
  },
  markPrintJobSucceeded: (jobId) => {
    let completedJob: PrintJob | null = null;
    set((state) => {
      const now = Date.now();
      const printJobs = pruneJobs(state.printJobs.map((job) => {
        if (job.id !== jobId) return job;
        completedJob = {
          ...job,
          status: 'success',
          updatedAt: now,
          completedAt: now,
          error: null,
        };
        return completedJob;
      }), now);

      return {
        printJobs,
        activePrintJobIdsByPrinter: completedJob
          ? Object.fromEntries(
              Object.entries(state.activePrintJobIdsByPrinter).filter(([, activeJobId]) => activeJobId !== jobId)
            )
          : state.activePrintJobIdsByPrinter,
        orderPrintStates: deriveOrderPrintStates(printJobs, now),
      };
    });
    return completedJob;
  },
  markPrintJobFailed: (jobId, error) => {
    let completedJob: PrintJob | null = null;
    set((state) => {
      const now = Date.now();
      const printJobs = pruneJobs(state.printJobs.map((job) => {
        if (job.id !== jobId) return job;
        completedJob = {
          ...job,
          status: 'failed',
          updatedAt: now,
          completedAt: now,
          error,
        };
        return completedJob;
      }), now);

      return {
        printJobs,
        activePrintJobIdsByPrinter: completedJob
          ? Object.fromEntries(
              Object.entries(state.activePrintJobIdsByPrinter).filter(([, activeJobId]) => activeJobId !== jobId)
            )
          : state.activePrintJobIdsByPrinter,
        orderPrintStates: deriveOrderPrintStates(printJobs, now),
      };
    });
    return completedJob;
  },
  clearPrintHistory: () => set({
    printJobs: [],
    activePrintJobIdsByPrinter: {},
    orderPrintStates: {},
  }),
  setPreOrderSkipNotice: (message) => set({ preOrderSkipNotice: message }),
  showAutoPrintSimulator: ({ order, imageUri, imageUris, imageLabels }) => set({
    autoPrintSimulator: {
      visible: true,
      order,
      imageUri,
      imageUris: imageUris || (imageUri ? [imageUri] : []),
      imageLabels: imageLabels || [],
    },
  }),
  dismissAutoPrintSimulator: () => set({
    autoPrintSimulator: {
      visible: false,
      order: null,
      imageUri: null,
      imageUris: [],
      imageLabels: [],
    },
  }),
}));

export function getPendingPrintJob(): PrintJob | null {
  const { printJobs } = usePrinterAutomationStore.getState();
  return printJobs.find((job) => job.status === 'queued') || null;
}

export function getReadyPendingPrintJobs(): PrintJob[] {
  const { printJobs } = usePrinterAutomationStore.getState();
  const jobsById = new Map(printJobs.map((job) => [job.id, job]));
  return selectReadyPrintJobIds(printJobs.map((job) => ({
    id: job.id,
    priority: job.priority,
    status: job.status,
    printerTarget: job.printer.target,
  }))).flatMap((jobId) => {
    const job = jobsById.get(jobId);
    return job ? [job] : [];
  });
}

export function getOrderPrintState(orderId: string | null | undefined): OrderPrintState | null {
  if (!orderId) return null;
  return usePrinterAutomationStore.getState().orderPrintStates[orderId] || null;
}
