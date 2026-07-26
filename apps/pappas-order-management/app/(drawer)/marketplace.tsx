import React, { useCallback, useState } from 'react';
import { Modal as NativeModal, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, IconButton, Menu, Modal, Portal, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';

import {
  deleteMarketplaceCookies,
  getMarketplaceActiveOrders,
  getMarketplaceCredentialStatus,
  getMarketplaceHistory,
  getMarketplaceOrderDetail,
  type MarketplaceActiveOrder,
  type MarketplaceHistoryDateRange,
  type MarketplaceOrderDetail,
  type MarketplaceHistoryOrder,
  saveMarketplaceCookies,
  type MarketplaceCredentialStatus,
  type MarketplaceProvider,
} from '@/lib/marketplace';
import { useMarketplacePosDraftStore } from '@/stores/marketplacePosDraftStore';

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

const HISTORY_DATE_RANGE_OPTIONS: Array<{ value: MarketplaceHistoryDateRange; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_12_WEEKS', label: 'Last 12 weeks' },
];

const HISTORY_STATUS_OPTIONS = [
  'Potential deduction',
  'Issue charged',
  'Refunded by Uber',
  'Dispute rejected',
  'Dispute accepted',
] as const;

const HISTORY_STATUS_MATCHERS: Record<(typeof HISTORY_STATUS_OPTIONS)[number], string[]> = {
  'Potential deduction': ['potential deduction', 'deduction', 'chargeback', 'possible chargeback'],
  'Issue charged': ['issue charged', 'charged', 'merchant at fault'],
  'Refunded by Uber': ['refunded by uber', 'uber refund', 'refund'],
  'Dispute rejected': ['dispute rejected', 'rejected'],
  'Dispute accepted': ['dispute accepted', 'accepted'],
};

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
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState<MarketplaceActiveOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<MarketplaceHistoryOrder[]>([]);
  const [historyDateRange, setHistoryDateRange] = useState<MarketplaceHistoryDateRange>('TODAY');
  const [selectedHistoryStatuses, setSelectedHistoryStatuses] = useState<Array<(typeof HISTORY_STATUS_OPTIONS)[number]>>([]);
  const [showHistoryDateMenu, setShowHistoryDateMenu] = useState(false);
  const [showHistoryStatusMenu, setShowHistoryStatusMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<MarketplaceOrderDetail | null>(null);
  const setMarketplacePosDraft = useMarketplacePosDraftStore((state) => state.setDraft);
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
      const result = await getMarketplaceHistory('uber_eats', { dateRange: historyDateRange });
      setHistoryOrders(result.orders);
    } finally {
      setHistoryLoading(false);
    }
  }, [credentialStatus.uber_eats.configured, historyDateRange, listTab, providerTab]);

  const loadActiveOrders = useCallback(async () => {
    if (providerTab !== 'uber_eats' || listTab !== 'active' || !credentialStatus.uber_eats.configured) {
      setActiveOrders([]);
      return;
    }

    try {
      setActiveLoading(true);
      const result = await getMarketplaceActiveOrders('uber_eats');
      setActiveOrders(result.orders);
    } finally {
      setActiveLoading(false);
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

  useFocusEffect(
    useCallback(() => {
      void loadActiveOrders();
    }, [loadActiveOrders])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void Promise.all([loadStatuses(), loadHistory(), loadActiveOrders()]).finally(() => setRefreshing(false));
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
      if (providerTab === 'uber_eats') {
        if (listTab === 'history') {
          const result = await getMarketplaceHistory('uber_eats', { dateRange: historyDateRange });
          setHistoryOrders(result.orders);
        } else {
          const result = await getMarketplaceActiveOrders('uber_eats');
          setActiveOrders(result.orders);
        }
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
        setActiveOrders([]);
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

  const handleAddToPos = () => {
    if (!selectedOrderDetail) return;

    setMarketplacePosDraft({
      provider: 'uber_eats',
      sourceName: 'Uber Eats',
      orderDetail: selectedOrderDetail,
    });
    setShowDetailModal(false);
    setSelectedOrderDetail(null);
    router.push('/pos');
  };

  const toggleHistoryStatus = (status: (typeof HISTORY_STATUS_OPTIONS)[number]) => {
    setSelectedHistoryStatuses((current) => (
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status]
    ));
  };

  const filteredHistoryOrders = historyOrders.filter((order) => {
    if (selectedHistoryStatuses.length === 0) return true;
    const haystack = `${order.issueType} ${order.orderChannel} ${order.fulfillmentType}`.toLowerCase();
    return selectedHistoryStatuses.some((status) => (
      HISTORY_STATUS_MATCHERS[status].some((matcher) => haystack.includes(matcher))
    ));
  });

  const selectedHistoryDateLabel = HISTORY_DATE_RANGE_OPTIONS.find((option) => option.value === historyDateRange)?.label || 'Today';
  const selectedStatusLabel = selectedHistoryStatuses.length > 0
    ? `${selectedHistoryStatuses.length} selected`
    : 'All statuses';

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
                onPress={() => void Promise.all([loadStatuses(), loadHistory(), loadActiveOrders()])}
                loading={loading || historyLoading || activeLoading}
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

          {isUberEats && listTab === 'history' ? (
            <Card style={styles.filterCard}>
              <Card.Content style={styles.filterCardContent}>
                <View style={styles.filterToolbar}>
                  <View style={styles.filterControl}>
                    <Text style={styles.filterLabel}>Date</Text>
                    <Menu
                      visible={showHistoryDateMenu}
                      onDismiss={() => setShowHistoryDateMenu(false)}
                      anchor={(
                        <Button mode="outlined" icon="calendar" onPress={() => setShowHistoryDateMenu(true)} style={styles.filterDropdownButton}>
                          {selectedHistoryDateLabel}
                        </Button>
                      )}
                    >
                      {HISTORY_DATE_RANGE_OPTIONS.map((option) => (
                        <Menu.Item
                          key={option.value}
                          onPress={() => {
                            setHistoryDateRange(option.value);
                            setShowHistoryDateMenu(false);
                          }}
                          title={option.label}
                          leadingIcon={historyDateRange === option.value ? 'check' : undefined}
                        />
                      ))}
                    </Menu>
                  </View>

                  <View style={styles.filterControl}>
                    <Text style={styles.filterLabel}>Status</Text>
                    <Menu
                      visible={showHistoryStatusMenu}
                      onDismiss={() => setShowHistoryStatusMenu(false)}
                      anchor={(
                        <Button mode="outlined" icon="filter-variant" onPress={() => setShowHistoryStatusMenu(true)} style={styles.filterDropdownButton}>
                          {selectedStatusLabel}
                        </Button>
                      )}
                    >
                      {HISTORY_STATUS_OPTIONS.map((status) => (
                        <TouchableOpacity key={status} onPress={() => toggleHistoryStatus(status)} style={styles.filterMenuRow}>
                          <Checkbox
                            status={selectedHistoryStatuses.includes(status) ? 'checked' : 'unchecked'}
                            onPress={() => toggleHistoryStatus(status)}
                          />
                          <Text style={styles.filterMenuText}>{status}</Text>
                        </TouchableOpacity>
                      ))}
                      <Menu.Item
                        onPress={() => {
                          setSelectedHistoryStatuses([]);
                          setShowHistoryStatusMenu(false);
                        }}
                        title="Clear status filters"
                        leadingIcon="close-circle-outline"
                      />
                    </Menu>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={styles.tableCard}>
            <Card.Content>
              <View style={styles.tableColumns}>
                <Text style={[styles.tableHeading, styles.flex2]}>Order</Text>
                <Text style={styles.tableHeading}>Customer</Text>
                <Text style={styles.tableHeading}>Status</Text>
                <Text style={styles.tableHeading}>Updated</Text>
              </View>
              {isUberEats && currentStatus.configured && listTab === 'active' ? (
                activeOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {activeOrders.map((order) => (
                      <TouchableOpacity
                        key={order.workflowUuid}
                        style={styles.historyRow}
                        onPress={() => void handleOpenOrderDetail(order.workflowUuid)}
                      >
                        <View style={[styles.historyCell, styles.flex2]}>
                          <Text style={styles.historyPrimaryLink}>{order.orderId}</Text>
                          <Text style={styles.historySecondary}>{order.salesTotal || 'No total available'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.customerName}</Text>
                          <Text style={styles.historySecondary}>{order.orderChannel || 'Marketplace order'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{formatOrderState(order.status)}</Text>
                          <Text style={styles.historySecondary}>{order.fulfillmentType || 'No fulfillment type'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.requestedAt || 'N/A'}</Text>
                          <Text style={styles.historySecondary}>{order.statusDescription || order.courierName || 'In progress'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.placeholderPanel}>
                    <Text style={styles.placeholderTitle}>No Uber Eats active orders right now</Text>
                    <Text style={styles.placeholderText}>
                      Cookies are configured, but the latest active-order request returned no open Uber Eats orders.
                    </Text>
                  </View>
                )
              ) : isUberEats && listTab === 'history' && currentStatus.configured ? (
                filteredHistoryOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {filteredHistoryOrders.map((order) => (
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
                    <Text style={styles.placeholderTitle}>No Uber Eats history orders found</Text>
                    <Text style={styles.placeholderText}>
                      Cookies are configured, but the latest history request and selected filters returned no matching rows.
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
                        ? 'Configure Uber Eats cookies first to load active orders.'
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
        <NativeModal
          visible={showDetailModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            if (detailLoading) return;
            setShowDetailModal(false);
            setSelectedOrderDetail(null);
          }}
        >
          <View style={styles.detailScreen}>
            <View style={styles.detailShell}>
              <Surface style={styles.detailTopBar} elevation={1}>
                <View style={styles.detailTopBarHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailHeaderTitle}>
                      Order {selectedOrderDetail?.orderId || 'Detail'}
                    </Text>
                    <Text style={styles.detailHeaderMeta}>
                      {selectedOrderDetail
                        ? `${selectedOrderDetail.customerName} • ${formatOrderState(selectedOrderDetail.orderJobState)}`
                        : 'Loading Uber Eats order details'}
                    </Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => {
                      setShowDetailModal(false);
                      setSelectedOrderDetail(null);
                    }}
                    disabled={detailLoading}
                  />
                </View>
                {selectedOrderDetail ? (
                  <View style={styles.detailHeaderBadges}>
                    <View style={[styles.detailStatusBadge, styles.detailStatusBadgePrimary]}>
                      <Text style={styles.detailStatusBadgeText}>{formatOrderState(selectedOrderDetail.orderJobState)}</Text>
                    </View>
                    <View style={[styles.detailStatusBadge, styles.detailStatusBadgeSecondary]}>
                      <Text style={styles.detailStatusBadgeText}>{formatOrderState(selectedOrderDetail.fulfillmentType)}</Text>
                    </View>
                    <Text style={styles.detailHeaderTime}>{formatUnixSeconds(selectedOrderDetail.requestedAt)}</Text>
                    <Button mode="contained" icon="cart-plus" onPress={handleAddToPos} style={styles.detailHeaderAction}>
                      Add To POS
                    </Button>
                  </View>
                ) : null}
              </Surface>

              {selectedOrderDetail ? (
                <ScrollView style={styles.detailScrollContent} contentContainerStyle={styles.detailScrollContainer}>
                  <View style={styles.detailSummaryGrid}>
                    <Card style={styles.detailInfoCard}>
                      <Card.Title title="Customer" titleStyle={styles.detailCardTitle} />
                      <Card.Content>
                        <Text style={styles.detailCustomerName}>{selectedOrderDetail.customerName}</Text>
                        {selectedOrderDetail.customerPhone ? <Text style={styles.detailContactText}>{selectedOrderDetail.customerPhone}</Text> : null}
                        {selectedOrderDetail.customerAddress ? <Text style={styles.detailContactText}>{selectedOrderDetail.customerAddress}</Text> : null}
                      </Card.Content>
                    </Card>

                    <Card style={styles.detailInfoCard}>
                      <Card.Title title="Order" titleStyle={styles.detailCardTitle} />
                      <Card.Content>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Requested</Text>
                          <Text style={styles.detailTotalValue}>{formatUnixSeconds(selectedOrderDetail.requestedAt)}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Completed</Text>
                          <Text style={styles.detailTotalValue}>{formatUnixMilliseconds(selectedOrderDetail.completedAtTimestamp)}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Net payout</Text>
                          <Text style={styles.detailTotalValue}>{selectedOrderDetail.netPayout}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Marketplace fee</Text>
                          <Text style={styles.detailTotalValue}>{selectedOrderDetail.marketplaceFeeRate ? `${selectedOrderDetail.marketplaceFeeRate}%` : 'N/A'}</Text>
                        </View>
                      </Card.Content>
                    </Card>
                  </View>

                  <Card style={styles.detailInfoCard}>
                    <Card.Title title={`Items (${selectedOrderDetail.items.length})`} titleStyle={styles.detailCardTitle} />
                    <Card.Content>
                      {selectedOrderDetail.items.map((item, index) => (
                        <View key={`${item.name}-${index}`} style={styles.detailItemRow}>
                          <View style={styles.detailItemHeader}>
                            <Text style={styles.detailItemName}>{item.quantity}x {item.name}</Text>
                            <Text style={styles.detailItemPrice}>{item.price}</Text>
                          </View>
                          {item.specialInstructions ? <Text style={styles.detailItemNote}>Note: {item.specialInstructions}</Text> : null}
                          {item.customizations.map((customization, customizationIndex) => (
                            <View key={`${customization.name}-${customizationIndex}`} style={styles.detailAddonsList}>
                              <Text style={styles.detailAddonGroup}>{customization.name}</Text>
                              {customization.options.map((option, optionIndex) => (
                                <Text key={`${option.name}-${optionIndex}`} style={styles.detailAddonText}>
                                  {option.quantity > 1 ? `${option.quantity}x ` : '+ '}{option.name}{option.price ? ` (${option.price})` : ''}
                                </Text>
                              ))}
                            </View>
                          ))}
                        </View>
                      ))}
                    </Card.Content>
                  </Card>

                  <Card style={styles.detailInfoCard}>
                    <Card.Title title="Status Timeline" titleStyle={styles.detailCardTitle} />
                    <Card.Content>
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
            </View>
          </View>
        </NativeModal>

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
  filterCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  filterCardContent: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
  },
  filterToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterControl: {
    flex: 1,
    gap: 6,
  },
  filterDropdownButton: {
    justifyContent: 'flex-start',
  },
  filterMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 220,
  },
  filterMenuText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
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
  detailScreen: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  detailShell: {
    flex: 1,
  },
  detailTopBar: {
    backgroundColor: '#fff',
    paddingTop: 14,
  },
  detailTopBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  detailHeaderMeta: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  detailStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailStatusBadgePrimary: {
    backgroundColor: '#2563eb',
  },
  detailStatusBadgeSecondary: {
    backgroundColor: '#0f766e',
  },
  detailStatusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  detailHeaderTime: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailHeaderAction: {
    borderRadius: 999,
  },
  detailScrollContent: {
    flex: 1,
  },
  detailScrollContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  detailSummaryGrid: {
    gap: 12,
  },
  detailInfoCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  detailCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  detailCustomerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 6,
  },
  detailContactText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  detailTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  detailTotalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailTotalValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  detailItemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  detailItemNote: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  detailAddonsList: {
    marginTop: 6,
    paddingLeft: 10,
  },
  detailAddonGroup: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  detailAddonText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
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
