import { ActionButton as Button } from '@/components/ui/ActionButton';
import { SearchField as Searchbar } from '@/components/ui';
import { WorkspaceHeader, StatusBadge, EditorSheet, DetailRow } from '@/components/ui';
import { ResponsiveDialog as Dialog } from '@/components/ui/ResponsiveDialog';
import { designTokens as t } from '@/lib/redesign';
import { PageHeader } from '@/components/ui';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Clipboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Appbar,
  Card,
  Chip,
  Portal,
  Switch,
  Text,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BRAND_COLORS } from '@/utils/brand';

import {
  getCouponsList,
  toggleCouponActive,
  type Coupon,
} from '@/lib/coupons';

type FilterType = 'all' | 'active' | 'inactive' | 'expired';

export default function CouponsScreen() {
  const theme = useTheme();
  const [contentWidth, setContentWidth] = useState(0);
  const columns = contentWidth < 600 ? 1 : contentWidth < 1000 ? 2 : 3;
  const gutter = contentWidth >= 1100 ? 16 : 12;
  const cardWidth = Math.max(0, (contentWidth - gutter * 2 - (columns - 1) * 16) / columns);
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [activeDraft, setActiveDraft] = useState(false);
  useEffect(() => { setActiveDraft(selectedCoupon?.is_active ?? false); }, [selectedCoupon?.id, selectedCoupon?.is_active]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    const result = await getCouponsList({ searchQuery, filter, page, pageSize });
    setLoading(false);
    setRefreshing(false);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      setCoupons(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    }
  }, [searchQuery, filter, page, pageSize]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCoupons();
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    setPage(1);
  };

  const handleCopyCode = (code: string) => {
    try {
      Clipboard.setString(code);
      Alert.alert('Copied', `Coupon code "${code}" copied to clipboard.`);
    } catch {
      Alert.alert('Copied', `Coupon code "${code}" copied.`);
    }
  };

  const saveCouponDetails = async () => {
    if (!selectedCoupon || togglingId) return;
    if (activeDraft === selectedCoupon.is_active) { setSelectedCoupon(null); return; }
    const coupon = selectedCoupon;
    setTogglingId(coupon.id);
    try {
      const { success, error } = await toggleCouponActive(coupon.id, activeDraft);
      if (!success) { Alert.alert('Error', error || 'Failed to update coupon status.'); return; }
      setCoupons((current) => current.map((item) => item.id === coupon.id ? { ...item, is_active: activeDraft } : item));
      setSelectedCoupon(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update coupon status.');
    } finally { setTogglingId(null); }
  };

  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    const label = !coupon.is_active ? 'Inactive' : coupon.ends_at && new Date(coupon.ends_at) < now ? 'Expired' : coupon.starts_at && new Date(coupon.starts_at) > now ? 'Scheduled' : coupon.max_uses != null && coupon.usage_count >= coupon.max_uses ? 'Max uses' : 'Active';
    return <StatusBadge label={label} tone={label === 'Active' ? 'success' : label === 'Scheduled' ? 'primary' : 'neutral'} />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No limit';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.container} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <WorkspaceHeader title="Coupons" />

      <View style={[styles.filterSection, { padding: gutter }]}>
        <View style={{ flexDirection: contentWidth < 600 ? 'column' : 'row', alignItems: 'stretch', gap: 8, marginBottom: 24 }}><Searchbar
          placeholder="Search coupon code, title..."
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={[styles.searchBar, contentWidth < 600 && { flex: undefined, width: '100%' }]}
          elevation={0}
        /><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={onRefresh} loading={refreshing}>Refresh</Button></View>

        <View style={styles.filterChipRow}>
          {(['all', 'active', 'inactive', 'expired'] as FilterType[]).map((f) => (
            <Button key={f} mode="outlined" contentStyle={{ minHeight: 44 }} style={{ backgroundColor: filter === f ? t.color.primaryTint : t.color.surface, borderColor: filter === f ? t.color.primary : t.color.border }} onPress={() => handleFilterChange(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</Button>
          ))}
        </View>
      </View>

      <ScrollView
        style={[styles.content, { paddingHorizontal: gutter }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading coupons...</Text>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.centerContainer}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={54} color="#aaa" />
            <Text style={styles.emptyTitle}>No coupons found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting search query or filters.</Text>
          </View>
        ) : (
          <View style={styles.couponGrid}>
            {coupons.map((coupon) => {
              const discountText =
                coupon.discount_type === 'percent'
                  ? `${coupon.discount_value}% OFF`
                  : `$${coupon.discount_value.toFixed(2)} OFF`;

              return (
                <View key={coupon.id} style={[styles.couponCard, { width: cardWidth }]}>
                  <View style={styles.cardHeaderRow}><Text style={{ flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: 1.5, color: t.color.text }}>{coupon.code}</Text>{getStatusBadge(coupon)}</View>
                  <Text style={{ fontSize: 32, color: t.color.text, fontWeight: '700', marginTop: 22, marginBottom: 8 }}>{discountText.toLowerCase()}</Text>
                  <Text style={{ fontSize: 14, color: t.color.muted, marginBottom: 16 }}>{coupon.title} · Min ${coupon.min_cart_subtotal.toFixed(2)}</Text>
                  <Text style={{ fontSize: 14, color: t.color.muted }}>{coupon.usage_count}{coupon.max_uses != null ? ` / ${coupon.max_uses}` : ''} uses · Ends {formatDate(coupon.ends_at)}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderColor: t.color.border, paddingTop: 18, marginTop: 20 }}><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => handleCopyCode(coupon.code)}>Copy code</Button><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setSelectedCoupon(coupon)}>Details</Button></View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Pagination Footer */}
      <View style={styles.paginationFooter}>
        <Text style={styles.paginationInfo}>
          {totalCount === 0
            ? '0 coupons'
            : `Showing ${Math.min((page - 1) * pageSize + 1, totalCount)} - ${Math.min(page * pageSize, totalCount)} of ${totalCount}`}
        </Text>

        <View style={styles.paginationControls}>
          <View style={styles.pageSizeRow}>
            <Text style={styles.pageSizeLabel}>Per page:</Text>
            {[6, 10, 20, 50].map((size) => (
              <Chip
                key={size}
                compact
                selected={pageSize === size}
                onPress={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                style={styles.pageSizeChip}
              >
                {size}
              </Chip>
            ))}
          </View>

          <View style={styles.pageButtonsRow}>
            <Button
              mode="outlined"
              compact
              icon="chevron-left"
              disabled={page <= 1 || loading}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>

            <Text style={styles.pageNumberText}>
              {page} / {totalPages}
            </Text>

            <Button
              mode="outlined"
              compact
              contentStyle={{ flexDirection: 'row-reverse' }}
              icon="chevron-right"
              disabled={page >= totalPages || loading}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </View>
        </View>
      </View>

      <EditorSheet visible={selectedCoupon !== null} title="Coupon details" onDismiss={() => setSelectedCoupon(null)} dirty={!!selectedCoupon && activeDraft !== selectedCoupon.is_active} pending={!!togglingId} footer={(dismiss) => <>
        <Button mode="outlined" onPress={dismiss} disabled={!!togglingId} contentStyle={{ minHeight: 48 }}>Cancel</Button>
        <Button mode="contained" onPress={() => void saveCouponDetails()} loading={!!togglingId} disabled={!!togglingId} contentStyle={{ minHeight: 48 }}>Done</Button>
      </>}>
        {selectedCoupon && <View>
          <DetailRow label="Coupon code" value={selectedCoupon.code} />
          <DetailRow label="Description" value={selectedCoupon.description || selectedCoupon.title} />
          <DetailRow label="Discount" value={selectedCoupon.discount_type === 'percent' ? `${selectedCoupon.discount_value}%` : `$${selectedCoupon.discount_value.toFixed(2)}`} />
          <DetailRow label="Minimum subtotal" value={`$${selectedCoupon.min_cart_subtotal.toFixed(2)}`} />
          <DetailRow label="Usage count / limit" value={`${selectedCoupon.usage_count} / ${selectedCoupon.max_uses ?? 'Unlimited'}`} />
          <DetailRow label="Per-user limit" value={selectedCoupon.max_uses_per_user ?? 'No limit'} />
          {selectedCoupon.target_email && <DetailRow label="Target email" value={selectedCoupon.target_email} />}
          <DetailRow label="Starts" value={formatDate(selectedCoupon.starts_at)} />
          <DetailRow label="Ends" value={formatDate(selectedCoupon.ends_at)} />
          <DetailRow label="Active status" value={<Switch accessibilityLabel="Active status" value={activeDraft} onValueChange={setActiveDraft} disabled={!!togglingId} />} />
        </View>}
      </EditorSheet>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  appbar: {
    backgroundColor: BRAND_COLORS.header,
  },
  appbarTitle: {
    color: t.color.surface,
  },
  appbarSubtitle: {
    color: '#d7e4ed',
  },
  filterSection: {
    padding: 28,
    paddingBottom: 20,
    backgroundColor: t.color.background,
  },
  searchBar: {
    backgroundColor: t.color.surface, flex: 1, borderRadius: 10, borderWidth: 1, borderColor: t.color.border,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    color: t.color.muted,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  couponGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  couponCard: {
    padding: 20, minWidth: 0, maxWidth: '100%', borderLeftWidth: 4, borderLeftColor: t.color.primary,
    borderRadius: t.radius.card, borderWidth: 1, borderColor: t.color.border,
    backgroundColor: t.color.surface,
  },
  cardContent: {
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap', gap: 8,
    marginBottom: 0,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: t.radius.card,
  },
  codeText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1565c0',
    letterSpacing: 0.5,
  },
  badge: {
    height: 26,
  },
  badgeText: {
    fontSize: 14,
    marginVertical: 0,
  },
  badgeActive: {
    backgroundColor: '#e8f8e9',
  },
  badgeInactive: {
    backgroundColor: '#fff3e0',
  },
  badgeExpired: {
    backgroundColor: '#ffebee',
  },
  badgePending: {
    backgroundColor: '#e1f5fe',
  },
  badgeMax: {
    backgroundColor: '#ede7f6',
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  couponDesc: {
    fontSize: 14,
    color: t.color.muted,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  discountChip: {
    backgroundColor: '#fff8e1',
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 14,
    color: '#777',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#555',
  },
  dialogTitle: {
    fontWeight: 'bold',
  },
  dialogContent: {
    gap: 8,
  },
  dialogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dialogLabel: {
    fontWeight: 'bold',
    color: '#444',
  },
  dialogValue: {
    color: t.color.muted,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: t.color.background,
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationInfo: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageSizeLabel: {
    fontSize: 14,
    color: t.color.muted,
    marginRight: 4,
  },
  pageSizeChip: {
    height: 28,
  },
  pageButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});
