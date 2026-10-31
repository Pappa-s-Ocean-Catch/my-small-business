import { ActionButton as Button } from '@/components/ui/ActionButton';
import { SearchField as Searchbar } from '@/components/ui';
import { StatusBadge } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, Pressable, useWindowDimensions } from 'react-native';
import { Avatar, Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { Customer } from '@/lib/customers';
import { BRAND_COLORS } from '@/utils/brand';

type Props = {
  headerNotice?: React.ReactNode;
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
  headerNotice,
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
  searchPlaceholder = 'Search customers by name, phone or email',
  headerActionLabel,
  onHeaderActionPress,
}: Props) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 600;
  const gutter = width < 1100 ? 12 : 16;

  const renderCustomerItem = ({ item, index }: { item: Customer; index: number }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${item.name || 'Unknown'}`} onPress={() => onSelectCustomer(item)} style={[styles.card, compact && styles.cardCompact, index === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1 }, index === customers.length - 1 && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } ]}>
      <Avatar.Text size={44} label={getInitials(item.name || 'Unknown')} style={[styles.avatar, { backgroundColor: t.color.primaryTint }]} labelStyle={{ color: t.color.primary, fontSize: 16, fontWeight: '700' }} />
      <View style={[styles.infoContainer, compact && styles.infoCompact]}><Text style={styles.name}>{item.name || 'Unknown'}</Text><Text style={styles.contact}>{item.phone || item.email || 'No contact details'} · {item.totalOrders ?? 0} orders{item.lastOrderDate ? ` · Last visit ${new Date(item.lastOrderDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}</Text></View>
      <StatusBadge label={`${item.rewardPoints ?? 0} pts`} tone="primary" />
    </Pressable>
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
        <Surface style={[styles.searchSurface, { paddingHorizontal: gutter }]} elevation={0}>
          <Searchbar
            placeholder={searchPlaceholder}
            onChangeText={onChangeSearchQuery}
            value={searchQuery}
            style={[styles.searchBar, compact && styles.searchBarCompact]}
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
      <Surface style={[styles.searchSurface, { paddingHorizontal: gutter }]} elevation={0}>
        <View style={[styles.searchRow, compact && styles.searchRowCompact]}>
          <Searchbar
            placeholder={searchPlaceholder}
            onChangeText={onChangeSearchQuery}
            value={searchQuery}
            style={[styles.searchBar, compact && styles.searchBarCompact]}
            elevation={0}
          />
          {headerActionLabel && onHeaderActionPress ? (
            <Button
              mode="contained"
              onPress={onHeaderActionPress}
              buttonColor={t.color.primary}
              style={[styles.headerActionButton, compact && styles.headerActionCompact]}
              contentStyle={styles.headerActionButtonContent}
            >
              {headerActionLabel}
            </Button>
          ) : null}
        </View>
      </Surface>

      {headerNotice}
      <FlatList
        data={customers}
        keyExtractor={(item) => `${item.id}-${item.email}-${item.phone}`}
        renderItem={renderCustomerItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter }]}
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
    padding: 16,
    paddingBottom: 20,
    backgroundColor: t.color.background,
  },
  searchBar: {
    backgroundColor: t.color.surface,
    flex: 1,
    minWidth: 180,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerActionButton: {
    borderRadius: t.radius.control,
  },
  headerActionButtonContent: {
    minHeight: 48,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  separator: {
    height: 0,
  },
  card: {
    backgroundColor: t.color.surface,
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: t.color.border, minHeight: 82, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardCompact: { paddingHorizontal: 14, gap: 10, flexWrap: 'nowrap', minHeight: 102 },
  infoCompact: { minWidth: 0 },
  searchRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  searchBarCompact: { flex: 0, width: '100%' },
  headerActionCompact: { width: '100%' },
  avatar: {
    marginRight: 2,
    flexShrink: 0,
  },
  infoContainer: {
    flex: 1,
    minWidth: 120,
  },
  name: {
    fontSize: 16, fontWeight: '700',
    color: t.color.text,
  },
  contact: {
    color: t.color.muted,
    marginTop: 2,
    fontSize: 13,
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
    color: t.color.muted,
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: t.color.muted,
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
