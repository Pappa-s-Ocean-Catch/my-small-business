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
import { formatDateToLocalISO, getOrderChannelLabel, getPaymentMethodType, getTodayDateString } from '@/utils/orderUtils';

type CompareMode = 'lastWeek' | 'lastMonth' | 'lastYear' | 'custom';

type SalesBucket = {
  label: string;
  total: number;
};

type BreakdownRow = {
  label: string;
  orders: number;
  total: number;
};

const REPORT_START_HOUR = 10;
const REPORT_END_HOUR = 21;
const REPORT_BUCKETS = (REPORT_END_HOUR - REPORT_START_HOUR) * 2 + 1;

const COMPARE_LABELS: Record<CompareMode, string> = {
  lastWeek: 'Same day last week',
  lastMonth: 'Same day last month',
  lastYear: 'Same day last year',
  custom: 'Custom date',
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

const formatDisplayDate = (dateString: string) => (
  parseLocalDate(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
);

const getPaidSalesOrders = (orders: Order[]) => (
  orders.filter((order) => order.payment_status === 'paid' && order.order_status !== 'cancelled')
);

const buildBuckets = (orders: Order[]): SalesBucket[] => {
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
    buckets[index].total += Number(order.total) || 0;
  });

  return buckets;
};

const buildBreakdown = (orders: Order[], groupBy: (order: Order) => string): BreakdownRow[] => {
  const map = new Map<string, BreakdownRow>();
  getPaidSalesOrders(orders).forEach((order) => {
    const label = groupBy(order);
    const current = map.get(label) || { label, orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(order.total) || 0;
    map.set(label, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const buildChartData = (buckets: SalesBucket[]): lineDataItem[] => (
  buckets.map((bucket, index) => {
    const showLabel = index % 4 === 0 || index === buckets.length - 1;
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

function MiniLineChart({
  current,
  compare,
  width,
  chartKey,
}: {
  current: SalesBucket[];
  compare: SalesBucket[];
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
        height={180}
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
        xAxisLabelsHeight={36}
        xAxisLabelsVerticalShift={8}
        disableScroll
        pointerConfig={{
          pointerStripHeight: 180,
          pointerStripColor: '#94a3b8',
          pointerStripWidth: 1,
          pointerColor: '#2563eb',
          radius: 4,
          pointerLabelWidth: 120,
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
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [compareMode, setCompareMode] = useState<CompareMode>('lastWeek');
  const [customCompareDate, setCustomCompareDate] = useState(addDate(getTodayDateString(), -7, 'day'));
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [compareOrders, setCompareOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'current' | 'custom' | null>(null);
  const [draftDate, setDraftDate] = useState<Date>(parseLocalDate(getTodayDateString()));

  const compareDate = useMemo(() => {
    if (compareMode === 'lastWeek') return addDate(selectedDate, -7, 'day');
    if (compareMode === 'lastMonth') return addDate(selectedDate, -1, 'month');
    if (compareMode === 'lastYear') return addDate(selectedDate, -1, 'year');
    return customCompareDate;
  }, [compareMode, customCompareDate, selectedDate]);

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
        getAllOrders({ date: selectedDate, payment_status: 'paid' }),
        getAllOrders({ date: compareDate, payment_status: 'paid' }),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (current.error || compare.error) {
        Alert.alert('Error', current.error || compare.error || 'Failed to load report');
        return;
      }

      setCurrentOrders(current.data || []);
      setCompareOrders(compare.data || []);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      Alert.alert('Error', 'Failed to load report');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [compareDate, selectedDate]);

  useEffect(() => {
    void loadReport({ clearBeforeLoad: true });
  }, [loadReport]);

  const currentSalesOrders = useMemo(() => getPaidSalesOrders(currentOrders), [currentOrders]);
  const compareSalesOrders = useMemo(() => getPaidSalesOrders(compareOrders), [compareOrders]);
  const currentTotal = currentSalesOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const compareTotal = compareSalesOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const difference = currentTotal - compareTotal;
  const differencePercent = compareTotal > 0 ? (difference / compareTotal) * 100 : null;
  const currentBuckets = useMemo(() => buildBuckets(currentOrders), [currentOrders]);
  const compareBuckets = useMemo(() => buildBuckets(compareOrders), [compareOrders]);
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

  const onRefresh = () => {
    setRefreshing(true);
    void loadReport();
  };

  const openDatePicker = (target: 'current' | 'custom') => {
    setDraftDate(parseLocalDate(target === 'current' ? selectedDate : customCompareDate));
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

  const renderBreakdown = (title: string, rows: BreakdownRow[]) => (
    <Surface key={`${selectedDate}-${title}`} style={styles.panel} elevation={1}>
      <Text style={styles.panelTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No paid sales for this date.</Text>
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Sales report</Text>
            <Text style={styles.title}>{formatDisplayDate(selectedDate)}</Text>
          </View>
          <Button mode="outlined" icon="calendar" onPress={() => openDatePicker('current')}>
            Date
          </Button>
        </View>

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

        {loading && !refreshing ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.emptyText}>Loading report...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              <View style={[styles.statBox, styles.statBoxSales]}>
                <Text style={styles.statLabel}>Total sales</Text>
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
              <View style={[styles.statBox, difference >= 0 ? styles.statBoxPositive : styles.statBoxNegative]}>
                <Text style={styles.statLabel}>Vs {COMPARE_LABELS[compareMode].toLowerCase()}</Text>
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
                  <Text style={styles.panelTitle}>30 minute sales</Text>
                  <Text style={styles.panelSubtitle}>
                    Current date compared with {formatDisplayDate(compareDate)}
                  </Text>
                </View>
                <View style={styles.legend}>
                  <Text style={styles.legendCurrent}>Current</Text>
                  <Text style={styles.legendCompare}>Compare</Text>
                </View>
              </View>
              <MiniLineChart
                current={currentBuckets}
                compare={compareBuckets}
                width={width}
                chartKey={`${selectedDate}-${compareDate}-${currentTotal}-${compareTotal}`}
              />
            </Surface>

            {renderBreakdown('Payment method', paymentBreakdown)}
            {renderBreakdown('Channel', channelBreakdown)}
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
                {showDatePicker === 'custom' ? 'Comparison date' : 'Report date'}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: { fontSize: 13, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 24, color: '#111827', fontWeight: '800', marginTop: 2 },
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
  panelSubtitle: { color: '#64748b', marginTop: 2 },
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
