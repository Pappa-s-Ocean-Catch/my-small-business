import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal as NativeModal, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, IconButton, Menu, Modal, Portal, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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
import { invalidateLocalMarketplaceSession } from '@/lib/marketplace-local-session';
import type { AddonItem, RemovableIngredient, SaleProduct } from '@/app/pos.types';

type ProviderTab = 'uber_eats' | 'doordash';
type MarketplaceListTab = 'active' | 'scheduled' | 'history';
type MappingEntityType = 'product' | 'addon_group' | 'addon' | 'ingredient';

type MarketplaceUnmatchedName = {
  id: string;
  provider: MarketplaceProvider;
  entity_type: MappingEntityType;
  external_name: string;
  normalized_external_name: string;
  parent_external_name: string;
  occurrences: number;
  last_seen_at: string;
};

type MarketplaceSavedMapping = {
  id: string;
  provider: MarketplaceProvider;
  entity_type: MappingEntityType;
  external_name: string;
  normalized_external_name: string;
  internal_name: string;
  internal_entity_id: string | null;
  parent_normalized_external_name: string;
};

const PROVIDER_LABELS: Record<ProviderTab, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
};

const LIST_TAB_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
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

const UBER_HISTORY_STATUS_OPTIONS = [
  'Potential deduction',
  'Issue charged',
  'Refunded by Uber',
  'Dispute rejected',
  'Dispute accepted',
] as const;

const HISTORY_STATUS_MATCHERS: Record<(typeof UBER_HISTORY_STATUS_OPTIONS)[number], string[]> = {
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
    timeZone: 'Australia/Melbourne',
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
    timeZone: 'Australia/Melbourne',
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
  const [businessIdInput, setBusinessIdInput] = useState('');
  const [storeIdInput, setStoreIdInput] = useState('');
  const [ddAttKeyInput, setDdAttKeyInput] = useState('');
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState<MarketplaceActiveOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<MarketplaceHistoryOrder[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledOrders, setScheduledOrders] = useState<MarketplaceHistoryOrder[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null);
  const [showMappingsModal, setShowMappingsModal] = useState(false);
  const [unmatchedNames, setUnmatchedNames] = useState<MarketplaceUnmatchedName[]>([]);
  const [savedMappings, setSavedMappings] = useState<MarketplaceSavedMapping[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [addonItems, setAddonItems] = useState<AddonItem[]>([]);
  const [ingredients, setIngredients] = useState<RemovableIngredient[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
  const [historyDateRange, setHistoryDateRange] = useState<MarketplaceHistoryDateRange>('TODAY');
  const [selectedHistoryStatuses, setSelectedHistoryStatuses] = useState<string[]>([]);
  const [showHistoryDateMenu, setShowHistoryDateMenu] = useState(false);
  const [showHistoryStatusMenu, setShowHistoryStatusMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<MarketplaceOrderDetail | null>(null);
  const setMarketplacePosDraft = useMarketplacePosDraftStore((state) => state.setDraft);
  const setMappingEdit = useMarketplacePosDraftStore((state) => state.setMappingEdit);
  const [credentialStatus, setCredentialStatus] = useState<Record<MarketplaceProvider, MarketplaceCredentialStatus>>({
    uber_eats: { provider: 'uber_eats', configured: false, updatedAt: null, configuredBy: null, providerConfig: {} },
    doordash: { provider: 'doordash', configured: false, updatedAt: null, configuredBy: null, providerConfig: {} },
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
  const isDoorDash = providerTab === 'doordash';

  useEffect(() => {
    if (!showSettingsModal) return;
    setCookieInput('');
    setBusinessIdInput(String(currentStatus.providerConfig.businessId ?? ''));
    setStoreIdInput(String(currentStatus.providerConfig.storeId ?? ''));
    setDdAttKeyInput(String(currentStatus.providerConfig.ddAttKey ?? ''));
  }, [currentStatus.providerConfig.businessId, currentStatus.providerConfig.ddAttKey, currentStatus.providerConfig.storeId, providerTab, showSettingsModal]);

  const loadHistory = useCallback(async () => {
    if (listTab !== 'history' || !credentialStatus[providerTab].configured) {
      setHistoryOrders([]);
      return;
    }

    try {
      setHistoryLoading(true);
      const result = await getMarketplaceHistory(providerTab, {
        dateRange: historyDateRange,
        statuses: providerTab === 'doordash' ? selectedHistoryStatuses : undefined,
        mode: 'history',
      });
      setHistoryOrders(result.orders);
    } finally {
      setHistoryLoading(false);
    }
  }, [credentialStatus, historyDateRange, listTab, providerTab, selectedHistoryStatuses]);

  const loadScheduledOrders = useCallback(async () => {
    if (listTab !== 'scheduled' || !credentialStatus[providerTab].configured) {
      setScheduledOrders([]);
      return;
    }

    try {
      setScheduledLoading(true);
      const result = await getMarketplaceHistory(providerTab, {
        dateRange: historyDateRange,
        mode: 'scheduled',
      });
      setScheduledOrders(result.orders);
    } finally {
      setScheduledLoading(false);
    }
  }, [credentialStatus, historyDateRange, listTab, providerTab]);

  const loadActiveOrders = useCallback(async () => {
    if (listTab !== 'active' || !credentialStatus[providerTab].configured) {
      setActiveOrders([]);
      return;
    }

    try {
      setActiveLoading(true);
      const result = await getMarketplaceActiveOrders(providerTab);
      setActiveOrders(result.orders);
    } finally {
      setActiveLoading(false);
    }
  }, [credentialStatus, listTab, providerTab]);

  const loadMappings = useCallback(async () => {
    try {
      setMappingLoading(true);
      const [unmatchedResult, savedMappingsResult, productsResult, addonsResult, ingredientsResult] = await Promise.all([
        supabase
          .from('marketplace_unmatched_names')
          .select('id, provider, entity_type, external_name, normalized_external_name, parent_external_name, occurrences, last_seen_at')
          .eq('provider', providerTab)
          .order('occurrences', { ascending: false })
          .order('last_seen_at', { ascending: false })
          .limit(50),
        supabase
          .from('marketplace_name_mappings')
          .select('id, provider, entity_type, external_name, normalized_external_name, internal_name, internal_entity_id, parent_normalized_external_name')
          .eq('provider', providerTab)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(100),
        supabase
          .from('sale_products')
          .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('addon_items')
          .select('id, addon_group_id, name, extra_price, section, sort_order, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('sale_product_ingredients')
          .select('id, customer_can_remove, products!product_id(name)')
          .eq('customer_can_remove', true)
          .order('id', { ascending: true }),
      ]);

      setUnmatchedNames((unmatchedResult.data || []) as MarketplaceUnmatchedName[]);
      setSavedMappings((savedMappingsResult.data || []) as MarketplaceSavedMapping[]);
      setProducts((productsResult.data || []) as SaleProduct[]);
      setAddonItems((addonsResult.data || []) as AddonItem[]);
      const mappedIngredients = ((ingredientsResult.data || []) as Array<{
        id: string;
        customer_can_remove: boolean;
        products: { name?: string } | { name?: string }[] | null;
      }>).map((row) => {
        const productRef = Array.isArray(row.products) ? row.products[0] : row.products;
        return {
          id: row.id,
          ingredient_name: productRef?.name?.trim() || 'Unknown ingredient',
          customer_can_remove: row.customer_can_remove,
        };
      });

      setIngredients(mappedIngredients.filter((item, index, list) => (
        list.findIndex((entry) => entry.ingredient_name === item.ingredient_name) === index
      )));
    } finally {
      setMappingLoading(false);
    }
  }, [providerTab]);

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

  useFocusEffect(
    useCallback(() => {
      void loadScheduledOrders();
    }, [loadScheduledOrders])
  );

  useFocusEffect(
    useCallback(() => {
      void loadMappings();
    }, [loadMappings])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void Promise.all([loadStatuses(), loadHistory(), loadActiveOrders(), loadScheduledOrders(), loadMappings()]).finally(() => setRefreshing(false));
  };

  const handleSaveCookies = async () => {
    const nextCookies = cookieInput.trim();
    if (!nextCookies) return;

    try {
      setSaving(true);
      const providerConfig = providerTab === 'doordash'
        ? {
            businessId: businessIdInput.trim(),
            storeId: storeIdInput.trim(),
            ddAttKey: ddAttKeyInput.trim(),
          }
        : {};
      const status = await saveMarketplaceCookies(providerTab, {
        cookies: nextCookies,
        providerConfig,
      });
      invalidateLocalMarketplaceSession(providerTab);
      setCredentialStatus((prev) => ({ ...prev, [providerTab]: status }));
      setCookieInput('');
      setBusinessIdInput('');
      setStoreIdInput('');
      setDdAttKeyInput('');
      setShowSettingsModal(false);
      if (listTab === 'history') {
        const result = await getMarketplaceHistory(providerTab, {
          dateRange: historyDateRange,
          statuses: providerTab === 'doordash' ? selectedHistoryStatuses : undefined,
          mode: 'history',
        });
        setHistoryOrders(result.orders);
      } else if (listTab === 'scheduled') {
        const result = await getMarketplaceHistory(providerTab, {
          dateRange: historyDateRange,
          mode: 'scheduled',
        });
        setScheduledOrders(result.orders);
      } else {
        const result = await getMarketplaceActiveOrders(providerTab);
        setActiveOrders(result.orders);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearCookies = async () => {
    try {
      setSaving(true);
      await deleteMarketplaceCookies(providerTab);
      invalidateLocalMarketplaceSession(providerTab);
      setCredentialStatus((prev) => ({
        ...prev,
        [providerTab]: { provider: providerTab, configured: false, updatedAt: null, configuredBy: null, providerConfig: {} },
      }));
      setCookieInput('');
      setBusinessIdInput('');
      setStoreIdInput('');
      setDdAttKeyInput('');
      setShowSettingsModal(false);
      setActiveOrders([]);
      setHistoryOrders([]);
      setScheduledOrders([]);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenOrderDetail = async (
    provider: MarketplaceProvider,
    workflowUuid: string,
    mode: 'history' | 'live' = 'history'
  ) => {
    try {
      setDetailLoading(true);
      setSelectedOrderDetail(null);
      setShowDetailModal(true);
      const detail = await getMarketplaceOrderDetail(provider, workflowUuid, { mode });
      setSelectedOrderDetail(detail);
    } catch (error) {
      setShowDetailModal(false);
      throw error;
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddToPos = async () => {
    if (!selectedOrderDetail) return;

    const marketplaceOrder = selectedOrderDetail;
    const externalOrderNumber = marketplaceOrder.orderId.trim();
    const sourceName = marketplaceOrder.sourceName.trim();
    if (!externalOrderNumber || !sourceName) {
      Alert.alert('Marketplace', 'This marketplace order is missing its source or external order ID.');
      return;
    }

    try {
      setDetailLoading(true);
      const { data: existingOrders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('order_channel', 'third_party')
        .ilike('delivery_partner_name', sourceName)
        .eq('external_order_number', externalOrderNumber)
        .limit(1);

      if (error) {
        Alert.alert('Marketplace', `Could not verify whether this order is already in POS: ${error.message}`);
        return;
      }
      if ((existingOrders || []).length > 0) {
        Alert.alert('Marketplace', 'This marketplace order has already been added to POS.');
        return;
      }

      setMarketplacePosDraft({
        provider: marketplaceOrder.provider,
        sourceName: marketplaceOrder.sourceName as 'Uber Eats' | 'DoorDash',
        orderDetail: marketplaceOrder,
      });
      setShowDetailModal(false);
      setSelectedOrderDetail(null);
      router.push('/marketplace-resolver');
    } catch (error) {
      Alert.alert(
        'Marketplace',
        `Could not verify whether this order is already in POS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleHistoryStatus = (status: string) => {
    setSelectedHistoryStatuses((current) => (
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status]
    ));
  };

  const doordashStatusOptions = useMemo(() => (
    Array.from(new Set(historyOrders.map((order) => order.issueType).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  ), [historyOrders]);

  const historyStatusOptions = isUberEats ? [...UBER_HISTORY_STATUS_OPTIONS] : doordashStatusOptions;

  const filteredHistoryOrders = historyOrders.filter((order) => {
    if (selectedHistoryStatuses.length === 0) return true;
    if (!isUberEats) {
      return selectedHistoryStatuses.includes(order.issueType);
    }
    const haystack = `${order.issueType} ${order.orderChannel} ${order.fulfillmentType}`.toLowerCase();
    return selectedHistoryStatuses.some((status) => (
      HISTORY_STATUS_MATCHERS[status as (typeof UBER_HISTORY_STATUS_OPTIONS)[number]]?.some((matcher) => haystack.includes(matcher))
    ));
  });

  const selectedHistoryDateLabel = HISTORY_DATE_RANGE_OPTIONS.find((option) => option.value === historyDateRange)?.label || 'Today';
  const selectedStatusLabel = selectedHistoryStatuses.length > 0
    ? `${selectedHistoryStatuses.length} selected`
    : 'All statuses';

  const saveMapping = async (entry: MarketplaceUnmatchedName) => {
    const internalName = selectedMappings[entry.id]?.trim();
    if (!internalName) return;

    try {
      setSavingMappingId(entry.id);
      const { error } = await supabase
        .from('marketplace_name_mappings')
        .upsert({
          provider: entry.provider,
          entity_type: entry.entity_type,
          external_name: entry.external_name,
          normalized_external_name: entry.normalized_external_name,
          internal_name: internalName,
          is_active: true,
        }, { onConflict: 'provider,entity_type,normalized_external_name' });

      if (error) throw error;

      const { error: cleanupError } = await supabase
        .from('marketplace_unmatched_names')
        .delete()
        .eq('id', entry.id);

      if (cleanupError) {
        throw cleanupError;
      }

      setUnmatchedNames((current) => current.filter((item) => item.id !== entry.id));
      setSelectedMappings((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
    } catch (error) {
      console.error('Failed to save marketplace mapping', error);
    } finally {
      setSavingMappingId(null);
    }
  };

  const removeSavedMapping = (mapping: MarketplaceSavedMapping) => {
    Alert.alert('Remove mapping?', `Future ${mapping.external_name} orders will need to be resolved again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          void (async () => {
            setSavingMappingId(mapping.id);
            try {
              const { error } = await supabase.from('marketplace_name_mappings').delete().eq('id', mapping.id);
              if (error) throw error;
              setSavedMappings((current) => current.filter((entry) => entry.id !== mapping.id));
            } catch (error) {
              Alert.alert('Marketplace', error instanceof Error ? error.message : 'Could not remove mapping.');
            } finally {
              setSavingMappingId(null);
            }
          })();
        },
      },
    ]);
  };

  const editSavedMapping = (mapping: MarketplaceSavedMapping) => {
    setMappingEdit({
      id: mapping.id, provider: mapping.provider, entityType: mapping.entity_type,
      externalName: mapping.external_name, normalizedExternalName: mapping.normalized_external_name,
      parentNormalizedExternalName: mapping.parent_normalized_external_name,
      internalName: mapping.internal_name, internalEntityId: mapping.internal_entity_id,
    });
    setShowMappingsModal(false);
    router.push('/marketplace-resolver');
  };

  const getMappingOptions = (entityType: MappingEntityType) => {
    if (entityType === 'product') {
      return products.map((item) => item.name);
    }
    if (entityType === 'addon') {
      return addonItems.map((item) => item.name);
    }
    return ingredients.map((item) => item.ingredient_name);
  };

  const openMappingsModal = async () => {
    setShowMappingsModal(true);
    await loadMappings();
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
        <Card style={styles.utilityCard}>
          <Card.Content style={styles.utilityContent}>
            <View style={styles.utilityHeader}>
              <View style={styles.utilityTitleWrap}>
                <Text style={styles.utilityTitle}>Marketplace</Text>
                <Text style={styles.utilitySubtitle}>Sync settings, mappings, and marketplace orders.</Text>
              </View>
            </View>

            <View style={styles.providerConfigRow}>
              {(['uber_eats', 'doordash'] as ProviderTab[]).map((provider) => {
                const status = credentialStatus[provider];
                const isActiveProvider = providerTab === provider;
                const label = PROVIDER_LABELS[provider];

                return (
                  <TouchableOpacity
                    key={provider}
                    style={[
                      styles.providerConfigButton,
                      isActiveProvider ? styles.providerConfigButtonActive : null,
                      status.configured ? styles.providerConfigButtonReady : styles.providerConfigButtonPending,
                    ]}
                    onPress={() => {
                      setProviderTab(provider);
                      setShowSettingsModal(true);
                    }}
                  >
                    <View style={styles.providerConfigButtonHeader}>
                      <Text style={[styles.providerConfigButtonTitle, isActiveProvider ? styles.providerConfigButtonTitleActive : null]}>
                        {label}
                      </Text>
                      <IconButton
                        icon={status.configured ? 'check-circle' : 'circle-outline'}
                        size={18}
                        iconColor={status.configured ? '#15803d' : '#a16207'}
                        style={styles.providerConfigIcon}
                      />
                    </View>
                    <Text style={styles.providerConfigButtonMeta}>
                      {status.configured ? `Configured • ${formatStatusDate(status.updatedAt)}` : 'Tap to configure'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.utilityMetaRow}>
              <View style={styles.mappingCompactCopy}>
                <Text style={styles.mappingCompactTitle}>Name Mapping</Text>
                <Text style={styles.mappingCompactMeta}>
                  {unmatchedNames.length > 0
                    ? `${unmatchedNames.length} unmatched names ready to review`
                    : 'Keep product, add-on, and ingredient names aligned for imports.'}
                </Text>
              </View>
              <Button mode="text" icon="tune-variant" onPress={() => void openMappingsModal()} compact>
                Open Mapping
              </Button>
            </View>
          </Card.Content>
        </Card>

        <SegmentedButtons
          value={providerTab}
          onValueChange={(value) => setProviderTab(value as ProviderTab)}
          buttons={PROVIDER_TAB_OPTIONS}
        />

        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderTopRow}>
              <View>
                <Text style={styles.sectionTitle}>Orders</Text>
                <Text style={styles.sectionSubtitleCompact}>Active now, scheduled next, and completed history by provider.</Text>
              </View>
              <Button
                mode="outlined"
                icon="refresh"
                onPress={() => void Promise.all([loadStatuses(), loadHistory(), loadActiveOrders(), loadScheduledOrders()])}
                loading={loading || historyLoading || activeLoading || scheduledLoading}
                compact
              >
                Refresh
              </Button>
            </View>
            <SegmentedButtons
              value={listTab}
              onValueChange={(value) => setListTab(value as MarketplaceListTab)}
              buttons={LIST_TAB_OPTIONS}
            />
          </View>

          {listTab === 'history' ? (
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
                      {historyStatusOptions.map((status) => (
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
              <>
              <View style={styles.tableColumns}>
                <Text style={[styles.tableHeading, styles.flex2]}>Order</Text>
                <Text style={styles.tableHeading}>Customer</Text>
                <Text style={styles.tableHeading}>Status</Text>
                <Text style={styles.tableHeading}>Updated</Text>
              </View>
              {currentStatus.configured && listTab === 'active' ? (
                activeOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {activeOrders.map((order) => (
                      <TouchableOpacity
                        key={order.workflowUuid}
                        style={styles.historyRow}
                        onPress={() => void handleOpenOrderDetail(providerTab, order.workflowUuid, isUberEats ? 'live' : 'history')}
                      >
                        <View style={[styles.historyCell, styles.flex2]}>
                          <Text style={styles.historyPrimaryLink}>{order.orderId}</Text>
                          <Text style={styles.historySecondary}>{order.salesTotal || 'No total available'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.customerName}</Text>
                          <Text style={styles.historySecondary}>{order.orderChannel || providerLabel}</Text>
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
                    <Text style={styles.placeholderTitle}>No {providerLabel} active orders right now</Text>
                    <Text style={styles.placeholderText}>
                      Settings are configured, but the latest active-order request returned no open {providerLabel} orders.
                    </Text>
                  </View>
                )
              ) : listTab === 'scheduled' && currentStatus.configured ? (
                scheduledOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {scheduledOrders.map((order) => (
                      <TouchableOpacity
                        key={order.workflowUuid}
                        style={styles.historyRow}
                        onPress={() => void handleOpenOrderDetail(providerTab, order.workflowUuid, 'history')}
                      >
                        <View style={[styles.historyCell, styles.flex2]}>
                          <Text style={styles.historyPrimaryLink}>{order.orderId}</Text>
                          <Text style={styles.historySecondary}>
                            {order.netPayout ? `${order.salesTotal} net ${order.netPayout}` : order.salesTotal}
                          </Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.customerName}</Text>
                          <Text style={styles.historySecondary}>{order.orderChannel || providerLabel}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{formatOrderState(order.fulfillmentType).replace('FULFILLMENT TYPE ', '')}</Text>
                          <Text style={styles.historySecondary}>{order.courierName || 'No courier yet'}</Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.requestedAt}</Text>
                          <Text style={styles.historySecondary}>{order.issueType || 'Scheduled'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.placeholderPanelCompact}>
                    <Text style={styles.placeholderTitle}>No {providerLabel} scheduled orders found</Text>
                    <Text style={styles.placeholderText}>
                      Settings are configured, but the latest scheduled-order request returned no future {providerLabel} orders.
                    </Text>
                  </View>
                )
              ) : listTab === 'scheduled' ? (
                <View style={styles.placeholderPanelCompact}>
                  <Text style={styles.placeholderTitle}>Scheduled orders coming next</Text>
                  <Text style={styles.placeholderText}>
                    Configure {providerLabel} settings first to load scheduled orders.
                  </Text>
                </View>
              ) : listTab === 'history' && currentStatus.configured ? (
                filteredHistoryOrders.length > 0 ? (
                  <View style={styles.historyList}>
                    {filteredHistoryOrders.map((order) => (
                      <TouchableOpacity
                        key={order.workflowUuid}
                        style={styles.historyRow}
                        onPress={() => void handleOpenOrderDetail(providerTab, order.workflowUuid, 'history')}
                      >
                        <View style={[styles.historyCell, styles.flex2]}>
                          <Text style={styles.historyPrimaryLink}>{order.orderId}</Text>
                          <Text style={styles.historySecondary}>
                            {order.netPayout ? `${order.salesTotal} net ${order.netPayout}` : order.salesTotal}
                          </Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{order.customerName}</Text>
                          <Text style={styles.historySecondary}>
                            {isUberEats
                              ? (order.subscriptionPass || (order.isSubscriber ? 'Subscriber' : 'Standard'))
                              : order.orderChannel || providerLabel}
                          </Text>
                        </View>
                        <View style={styles.historyCell}>
                          <Text style={styles.historyPrimary}>{formatOrderState(order.fulfillmentType).replace('FULFILLMENT TYPE ', '')}</Text>
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
                    <Text style={styles.placeholderTitle}>No {providerLabel} history orders found</Text>
                    <Text style={styles.placeholderText}>
                      Settings are configured, but the latest history request and selected filters returned no matching rows.
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.placeholderPanel}>
                  <Text style={styles.placeholderTitle}>
                    {providerLabel} {listTab === 'active' ? 'active orders' : listTab === 'scheduled' ? 'scheduled orders' : 'history orders'}
                  </Text>
                  <Text style={styles.placeholderText}>
                    {listTab === 'active'
                      ? `Configure ${providerLabel} settings first to load active orders.`
                      : listTab === 'scheduled'
                        ? `Scheduled ${providerLabel} orders will appear here after backend integration.`
                      : currentStatus.configured
                        ? `Loading history from ${providerLabel}.`
                        : `Configure ${providerLabel} settings first to load history orders.`}
                  </Text>
                </View>
              )}
              </>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      <Portal>
        <NativeModal
          visible={showMappingsModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            if (savingMappingId) return;
            setShowMappingsModal(false);
          }}
        >
          <View style={styles.detailScreen}>
            <View style={styles.detailShell}>
              <Surface style={styles.detailTopBar} elevation={1}>
                <View style={styles.detailTopBarHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailHeaderTitle}>Marketplace Mapping</Text>
                    <Text style={styles.detailHeaderMeta}>
                      Match unmatched marketplace names to POS products, add-ons, and ingredients.
                    </Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => setShowMappingsModal(false)}
                    disabled={Boolean(savingMappingId)}
                  />
                </View>
              </Surface>

              <ScrollView style={styles.detailScrollContent} contentContainerStyle={styles.detailScrollContainer}>
                {unmatchedNames.length > 0 ? (
                  <View style={styles.mappingList}>
                    {unmatchedNames.map((entry) => {
                      const options = getMappingOptions(entry.entity_type);
                      const selectedValue = selectedMappings[entry.id] || '';
                      const matches = options
                        .filter((option) => option.toLowerCase().includes(entry.external_name.toLowerCase()) || entry.external_name.toLowerCase().includes(option.toLowerCase()))
                        .slice(0, 12);

                      return (
                        <Card key={entry.id} style={styles.mappingCard}>
                          <Card.Content style={styles.mappingCardContent}>
                            <View style={styles.mappingHeader}>
                              <View style={styles.mappingCopy}>
                                <Text style={styles.mappingTitle}>{entry.external_name}</Text>
                                <Text style={styles.mappingMeta}>
                                  {entry.entity_type.toUpperCase()} • Seen {entry.occurrences} times
                                  {entry.parent_external_name ? ` • ${entry.parent_external_name}` : ''}
                                </Text>
                              </View>
                            </View>

                            <TextInput
                              mode="outlined"
                              label="Internal POS name"
                              value={selectedValue}
                              onChangeText={(value) => setSelectedMappings((current) => ({ ...current, [entry.id]: value }))}
                              style={styles.checkoutInput}
                            />

                            {matches.length > 0 ? (
                              <View style={styles.mappingSuggestions}>
                                {matches.map((option) => (
                                  <Button
                                    key={`${entry.id}-${option}`}
                                    mode={selectedValue === option ? 'contained-tonal' : 'outlined'}
                                    compact
                                    onPress={() => setSelectedMappings((current) => ({ ...current, [entry.id]: option }))}
                                    style={styles.mappingSuggestionChip}
                                  >
                                    {option}
                                  </Button>
                                ))}
                              </View>
                            ) : null}

                            <View style={styles.mappingActions}>
                              <Button
                                mode="contained"
                                onPress={() => void saveMapping(entry)}
                                loading={savingMappingId === entry.id}
                                disabled={!selectedValue.trim() || savingMappingId === entry.id}
                              >
                                Save mapping
                              </Button>
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.placeholderPanel}>
                    <Text style={styles.placeholderTitle}>
                      {mappingLoading ? 'Loading unmatched marketplace names...' : 'No unmatched names right now'}
                    </Text>
                    <Text style={styles.placeholderText}>
                      New product, add-on, and ingredient mismatches from Marketplace imports will appear here so staff can map them to POS names.
                    </Text>
                  </View>
                )}
                {savedMappings.length > 0 ? (
                  <View style={styles.mappingList}>
                    <Text style={styles.savedMappingsTitle}>Saved mappings</Text>
                    {savedMappings.map((mapping) => (
                      <Card key={mapping.id} style={styles.mappingCard}>
                        <Card.Content style={styles.mappingCardContent}>
                          <Text style={styles.mappingTitle}>{mapping.external_name} → {mapping.internal_name}</Text>
                          <Text style={styles.mappingMeta}>
                            {mapping.entity_type.toUpperCase()}{mapping.parent_normalized_external_name ? ' • Product-specific' : ''}
                          </Text>
                          <View style={styles.mappingActions}>
                            <Button mode="outlined" onPress={() => editSavedMapping(mapping)} disabled={Boolean(savingMappingId)}>
                              Edit in resolver
                            </Button>
                            <Button mode="text" textColor="#b91c1c" onPress={() => removeSavedMapping(mapping)} disabled={Boolean(savingMappingId)}>
                              Remove mapping
                            </Button>
                          </View>
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </NativeModal>

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
                        : 'Loading marketplace order details'}
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
                    <Text style={styles.detailHeaderTime}>{formatUnixMilliseconds(selectedOrderDetail.requestedAt)}</Text>
                    <Button mode="contained" icon="cart-plus" onPress={() => void handleAddToPos()} disabled={detailLoading} style={styles.detailHeaderAction}>
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
                          <Text style={styles.detailTotalValue}>{formatUnixMilliseconds(selectedOrderDetail.requestedAt)}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Completed</Text>
                          <Text style={styles.detailTotalValue}>{formatUnixMilliseconds(selectedOrderDetail.completedAtTimestamp)}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Subtotal</Text>
                          <Text style={styles.detailTotalValue}>{selectedOrderDetail.subtotal || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Discount</Text>
                          <Text style={styles.detailTotalValue}>
                            {selectedOrderDetail.discount
                              ? `-${selectedOrderDetail.discount}`
                              : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Order total</Text>
                          <Text style={styles.detailTotalValue}>{selectedOrderDetail.total || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailTotalRow}>
                          <Text style={styles.detailTotalLabel}>Net payout</Text>
                          <Text style={styles.detailTotalValue}>{selectedOrderDetail.netPayout}</Text>
                        </View>
                        {selectedOrderDetail.discountLabel ? (
                          <Text style={styles.detailHelperText}>
                            Discount source: {selectedOrderDetail.discountLabel}
                          </Text>
                        ) : null}
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
            setBusinessIdInput('');
            setStoreIdInput('');
            setDdAttKeyInput('');
          }}
          contentContainerStyle={styles.modalCard}
        >
          <Text style={styles.modalTitle}>{providerLabel} cookies</Text>
          <Text style={styles.modalSubtitle}>
            Paste the full cookie string from your browser session. We encrypt it on the server before saving it to the database for cross-device sync.
          </Text>

          {isDoorDash ? (
            <>
              <View style={styles.doordashConfigRow}>
                <TextInput
                  mode="outlined"
                  label="Business ID"
                  value={businessIdInput}
                  onChangeText={setBusinessIdInput}
                  keyboardType="numeric"
                  style={styles.doordashConfigInput}
                  disabled={saving}
                />
                <TextInput
                  mode="outlined"
                  label="Store ID"
                  value={storeIdInput}
                  onChangeText={setStoreIdInput}
                  keyboardType="numeric"
                  style={styles.doordashConfigInput}
                  disabled={saving}
                />
              </View>
              <TextInput
                mode="outlined"
                label="DD ATT Key"
                value={ddAttKeyInput}
                onChangeText={setDdAttKeyInput}
                style={styles.cookieInput}
                disabled={saving}
              />
            </>
          ) : null}

          <TextInput
            mode="outlined"
            label="Cookie header value"
            value={cookieInput}
            onChangeText={setCookieInput}
            multiline
            numberOfLines={8}
            style={styles.cookieInput}
            disabled={saving}
          />

          <Text style={styles.modalHint}>
            Current status: {currentStatus.configured ? `configured on ${formatStatusDate(currentStatus.updatedAt)}` : 'not configured'}
          </Text>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowSettingsModal(false)} disabled={saving}>
              Close
            </Button>
            <Button mode="outlined" onPress={() => void handleClearCookies()} disabled={!currentStatus.configured || saving}>
              Clear
            </Button>
            <Button
              mode="contained"
              onPress={() => void handleSaveCookies()}
              loading={saving}
              disabled={!cookieInput.trim() || (isDoorDash && (!businessIdInput.trim() || !storeIdInput.trim()))}
            >
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
    padding: 12,
    gap: 12,
  },
  utilityCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  utilityContent: {
    gap: 12,
  },
  utilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  utilityTitleWrap: {
    flex: 1,
    gap: 2,
  },
  utilityTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  utilitySubtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  providerConfigRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  providerConfigButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  providerConfigButtonActive: {
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  providerConfigButtonReady: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  providerConfigButtonPending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  providerConfigButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  providerConfigButtonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  providerConfigButtonTitleActive: {
    color: '#1d4ed8',
  },
  providerConfigButtonMeta: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  providerConfigIcon: {
    margin: 0,
  },
  utilityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  mappingCompactCopy: {
    flex: 1,
    gap: 3,
  },
  mappingCompactTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  mappingCompactMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitleCompact: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 520,
  },
  tableSection: {
    gap: 10,
  },
  tableHeader: {
    gap: 8,
  },
  tableHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
    gap: 6,
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
    flexWrap: 'wrap',
  },
  filterControl: {
    flex: 1,
    minWidth: 140,
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexWrap: 'wrap',
  },
  tableHeading: {
    flex: 1,
    minWidth: 120,
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
  placeholderPanelCompact: {
    paddingVertical: 18,
    gap: 8,
  },
  historyList: {
    gap: 10,
    paddingTop: 10,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexWrap: 'wrap',
  },
  historyCell: {
    flex: 1,
    gap: 4,
    minWidth: 140,
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
  mappingList: {
    gap: 12,
  },
  savedMappingsTitle: {
    color: '#36566b',
    fontWeight: '700',
    marginTop: 12,
  },
  mappingCard: {
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  mappingCardContent: {
    gap: 12,
  },
  mappingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mappingCopy: {
    flex: 1,
    gap: 4,
  },
  mappingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  mappingMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  mappingSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mappingSuggestionChip: {
    borderRadius: 999,
  },
  mappingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    marginHorizontal: 12,
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
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
  detailHelperText: {
    marginTop: -2,
    marginBottom: 8,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
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
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
  doordashConfigRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  doordashConfigInput: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#fff',
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
    flexWrap: 'wrap',
  },
});
