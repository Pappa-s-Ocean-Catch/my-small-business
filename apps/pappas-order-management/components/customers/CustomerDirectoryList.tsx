import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Searchbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { Customer } from '@/lib/customers';

type Props = {
  customers: Customer[];
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  loading?: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  emptyText?: string;
  loadingText?: string;
  searchPlaceholder?: string;
  headerActionLabel?: string;
  onHeaderActionPress?: () => void;
};

const formatMoney = (value?: number) => `$${(Number(value) || 0).toFixed(2)}`;

const getInitials = (name: string) => (
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '??'
);

export function CustomerDirectoryList({
  customers,
  searchQuery,
  onChangeSearchQuery,
  onSelectCustomer,
  loading = false,
  loadingMore = false,
  refreshing = false,
  onRefresh,
  onEndReached,
  emptyText = 'No customers found',
  loadingText = 'Loading customers...',
  searchPlaceholder = 'Search customers...',
  headerActionLabel,
  onHeaderActionPress,
}: Props) {
  const theme = useTheme();

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <Card
      style={styles.card}
      onPress={() => onSelectCustomer(item)}
      mode="contained"
    >
      <Card.Content style={styles.cardContent}>
        <Avatar.Text
          size={48}
          label={getInitials(item.name || 'Unknown')}
          style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}
          labelStyle={{ color: theme.colors.onPrimaryContainer }}
        />
        <View style={styles.infoContainer}>
          <Text variant="titleMedium" style={styles.name}>{item.name || 'Unknown'}</Text>
          <Text variant="bodySmall" style={styles.contact}>{item.email || item.phone || 'No contact details'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="cart-outline" size={14} color={theme.colors.secondary} />
              <Text variant="labelSmall" style={styles.statText}>{item.totalOrders ?? 0} orders</Text>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="currency-usd" size={14} color="#16a34a" />
              <Text variant="labelSmall" style={styles.statText}>{formatMoney(item.totalSpent)} spent</Text>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="star-outline" size={14} color="#f59e0b" />
              <Text variant="labelSmall" style={styles.statText}>{item.rewardPoints ?? 0} pts</Text>
            </View>
          </View>
        </View>
        <IconButton icon="chevron-right" size={20} />
      </Card.Content>
    </Card>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Surface style={styles.searchSurface} elevation={1}>
          <Searchbar
            placeholder={searchPlaceholder}
            onChangeText={onChangeSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            elevation={0}
          />
        </Surface>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.searchSurface} elevation={1}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder={searchPlaceholder}
            onChangeText={onChangeSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            elevation={0}
          />
          {headerActionLabel && onHeaderActionPress ? (
            <Button
              mode="contained"
              icon="account-plus-outline"
              onPress={onHeaderActionPress}
              style={styles.headerActionButton}
              contentStyle={styles.headerActionButtonContent}
            >
              {headerActionLabel}
            </Button>
          ) : null}
        </View>
      </Surface>

      <FlatList
        data={customers}
        keyExtractor={(item) => `${item.id}-${item.email}-${item.phone}`}
        renderItem={renderCustomerItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-search-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSurface: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBar: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionButton: {
    borderRadius: 12,
  },
  headerActionButtonContent: {
    height: 52,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: '#1e293b',
  },
  contact: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
