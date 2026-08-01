import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Appbar, Button, Surface, Text } from 'react-native-paper';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import type { Order } from '@my-small-business/types';
import { getAllOrders } from '@/lib/orders';
import {
  buildChannelFinancialBreakdown,
  getOrderGrossSales,
  isMarketplaceSalesOrder,
} from '@/lib/marketplace-pos-import';
import { formatDateToLocalISO, getOrderChannelLabel, getPaymentMethodType, getTodayDateString } from '@/utils/orderUtils';

type CompareMode = 'lastWeek' | 'lastMonth' | 'lastYear' | 'custom';
type ReportType = 'daily' | 'weekly' | 'monthly';

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
    accent: '#2563eb',
  },
  {
    type: 'weekly',
    title: 'Weekly sales',
    description: 'Monday to Sunday totals grouped by date with previous week comparison.',
    accent: '#059669',
  },
  {
    type: 'monthly',
    title: 'Monthly sales',
    description: 'Full month performance grouped by date with previous month comparison.',
    accent: '#ea580c',
  },
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
};

const money = (value: number) => `$${Math.round(value).toLocaleString('en-AU')}`;

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

const toRangeBoundaryIso = (dateString: string, boundary: 'start' | 'end') => {
  const date = parseLocalDate(dateString);
  if (boundary === 'start') date.setHours(0, 0, 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date.toISOString();
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

const getRangeForReport = (reportType: ReportType, dateString: string): DateRange => {
  if (reportType === 'weekly') {
    return { start: startOfWeek(dateString), end: endOfWeek(dateString) };
  }
  if (reportType === 'monthly') {
    return { start: startOfMonth(dateString), end: endOfMonth(dateString) };
  }
  return { start: dateString, end: dateString };
};

const getCompareRangeForReport = (
  reportType: ReportType,
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
    const hour = created.getHours();
    if (hour < REPORT_START_HOUR || hour > REPORT_END_HOUR) return;
    const index = (hour - REPORT_START_HOUR) * 2 + (created.getMinutes() >= 30 ? 1 : 0);
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
    const dayKey = formatDateToLocalISO(new Date(order.created_at));
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
  buckets.map((bucket, index) => {
    const showLabel = buckets.length <= 7 || index % Math.max(1, Math.ceil(buckets.length / 6)) === 0 || index === buckets.length - 1;
    return {
      value: bucket.total,
      label: bucket.label,
      dataPointLabelComponent: bucket.total > 0
        ? () => <Text style={styles.dataPointLabel}>{money(bucket.total)}</Text>
        : undefined,
      dataPointLabelShiftX: -18,
      dataPointLabelShiftY: -12,
      dataPointLabelWidth: 48,
      labelComponent: () => (
        <Text style={styles.chartXAxisLabel}>{showLabel ? bucket.label : ''}</Text>
      ),
    };
  })
);

function ComparisonChart({
  current,
  compare,
  width,
  chartKey,
}: {
  current: ChartBucket[];
  compare: ChartBucket[];
  width: number;
  chartKey: string;
}) {
  const chartWidth = Math.max(320, width - 92);
  const maxValue = Math.max(1, ...current.map((b) => b.total), ...compare.map((b) => b.total));
  const roundedMaxValue = Math.ceil(maxValue / 50) * 50 || 50;
  const spacing = Math.max(6, (chartWidth - 24) / Math.max(1, current.length - 1));

  return (
    <View style={styles.chartWrap}>
      <LineChart
        key={chartKey}
        data={buildChartData(current)}
        data2={buildChartData(compare)}
        height={190}
        width={chartWidth}
        maxValue={roundedMaxValue}
        noOfSections={4}
        spacing={spacing}
        initialSpacing={8}
        endSpacing={8}
        color="#2563eb"
        color2="#94a3b8"
        thickness={3}
        thickness2={3}
        strokeDashArray2={[6, 5]}
        curved
        areaChart
        startFillColor="#bfdbfe"
        endFillColor="#ffffff"
        startOpacity={0.35}
        endOpacity={0.02}
        dataPointsRadius={3}
        dataPointsColor="#2563eb"
        hideDataPoints2
        yAxisColor="#e5e7eb"
        xAxisColor="#e5e7eb"
        rulesColor="#e5e7eb"
        yAxisTextStyle={styles.chartAxisText}
        xAxisLabelTextStyle={styles.chartAxisText}
        yAxisLabelPrefix="$"
        yAxisLabelWidth={44}
        xAxisLabelsHeight={40}
        xAxisLabelsVerticalShift={8}
        disableScroll
        pointerConfig={{
          pointerStripHeight: 190,
          pointerStripColor: '#94a3b8',
          pointerStripWidth: 1,
          pointerColor: '#2563eb',
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
      />
    </View>
  );
}

export default function ReportScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { width } = useWindowDimensions();
  const requestIdRef = useRef(0);
  const [selectedReport, setSelectedReport] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [compareMode, setCompareMode] = useState<CompareMode>('lastWeek');
  const [customCompareDate, setCustomCompareDate] = useState(addDate(getTodayDateString(), -7, 'day'));
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [compareOrders, setCompareOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'current' | 'custom' | null>(null);
  const [draftDate, setDraftDate] = useState<Date>(parseLocalDate(getTodayDateString()));

  const currentRange = useMemo(
    () => getRangeForReport(selectedReport, selectedDate),
    [selectedDate, selectedReport]
  );

  const compareRange = useMemo(
    () => getCompareRangeForReport(selectedReport, selectedDate, compareMode, customCompareDate),
    [compareMode, customCompareDate, selectedDate, selectedReport]
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
          since: toRangeBoundaryIso(currentRange.start, 'start'),
          until: toRangeBoundaryIso(currentRange.end, 'end'),
          payment_status: 'paid',
        }),
        getAllOrders({
          since: toRangeBoundaryIso(compareRange.start, 'start'),
          until: toRangeBoundaryIso(compareRange.end, 'end'),
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
    () => buildBreakdown(currentOrders, (order) => {
      const type = getPaymentMethodType(order);
      if (type === 'card') return 'Card';
      return 'Cash';
    }),
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

  const dailyBreakdown = useMemo(
    () => (
      selectedReport === 'daily'
        ? []
        : buildBreakdown(currentOrders, (order) => formatShortDay(formatDateToLocalISO(new Date(order.created_at))))
    ),
    [currentOrders, selectedReport]
  );

  const compareSummaryLabel = useMemo(() => {
    if (selectedReport === 'daily') return COMPARE_LABELS[compareMode].toLowerCase();
    return selectedReport === 'weekly' ? 'previous week' : 'previous month';
  }, [compareMode, selectedReport]);

  const chartTitle = selectedReport === 'daily'
    ? '30 minute gross sales'
    : selectedReport === 'weekly'
      ? 'Gross sales by day'
      : 'Monthly daily gross sales';

  const chartSubtitle = selectedReport === 'daily'
    ? `Current date compared with ${formatDisplayDate(compareRange.start)}`
    : `${formatRangeLabel(currentRange.start, currentRange.end)} compared with ${formatRangeLabel(compareRange.start, compareRange.end)}`;

  const periodTitle = selectedReport === 'daily'
    ? formatDisplayDate(selectedDate)
    : formatRangeLabel(currentRange.start, currentRange.end);

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
    <Surface key={`${selectedReport}-${title}`} style={styles.panel} elevation={1}>
      <Text style={styles.panelTitle}>{title}</Text>
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
    </Surface>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Report" color="#fff" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >


        <View style={styles.tileGrid}>
          {REPORT_TILES.map((tile) => {
            const active = tile.type === selectedReport;
            return (
              <TouchableOpacity
                key={tile.type}
                style={[
                  styles.reportTile,
                  active ? styles.reportTileActive : null,
                  { borderColor: tile.accent },
                ]}
                onPress={() => setSelectedReport(tile.type)}
              >
                <View style={[styles.reportTileAccent, { backgroundColor: tile.accent }]} />
                <Text style={styles.reportTileTitle}>{tile.title}</Text>
                <Text style={styles.reportTileDescription}>{tile.description}</Text>
                <Text style={[styles.reportTileAction, { color: tile.accent }]}>
                  {active ? 'Viewing now' : 'Open report'}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Surface style={styles.reportTileSoon} elevation={0}>
            <Text style={styles.reportTileSoonTitle}>More reports coming soon</Text>
            <Text style={styles.reportTileSoonText}>
              Inventory, staff, product, and customer insights can plug into this same hub later.
            </Text>
          </Surface>
        </View>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{REPORT_LABELS[selectedReport]}</Text>
            <Text style={styles.reportPeriodTitle}>{periodTitle}</Text>
          </View>
          <View style={styles.periodActions}>
            {selectedReport !== 'daily' && (
              <>
                <Button mode="outlined" compact icon="chevron-left" onPress={() => shiftSelectedPeriod('previous')}>
                  Prev
                </Button>
                <Button mode="outlined" compact icon="chevron-right" contentStyle={styles.periodNextButtonContent} onPress={() => shiftSelectedPeriod('next')}>
                  Next
                </Button>
              </>
            )}
            <Button mode="outlined" icon="calendar" onPress={() => openDatePicker('current')}>
              {selectedReport === 'daily' ? 'Date' : 'Pick'}
            </Button>
          </View>
        </View>

        {selectedReport === 'daily' && (
          <View style={styles.compareRow}>
            {(Object.keys(COMPARE_LABELS) as CompareMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.compareChip, compareMode === mode && styles.compareChipActive]}
                onPress={() => {
                  setCompareMode(mode);
                  if (mode === 'custom') openDatePicker('custom');
                }}
              >
                <Text style={[styles.compareChipText, compareMode === mode && styles.compareChipTextActive]}>
                  {mode === 'custom' ? 'Custom' : COMPARE_LABELS[mode].replace('Same day ', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && !refreshing ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.emptyText}>Loading report...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              <View style={[styles.statBox, styles.statBoxSales]}>
                <Text style={styles.statLabel}>Gross sales</Text>
                <Text style={styles.statValue}>{money(currentTotal)}</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxOrders]}>
                <Text style={styles.statLabel}>Paid orders</Text>
                <Text style={styles.statValue}>{currentSalesOrders.length}</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxAverage]}>
                <Text style={styles.statLabel}>Average order</Text>
                <Text style={styles.statValue}>
                  {currentSalesOrders.length ? money(currentTotal / currentSalesOrders.length) : money(0)}
                </Text>
              </View>
              <View style={[styles.statBox, styles.statBoxAverage]}>
                <Text style={styles.statLabel}>Discounts</Text>
                <Text style={styles.statValue}>{money(currentDiscountTotal)}</Text>
                <Text style={styles.statSubtext}>
                  Vs {compareSummaryLabel} {money(currentDiscountTotal - compareDiscountTotal)}
                </Text>
              </View>
              <View style={[styles.statBox, difference >= 0 ? styles.statBoxPositive : styles.statBoxNegative]}>
                <Text style={styles.statLabel}>Vs {compareSummaryLabel}</Text>
                <Text style={[styles.statValue, difference >= 0 ? styles.positive : styles.negative]}>
                  {difference >= 0 ? '+' : ''}{money(difference)}
                </Text>
                <Text style={styles.statSubtext}>
                  {differencePercent == null ? 'No comparison sales' : `${differencePercent >= 0 ? '+' : ''}${differencePercent.toFixed(1)}%`}
                </Text>
              </View>
            </View>

            <Surface style={styles.panel} elevation={1}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelTitle}>{chartTitle}</Text>
                  <Text style={styles.panelSubtitle}>{chartSubtitle}</Text>
                </View>
                <View style={styles.legend}>
                  <Text style={styles.legendCurrent}>Current</Text>
                  <Text style={styles.legendCompare}>Compare</Text>
                </View>
              </View>
              <ComparisonChart
                current={currentBuckets}
                compare={compareBuckets}
                width={width}
                chartKey={`${selectedReport}-${currentRange.start}-${currentRange.end}-${compareRange.start}-${compareRange.end}-${currentTotal}-${compareTotal}`}
              />
            </Surface>

            {selectedReport !== 'daily' && renderBreakdown('Gross sales by date', dailyBreakdown, 'No paid sales for this period.')}
            {renderBreakdown('Payment method', paymentBreakdown, 'No paid sales for this period.')}
            {renderBreakdown('Channel', channelBreakdown, 'No paid sales for this period.')}

            <Surface style={styles.panel} elevation={1}>
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

      <Modal
        visible={Boolean(showDatePicker && Platform.OS !== 'android')}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(null)}
      >
        <View style={styles.dateModalBackdrop}>
          <Surface style={styles.dateModal} elevation={3}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.panelTitle}>
                {showDatePicker === 'custom' ? 'Comparison date' : selectedReport === 'daily' ? 'Report date' : 'Anchor date'}
              </Text>
              <Text style={styles.panelSubtitle}>{formatDisplayDate(formatDateToLocalISO(draftDate))}</Text>
            </View>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              onChange={onDateChange}
            />
            <View style={styles.dateModalActions}>
              <Button mode="outlined" onPress={() => setShowDatePicker(null)}>
                Cancel
              </Button>
              <Button mode="contained" onPress={applyDraftDate}>
                Apply
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  appbar: { backgroundColor: '#1f2937' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 18,
  },
  heroDescription: {
    color: '#cbd5e1',
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
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    padding: 16,
  },
  reportTileActive: {
    backgroundColor: '#f8fafc',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  reportTileAccent: {
    width: 48,
    height: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  reportTileTitle: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '800',
  },
  reportTileDescription: {
    marginTop: 8,
    color: '#475569',
    lineHeight: 19,
  },
  reportTileAction: {
    marginTop: 'auto',
    paddingTop: 16,
    fontWeight: '800',
  },
  reportTileSoon: {
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    padding: 16,
    justifyContent: 'space-between',
  },
  reportTileSoonTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
  },
  reportTileSoonText: {
    marginTop: 10,
    color: '#475569',
    lineHeight: 19,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
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
  eyebrow: { fontSize: 13, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 26, color: '#fff', fontWeight: '800', marginTop: 4 },
  reportPeriodTitle: { fontSize: 24, color: '#111827', fontWeight: '800', marginTop: 2 },
  compareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compareChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  compareChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  compareChipText: { color: '#475569', fontWeight: '700' },
  compareChipTextActive: { color: '#1d4ed8' },
  loading: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 6,
    padding: 14,
    borderLeftWidth: 4,
  },
  statBoxSales: { backgroundColor: '#eff6ff', borderLeftColor: '#2563eb' },
  statBoxOrders: { backgroundColor: '#f0fdf4', borderLeftColor: '#16a34a' },
  statBoxAverage: { backgroundColor: '#fff7ed', borderLeftColor: '#f97316' },
  statBoxPositive: { backgroundColor: '#ecfdf5', borderLeftColor: '#059669' },
  statBoxNegative: { backgroundColor: '#fef2f2', borderLeftColor: '#dc2626' },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  statValue: { fontSize: 24, color: '#111827', fontWeight: '800', marginTop: 6 },
  statSubtext: { color: '#64748b', marginTop: 2 },
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  panel: { borderRadius: 8, padding: 14, backgroundColor: '#fff' },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  panelTitle: { fontSize: 17, color: '#111827', fontWeight: '800' },
  panelSubtitle: { color: '#64748b', marginTop: 2, flexShrink: 1 },
  legend: { alignItems: 'flex-end', gap: 3 },
  legendCurrent: { color: '#2563eb', fontWeight: '800' },
  legendCompare: { color: '#64748b', fontWeight: '800' },
  chartWrap: { marginTop: 6, marginLeft: -4 },
  chartAxisText: { color: '#64748b', fontSize: 11 },
  chartXAxisLabel: { color: '#64748b', fontSize: 11, marginTop: 14 },
  dataPointLabel: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  pointerLabel: {
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pointerLabelText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pointerLabelValue: { color: '#bfdbfe', fontSize: 12, marginTop: 3 },
  pointerLabelMuted: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  breakdownLabel: { color: '#111827', fontWeight: '800' },
  breakdownMeta: { color: '#64748b', marginTop: 2 },
  breakdownValue: { color: '#111827', fontWeight: '800', fontSize: 16 },
  channelFinancialRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  channelFinancialHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  channelFinancialMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelFinancialMetric: {
    flexBasis: 150,
    flexGrow: 1,
    color: '#334155',
    fontWeight: '700',
  },
  emptyText: { color: '#64748b' },
  dateModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  dateModal: {
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 16,
  },
  dateModalHeader: { gap: 3, marginBottom: 8 },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
});
