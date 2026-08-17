import type { Order } from '@my-small-business/types';
import { escposPrintDocument, escposPrintOrderImage, formatPrinterError, getPrinterDriver } from '@/lib/escpos-printer';
import type { SavedPrinter } from '@/lib/escpos-printer';
import type { PrinterImageSource } from '@/lib/printer-image';
import type { EscPosDocument } from '@/lib/instore-instant-ticket';
import {
  getReadyPendingPrintJobs,
  usePrinterAutomationStore,
  type PrintJob,
  type PrintJobSource,
} from '@/stores/printerAutomationStore';

const WAIT_FOR_PRINT_JOBS_TIMEOUT_MS = 2 * 60 * 1000;

type PreparedPrintJobBase = {
  printer: SavedPrinter;
  label: string;
  width: number;
  copies?: number;
  priority?: PrintJob['priority'];
};

export type PreparedPrintJobInput = PreparedPrintJobBase & (
  | { image: PrinterImageSource; document?: never }
  | { document: EscPosDocument; image?: never }
);

export function enqueuePreparedPrintJobs(options: {
  order?: Pick<Order, 'id' | 'order_number'> | null;
  source: PrintJobSource;
  scope: string;
  jobs: PreparedPrintJobInput[];
  silentSuccess?: boolean;
}): PrintJob[] {
  const enqueuePrintJobs = usePrinterAutomationStore.getState().enqueuePrintJobs;
  const queuedJobs = enqueuePrintJobs(options.jobs.map((job) => ({
    orderId: options.order?.id ?? null,
    orderNumber: options.order?.order_number ?? null,
    source: options.source,
    scope: options.scope,
    label: job.label,
    printer: job.printer,
    image: job.image ?? null,
    document: job.document ?? null,
    copies: job.copies ?? 1,
    width: job.width,
    silentSuccess: options.silentSuccess,
    priority: job.priority ?? 'normal',
  })));

  const addJournalEntry = usePrinterAutomationStore.getState().addJournalEntry;
  for (const job of queuedJobs) {
    addJournalEntry({
      level: 'info',
      scope: options.scope,
      message: 'Queued print job',
      orderId: job.orderId,
      orderNumber: job.orderNumber,
      details: `job=${job.label} printer=${job.printer.deviceName} driver=${job.printer.driver ?? 'epsonSdk'} payload=${job.document ? 'text' : 'image'}`,
    });
  }

  return queuedJobs;
}

export async function waitForPrintJobs(jobIds: string[]): Promise<{ success: boolean; failedJobs: PrintJob[] }> {
  if (jobIds.length === 0) {
    return { success: true, failedJobs: [] };
  }

  return await new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      const state = usePrinterAutomationStore.getState();
      const trackedJobs = state.printJobs.filter((job) => jobIds.includes(job.id));
      resolve({
        success: false,
        failedJobs: trackedJobs.filter((job) => job.status === 'failed'),
      });
    }, WAIT_FOR_PRINT_JOBS_TIMEOUT_MS);

    const unsubscribe = usePrinterAutomationStore.subscribe((state) => {
      const trackedJobs = state.printJobs.filter((job) => jobIds.includes(job.id));
      if (trackedJobs.length === 0) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve({
          success: false,
          failedJobs: [],
        });
        return;
      }

      if (trackedJobs.length !== jobIds.length) {
        return;
      }

      const allCompleted = trackedJobs.every((job) => job.status === 'success' || job.status === 'failed');
      if (!allCompleted) {
        return;
      }

      clearTimeout(timeoutId);
      unsubscribe();
      const failedJobs = trackedJobs.filter((job) => job.status === 'failed');
      resolve({
        success: failedJobs.length === 0,
        failedJobs,
      });
    });
  });
}

export async function processPendingPrintJob(jobId: string): Promise<boolean> {
  const store = usePrinterAutomationStore.getState();
  const job = store.printJobs.find((item) => item.id === jobId) || null;
  if (!job) {
    return false;
  }

  const startedJob = store.markPrintJobStarted(job.id);
  if (!startedJob) {
    return false;
  }

  const sendStartedAt = Date.now();
  const queuedDurationMs = Math.max(0, sendStartedAt - startedJob.createdAt);
  const driver = getPrinterDriver(startedJob.printer);
  const transport = driver === 'rawTcp'
    ? 'Raw TCP (native/JS resolved during dispatch)'
    : driver === 'epsonSdk' ? 'Epson SDK' : 'simulator';

  store.addJournalEntry({
    level: 'info',
    scope: startedJob.scope,
    message: 'Started queued print job',
    orderId: startedJob.orderId,
    orderNumber: startedJob.orderNumber,
    details: `job=${startedJob.label} printer=${startedJob.printer.deviceName} driver=${driver} transport=${transport} queue=${queuedDurationMs}ms dispatch=0ms`,
  });

  try {
    if (!startedJob.document && !startedJob.image) throw new Error('Print job payload is unavailable.');
    const dispatch = startedJob.document
      ? (await escposPrintDocument(startedJob.document, startedJob.printer), null)
      : await escposPrintOrderImage(startedJob.image!, startedJob.printer, startedJob.copies, startedJob.width);
    const completedJob = usePrinterAutomationStore.getState().markPrintJobSucceeded(startedJob.id);
    const durationMs = Date.now() - sendStartedAt;
    usePrinterAutomationStore.getState().addJournalEntry({
      level: 'success',
      scope: startedJob.scope,
      message: 'Completed queued print job',
      orderId: startedJob.orderId,
      orderNumber: startedJob.orderNumber,
      details: startedJob.document
        ? `job=${startedJob.label} printer=${startedJob.printer.deviceName} driver=${driver} transport=${transport} payload=text queue=${queuedDurationMs}ms dispatch=${durationMs}ms print=${durationMs}ms total=${Math.max(0, Date.now() - startedJob.createdAt)}ms`
        : `job=${startedJob.label} printer=${startedJob.printer.deviceName} driver=${driver} transport=${transport} payload=image quality=${dispatch!.quality} captureScale=${dispatch!.captureScale} requestedWidth=${startedJob.width} queue=${queuedDurationMs}ms dispatch=${durationMs}ms print=${durationMs}ms total=${Math.max(0, Date.now() - startedJob.createdAt)}ms${dispatch!.native ? ` nativeCapture=${dispatch!.native.captureMs}ms nativeResize=${dispatch!.native.resizeMs}ms nativeRaster=${dispatch!.native.rasterMs} nativeSend=${dispatch!.native.sendMs} nativeSize=${dispatch!.native.width}x${dispatch!.native.height} nativeBytes=${dispatch!.native.byteLength}` : ''}`,
    });

    if (completedJob && !completedJob.silentSuccess && completedJob.source !== 'auto') {
      usePrinterAutomationStore.getState().showToast(
        `Printed successfully${completedJob.orderNumber ? ` for ${completedJob.orderNumber}` : ''}`,
        'success'
      );
    }
  } catch (error) {
    const message = formatPrinterError(error) || 'Failed to print';
    usePrinterAutomationStore.getState().markPrintJobFailed(startedJob.id, message);
    usePrinterAutomationStore.getState().addJournalEntry({
      level: 'error',
      scope: startedJob.scope,
      message: 'Queued print job failed',
      orderId: startedJob.orderId,
      orderNumber: startedJob.orderNumber,
      details: `job=${startedJob.label} printer=${startedJob.printer.deviceName} driver=${driver} transport=${transport} queue=${queuedDurationMs}ms dispatch=${Math.max(0, Date.now() - sendStartedAt)}ms total=${Math.max(0, Date.now() - startedJob.createdAt)}ms reason=${message}`,
    });
    usePrinterAutomationStore.getState().showToast(
      `Print failed${startedJob.orderNumber ? ` for ${startedJob.orderNumber}` : ''}: ${message}`,
      'error'
    );
  }

  return true;
}

export async function processReadyPendingPrintJobs(): Promise<boolean> {
  const jobs = getReadyPendingPrintJobs();
  if (jobs.length === 0) {
    return false;
  }

  await Promise.all(jobs.map((job) => processPendingPrintJob(job.id)));
  return true;
}
