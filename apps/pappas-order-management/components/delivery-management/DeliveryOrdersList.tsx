import { ActionButton as Button } from '@/components/ui/ActionButton';
import { SearchField as Searchbar } from '@/components/ui';
import { formatDateToLocalISO } from '@/utils/orderUtils';
import { AsyncState, StatusBadge } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, Card, Surface, useTheme, Chip } from 'react-native-paper';
import { getDeliveryOrders } from '../../lib/delivery-management';
import { dateRangeBounds } from '../../lib/delivery-management-state';
import type { ShipdayDeliveryRecord } from '../../../../libs/types/delivery-management';

type Props = {
  onSelectOrder: (order: ShipdayDeliveryRecord) => void;
  onNewDelivery?: () => void;
};

export function DeliveryOrdersList({ onSelectOrder, onNewDelivery }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');

  // Date range state (simple toggle for now: Today vs Last 7 Days)
  const [dateRange, setDateRange] = useState<'today' | 'week'>('today');

  const todayDate = formatDateToLocalISO(new Date());
  const { from, to } = React.useMemo(() => {
    const toStr = todayDate;

    if (dateRange === 'today') {
      return dateRangeBounds(toStr, toStr);
    } else {
      const weekAgo = new Date(`${todayDate}T12:00:00`);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const fromStr = formatDateToLocalISO(weekAgo);
      return dateRangeBounds(fromStr, toStr);
    }
  }, [dateRange, todayDate]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['delivery-orders', from, to, 1], // only fetching page 1 for simplicity here
    queryFn: () => getDeliveryOrders({ from, to, page: 1 }),
  });

  const orders = data?.orders || [];

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const lowerSearch = search.toLowerCase();
    return (
      o.reference.toLowerCase().includes(lowerSearch) ||
      o.customerName?.toLowerCase().includes(lowerSearch) ||
      o.deliveryAddress?.toLowerCase().includes(lowerSearch)
    );
  });

  const renderItem = ({ item }: { item: ShipdayDeliveryRecord }) => (
    <Card style={styles.card} onPress={() => onSelectOrder(item)}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.reference}</Text>
          <StatusBadge label={item.status} />
        </View>
        <View style={styles.cardBody}>
          <Text variant="bodyMedium">To: {item.customerName}</Text>
          <Text variant="bodySmall">Dropoff: {item.deliveryAddress}</Text>
          {item.deliveryFee !== null && (
            <Text variant="labelMedium" style={{ marginTop: 4 }}>Fee: ${item.deliveryFee.toFixed(2)}</Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={{ padding: width >= 1100 ? 16 : 12, gap: 20, backgroundColor: t.color.background }}>
        <View style={{ flexDirection: width < 600 ? 'column' : 'row', alignItems: 'stretch', gap: 8 }}><Searchbar placeholder="Search customer or address" onChangeText={setSearch} value={search} style={{ flex: width < 600 ? undefined : 1 }} />{onNewDelivery && <Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={onNewDelivery}>New delivery</Button>}</View>
        <View style={{ flexDirection: 'row', gap: 8 }}><Button mode="outlined" contentStyle={{ minHeight: 44 }} style={{ backgroundColor: dateRange === 'today' ? t.color.primaryTint : t.color.surface }} onPress={() => setDateRange('today')}>Today</Button><Button mode="outlined" contentStyle={{ minHeight: 44 }} style={{ backgroundColor: dateRange === 'week' ? t.color.primaryTint : t.color.surface }} onPress={() => setDateRange('week')}>Last 7 days</Button></View>
      </View>

      {isLoading ? (
        <AsyncState loading title="Loading deliveries" />
      ) : isError ? (
        <AsyncState title="Deliveries couldn’t load" icon="alert-outline" description="Check your connection and try again. Your selected date range is saved." retryLabel="Try again" retryMode="contained" onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text variant="bodyLarge">No deliveries found.</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  filterBar: {
    padding: 12,
    backgroundColor: t.color.surface,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  searchbar: {
    height: 48,
  },
  listContainer: {
    padding: 12,
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
    backgroundColor: t.color.surface,
    borderWidth: 1, borderColor: t.color.border,
    borderRadius: t.radius.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap', gap: 8,
    marginBottom: 8,
  },
  chip: {
    height: 28,
  },
  cardBody: {
    gap: 2,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
