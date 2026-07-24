import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { Audio } from 'expo-av';
import { useQueryClient } from '@tanstack/react-query';
import type { Order } from '@my-small-business/types';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { LIVE_ORDERS_QUERY_KEY, PRE_ORDER_COUNT_QUERY_KEY, PRE_ORDERS_QUERY_KEY } from '@/hooks/useLiveOrdersQuery';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APP_SETTINGS, loadAppSettings } from '@/lib/settings';
import {
  claimOrderForAutoPrint,
  completeKitchenPrintClaim,
  getOrder,
  releaseKitchenPrintClaim,
  updateOrderStatus,
} from '@/lib/orders';
import { formatPrinterError, isSimulatorPrinter } from '@/lib/escpos-printer';
import { captureReceiptForPrinter, captureReceiptPreview, type PrinterImageSource } from '@/lib/printer-image';
import { buildSectionPrintJobs, hasAnySimulatorAssignment } from '@/lib/printer-routing';
import { enqueuePreparedPrintJobs, processReadyPendingPrintJobs, waitForPrintJobs } from '@/lib/print-queue';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { ReceiptTemplate } from '@/components/ReceiptTemplate';
import { shouldPlayOrderSound } from '@/utils/orderUtils';
import { getPrintDeviceId } from '@/lib/print-device';
import { getFriendlyOrderNumber } from '@/utils/orderNumber';
import { playNewOrderSound } from '@/lib/sounds';
import { usePrinterAutomationStore, type JournalLevel } from '@/stores/printerAutomationStore';

type TimeoutHandle = ReturnType<typeof setTimeout>;
type JournalOrderRef = { id: string; order_number?: string | null };

const PRINT_CLAIM_STALE_AFTER_SECONDS = 15;
const RECEIPT_REF_WAIT_MS = 120;
const RECEIPT_REF_MAX_ATTEMPTS = 8;
const RECEIPT_RENDER_SETTLE_MS = 300;
const RECEIPT_RENDER_FRAME_COUNT = 2;

export function PrinterAutomationProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const globalReceiptRef = useRef(null);
  const pendingAnnouncementTimersRef = useRef<Map<string, TimeoutHandle>>(new Map());
  const announcingOrderIdsRef = useRef<Set<string>>(new Set());
  const processedOrderIdsRef = useRef<Set<string>>(new Set());
  const soundedOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintingOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const printDeviceIdRef = useRef<string | null>(null);
  const lastAutoStatusAlertAtRef = useRef<number>(0);
  const preOrderNoticeTimeoutRef = useRef<TimeoutHandle | null>(null);
  const [tempPrintingOrder, setTempPrintingOrder] = useState<Order | null>(null);
  const [tempPrintSource, setTempPrintSource] = useState<string | null>(null);
  const [tempPrintTicketIndex, setTempPrintTicketIndex] = useState(0);
  const [tempPrintDuplicateBySections, setTempPrintDuplicateBySections] = useState(false);

  const autoPrintToast = usePrinterAutomationStore((state) => state.autoPrintToast);
  const dismissToast = usePrinterAutomationStore((state) => state.dismissToast);
  const showToast = usePrinterAutomationStore((state) => state.showToast);
  const addJournalEntry = usePrinterAutomationStore((state) => state.addJournalEntry);
  const printJobs = usePrinterAutomationStore((state) => state.printJobs);
  const activePrintJobIdsByPrinter = usePrinterAutomationStore((state) => state.activePrintJobIdsByPrinter);
  const pruneRuntimeState = usePrinterAutomationStore((state) => state.pruneRuntimeState);
  const setPreOrderSkipNotice = usePrinterAutomationStore((state) => state.setPreOrderSkipNotice);
  const autoPrintSimulator = usePrinterAutomationStore((state) => state.autoPrintSimulator);
  const showAutoPrintSimulator = usePrinterAutomationStore((state) => state.showAutoPrintSimulator);
  const dismissAutoPrintSimulator = usePrinterAutomationStore((state) => state.dismissAutoPrintSimulator);

  const logOrderEvent = useCallback((
    level: JournalLevel,
    scope: string,
    message: string,
    options?: { order?: JournalOrderRef | null; details?: string | null },
  ) => {
    addJournalEntry({
      level,
      scope,
      message,
      orderId: options?.order?.id ?? null,
      orderNumber: options?.order?.order_number ?? null,
      details: options?.details ?? null,
    });
  }, [addJournalEntry]);

  const formatDurationMs = useCallback((startedAt: number) => `${Date.now() - startedAt}ms`, []);

  const notifyAutoPrintError = useCallback((order: JournalOrderRef, reason: string) => {
    const orderLabel = getFriendlyOrderNumber(order.order_number, order.id);
    showToast(`Auto print failed for ${orderLabel}: ${reason}`, 'error');
    logOrderEvent('error', 'auto-print', 'Auto print failed', {
      order,
      details: reason,
    });
  }, [logOrderEvent, showToast]);

  const getPrintDelayMs = useCallback(() => Math.max(2000, (appSettings.printerDelayPrintSec || 3) * 1000), [appSettings.printerDelayPrintSec]);

  const waitForReceiptTemplateRef = useCallback(async () => {
    for (let attempt = 0; attempt < RECEIPT_REF_MAX_ATTEMPTS; attempt++) {
      if (globalReceiptRef.current) {
        return globalReceiptRef.current;
      }
      await new Promise((resolve) => setTimeout(resolve, RECEIPT_REF_WAIT_MS));
    }
    return null;
  }, []);

  const waitForReceiptRenderFrames = useCallback(async (frameCount: number = RECEIPT_RENDER_FRAME_COUNT) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, []);

  const playAttentionSoundForOrder = useCallback((order: Pick<Order, 'id' | 'order_channel' | 'payment_method' | 'customer_name' | 'scheduled_pickup_at'>) => {
    if (!appSettings.soundEnabled) return;
    if (soundedOrderIdsRef.current.has(order.id)) return;
    if (!shouldPlayOrderSound(order)) return;

    soundedOrderIdsRef.current.add(order.id);
    playNewOrderSound({
      soundId: appSettings.soundId,
      repeatCount: appSettings.soundRepeatCount,
      delayMs: 1000,
    });
  }, [appSettings.soundEnabled, appSettings.soundId, appSettings.soundRepeatCount]);

  const quickPrintAutoOrder = useCallback(async (order: Order) => {
    let claimedDeviceId: string | null = null;
    let shouldReleaseClaim = false;
    const workflowStartedAt = Date.now();

    try {
      if (autoPrintedOrderIdsRef.current.has(order.id) || autoPrintingOrderIdsRef.current.has(order.id)) {
        logOrderEvent('decision', 'auto-print', 'Skipped because this POS already handled the order', {
          order,
        });
        return;
      }
      autoPrintingOrderIdsRef.current.add(order.id);

      const effectiveSettings = await loadAppSettings().catch(() => appSettings);

      if (!effectiveSettings.printerAutoPrint || (!effectiveSettings.printerEnabled && !hasAnySimulatorAssignment(effectiveSettings))) {
        processedOrderIdsRef.current.delete(order.id);
        logOrderEvent('decision', 'auto-print', 'Cancelled auto-print because settings changed', {
          order,
        });
        return;
      }

      if (!printDeviceIdRef.current) {
        printDeviceIdRef.current = await getPrintDeviceId();
      }
      claimedDeviceId = printDeviceIdRef.current;

      const claim = await claimOrderForAutoPrint(order.id, claimedDeviceId, PRINT_CLAIM_STALE_AFTER_SECONDS);
      if (!claim.claimed) {
        if (claim.error) {
          processedOrderIdsRef.current.delete(order.id);
          notifyAutoPrintError(order, claim.error);
        } else {
          logOrderEvent('decision', 'claim', 'Another POS currently owns the print claim', {
            order,
            details: `Retrying in ${(PRINT_CLAIM_STALE_AFTER_SECONDS + 5) * 1000}ms`,
          });
          const retryTimer = setTimeout(() => {
            pendingAnnouncementTimersRef.current.delete(order.id);
            processedOrderIdsRef.current.delete(order.id);
            void fetchAndAnnounceOrder(order.id);
          }, (PRINT_CLAIM_STALE_AFTER_SECONDS + 5) * 1000);
          pendingAnnouncementTimersRef.current.set(order.id, retryTimer);
        }
        return;
      }

      shouldReleaseClaim = true;
      logOrderEvent('success', 'claim', 'Claimed order for auto-print', {
        order,
        details: `Device ${claimedDeviceId}`,
      });

      let freshOrder = order;
      const latestOrderResult = await getOrder(order.id);
      if (latestOrderResult.data) {
        freshOrder = latestOrderResult.data;
      } else if (latestOrderResult.error) {
        logOrderEvent('error', 'auto-print', 'Failed to refresh latest order before printing', {
          order,
          details: latestOrderResult.error,
        });
      }

      setTempPrintingOrder(freshOrder);
      setTempPrintSource('printer-automation:auto-print');
      const targetDots = effectiveSettings.printerPaperWidth === '58mm' ? 384 : 576;
      const scale = effectiveSettings.printerHighQuality ? 2 : 1;
      const jobs = buildSectionPrintJobs(effectiveSettings, freshOrder);
      logOrderEvent('info', 'print', 'Auto-print queue acquired', {
        order: freshOrder,
        details: `jobs=${jobs.length}`,
      });
      const capturedJobs: Array<{ image: PrinterImageSource; previewUri: string | null; label: string; printer: NonNullable<ReturnType<typeof buildSectionPrintJobs>[number]['printer']> | null }> = [];

      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        const jobStartedAt = Date.now();
        setTempPrintTicketIndex(job.onlyTicketIndex ?? 0);
        setTempPrintDuplicateBySections(job.duplicateBySections);
        if (index === 0) {
          await new Promise((resolve) => setTimeout(resolve, RECEIPT_RENDER_SETTLE_MS));
        } else {
          await waitForReceiptRenderFrames();
        }
        logOrderEvent('info', 'print', 'Prepared receipt template for auto-print job', {
          order: freshOrder,
          details: `job=${job.label} renderSettle=${formatDurationMs(jobStartedAt)} mode=${index === 0 ? 'initial-wait' : 'frame-sync'}`,
        });

        const refWaitStartedAt = Date.now();
        const receiptRef = await waitForReceiptTemplateRef();
        if (!receiptRef) {
          logOrderEvent('error', 'print', 'Receipt template ref was not ready for capture', {
            order: freshOrder,
            details: `Waited ${RECEIPT_REF_WAIT_MS * RECEIPT_REF_MAX_ATTEMPTS}ms before capture`,
          });
          throw new Error('Receipt template is still loading. Please try again.');
        }
        logOrderEvent('info', 'print', 'Receipt template ref resolved for auto-print job', {
          order: freshOrder,
          details: `job=${job.label} wait=${formatDurationMs(refWaitStartedAt)}`,
        });

        if (!job.printer || isSimulatorPrinter(job.printer)) {
          const captureStartedAt = Date.now();
          const uri = await captureReceiptPreview(receiptRef, targetDots * scale);
          logOrderEvent('info', 'print', 'Captured simulator preview for auto-print job', {
            order: freshOrder,
            details: `job=${job.label} capture=${formatDurationMs(captureStartedAt)} width=${targetDots * scale}`,
          });
          capturedJobs.push({
            image: { kind: 'uri', uri },
            previewUri: uri,
            label: job.label,
            printer: job.printer,
          });
        } else {
          const captureStartedAt = Date.now();
          const image = await captureReceiptForPrinter(receiptRef, job.printer, targetDots * scale);
          const previewUri = image.kind === 'uri' ? image.uri : await captureReceiptPreview(receiptRef, targetDots * scale);
          logOrderEvent('info', 'print', 'Captured receipt image for auto-print job', {
            order: freshOrder,
            details: `job=${job.label} capture=${formatDurationMs(captureStartedAt)} printer=${job.printer.deviceName} driver=${job.printer.driver ?? 'epsonSdk'}`,
          });
          capturedJobs.push({
            image,
            previewUri,
            label: job.label,
            printer: job.printer,
          });
        }
      }

      const simulatorImageUris: string[] = [];
      const simulatorImageLabels: string[] = [];
      const printerJobs: Array<{ image: PrinterImageSource; printer: NonNullable<typeof capturedJobs[number]['printer']> }> = [];
      for (const job of capturedJobs) {
        if (isSimulatorPrinter(job.printer)) {
          if (job.previewUri) simulatorImageUris.push(job.previewUri);
          simulatorImageLabels.push(job.label);
        } else {
          if (job.printer) {
            printerJobs.push({ image: job.image, printer: job.printer });
          }
        }
      }

      if (simulatorImageUris.length > 0) {
        logOrderEvent('decision', 'print', 'Using print simulator', {
          order: freshOrder,
          details: `${simulatorImageUris.length} receipt image(s) prepared for simulator`,
        });
        showAutoPrintSimulator({
          order: freshOrder,
          imageUri: simulatorImageUris[0] || null,
          imageUris: simulatorImageUris,
          imageLabels: simulatorImageLabels,
        });
      }

      if (printerJobs.length > 0) {
        if (!effectiveSettings.printerEnabled) {
          processedOrderIdsRef.current.delete(order.id);
          notifyAutoPrintError(order, 'Auto-print is enabled, but no printer is selected.');
          return;
        }

        logOrderEvent('info', 'print', 'Sending receipt image(s) to printer', {
          order: freshOrder,
          details: `${printerJobs.length} image(s) using section printer routing`,
        });

        const queuedJobs = enqueuePreparedPrintJobs({
          order: freshOrder,
          source: 'auto',
          scope: 'auto-print',
          jobs: printerJobs.map((job) => ({
            image: job.image,
            printer: job.printer,
            width: targetDots,
            label: job.printer.deviceName,
          })),
          silentSuccess: true,
        });
        const queueResult = await waitForPrintJobs(queuedJobs.map((job) => job.id));
        if (!queueResult.success) {
          throw new Error(queueResult.failedJobs[0]?.error || 'Queued print job failed');
        }
      }

      if (freshOrder.order_status === 'pending' || freshOrder.order_status === 'confirmed') {
        const statusResult = await updateOrderStatus(order.id, 'preparing');
        if (statusResult.error) {
          const now = Date.now();
          if (now - lastAutoStatusAlertAtRef.current > 4000) {
            lastAutoStatusAlertAtRef.current = now;
            showToast(`Printed order, but auto status update failed: ${statusResult.error}`, 'error');
          }
        } else {
          logOrderEvent('success', 'status', 'Moved order to preparing after auto-print', {
            order: freshOrder,
          });
        }
      }

      if (claimedDeviceId) {
        const completion = await completeKitchenPrintClaim(order.id, claimedDeviceId);
        if (!completion.completed) {
          throw new Error(completion.error || 'Failed to complete kitchen print claim');
        }
        shouldReleaseClaim = false;
        logOrderEvent('success', 'claim', 'Completed print claim', {
          order: freshOrder,
          details: `Device ${claimedDeviceId}`,
        });
      }

      autoPrintedOrderIdsRef.current.add(order.id);
      logOrderEvent('success', 'print', 'Auto-print workflow completed', {
        order: freshOrder,
        details: `${capturedJobs.length} receipt image(s) processed in ${formatDurationMs(workflowStartedAt)}`,
      });
    } catch (error) {
      processedOrderIdsRef.current.delete(order.id);
      logOrderEvent('error', 'print', 'Auto-print workflow failed', {
        order,
        details: `after=${formatDurationMs(workflowStartedAt)} reason=${formatPrinterError(error)}`,
      });
      notifyAutoPrintError(order, formatPrinterError(error) || 'Failed to print order.');
    } finally {
      if (claimedDeviceId && shouldReleaseClaim) {
        const released = await releaseKitchenPrintClaim(order.id, claimedDeviceId);
        if (released.error) {
          console.error('Failed to release kitchen print claim:', released.error);
        }
      }
      setTempPrintingOrder(null);
      setTempPrintSource(null);
      setTempPrintTicketIndex(0);
      setTempPrintDuplicateBySections(false);
      autoPrintingOrderIdsRef.current.delete(order.id);
    }
  }, [appSettings, logOrderEvent, notifyAutoPrintError, showAutoPrintSimulator, showToast, waitForReceiptRenderFrames, waitForReceiptTemplateRef]);

  const announceAndPrintOrder = useCallback(async (order: Order) => {
    if (processedOrderIdsRef.current.has(order.id)) return;

    if ((appSettings.printerEnabled || hasAnySimulatorAssignment(appSettings)) && appSettings.printerAutoPrint) {
      processedOrderIdsRef.current.add(order.id);
      logOrderEvent('decision', 'auto-print', 'Starting auto-print workflow', {
        order,
        details: hasAnySimulatorAssignment(appSettings) ? 'Simulator routing enabled' : 'Printer mode enabled',
      });
      try {
        await quickPrintAutoOrder(order);
      } catch (error) {
        processedOrderIdsRef.current.delete(order.id);
        notifyAutoPrintError(order, formatPrinterError(error));
      }
      return;
    }

    logOrderEvent('decision', 'auto-print', 'Skipped auto-print workflow on this POS', {
      order,
      details: 'Auto-print is disabled or no printer capability is enabled on this device',
    });
  }, [appSettings, logOrderEvent, notifyAutoPrintError, quickPrintAutoOrder]);

  const fetchAndAnnounceOrder = useCallback(async (orderId: string, attempt = 0) => {
    if (processedOrderIdsRef.current.has(orderId)) return;
    if (announcingOrderIdsRef.current.has(orderId)) return;

    announcingOrderIdsRef.current.add(orderId);
    logOrderEvent('info', 'scheduler', 'Fetching order for auto workflow', {
      order: { id: orderId },
      details: `Attempt ${attempt + 1}`,
    });

    try {
      const result = await getOrder(orderId);
      const order = result.data;
      const isPrintableStatus = order?.order_status === 'pending' || order?.order_status === 'confirmed';

      if (!order || !isPrintableStatus || order.payment_status === 'refunded') {
        processedOrderIdsRef.current.add(orderId);
        logOrderEvent('decision', 'scheduler', 'Skipped auto workflow', {
          order: order ? { id: order.id, order_number: order.order_number } : { id: orderId },
          details: !order ? result.error || 'Order not found' : `Status=${order.order_status}, payment=${order.payment_status}`,
        });
        return;
      }

      if (!order.items || order.items.length === 0) {
        if (attempt < 3) {
          logOrderEvent('decision', 'scheduler', 'Retrying because order items are not ready yet', {
            order,
            details: `Retry ${attempt + 2} scheduled in 1000ms`,
          });
          const retryTimer = setTimeout(() => {
            pendingAnnouncementTimersRef.current.delete(orderId);
            void fetchAndAnnounceOrder(orderId, attempt + 1);
          }, 1000);
          pendingAnnouncementTimersRef.current.set(orderId, retryTimer);
        } else {
          logOrderEvent('error', 'scheduler', 'Order items still missing after retries', {
            order,
            details: 'Auto workflow stopped before printing',
          });
        }
        return;
      }

      await announceAndPrintOrder(order);
    } finally {
      announcingOrderIdsRef.current.delete(orderId);
    }
  }, [announceAndPrintOrder, logOrderEvent]);

  const scheduleOrderAnnouncement = useCallback((order: Pick<Order, 'id' | 'created_at'>) => {
    if (processedOrderIdsRef.current.has(order.id)) return;
    if (pendingAnnouncementTimersRef.current.has(order.id)) return;
    if (announcingOrderIdsRef.current.has(order.id)) return;

    const delayMs = getPrintDelayMs();
    const createdAtMs = new Date(order.created_at).getTime();
    const dueInMs = Number.isFinite(createdAtMs)
      ? Math.max(0, createdAtMs + delayMs - Date.now())
      : delayMs;

    const timer = setTimeout(() => {
      pendingAnnouncementTimersRef.current.delete(order.id);
      void fetchAndAnnounceOrder(order.id);
    }, dueInMs);
    pendingAnnouncementTimersRef.current.set(order.id, timer);

    logOrderEvent('decision', 'scheduler', 'Scheduled order announcement', {
      order: { id: order.id },
      details: `Due in ${dueInMs}ms`,
    });
  }, [fetchAndAnnounceOrder, getPrintDelayMs, logOrderEvent]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    const pendingJobs = printJobs.filter((job) => job.status === 'queued');
    if (pendingJobs.length === 0) return;

    void processReadyPendingPrintJobs();
  }, [activePrintJobIdsByPrinter, printJobs]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      pruneRuntimeState();
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [pruneRuntimeState]);

  useEffect(() => {
    const subscription = supabase
      .channel('printer-automation-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          const orderId = (payload.new as any).id;
          const scheduledPickupAt = (payload.new as any)?.scheduled_pickup_at as string | null | undefined;
          const scheduledPickupAtMs = scheduledPickupAt ? new Date(scheduledPickupAt).getTime() : NaN;
          const isPreOrderFarAway = Number.isFinite(scheduledPickupAtMs) && (scheduledPickupAtMs - Date.now()) > (30 * 60 * 1000);

          const isSignificantInsert =
            payload.eventType === 'INSERT'
            && (payload.new.order_status === 'pending' || payload.new.order_status === 'confirmed');
          const isSignificantUpdate =
            payload.eventType === 'UPDATE'
            && (
              (
                payload.old.order_status === 'pending_online_payment'
                && (payload.new.order_status === 'confirmed' || payload.new.order_status === 'accepted')
              )
              || (
                payload.old.order_status !== payload.new.order_status
                && payload.new.order_status === 'confirmed'
              )
            );

          if (!(isSignificantInsert || isSignificantUpdate)) {
            return;
          }

          logOrderEvent('info', 'realtime', `Received ${payload.eventType.toLowerCase()} event`, {
            order: { id: orderId, order_number: (payload.new as any)?.order_number ?? null },
            details: `status ${(payload.old as any)?.order_status ?? '-'} -> ${(payload.new as any)?.order_status ?? '-'}, payment ${(payload.new as any)?.payment_status ?? '-'}`,
          });

          playAttentionSoundForOrder({
            id: orderId,
            order_channel: (payload.new as any)?.order_channel,
            payment_method: (payload.new as any)?.payment_method,
            customer_name: (payload.new as any)?.customer_name,
            scheduled_pickup_at: scheduledPickupAt ?? null,
          });

          if (isPreOrderFarAway) {
            logOrderEvent('decision', 'realtime', 'Pre-order outside live window, skipping print for now', {
              order: { id: orderId, order_number: (payload.new as any)?.order_number ?? null },
              details: scheduledPickupAt ?? 'No scheduled pickup time',
            });

            const orderNumber = (payload.new as any)?.order_number || orderId;
            setPreOrderSkipNotice(`Pre-order ${orderNumber} received - print skipped`);
            if (preOrderNoticeTimeoutRef.current) {
              clearTimeout(preOrderNoticeTimeoutRef.current);
            }
            preOrderNoticeTimeoutRef.current = setTimeout(() => {
              setPreOrderSkipNotice(null);
            }, 4500);

            if ((payload.new as { order_status?: string }).order_status === 'pending') {
              await updateOrderStatus(orderId, 'confirmed');
            }
            void queryClient.invalidateQueries({ queryKey: LIVE_ORDERS_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: PRE_ORDER_COUNT_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: PRE_ORDERS_QUERY_KEY });
            return;
          }

          void queryClient.invalidateQueries({ queryKey: LIVE_ORDERS_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: PRE_ORDER_COUNT_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: PRE_ORDERS_QUERY_KEY });
          scheduleOrderAnnouncement({
            id: orderId,
            created_at: (payload.new as any)?.created_at || new Date().toISOString(),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      pendingAnnouncementTimersRef.current.forEach((timer) => clearTimeout(timer));
      pendingAnnouncementTimersRef.current.clear();
      if (preOrderNoticeTimeoutRef.current) {
        clearTimeout(preOrderNoticeTimeoutRef.current);
      }
    };
  }, [logOrderEvent, playAttentionSoundForOrder, queryClient, scheduleOrderAnnouncement, setPreOrderSkipNotice]);

  return (
    <>
      {children}
      <View style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0 }} pointerEvents="none">
        {tempPrintingOrder ? (
          <View ref={globalReceiptRef} collapsable={false}>
            <ReceiptTemplate
              order={tempPrintingOrder}
              width={appSettings.printerPaperWidth === '58mm' ? 384 : 576}
              printSource={tempPrintSource || undefined}
              showTicketCounter={hasAnySimulatorAssignment(appSettings)}
              onlyTicketIndex={tempPrintTicketIndex}
              duplicateBySections={tempPrintDuplicateBySections}
            />
          </View>
        ) : null}
      </View>
      <Snackbar
        visible={autoPrintToast.visible}
        onDismiss={dismissToast}
        duration={5000}
        style={{
          backgroundColor: autoPrintToast.level === 'error'
            ? '#991b1b'
            : autoPrintToast.level === 'success'
              ? '#166534'
              : '#1f2937',
        }}
        action={{
          label: 'Dismiss',
          onPress: dismissToast,
        }}
      >
        {autoPrintToast.message}
      </Snackbar>
      <PrintSimulatorModal
        visible={autoPrintSimulator.visible}
        order={autoPrintSimulator.order}
        imageUri={autoPrintSimulator.imageUri}
        imageUris={autoPrintSimulator.imageUris}
        imageLabels={autoPrintSimulator.imageLabels}
        onClose={dismissAutoPrintSimulator}
      />
    </>
  );
}
