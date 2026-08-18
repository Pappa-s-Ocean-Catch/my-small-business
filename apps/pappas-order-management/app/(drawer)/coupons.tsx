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
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  Searchbar,
  Switch,
  Text,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import {
  getCouponsList,
  toggleCouponActive,
  type Coupon,
} from '@/lib/coupons';

type FilterType = 'all' | 'active' | 'inactive' | 'expired';

export default function CouponsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const handleToggleActive = async (coupon: Coupon) => {
    const newStatus = !coupon.is_active;
    setTogglingId(coupon.id);
    const { success, error } = await toggleCouponActive(coupon.id, newStatus);
    setTogglingId(null);
    if (success) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: newStatus } : c))
      );
      if (selectedCoupon?.id === coupon.id) {
        setSelectedCoupon({ ...selectedCoupon, is_active: newStatus });
      }
    } else {
      Alert.alert('Error', error || 'Failed to update coupon status.');
    }
  };

  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    if (!coupon.is_active) {
      return <Chip style={[styles.badge, styles.badgeInactive]} textStyle={styles.badgeText}>Inactive</Chip>;
    }
    if (coupon.ends_at && new Date(coupon.ends_at) < now) {
      return <Chip style={[styles.badge, styles.badgeExpired]} textStyle={styles.badgeText}>Expired</Chip>;
    }
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return <Chip style={[styles.badge, styles.badgePending]} textStyle={styles.badgeText}>Scheduled</Chip>;
    }
    if (coupon.max_uses != null && coupon.usage_count >= coupon.max_uses) {
      return <Chip style={[styles.badge, styles.badgeMax]} textStyle={styles.badgeText}>Max Uses</Chip>;
    }
    return <Chip style={[styles.badge, styles.badgeActive]} textStyle={styles.badgeText}>Active</Chip>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No limit';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.elevation?.level1 ?? theme.colors.surface }}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
        <Appbar.Content title="Coupon Management" subtitle="Manage & toggle discount coupon codes" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterSection}>
        <Searchbar
          placeholder="Search coupon code, title..."
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={styles.searchBar}
          elevation={1}
        />

        <View style={styles.filterChipRow}>
          {(['all', 'active', 'inactive', 'expired'] as FilterType[]).map((f) => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => handleFilterChange(f)}
              style={styles.filterChip}
              showSelectedOverlay
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Chip>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
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
              const isToggling = togglingId === coupon.id;
              const discountText =
                coupon.discount_type === 'percent'
                  ? `${coupon.discount_value}% OFF`
                  : `$${coupon.discount_value.toFixed(2)} OFF`;

              return (
                <Card
                  key={coupon.id}
                  style={styles.couponCard}
                  onPress={() => setSelectedCoupon(coupon)}
                >
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <TouchableOpacity
                        style={styles.codeContainer}
                        onPress={() => handleCopyCode(coupon.code)}
                      >
                        <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color={theme.colors.primary} />
                        <Text style={styles.codeText}>{coupon.code}</Text>
                        <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                      {getStatusBadge(coupon)}
                    </View>

                    <Text style={styles.couponTitle} numberOfLines={1}>
                      {coupon.title}
                    </Text>
                    {coupon.description ? (
                      <Text style={styles.couponDesc} numberOfLines={2}>
                        {coupon.description}
                      </Text>
                    ) : null}

                    <View style={styles.detailsRow}>
                      <Chip compact icon="label-outline" style={styles.discountChip}>
                        {discountText}
                      </Chip>

                      <Text style={styles.detailText}>
                        Uses: {coupon.usage_count} {coupon.max_uses != null ? `/ ${coupon.max_uses}` : ''}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>
                        Min Subtotal: ${coupon.min_cart_subtotal.toFixed(2)}
                      </Text>
                      <Text style={styles.metaText}>
                        Ends: {formatDate(coupon.ends_at)}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>Active Status</Text>
                        <Switch
                          value={coupon.is_active}
                          onValueChange={() => handleToggleActive(coupon)}
                          disabled={isToggling}
                        />
                      </View>
                      <Button
                        mode="outlined"
                        compact
                        onPress={() => setSelectedCoupon(coupon)}
                      >
                        Details
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
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
            {[10, 20, 50].map((size) => (
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

      {/* Coupon Detail Dialog */}
      <Portal>
        <Dialog visible={selectedCoupon !== null} onDismiss={() => setSelectedCoupon(null)}>
          <Dialog.Title style={styles.dialogTitle}>
            Coupon Details
          </Dialog.Title>
          <Dialog.Content>
            {selectedCoupon && (
              <View style={styles.dialogContent}>
                <View style={[styles.dialogRow, { alignItems: 'center', backgroundColor: '#e3f2fd', padding: 10, borderRadius: 8 }]}>
                  <Text style={[styles.dialogLabel, { fontSize: 16, color: '#1565c0' }]}>Code:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1565c0', letterSpacing: 1 }}>
                      {selectedCoupon.code}
                    </Text>
                    <Button
                      mode="contained"
                      compact
                      icon="content-copy"
                      onPress={() => handleCopyCode(selectedCoupon.code)}
                    >
                      Copy
                    </Button>
                  </View>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Title:</Text>
                  <Text style={styles.dialogValue}>{selectedCoupon.title}</Text>
                </View>
                {selectedCoupon.description && (
                  <View style={styles.dialogRow}>
                    <Text style={styles.dialogLabel}>Description:</Text>
                    <Text style={styles.dialogValue}>{selectedCoupon.description}</Text>
                  </View>
                )}
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Discount:</Text>
                  <Text style={styles.dialogValue}>
                    {selectedCoupon.discount_type === 'percent'
                      ? `${selectedCoupon.discount_value}%`
                      : `$${selectedCoupon.discount_value.toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Min Subtotal:</Text>
                  <Text style={styles.dialogValue}>${selectedCoupon.min_cart_subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Usage Count:</Text>
                  <Text style={styles.dialogValue}>
                    {selectedCoupon.usage_count} {selectedCoupon.max_uses != null ? `/ ${selectedCoupon.max_uses}` : '(Unlimited)'}
                  </Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Per-User Limit:</Text>
                  <Text style={styles.dialogValue}>
                    {selectedCoupon.max_uses_per_user != null ? `${selectedCoupon.max_uses_per_user} per customer` : 'No limit'}
                  </Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Target Email:</Text>
                  <Text style={styles.dialogValue}>{selectedCoupon.target_email || 'Public / Anyone'}</Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Starts At:</Text>
                  <Text style={styles.dialogValue}>{formatDate(selectedCoupon.starts_at)}</Text>
                </View>
                <View style={styles.dialogRow}>
                  <Text style={styles.dialogLabel}>Ends At:</Text>
                  <Text style={styles.dialogValue}>{formatDate(selectedCoupon.ends_at)}</Text>
                </View>

                <View style={[styles.dialogRow, { marginTop: 15, alignItems: 'center' }]}>
                  <Text style={styles.dialogLabel}>Active Status:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ marginRight: 8 }}>{selectedCoupon.is_active ? 'Active' : 'Inactive'}</Text>
                    <Switch
                      value={selectedCoupon.is_active}
                      onValueChange={() => handleToggleActive(selectedCoupon)}
                    />
                  </View>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            {selectedCoupon && (
              <Button icon="content-copy" onPress={() => handleCopyCode(selectedCoupon.code)}>
                Copy Code
              </Button>
            )}
            <Button onPress={() => setSelectedCoupon(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterSection: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
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
    gap: 12,
  },
  couponCard: {
    width: '49%',
    minWidth: 320,
    backgroundColor: '#fff',
  },
  cardContent: {
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
    fontSize: 11,
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
    fontSize: 13,
    color: '#666',
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
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 13,
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
    color: '#666',
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationInfo: {
    fontSize: 13,
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
    fontSize: 12,
    color: '#666',
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
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
});
