import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Surface } from 'react-native-paper';

import type { Customer } from '../../lib/customers';
import { getRecentCustomers, searchCustomers } from '../../lib/customers';
import { CustomerDirectoryList } from '../customers/CustomerDirectoryList';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import { PosPhoneInputModal } from './PosPhoneInputModal';
import { PosTextInputModal } from './PosTextInputModal';
import { styles } from './pos.styles';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  onChangePhone: (value: string) => void;
  customerName: string;
  onChangeName: (value: string) => void;
  customerLookupError: string | null;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  allowEmptyPhone?: boolean;
  onClearCustomer: () => void;
  onResetToDefaultInstore?: () => void;
  rewardPointsEnabled: boolean;
  rewardPointsBalance: number;
  rewardPointsDollarValue: number;
  rewardPointsApplied: boolean;
  appliedRewardPointsValue: number;
  onToggleRewardPoints: () => void;
};

const formatMoney = (value?: number) => `$${(Number(value) || 0).toFixed(2)}`;

const formatShortDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

export function PosCustomerSelector({
  customerLookupStatus,
  customerPhone,
  onChangePhone,
  customerName,
  onChangeName,
  customerLookupError,
  selectedCustomer,
  onSelectCustomer,
  allowEmptyPhone = false,
  onClearCustomer,
  onResetToDefaultInstore,
  rewardPointsEnabled,
  rewardPointsBalance,
  rewardPointsDollarValue,
  rewardPointsApplied,
  appliedRewardPointsValue,
  onToggleRewardPoints,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 920;
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [searchDialogVisible, setSearchDialogVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMatches, setModalMatches] = useState<Customer[]>([]);
  const [loadingModalMatches, setLoadingModalMatches] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchDialogVisible) return;

    const query = searchQuery.trim();
    let cancelled = false;
    setLoadingModalMatches(true);
    setModalError(null);

    const request = query ? searchCustomers(query, 0, 20) : getRecentCustomers(0, 20);
    void request
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setModalError(error);
          setModalMatches([]);
          return;
        }
        setModalMatches(data || []);
      })
      .finally(() => {
        if (!cancelled) setLoadingModalMatches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchDialogVisible, searchQuery]);

  const helperText = useMemo(() => {
    if (customerLookupStatus === 'loading') return 'Looking up customer...';
    if (customerLookupStatus === 'found') return 'Customer matched';
    if (customerLookupStatus === 'new') return allowEmptyPhone ? 'New customer details will be saved if provided.' : 'No match yet. We will create a customer when you place the order.';
    if (customerLookupStatus === 'error') return customerLookupError;
    return allowEmptyPhone ? 'Optional for walk-ins. Search by phone or name if needed.' : 'Type a phone number or search by name.';
  }, [allowEmptyPhone, customerLookupError, customerLookupStatus]);

  const helperStyle = customerLookupStatus === 'error'
    ? styles.errorText
    : customerLookupStatus === 'found'
      ? styles.foundText
      : styles.lookupText;

  const selectedLastOrder = formatShortDate(selectedCustomer?.lastOrderDate);

  return (
    <>
      <View style={styles.customerCard}>
        <Text style={styles.checkoutSectionTitle}>Customer</Text>
        <View style={styles.customerIdentityRowSingleLine}>
          <TouchableOpacity
            style={[styles.phoneTrigger, styles.customerIdentityField, styles.customerPhoneField]}
            onPress={() => setPhoneModalVisible(true)}
          >
            <Text style={styles.phoneTriggerLabel}>{allowEmptyPhone ? 'Phone optional' : 'Phone'}</Text>
            <Text style={[styles.phoneTriggerValue, !customerPhone ? styles.phoneTriggerPlaceholder : null]} numberOfLines={1}>
              {customerPhone || '04'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.phoneTrigger, styles.customerIdentityField]}
            onPress={() => setNameModalVisible(true)}
          >
            <Text style={styles.phoneTriggerLabel}>Name</Text>
            <Text style={[styles.phoneTriggerValue, !customerName ? styles.phoneTriggerPlaceholder : null]} numberOfLines={1}>
              {customerName || 'Tap to enter'}
            </Text>
          </TouchableOpacity>
          <Button
            mode="outlined"
            icon="account-search-outline"
            compact
            onPress={() => setSearchDialogVisible(true)}
            style={styles.customerSearchButton}
            contentStyle={styles.customerSearchButtonContent}
          >
            Search
          </Button>
        </View>

        <View style={styles.customerInlineState}>
          {customerLookupStatus === 'loading' ? <ActivityIndicator size="small" color="#2563eb" /> : null}
          <Text style={[helperStyle, styles.customerHelperText]}>{helperText}</Text>
        </View>

        {(selectedCustomer || customerName.trim()) && (
          <View style={styles.customerSummaryCompact}>
            <View style={styles.customerSummaryTopRow}>
              <Text style={styles.customerSummaryCaption}>
                {selectedCustomer ? 'Customer selected' : 'Customer details entered'}
              </Text>
              <View style={styles.customerSummaryActions}>
                <Button mode="text" compact onPress={onClearCustomer} labelStyle={styles.customerSummaryActionLabel}>
                  Clear
                </Button>
                {onResetToDefaultInstore ? (
                  <Button mode="text" compact onPress={onResetToDefaultInstore} labelStyle={styles.customerSummaryActionLabel}>
                    Default In-store
                  </Button>
                ) : null}
              </View>
            </View>
            <View style={styles.customerSummaryStatsRow}>
              <View style={styles.customerSummaryStatPill}>
                <Text style={styles.customerSummaryStatLabel}>Points</Text>
                <Text style={styles.customerSummaryStatValue}>{rewardPointsBalance.toLocaleString()}</Text>
              </View>
              <View style={styles.customerSummaryStatPill}>
                <Text style={styles.customerSummaryStatLabel}>Orders</Text>
                <Text style={styles.customerSummaryStatValue}>{selectedCustomer?.totalOrders ?? 0}</Text>
              </View>
              <View style={styles.customerSummaryStatPill}>
                <Text style={styles.customerSummaryStatLabel}>Spent</Text>
                <Text style={styles.customerSummaryStatValue}>{formatMoney(selectedCustomer?.totalSpent)}</Text>
              </View>
              <View style={styles.customerSummaryStatPill}>
                <Text style={styles.customerSummaryStatLabel}>Last</Text>
                <Text style={styles.customerSummaryStatValue}>{selectedLastOrder || '-'}</Text>
              </View>
            </View>
            {selectedCustomer && rewardPointsEnabled && rewardPointsBalance > 0 ? (
              <View style={styles.customerRewardRow}>
                <Text style={styles.customerRewardText}>
                  {rewardPointsBalance.toLocaleString()} pts = {formatMoney(rewardPointsDollarValue)}
                  {rewardPointsApplied ? ` • Applied ${formatMoney(appliedRewardPointsValue)}` : ''}
                </Text>
                <Button mode={rewardPointsApplied ? 'contained-tonal' : 'contained'} compact onPress={onToggleRewardPoints}>
                  {rewardPointsApplied ? 'Remove points' : 'Apply points'}
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <PosPhoneInputModal
        visible={phoneModalVisible}
        value={customerPhone}
        onDismiss={() => setPhoneModalVisible(false)}
        onSave={(value) => {
          onChangePhone(value);
          setPhoneModalVisible(false);
        }}
      />

      <PosTextInputModal
        visible={nameModalVisible}
        title="Enter Customer Name"
        value={customerName}
        onDismiss={() => setNameModalVisible(false)}
        onSave={(value) => {
          onChangeName(value);
          setNameModalVisible(false);
        }}
      />

      <Modal
        visible={searchDialogVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchDialogVisible(false)}
      >
        <View style={modalStyles.container}>
          <View style={modalStyles.modalShell}>
            <Surface
              style={[
                modalStyles.header,
                { paddingTop: isWide ? 14 : Math.max(insets.top, 8) },
              ]}
              elevation={1}
            >
              <View style={modalStyles.headerTop}>
                <View style={modalStyles.headerTitleBlock}>
                  <Text style={modalStyles.headerTitle}>Find customer</Text>
                  <Text style={modalStyles.headerMeta}>
                    Search by name or phone, then tap a customer to attach them to this order.
                  </Text>
                </View>
                <IconButton icon="close" size={24} iconColor="#f8fafc" onPress={() => setSearchDialogVisible(false)} />
              </View>
            </Surface>

            <View
              style={[
                modalStyles.contentArea,
                isWide ? modalStyles.contentAreaWide : null,
                { paddingBottom: Math.max(insets.bottom, 20) + 24 },
              ]}
            >
              <View style={modalStyles.resultsArea}>
                {!!modalError && <Text style={styles.errorText}>{modalError}</Text>}
                <CustomerDirectoryList
                  customers={modalMatches}
                  searchQuery={searchQuery}
                  onChangeSearchQuery={setSearchQuery}
                  onSelectCustomer={(nextCustomer) => {
                    onSelectCustomer(nextCustomer);
                    setSearchDialogVisible(false);
                  }}
                  loading={loadingModalMatches}
                  emptyText="No customers found."
                  searchPlaceholder="Search by name or phone"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f6' },
  modalShell: { flex: 1, backgroundColor: '#eef2f6' },
  header: {
    paddingBottom: 18,
    backgroundColor: '#10243f',
    borderBottomWidth: 1,
    borderBottomColor: '#183457',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 20,
    paddingRight: 8,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f8fafc',
  },
  headerMeta: {
    fontSize: 14,
    color: '#b9c8dd',
    fontWeight: '600',
    marginTop: 4,
  },
  contentArea: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  contentAreaWide: {
    padding: 18,
  },
  resultsArea: {
    flex: 1,
    minHeight: 0,
  },
});
