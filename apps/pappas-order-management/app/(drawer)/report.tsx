import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { ManualPrintButton } from '@/components/printer/ManualPrintButton';
import { enqueuePreparedPrintJobs, waitForPrintJobs } from '@/lib/print-queue';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { WorkspaceHeader } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { FormField, MetricCard, Panel, SectionHeader } from '@/components/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { isCompactPhoneWidth } from '@/lib/responsive';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { IconButton, Menu, Surface, Text } from 'react-native-paper';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import type { Order } from '@my-small-business/types';
import { ReportPrintTemplate } from '@/components/ReportPrintTemplate';
import { PrintSimulatorModal } from '@/components/PrintSimulatorModal';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { useStoreInfo } from '@/hooks/useStoreInfo';
import { captureReceiptForPrinter, captureReceiptPreview } from '@/lib/printer-image';
import { formatPrinterError, isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { buildReportPrintSnapshot, REPORT_RECEIPT_WIDTH } from '@/lib/report-printing';
import { clampRollingDays, getRollingReportRanges } from '@/lib/report-periods';
import { buildDailyReportBreakdown } from '@/lib/report-daily-breakdown';
import { formatDateInMelbourne, getTimeInMelbourne, toMelbourneRangeBoundaryIso } from '@/lib/report-timezone';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { getAllOrders } from '@/lib/orders';
import {
  buildChannelFinancialBreakdown,
  getOrderGrossSales,
  isMarketplaceSalesOrder,
} from '@/lib/marketplace-pos-import';
import { formatDateToLocalISO, getOrderChannelLabel, getPaymentStatLabel } from '@/utils/orderUtils';

type CompareMode = 'lastWeek' | 'lastMonth' | 'lastYear' | 'custom';
type ReportType = 'daily' | 'weekly' | 'monthly' | 'rolling';

type ReportTile = {
  type: ReportType;
  title: string;
  description: string;
  accent: string;
};

type ChartBucket = {
  label: string;
  total: number;
};

type BreakdownRow = {
  label: string;
  orders: number;
  total: number;
};

type DateRange = {
  start: string;
  end: string;
};

const REPORT_TILES: ReportTile[] = [
  {
    type: 'daily',
    title: 'Sales report',
    description: 'Single day trading, 30 minute sales trend, payment mix, and channel split.',
    accent: t.color.primary,
  },
  {
    type: 'weekly',
    title: 'Weekly sales',
    description: 'Monday to Sunday totals grouped by date with previous week comparison.',
    accent: t.color.success,
  },
  {
    type: 'monthly',
    title: 'Monthly sales',
    description: 'Full month performance grouped by date with previous month comparison.',
    accent: '#ea580c',
  },
  { type: 'rolling', title: 'Last X days', description: 'Rolling sales period ending yesterday, compared with the preceding equal period.', accent: '#7c3aed' },
];

const REPORT_START_HOUR = 10;
const REPORT_END_HOUR = 21;
const REPORT_BUCKETS = (REPORT_END_HOUR - REPORT_START_HOUR) * 2 + 1;

const COMPARE_LABELS: Record<CompareMode, string> = {
  lastWeek: 'Same day last week',
  lastMonth: 'Same day last month',
  lastYear: 'Same day last year',
  custom: 'Custom date',
};

const REPORT_LABELS: Record<ReportType, string> = {
  daily: 'Sales report',
  weekly: 'Weekly sales',
  monthly: 'Monthly sales',
  rolling: 'Last X days',
};

const money = (value: number) => `${value < 0 ? '−' : ''}$${Math.round(Math.abs(value)).toLocaleString('en-AU')}`;

const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDate = (dateString: string, amount: number, unit: 'day' | 'month' | 'year') => {
  const date = parseLocalDate(dateString);
  if (unit === 'day') date.setDate(date.getDate() + amount);
  if (unit === 'month') date.setMonth(date.getMonth() + amount);
  if (unit === 'year') date.setFullYear(date.getFullYear() + amount);
  return formatDateToLocalISO(date);
};

const startOfWeek = (dateString: string) => {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateToLocalISO(date);
};

const endOfWeek = (dateString: string) => addDate(startOfWeek(dateString), 6, 'day');

const startOfMonth = (dateString: string) => {
  const date = parseLocalDate(dateString);
  date.setDate(1);
  return formatDateToLocalISO(date);
};

const endOfMonth = (dateString: string) => {
  const date = parseLocalDate(dateString);
  date.setMonth(date.getMonth() + 1, 0);
  return formatDateToLocalISO(date);
};

const formatDisplayDate = (dateString: string) => (
  parseLocalDate(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
);

const formatShortDay = (dateString: string) => (
  parseLocalDate(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
);

const formatMonthDay = (dateString: string) => (
  parseLocalDate(dateString).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
);

const formatRangeLabel = (start: string, end: string) => (
  `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`
);

const getPaidSalesOrders = (orders: Order[]) => orders.filter(isMarketplaceSalesOrder);

const getRangeForReport = (reportType: Exclude<ReportType, 'rolling'>, dateString: string): DateRange => {
  if (reportType === 'weekly') {
    return { start: startOfWeek(dateString), end: endOfWeek(dateString) };
  }
  if (reportType === 'monthly') {
    return { start: startOfMonth(dateString), end: endOfMonth(dateString) };
  }
  return { start: dateString, end: dateString };
};

const getCompareRangeForReport = (
  reportType: Exclude<ReportType, 'rolling'>,
  currentDate: string,
  compareMode: CompareMode,
  customCompareDate: string
): DateRange => {
  if (reportType === 'daily') {
    const compareDate =
      compareMode === 'lastWeek'
        ? addDate(currentDate, -7, 'day')
        : compareMode === 'lastMonth'
          ? addDate(currentDate, -1, 'month')
          : compareMode === 'lastYear'
            ? addDate(currentDate, -1, 'year')
            : customCompareDate;
    return { start: compareDate, end: compareDate };
  }

  if (reportType === 'weekly') {
    const currentStart = startOfWeek(currentDate);
    const compareStart = addDate(currentStart, -7, 'day');
    return { start: compareStart, end: addDate(compareStart, 6, 'day') };
  }

  const currentStart = startOfMonth(currentDate);
  const compareMonthDate = addDate(currentStart, -1, 'month');
  return { start: startOfMonth(compareMonthDate), end: endOfMonth(compareMonthDate) };
};

const buildDailyBuckets = (orders: Order[]): ChartBucket[] => {
  const buckets = Array.from({ length: REPORT_BUCKETS }, (_, index) => {
    const hour = REPORT_START_HOUR + Math.floor(index / 2);
    const minute = index % 2 === 0 ? '00' : '30';
    return { label: `${String(hour).padStart(2, '0')}:${minute}`, total: 0 };
  });

  getPaidSalesOrders(orders).forEach((order) => {
    const created = new Date(order.created_at);
    const { hour, minute } = getTimeInMelbourne(created);
    if (hour < REPORT_START_HOUR || hour > REPORT_END_HOUR) return;
    const index = (hour - REPORT_START_HOUR) * 2 + (minute >= 30 ? 1 : 0);
    if (!buckets[index]) return;
    buckets[index].total += Number(getOrderGrossSales(order)) || 0;
  });

  return buckets;
};

const buildRangeBuckets = (orders: Order[], range: DateRange, formatter: (dateString: string) => string): ChartBucket[] => {
  const buckets: ChartBucket[] = [];
  const totals = new Map<string, number>();
  let cursor = range.start;

  while (cursor <= range.end) {
    buckets.push({ label: formatter(cursor), total: 0 });
    totals.set(cursor, 0);
    cursor = addDate(cursor, 1, 'day');
  }

  getPaidSalesOrders(orders).forEach((order) => {
    const dayKey = formatDateInMelbourne(new Date(order.created_at));
    if (!totals.has(dayKey)) return;
    totals.set(dayKey, (totals.get(dayKey) || 0) + (Number(getOrderGrossSales(order)) || 0));
  });

  return buckets.map((bucket, index) => {
    const dayKey = addDate(range.start, index, 'day');
    return { ...bucket, total: totals.get(dayKey) || 0 };
  });
};

const buildBreakdown = (orders: Order[], groupBy: (order: Order) => string): BreakdownRow[] => {
  const map = new Map<string, BreakdownRow>();
  getPaidSalesOrders(orders).forEach((order) => {
    const label = groupBy(order);
    const current = map.get(label) || { label, orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(getOrderGrossSales(order)) || 0;
    map.set(label, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const getDiscountTotal = (orders: Order[]) => (
  getPaidSalesOrders(orders).reduce(
    (sum, order) => sum + (Number(order.promotion_discount) || 0) + (Number(order.coupon_discount) || 0),
    0
  )
);

const buildChartData = (buckets: ChartBucket[]): lineDataItem[] => (
  buckets.map((bucket) => {
    return {
      value: bucket.total,
      label: bucket.label,
      labelComponent: () => null,
    };
  })
);

function ComparisonChart({
  current,
  compare,
  chartKey,
}: {
  current: ChartBucket[];
  compare: ChartBucket[];
  chartKey: string;
}) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const maxValue = Math.max(1, ...current.map((b) => b.total), ...compare.map((b) => b.total));
  const roundedMaxValue = Math.ceil(maxValue / 50) * 50 || 50;
  // Gifted Charts adds the Y-axis gutter outside its plot width. Measure the
  // actual card body so rail, split view, padding, and text scaling are included.
  const axisLabelWidth = Math.max(44, Math.ceil((String(roundedMaxValue).length + 1) * 8 * fontScale + 12));
  const chartWidth = Math.max(1, availableWidth - axisLabelWidth - 12);
  const spacing = Math.max(0, (chartWidth - 48) / Math.max(1, Math.max(current.length, compare.length) - 1));

  return (
    <View style={styles.chartWrap} onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}>
      {availableWidth > 0 && <LineChart
        key={chartKey}
        data={buildChartData(current)}
        data2={buildChartData(compare)}
        height={190}
        width={chartWidth}
        parentWidth={availableWidth}
        maxValue={roundedMaxValue}
        noOfSections={4}
        spacing={spacing}
        initialSpacing={24}
        endSpacing={24}
        color={t.color.primary}
        color2="#94a3b8"
        thickness={3}
        thickness2={3}
        strokeDashArray2={[6, 5]}
        curved={false}
        areaChart1
        areaChart2={false}
        startFillColor1={t.color.primary}
        endFillColor1={t.color.primary}
        startOpacity1={0.18}
        endOpacity1={0.01}
        dataPointsRadius={3}
        dataPointsColor={t.color.primary}
        hideDataPoints2
        yAxisColor="#e5e7eb"
        xAxisColor="#e5e7eb"
        rulesColor="#e5e7eb"
        yAxisTextStyle={styles.chartAxisText}
        xAxisLabelTextStyle={styles.chartAxisText}
        yAxisLabelPrefix="$"
        yAxisLabelWidth={axisLabelWidth}
        xAxisLabelsHeight={0}
        xAxisLabelsVerticalShift={8}
        disableScroll
        pointerConfig={{
          pointerStripHeight: 190,
          pointerStripColor: '#94a3b8',
          pointerStripWidth: 1,
          pointerColor: t.color.primary,
          radius: 4,
          pointerLabelWidth: 128,
          pointerLabelHeight: 58,
          activatePointersOnLongPress: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (items: lineDataItem[]) => (
            <View style={styles.pointerLabel}>
              <Text style={styles.pointerLabelText}>{items[0]?.label || ''}</Text>
              <Text style={styles.pointerLabelValue}>Current {money(items[0]?.value || 0)}</Text>
              <Text style={styles.pointerLabelMuted}>Compare {money(items[1]?.value || 0)}</Text>
            </View>
          ),
        }}
      />}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: axisLabelWidth, paddingTop: 8 }}>
        {[0, Math.floor((current.length - 1) / 2), current.length - 1].map((index) => <Text key={index} style={styles.chartAxisText}>{current[index]?.label}</Text>)}
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const isPhoneLayout = isCompactPhoneWidth(contentWidth / fontScale);
  const requestIdRef = useRef(0);
  const reportReceiptRef = useRef<View>(null);
  const { data: appSettings = DEFAULT_APP_SETTINGS } = useAppSettingsQuery();
  const storeInfo = useStoreInfo();
  const [selectedReport, setSelectedReport] = useState<ReportType>('daily');
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [rollingDays, setRollingDays] = useState(15);
  const reportToday = formatDateInMelbourne(new Date());
  const [selectedDate, setSelectedDate] = useState(reportToday);
  const [compareMode, setCompareMode] = useState<CompareMode>('lastWeek');
  const [customCompareDate, setCustomCompareDate] = useState(addDate(reportToday, -7, 'day'));
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [compareOrders, setCompareOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'current' | 'custom' | null>(null);
  const [draftDate, setDraftDate] = useState<Date>(parseLocalDate(reportToday));
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [showReportSimulator, setShowReportSimulator] = useState(false);
  const [reportPreviewUri, setReportPreviewUri] = useState<string | null>(null);
  const [tileInfo, setTileInfo] = useState<ReportTile | null>(null);

  const rollingRanges = useMemo(() => getRollingReportRanges(reportToday, rollingDays), [reportToday, rollingDays]);
  const currentRange = useMemo(() => selectedReport === 'rolling' ? rollingRanges.current : getRangeForReport(selectedReport, selectedDate), [rollingRanges.current, selectedDate, selectedReport]);

  const compareRange = useMemo(
    () => selectedReport === 'rolling' ? rollingRanges.compare : getCompareRangeForReport(selectedReport, selectedDate, compareMode, customCompareDate),
    [compareMode, customCompareDate, rollingRanges.compare, selectedDate, selectedReport]
  );

  const loadReport = useCallback(async (options?: { clearBeforeLoad?: boolean }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      if (options?.clearBeforeLoad) {
        setCurrentOrders([]);
        setCompareOrders([]);
      }

      const [current, compare] = await Promise.all([
        getAllOrders({
          since: toMelbourneRangeBoundaryIso(currentRange.start, 'start'),
          until: toMelbourneRangeBoundaryIso(currentRange.end, 'end'),
          payment_status: 'paid',
        }),
        getAllOrders({
          since: toMelbourneRangeBoundaryIso(compareRange.start, 'start'),
          until: toMelbourneRangeBoundaryIso(compareRange.end, 'end'),
          payment_status: 'paid',
        }),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (current.error || compare.error) {
        Alert.alert('Error', current.error || compare.error || 'Failed to load report');
        return;
      }

      setCurrentOrders(current.data || []);
      setCompareOrders(compare.data || []);
    } catch {
      if (requestId !== requestIdRef.current) return;
      Alert.alert('Error', 'Failed to load report');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [compareRange.end, compareRange.start, currentRange.end, currentRange.start]);

  useEffect(() => {
    void loadReport({ clearBeforeLoad: true });
  }, [loadReport]);

  const currentSalesOrders = useMemo(() => getPaidSalesOrders(currentOrders), [currentOrders]);
  const compareSalesOrders = useMemo(() => getPaidSalesOrders(compareOrders), [compareOrders]);
  const currentTotal = currentSalesOrders.reduce(
    (sum, order) => sum + (Number(getOrderGrossSales(order)) || 0),
    0
  );
  const compareTotal = compareSalesOrders.reduce(
    (sum, order) => sum + (Number(getOrderGrossSales(order)) || 0),
    0
  );
  const currentDiscountTotal = getDiscountTotal(currentOrders);
  const compareDiscountTotal = getDiscountTotal(compareOrders);
  const difference = currentTotal - compareTotal;
  const differencePercent = compareTotal > 0 ? (difference / compareTotal) * 100 : null;

  const currentBuckets = useMemo(() => {
    if (selectedReport === 'daily') return buildDailyBuckets(currentOrders);
    return buildRangeBuckets(
      currentOrders,
      currentRange,
      selectedReport === 'weekly' ? formatShortDay : formatMonthDay
    );
  }, [currentOrders, currentRange, selectedReport]);

  const compareBuckets = useMemo(() => {
    if (selectedReport === 'daily') return buildDailyBuckets(compareOrders);
    return buildRangeBuckets(
      compareOrders,
      compareRange,
      selectedReport === 'weekly' ? formatShortDay : formatMonthDay
    );
  }, [compareOrders, compareRange, selectedReport]);

  const paymentBreakdown = useMemo(
    () => buildBreakdown(currentOrders, getPaymentStatLabel),
    [currentOrders]
  );

  const channelBreakdown = useMemo(
    () => buildBreakdown(currentOrders, (order) => getOrderChannelLabel(order)),
    [currentOrders]
  );

  const channelFinancials = useMemo(
    () => buildChannelFinancialBreakdown(currentOrders),
    [currentOrders]
  );

  const compareChannelFinancials = useMemo(
    () => buildChannelFinancialBreakdown(compareOrders),
    [compareOrders]
  );

  const currentNetSales = useMemo(() => {
    return channelFinancials.reduce((sum, channel) => {
      return sum + (channel.netSales || 0);
    }, 0);
  }, [channelFinancials]);

  const compareNetSales = useMemo(() => {
    return compareChannelFinancials.reduce((sum, channel) => {
      return sum + (channel.netSales || 0);
    }, 0);
  }, [compareChannelFinancials]);

  const netDifference = (currentNetSales != null && compareNetSales != null) ? currentNetSales - compareNetSales : null;

  const dailyBreakdown = useMemo(
    () => (
      selectedReport === 'daily'
        ? []
        : buildDailyReportBreakdown({
          range: currentRange,
          orders: currentSalesOrders,
          getDayKey: (order) => formatDateInMelbourne(new Date(order.created_at)),
          getTotal: getOrderGrossSales,
          formatLabel: formatShortDay,
        })
    ),
    [currentRange, currentSalesOrders, selectedReport]
  );

  const compareSummaryLabel = useMemo(() => {
    if (selectedReport === 'daily') return COMPARE_LABELS[compareMode].toLowerCase();
    if (selectedReport === 'rolling') return 'previous period';
    return selectedReport === 'weekly' ? 'previous week' : 'previous month';
  }, [compareMode, selectedReport]);

  const chartTitle = selectedReport === 'daily'
    ? '30 minute gross sales'
    : selectedReport === 'weekly'
      ? 'Gross sales by day'
      : selectedReport === 'rolling' ? 'Gross sales by date' : 'Monthly daily gross sales';

  const chartSubtitle = selectedReport === 'daily'
    ? `Current date compared with ${formatDisplayDate(compareRange.start)}`
    : `${formatRangeLabel(currentRange.start, currentRange.end)} compared with ${formatRangeLabel(compareRange.start, compareRange.end)}`;

  const periodTitle = selectedReport === 'rolling'
    ? `Last ${rollingDays} days: ${formatRangeLabel(currentRange.start, currentRange.end)}`
    : selectedReport === 'daily'
    ? formatDisplayDate(selectedDate)
    : formatRangeLabel(currentRange.start, currentRange.end);

  const reportPrintSnapshot = useMemo(
    () => buildReportPrintSnapshot({ reportType: selectedReport, periodLabel: periodTitle, generatedAt: new Date(), orders: currentOrders }),
    [currentOrders, periodTitle, selectedReport]
  );

  const printReportToPrinter = async (printer: SavedPrinter) => {
    try {
      setIsPrintingReport(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!reportReceiptRef.current) throw new Error('Report receipt is not ready yet.');
      if (isSimulatorPrinter(printer)) {
        setReportPreviewUri(await captureReceiptPreview(reportReceiptRef.current, REPORT_RECEIPT_WIDTH));
        setShowReportSimulator(true);
        return;
      }
      const image = await captureReceiptForPrinter(reportReceiptRef.current, printer, REPORT_RECEIPT_WIDTH, appSettings.printerHighQuality);
      const jobs = enqueuePreparedPrintJobs({ source: 'manual', scope: 'report:manual', jobs: [{ copyType: 'report', reportId: `${selectedReport}:${currentRange.start}:${currentRange.end}`, image, printer, width: REPORT_RECEIPT_WIDTH, label: `${selectedReport} report` }] });
      const result = await waitForPrintJobs(jobs.map((job) => job.id));
      if (!result.success) throw new Error(result.failedJobs[0]?.error || `Report print outcome unknown. Check job ${jobs[0]?.id} in the printer journal before retrying.`);
      Alert.alert('Printed', `Report completed on ${printer.deviceName}.`);
      return true;
    } catch (error) {
      Alert.alert('Print error', formatPrinterError(error));
      return false;
    } finally {
      setIsPrintingReport(false);
    }
  };

  const shiftSelectedPeriod = (direction: 'previous' | 'next') => {
    const amount = direction === 'previous' ? -1 : 1;
    if (selectedReport === 'weekly') {
      setSelectedDate((current) => addDate(current, amount * 7, 'day'));
      return;
    }
    if (selectedReport === 'monthly') {
      setSelectedDate((current) => addDate(current, amount, 'month'));
      return;
    }
    setSelectedDate((current) => addDate(current, amount, 'day'));
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadReport();
  };

  const openDatePicker = (target: 'current' | 'custom') => {
    const baseDate = target === 'current'
      ? selectedDate
      : customCompareDate;
    setDraftDate(parseLocalDate(baseDate));
    setShowDatePicker(target);
  };

  const applyDraftDate = () => {
    if (!showDatePicker) return;
    const nextDate = formatDateToLocalISO(draftDate);
    if (showDatePicker === 'current') {
      setSelectedDate(nextDate);
    } else {
      setCustomCompareDate(nextDate);
      setCompareMode('custom');
    }
    setShowDatePicker(null);
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type !== 'set' || !date || !showDatePicker) {
      if (event.type === 'dismissed') setShowDatePicker(null);
      return;
    }

    if (Platform.OS === 'android') {
      const nextDate = formatDateToLocalISO(date);
      if (showDatePicker === 'current') {
        setSelectedDate(nextDate);
      } else {
        setCustomCompareDate(nextDate);
        setCompareMode('custom');
      }
      setShowDatePicker(null);
      return;
    }

    setDraftDate(date);
  };

  const renderBreakdown = (title: string, rows: BreakdownRow[], emptyLabel: string) => (
    <Panel key={`${selectedReport}-${title}`} style={styles.panel}>
      <SectionHeader title={title} />
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        rows.map((row) => (
          <View key={row.label} style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>{row.label}</Text>
              <Text style={styles.breakdownMeta}>{row.orders} orders</Text>
            </View>
            <Text style={styles.breakdownValue}>{money(row.total)}</Text>
          </View>
        ))
      )}
    </Panel>
  );

  return (
    <View style={styles.container} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <WorkspaceHeader title="Sales reports" actions={<>

      </>} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: contentWidth < 1100 ? 12 : 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >


        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ChoiceTabs style={{ flex: 1 }} value={selectedReport} onValueChange={(value) => setSelectedReport(value as ReportType)} buttons={REPORT_TILES.map((tile) => ({ value: tile.type, label: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', rolling: 'Last X days' }[tile.type] }))} /><IconButton icon="information-outline" accessibilityLabel={`About ${REPORT_LABELS[selectedReport]}`} onPress={() => setTileInfo(REPORT_TILES.find((tile) => tile.type === selectedReport) || null)} /></View>
        {isPhoneLayout ? <View style={styles.phonePeriodRow}>
          {selectedReport !== 'rolling' && <Pressable accessibilityRole="button" accessibilityLabel="Previous report period" onPress={() => shiftSelectedPeriod('previous')} style={({ pressed }) => [styles.phonePeriodButton, pressed && styles.periodPressed]}><Text style={styles.phonePeriodLabel}>{'‹\nPrevious'}</Text></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={`Report period: ${periodTitle}`} accessibilityState={{ disabled: selectedReport === 'rolling' }} disabled={selectedReport === 'rolling'} onPress={() => openDatePicker('current')} style={({ pressed }) => [styles.phonePeriodButton, pressed && styles.periodPressed]}><Text style={styles.phonePeriodLabel}>{selectedReport === 'daily' ? parseLocalDate(selectedDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + '\n' + parseLocalDate(selectedDate).getFullYear() : periodTitle}</Text></Pressable>
          {selectedReport !== 'rolling' && <Pressable accessibilityRole="button" accessibilityLabel="Next report period" onPress={() => shiftSelectedPeriod('next')} style={({ pressed }) => [styles.phonePeriodButton, pressed && styles.periodPressed]}><Text style={styles.phonePeriodLabel}>Next ›</Text></Pressable>}
          <ManualPrintButton printers={appSettings.printerSaved} label="Print report" disabled={loading || refreshing || isPrintingReport} loading={isPrintingReport} onSelectPrinter={(printer) => printer ? printReportToPrinter(printer) : false} renderTrigger={({ onPress, disabled, loading: printing }) => <Pressable accessibilityRole="button" accessibilityLabel="Print report" accessibilityState={{ disabled, busy: printing }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.phonePeriodButton, pressed && styles.periodPressed, disabled && styles.periodDisabled]}>{printing ? <ActivityIndicator size="small" color={t.color.primary} /> : <Text style={styles.phonePeriodLabel}>{'Print\nreport'}</Text>}</Pressable>} />
        </View> : <View style={styles.headerRow}>
          <View style={styles.periodActions}>
            {selectedReport !== 'rolling' && <Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => shiftSelectedPeriod('previous')}>‹ Previous</Button>}
            <Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={selectedReport === 'rolling'} onPress={() => openDatePicker('current')}>{periodTitle}</Button>
            {selectedReport !== 'rolling' && <Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => shiftSelectedPeriod('next')}>Next ›</Button>}
          </View>
          <ManualPrintButton printers={appSettings.printerSaved} label="Print report" disabled={loading || refreshing || isPrintingReport} loading={isPrintingReport} onSelectPrinter={(printer) => printer ? printReportToPrinter(printer) : false} />
        </View>}

        {selectedReport === 'rolling' ? (
          <Surface style={styles.panel} elevation={0}>
            <Text style={styles.panelTitle}>Rolling period</Text>
            <View style={[styles.rollingControls, isPhoneLayout && styles.rollingControlsPhone]}>
              <View style={styles.compareRow}>
                {[7, 15, 30, 60, 90].map((days) => <Button key={days} compact mode={rollingDays === days ? 'contained' : 'outlined'} onPress={() => setRollingDays(days)}>{days} days</Button>)}
              </View>
              <FormField style={styles.rollingCustomInput} dense mode="outlined" label="Custom days" keyboardType="number-pad" value={String(rollingDays)} onChangeText={(value) => setRollingDays(clampRollingDays(Number(value)))} />
            </View>
          </Surface>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={t.color.primary} />
            <Text style={styles.emptyText}>Loading report...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              <MetricCard label="Gross sales" value={money(currentTotal)} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
              <MetricCard label="Net sales" value={currentNetSales == null ? 'N/A' : money(currentNetSales)} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
              <MetricCard label="Paid orders" value={currentSalesOrders.length} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
              <MetricCard label="Average order" value={currentSalesOrders.length ? money(currentTotal / currentSalesOrders.length) : money(0)} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
              <MetricCard label="Discounts" value={money(currentDiscountTotal)} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
              <MetricCard label={`Vs ${compareSummaryLabel}`} value={`${difference >= 0 ? '+' : ''}${money(difference)}`} style={[isPhoneLayout ? styles.metricPhone : styles.metricTablet]} />
            </View>

            <Surface style={styles.panel} elevation={0}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelTitle}>{chartTitle}</Text>
                  <Text style={styles.panelSubtitle}>{chartSubtitle}</Text>
                </View>
                <View style={styles.legend}>
                  <Text style={styles.legendCurrent}>Current</Text>
                  {selectedReport === 'daily' ? <Menu visible={showCompareMenu} onDismiss={() => setShowCompareMenu(false)} anchor={<Button mode="text" compact accessibilityLabel={`Choose comparison period: ${COMPARE_LABELS[compareMode]}`} labelStyle={{ fontSize: 13 }} onPress={() => setShowCompareMenu(true)}>Prior period ▾</Button>}>{(Object.keys(COMPARE_LABELS) as CompareMode[]).map((mode) => <Menu.Item key={mode} title={COMPARE_LABELS[mode]} leadingIcon={compareMode === mode ? 'check' : undefined} onPress={() => { setCompareMode(mode); setShowCompareMenu(false); if (mode === 'custom') openDatePicker('custom'); }} />)}</Menu> : <Text style={styles.legendCompare}>Prior period</Text>}
                </View>
              </View>
              <ComparisonChart
                current={currentBuckets}
                compare={compareBuckets}
                chartKey={`${selectedReport}-${currentRange.start}-${currentRange.end}-${compareRange.start}-${compareRange.end}-${currentTotal}-${compareTotal}`}
              />
            </Surface>

            {selectedReport !== 'daily' && renderBreakdown('Gross sales by date', dailyBreakdown, 'No paid sales for this period.')}
            <SectionHeader title="Breakdown" /><View style={{ flexDirection: contentWidth >= 900 ? 'row' : 'column', gap: 20 }}><View style={{ flex: 1, minWidth: 0 }}>{renderBreakdown('Payment methods', paymentBreakdown, 'No paid sales for this period.')}</View><View style={{ flex: 1, minWidth: 0 }}>{renderBreakdown('Sales by channel', channelBreakdown, 'No paid sales for this period.')}</View></View>

            <Surface style={styles.panel} elevation={0}>
              <Text style={styles.panelTitle}>Channel financials</Text>
              <Text style={styles.panelSubtitle}>
                Gross sales, marketplace payout, commission, and net sales by channel.
              </Text>
              {channelFinancials.map((row) => (
                <View key={row.label} style={styles.channelFinancialRow}>
                  <View style={styles.channelFinancialHeading}>
                    <Text style={styles.breakdownLabel}>{row.label}</Text>
                    <Text style={styles.breakdownMeta}>{row.orders} orders</Text>
                  </View>
                  <View style={styles.channelFinancialMetrics}>
                    <Text style={styles.channelFinancialMetric}>Gross sales {money(row.grossSales)}</Text>
                    <Text style={styles.channelFinancialMetric}>
                      Gross payout {row.grossPayout == null ? 'N/A' : money(row.grossPayout)}
                    </Text>
                    <Text style={styles.channelFinancialMetric}>
                      Commission {row.commission == null ? 'N/A' : money(row.commission)}
                    </Text>
                    <Text style={styles.channelFinancialMetric}>
                      Net sales {row.netSales == null ? 'N/A' : money(row.netSales)}
                    </Text>
                  </View>
                </View>
              ))}
            </Surface>
          </>
        )}
      </ScrollView>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker value={draftDate} mode="date" display="default" onChange={onDateChange} />
      )}

      <EditorSheet
        visible={Boolean(showDatePicker && Platform.OS !== 'android')}
        title={showDatePicker === 'custom' ? 'Comparison date' : selectedReport === 'daily' ? 'Report date' : 'Anchor date'}
        subtitle={formatDisplayDate(formatDateToLocalISO(draftDate))}
        onDismiss={() => setShowDatePicker(null)}
        footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setShowDatePicker(null)}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={applyDraftDate}>Apply date</Button></>}
      >
        <DateTimePicker value={draftDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange} />
      </EditorSheet>

      <EditorSheet visible={!!tileInfo} title={tileInfo?.title || 'About reports'} onDismiss={() => setTileInfo(null)} footer={<Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setTileInfo(null)}>Close</Button>}><Text style={styles.panelSubtitle}>{tileInfo?.description}</Text></EditorSheet>

      {isPrintingReport ? (
        <View style={styles.hiddenReceiptContainer} pointerEvents="none">
          <View ref={reportReceiptRef} collapsable={false}>
            <ReportPrintTemplate snapshot={reportPrintSnapshot} storeName={storeInfo.shopName} />
          </View>
        </View>
      ) : null}

      <PrintSimulatorModal visible={showReportSimulator} order={null} imageUri={reportPreviewUri} title="Report print preview" subtitle={reportPrintSnapshot.periodLabel} onClose={() => setShowReportSimulator(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.background },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  heroCard: {
    backgroundColor: t.color.text,
    borderRadius: t.radius.card,
    padding: 18,
  },
  heroDescription: {
    color: t.color.border,
    marginTop: 10,
    lineHeight: 20,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportTile: {
    flexBasis: 220,
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    padding: 12,
  },
  reportTilePhone: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 12,
  },
  reportTileActive: {
    backgroundColor: t.color.background,
    shadowColor: t.color.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  reportTileAccent: {
    width: 48,
    height: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  reportTileTitle: {
    fontSize: 18,
    color: t.color.text,
    fontWeight: '800',
  },
  reportTileDescription: {
    marginTop: 8,
    color: t.color.muted,
    lineHeight: 19,
  },
  reportTileAction: {
    marginTop: 'auto',
    paddingTop: 16,
    fontWeight: '800',
  },
  reportTileActionPhone: { paddingTop: 8, fontSize: 14 },
  reportTileSoon: {
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: t.color.border,
    padding: 16,
    justifyContent: 'space-between',
  },
  reportTileSoonTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: t.color.text,
  },
  reportTileSoonText: {
    marginTop: 10,
    color: t.color.muted,
    lineHeight: 19,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  phonePeriodRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  phonePeriodButton: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 6, paddingVertical: 8, borderWidth: 1, borderColor: t.color.border, borderRadius: 10, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' },
  phonePeriodLabel: { fontSize: 14, lineHeight: 16, fontWeight: '700', color: t.color.text, textAlign: 'center' },
  periodPressed: { backgroundColor: t.color.primaryTint },
  periodDisabled: { opacity: 0.45 },
  periodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  periodNextButtonContent: {
    flexDirection: 'row-reverse',
  },
  eyebrow: { fontSize: 14, color: t.color.muted, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 26, color: t.color.surface, fontWeight: '800', marginTop: 4 },
  reportPeriodTitle: { fontSize: 24, color: t.color.text, fontWeight: '800', marginTop: 2 },
  compareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rollingControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  rollingControlsPhone: { alignItems: 'stretch' },
  rollingCustomInput: { width: 150, backgroundColor: t.color.surface },
  compareChip: {
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radius.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.color.surface,
  },
  compareChipActive: { borderColor: t.color.primary, backgroundColor: t.color.primaryTint },
  compareChipText: { color: t.color.muted, fontWeight: '700' },
  compareChipTextActive: { color: t.color.primary },
  loading: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  metricPhone: { flexBasis: '45%', minWidth: 120 },
  metricTablet: { flexBasis: '30%', minWidth: 160 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  statBox: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: t.radius.card,
    padding: 14,
    borderLeftWidth: 4,
  },
  statBoxPhone: {
    flexGrow: 0,
    flexBasis: '47%',
  },
  statBoxSales: { backgroundColor: t.color.primaryTint, borderLeftColor: t.color.primary },
  statBoxNet: { backgroundColor: '#faf5ff', borderLeftColor: '#9333ea' },
  statBoxOrders: { backgroundColor: t.color.successTint, borderLeftColor: t.color.success },
  statBoxAverage: { backgroundColor: t.color.warningTint, borderLeftColor: t.color.warning },
  statBoxPositive: { backgroundColor: t.color.successTint, borderLeftColor: t.color.success },
  statBoxNegative: { backgroundColor: t.color.dangerTint, borderLeftColor: t.color.danger },
  statLabel: { fontSize: 14, color: t.color.muted, fontWeight: '700' },
  statValue: { fontSize: 24, color: t.color.text, fontWeight: '800', marginTop: 6 },
  statSubtext: { color: t.color.muted, marginTop: 2 },
  positive: { color: t.color.success },
  negative: { color: t.color.danger },
  panel: { borderRadius: t.radius.card, padding: 20, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  panelTitle: { fontSize: 17, color: t.color.text, fontWeight: '800' },
  panelSubtitle: { color: t.color.muted, marginTop: 2, flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexWrap: 'wrap' },
  legendCurrent: { color: t.color.primary, fontWeight: '800' },
  legendCompare: { color: t.color.muted, fontWeight: '800' },
  chartWrap: { marginTop: 6, minWidth: 0, width: '100%' },
  chartAxisText: { color: t.color.muted, fontSize: 14 },
  chartXAxisLabel: { color: t.color.muted, fontSize: 14, marginTop: 14 },
  dataPointLabel: { color: t.color.primary, fontSize: 14, fontWeight: '800' },
  pointerLabel: {
    borderRadius: t.radius.card,
    backgroundColor: t.color.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pointerLabelText: { color: t.color.surface, fontSize: 14, fontWeight: '800' },
  pointerLabelValue: { color: '#bfdbfe', fontSize: 14, marginTop: 3 },
  pointerLabelMuted: { color: t.color.border, fontSize: 14, marginTop: 2 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
    gap: 12,
  },
  breakdownLabel: { color: t.color.text, fontWeight: '800', flexShrink: 1 },
  breakdownMeta: { color: t.color.muted, marginTop: 2 },
  breakdownValue: { color: t.color.text, fontWeight: '800', fontSize: 16 },
  channelFinancialRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
    gap: 10,
  },
  channelFinancialHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  channelFinancialMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelFinancialMetric: {
    flexBasis: 150,
    flexGrow: 1,
    color: t.color.text,
    fontWeight: '700',
  },
  emptyText: { color: t.color.muted },
  dateModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  dateModal: {
    width: '100%', maxWidth: 620, alignSelf: 'center',
    borderRadius: t.radius.dialog,
    backgroundColor: t.color.surface,
    padding: 16,
  },
  dateModalHeader: { gap: 3, marginBottom: 8 },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  printerChoice: { marginTop: 10, alignItems: 'flex-start' },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hiddenReceiptContainer: { position: 'absolute', left: -10000, top: 0, opacity: 0 },
});
