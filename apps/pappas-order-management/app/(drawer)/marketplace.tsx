import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, Card, Modal, Portal, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';

import {
  deleteMarketplaceCookies,
  getMarketplaceCredentialStatus,
  getMarketplaceHistory,
  getMarketplaceOrderDetail,
  type MarketplaceOrderDetail,
  type MarketplaceHistoryOrder,
  saveMarketplaceCookies,
  type MarketplaceCredentialStatus,
  type MarketplaceProvider,
} from '@/lib/marketplace';

type ProviderTab = 'uber_eats' | 'doordash';
type MarketplaceListTab = 'active' | 'history';

const PROVIDER_LABELS: Record<ProviderTab, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
};

const LIST_TAB_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
];

const PROVIDER_TAB_OPTIONS = [
  { value: 'uber_eats', label: 'UBER EATS' },
  { value: 'doordash', label: 'DOORDASH' },
];

function formatStatusDate(value: string | null) {
  if (!value) return 'Not configured';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatUnixSeconds(value?: number | null) {
  if (!value) return 'N/A';
  return new Date(value * 1000).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatUnixMilliseconds(value?: number | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatOrderState(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').trim();
}

export default function MarketplaceScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const [providerTab, setProviderTab] = useState<ProviderTab>('uber_eats');
  const [listTab, setListTab] = useState<MarketplaceListTab>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<MarketplaceHistoryOrder[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<MarketplaceOrderDetail | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<Record<MarketplaceProvider, MarketplaceCredentialStatus>>({
    uber_eats: { provider: 'uber_eats', configured: false, updatedAt: null, configuredBy: null },
    doordash: { provider: 'doordash', configured: false, updatedAt: null, configuredBy: null },
  });

  const loadStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const [uberEatsStatus, doordashStatus] = await Promise.all([
        getMarketplaceCredentialStatus('uber_eats'),
        getMarketplaceCredentialStatus('doordash'),
      ]);
      setCredentialStatus({
        uber_eats: uberEatsStatus,
        doordash: doordashStatus,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const currentStatus = credentialStatus[providerTab];
  const providerLabel = PROVIDER_LABELS[providerTab];
  const isUberEats = providerTab === 'uber_eats';

  const loadHistory = useCallback(async () => {
    if (providerTab !== 'uber_eats' || listTab !== 'history' || !credentialStatus.uber_eats.configured) {
      setHistoryOrders([]);
      return;
    }

    try {
      setHistoryLoading(true);
      const result = await getMarketplaceHistory('uber_eats');
      setHistoryOrders(result.orders);
    } finally {
      setHistoryLoading(false);
    }
  }, [credentialStatus.uber_eats.configured, listTab, providerTab]);

  useFocusEffect(
    useCallback(() => {
      void loadStatuses();
    }, [loadStatuses])
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void Promise.all([loadStatuses(), loadHistory()]).finally(() => setRefreshing(false));
  };

  const handleSaveCookies = async () => {
    const nextCookies = cookieInput.trim();
    if (!nextCookies) return;

    try {
      setSaving(true);
      const status = await saveMarketplaceCookies(providerTab, nextCookies);
      setCredentialStatus((prev) => ({ ...prev, [providerTab]: status }));
      setCookieInput('');
      setShowSettingsModal(false);
      if (providerTab === 'uber_eats' && listTab === 'history') {
        const result = await getMarketplaceHistory('uber_eats');
        setHistoryOrders(result.orders);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearCookies = async () => {
    try {
      setSaving(true);
      await deleteMarketplaceCookies(providerTab);
      setCredentialStatus((prev) => ({
        ...prev,
        [providerTab]: {
          provider: providerTab,
          configured: false,
          updatedAt: null,
          configuredBy: null,
        },
      }));
      setCookieInput('');
      setShowSettingsModal(false);
      if (providerTab === 'uber_eats') {
        setHistoryOrders([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenOrderDetail = async (workflowUuid: string) => {
    try {
      setDetailLoading(true);
      setSelectedOrderDetail(null);
      setShowDetailModal(true);
      const detail = await getMarketplaceOrderDetail('uber_eats', workflowUuid);
      setSelectedOrderDetail(detail);
    } catch (error) {
      setShowDetailModal(false);
      throw error;
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} iconColor="#fff" />
        <Appbar.Content title="Marketplace" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="home" onPress={() => router.replace('/(drawer)/(tabs)/live-orders')} iconColor="#fff" />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Surface style={styles.heroCard} elevation={1}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Marketplace Sync</Text>
              <Text style={styles.heroTitle}>Uber Eats first, DoorDash next</Text>
              <Text style={styles.heroText}>
                Save marketplace cookies once, sync them securely across POS devices, and prepare the UI for automated active/history order sync.
              </Text>
            </View>
            <Button
              mode="contained"
              icon="cog-outline"
              onPress={() => setShowSettingsModal(true)}
              disabled={!isUberEats}
            >
              Settings
            </Button>
          </View>
        </Surface>

        <SegmentedButtons
          value={providerTab}
          onValueChange={(value) => setProviderTab(value as ProviderTab)}
          buttons={PROVIDER_TAB_OPTIONS}
        />

        <Card style={styles.statusCard}>
          <Card.Content style={styles.statusContent}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.sectionTitle}>{providerLabel}</Text>
                <Text style={styles.sectionSubtitle}>
                  {isUberEats
                    ? 'Configure cookies now. Active and history sync tables will plug into this page next.'
                    : 'DoorDash UI is reserved now so we can match the same flow later.'}
                </Text>
              </View>
              <View style={[styles.statusBadge, currentStatus.configured ? styles.statusBadgeReady : styles.statusBadgePending]}>
                <Text style={[styles.statusBadgeText, currentStatus.configured ? styles.statusBadgeTextReady : styles.statusBadgeTextPending]}>
                  {currentStatus.configured ? 'Configured' : 'Not configured'}
                </Text>
              </View>
            </View>

            <View style={styles.statusMetaRow}>
              <Text style={styles.statusMetaLabel}>Last updated</Text>
              <Text style={styles.statusMetaValue}>{formatStatusDate(currentStatus.updatedAt)}</Text>
            </View>

            <View style={styles.statusActionRow}>
              <Button
                mode="contained-tonal"
                icon="cog-outline"
                onPress={() => setShowSettingsModal(true)}
                disabled={!isUberEats}
              >
                Configure cookies
              </Button>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={() => void Promise.all([loadStatuses(), loadHistory()])}
                loading={loading || historyLoading}
              >
                Refresh
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <Text style={styles.sectionTitle}>Orders</Text>
            <SegmentedButtons
              value={listTab}
              onValueChange={(value) => setListTab(value as MarketplaceListTab)}
              buttons={LIST_TAB_OPTIONS}
            />
          </View>

          <Card style={styles.tableCard}>
            <Card.Content>
              <View style={styles.tableColumns}>
                <Text style={[styles.tableHeading, styles.flex2]}>Order</Text>
                <Text style={styles.tableHeading}>Customer</Text>
                <Text style={styles.tableHeading}>Status</Text>
                <Text style={styles.tableHeading}>Updated</Text>
              </View>
              {isUberEats && listTab === 'history' && currentStatus.configured ? (
                historyOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {historyOrders.map((order) => (
                      <TouchableOpacity
                        key={order.workflowUuid}
                        style={styles.historyRow}
                        onPress={() => void handleOpenOrderDetail(order.workflowUuid)}
                      >
                        <View style={[styles.historyCell, styles.flex2]}>
                          <Text style={styles.historyPrimaryLink}>{order.orderId}</Text>
                          <Text style={styles.historySecondary}>{order.salesTotal} net {order.netPayout}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.customerName}</Text>
                          <Text style={styles.historySecondary}>
                            {order.subscriptionPass || (order.isSubscriber ? 'Subscriber' : 'Standard')}
                          </Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.fulfillmentType.replace('FULFILLMENT_TYPE_', '')}</Text>
                          <Text style={styles.historySecondary}>{order.courierName || 'No courier'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.requestedAt}</Text>
                          <Text style={styles.historySecondary}>{order.issueType || 'Completed'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.placeholderPanel}>
                    <Text style={styles.placeholderTitle}>No Uber Eats history orders yet</Text>
                    <Text style={styles.placeholderText}>
                      Cookies are configured, but the latest history request returned no rows for the recent default range.
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.placeholderPanel}>
                  <Text style={styles.placeholderTitle}>
                    {providerLabel} {listTab === 'active' ? 'active orders' : 'history orders'}
                  </Text>
                  <Text style={styles.placeholderText}>
                    {!isUberEats
                      ? 'DoorDash will reuse the same layout and settings pattern after Uber Eats is connected.'
                      : listTab === 'active'
                        ? 'Active orders are the next step once you share the matching Uber Eats live-orders request.'
                        : currentStatus.configured
                          ? 'Loading history from Uber Eats.'
                          : 'Configure Uber Eats cookies first to load history orders.'}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={showDetailModal}
          onDismiss={() => {
            if (detailLoading) return;
            setShowDetailModal(false);
            setSelectedOrderDetail(null);
          }}
          contentContainerStyle={styles.detailModalCard}
        >
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Text style={styles.modalTitle}>
                {selectedOrderDetail?.orderId || 'Order detail'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedOrderDetail
                  ? `${selectedOrderDetail.customerName} • ${formatOrderState(selectedOrderDetail.orderJobState)}`
                  : 'Loading Uber Eats order details'}
              </Text>
            </View>
            <Button
              mode="text"
              onPress={() => {
                setShowDetailModal(false);
                setSelectedOrderDetail(null);
              }}
              disabled={detailLoading}
            >
              Close
            </Button>
          </View>

          {selectedOrderDetail ? (
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
              <Card style={styles.detailSectionCard}>
                <Card.Content style={styles.detailSectionContent}>
                  <Text style={styles.detailSectionTitle}>Order</Text>
                  <Text style={styles.detailMetaLine}>Status: {formatOrderState(selectedOrderDetail.orderJobState)}</Text>
                  <Text style={styles.detailMetaLine}>Fulfillment: {formatOrderState(selectedOrderDetail.fulfillmentType)}</Text>
                  <Text style={styles.detailMetaLine}>Requested: {formatUnixSeconds(selectedOrderDetail.requestedAt)}</Text>
                  <Text style={styles.detailMetaLine}>Completed: {formatUnixMilliseconds(selectedOrderDetail.completedAtTimestamp)}</Text>
                  <Text style={styles.detailMetaLine}>Net payout: {selectedOrderDetail.netPayout}</Text>
                  <Text style={styles.detailMetaLine}>Marketplace fee: {selectedOrderDetail.marketplaceFeeRate ? `${selectedOrderDetail.marketplaceFeeRate}%` : 'N/A'}</Text>
                </Card.Content>
              </Card>

              <Card style={styles.detailSectionCard}>
                <Card.Content style={styles.detailSectionContent}>
                  <Text style={styles.detailSectionTitle}>Customer</Text>
                  <Text style={styles.detailMetaLine}>{selectedOrderDetail.customerName}</Text>
                  {selectedOrderDetail.customerPhone ? <Text style={styles.detailMetaLine}>{selectedOrderDetail.customerPhone}</Text> : null}
                  {selectedOrderDetail.customerAddress ? <Text style={styles.detailMetaLine}>{selectedOrderDetail.customerAddress}</Text> : null}
                </Card.Content>
              </Card>

              <Card style={styles.detailSectionCard}>
                <Card.Content style={styles.detailSectionContent}>
                  <Text style={styles.detailSectionTitle}>Items</Text>
                  {selectedOrderDetail.items.map((item, index) => (
                    <View key={`${item.name}-${index}`} style={styles.detailItemBlock}>
                      <Text style={styles.detailItemTitle}>{item.quantity}x {item.name}</Text>
                      <Text style={styles.detailItemPrice}>{item.price}</Text>
                      {item.specialInstructions ? (
                        <Text style={styles.detailItemNote}>Note: {item.specialInstructions}</Text>
                      ) : null}
                      {item.customizations.map((customization, customizationIndex) => (
                        <View key={`${customization.name}-${customizationIndex}`} style={styles.detailCustomizationBlock}>
                          <Text style={styles.detailCustomizationTitle}>{customization.name}</Text>
                          {customization.options.map((option, optionIndex) => (
                            <Text key={`${option.name}-${optionIndex}`} style={styles.detailCustomizationOption}>
                              {option.quantity}x {option.name}{option.price ? ` (${option.price})` : ''}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  ))}
                </Card.Content>
              </Card>

              <Card style={styles.detailSectionCard}>
                <Card.Content style={styles.detailSectionContent}>
                  <Text style={styles.detailSectionTitle}>Status timeline</Text>
                  {selectedOrderDetail.orderStateChanges.map((event, index) => (
                    <View key={`${event.orderState}-${event.changedAt}-${index}`} style={styles.timelineRow}>
                      <Text style={styles.timelineState}>{formatOrderState(event.orderState)}</Text>
                      <Text style={styles.timelineTime}>{formatUnixMilliseconds(event.changedAt)}</Text>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            </ScrollView>
          ) : (
            <View style={styles.placeholderPanel}>
              <Text style={styles.placeholderText}>{detailLoading ? 'Loading order details...' : 'No order selected.'}</Text>
            </View>
          )}
        </Modal>

        <Modal
          visible={showSettingsModal}
          onDismiss={() => {
            if (saving) return;
            setShowSettingsModal(false);
            setCookieInput('');
          }}
          contentContainerStyle={styles.modalCard}
        >
          <Text style={styles.modalTitle}>{providerLabel} cookies</Text>
          <Text style={styles.modalSubtitle}>
            Paste the full cookie string from your browser session. We encrypt it on the server before saving it to the database for cross-device sync.
          </Text>

          <TextInput
            mode="outlined"
            label="Cookie header value"
            value={cookieInput}
            onChangeText={setCookieInput}
            multiline
            numberOfLines={8}
            style={styles.cookieInput}
            disabled={!isUberEats || saving}
          />

          <Text style={styles.modalHint}>
            Current status: {currentStatus.configured ? `configured on ${formatStatusDate(currentStatus.updatedAt)}` : 'not configured'}
          </Text>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowSettingsModal(false)} disabled={saving}>
              Close
            </Button>
            <Button mode="outlined" onPress={() => void handleClearCookies()} disabled={!currentStatus.configured || saving || !isUberEats}>
              Clear
            </Button>
            <Button mode="contained" onPress={() => void handleSaveCookies()} loading={saving} disabled={!cookieInput.trim() || !isUberEats}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  appbar: {
    backgroundColor: '#2563eb',
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  statusContent: {
    gap: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 520,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeReady: {
    backgroundColor: '#dcfce7',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadgeTextReady: {
    color: '#166534',
  },
  statusBadgeTextPending: {
    color: '#92400e',
  },
  statusMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  statusMetaLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  statusMetaValue: {
    fontSize: 13,
    color: '#0f172a',
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tableSection: {
    gap: 12,
  },
  tableHeader: {
    gap: 12,
  },
  tableCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  tableColumns: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeading: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  flex2: {
    flex: 2,
  },
  placeholderPanel: {
    paddingVertical: 24,
    gap: 8,
  },
  historyList: {
    gap: 10,
    paddingTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  historyCell: {
    flex: 1,
    gap: 4,
  },
  historyPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyPrimaryLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  historySecondary: {
    fontSize: 12,
    color: '#64748b',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 560,
  },
  modalCard: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    gap: 14,
  },
  detailModalCard: {
    marginHorizontal: 18,
    marginVertical: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    gap: 12,
    paddingBottom: 18,
  },
  detailSectionCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  detailSectionContent: {
    gap: 8,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailMetaLine: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  detailItemBlock: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailItemPrice: {
    fontSize: 13,
    color: '#0f766e',
    fontWeight: '700',
  },
  detailItemNote: {
    fontSize: 12,
    color: '#64748b',
  },
  detailCustomizationBlock: {
    paddingLeft: 10,
    gap: 2,
  },
  detailCustomizationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  detailCustomizationOption: {
    fontSize: 12,
    color: '#64748b',
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  timelineState: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748b',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  cookieInput: {
    backgroundColor: '#fff',
  },
  modalHint: {
    color: '#475569',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
