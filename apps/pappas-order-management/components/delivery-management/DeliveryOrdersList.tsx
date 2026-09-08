import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, Card, Button, Surface, useTheme, Chip, Searchbar } from 'react-native-paper';
import { getDeliveryOrders } from '../../lib/delivery-management';
import { dateRangeBounds } from '../../lib/delivery-management-state';
import type { ShipdayDeliveryRecord } from '../../../../libs/types/delivery-management';

type Props = {
  onSelectOrder: (order: ShipdayDeliveryRecord) => void;
};

export function DeliveryOrdersList({ onSelectOrder }: Props) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  
  // Date range state (simple toggle for now: Today vs Last 7 Days)
  const [dateRange, setDateRange] = useState<'today' | 'week'>('today');
  
  const { from, to } = React.useMemo(() => {
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    
    if (dateRange === 'today') {
      return dateRangeBounds(toStr, toStr);
    } else {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const fromStr = weekAgo.toISOString().split('T')[0];
      return dateRangeBounds(fromStr, toStr);
    }
  }, [dateRange]);

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
          <Chip compact mode="outlined" style={styles.chip}>{item.status}</Chip>
        </View>
        <View style={styles.cardBody}>
          <Text variant="bodyMedium">To: {item.customerName}</Text>
          <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="tail">Dropoff: {item.deliveryAddress}</Text>
          {item.deliveryFee !== null && (
            <Text variant="labelMedium" style={{ marginTop: 4 }}>Fee: ${item.deliveryFee.toFixed(2)}</Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Surface style={styles.filterBar} elevation={1}>
        <View style={styles.row}>
          <Chip 
            selected={dateRange === 'today'} 
            onPress={() => setDateRange('today')}
            style={styles.filterChip}
          >
            Today
          </Chip>
          <Chip 
            selected={dateRange === 'week'} 
            onPress={() => setDateRange('week')}
            style={styles.filterChip}
          >
            Last 7 Days
          </Chip>
        </View>
        <Searchbar
          placeholder="Search ref/customer/address"
          onChangeText={setSearch}
          value={search}
          style={styles.searchbar}
          inputStyle={{ minHeight: 40 }}
        />
      </Surface>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centerContent}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>Failed to load deliveries</Text>
          <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 16 }}>Retry</Button>
        </View>
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
    backgroundColor: '#f4f4f4',
  },
  filterBar: {
    padding: 12,
    backgroundColor: '#ffffff',
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
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
