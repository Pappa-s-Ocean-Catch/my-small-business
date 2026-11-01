import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { IconButton } from 'react-native-paper';

import type { Customer } from '../../lib/customers';
import { getRecentCustomers, searchCustomers, getRecentCalls } from '../../lib/customers';
import { CustomerDirectoryList } from '../customers/CustomerDirectoryList';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import { PosPhoneInputModal } from './PosPhoneInputModal';
import { PosTextInputModal } from './PosTextInputModal';
import { styles } from './pos.styles';
import { EditorSheet } from '@/components/ui';
import { designTokens as tokens } from '@/lib/redesign';

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
  const compact = width < 600;
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [searchDialogVisible, setSearchDialogVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMatches, setModalMatches] = useState<Customer[]>([]);
  const [loadingModalMatches, setLoadingModalMatches] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [recentCallsVisible, setRecentCallsVisible] = useState(false);
  const [recentCalls, setRecentCalls] = useState<{ caller_number: string, caller_name: string | null, created_at: string }[]>([]);
  const [loadingRecentCalls, setLoadingRecentCalls] = useState(false);

  const loadRecentCalls = async () => {
    setLoadingRecentCalls(true);
    setRecentCallsVisible(true);
    const { data } = await getRecentCalls(3);
    setRecentCalls(data || []);
    setLoadingRecentCalls(false);
  };

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

  const recentCallsSheet = (
    <EditorSheet visible={recentCallsVisible} title="Recent calls" onDismiss={() => setRecentCallsVisible(false)} footer={<Button mode="outlined" onPress={() => setRecentCallsVisible(false)}>Cancel</Button>}>
        {loadingRecentCalls ? <ActivityIndicator /> : recentCalls.length === 0 ? <Text style={{ color: tokens.color.muted }}>No recent calls</Text> : recentCalls.map(call => <TouchableOpacity key={`${call.caller_number}-${call.created_at}`} accessibilityRole="button" accessibilityLabel={`Use ${call.caller_name || call.caller_number}`} onPress={() => { onChangePhone(call.caller_number); if (call.caller_name) onChangeName(call.caller_name); setRecentCallsVisible(false); }} style={{ minHeight: 50, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface, padding: 14, borderRadius: 10, gap: 4 }}><Text style={{ color: tokens.color.text }}>{call.caller_name || 'Unknown caller'} · {call.caller_number}</Text><Text style={{ color: tokens.color.muted, fontSize: 12 }}>{new Date(call.created_at).toLocaleString('en-AU')}</Text></TouchableOpacity>)}
      </EditorSheet>
  );

  return (
    <>
      <View style={[styles.customerCard, compact && styles.customerCardPhone]}>
        {compact ? <View style={styles.customerCardHeader}>
          <Text style={styles.checkoutSectionTitle}>Customer</Text>
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon="account-search-outline" accessibilityLabel="Find customer" onPress={() => setSearchDialogVisible(true)} style={styles.customerPhoneAction} />
            <IconButton icon="phone-clock-outline" accessibilityLabel="Recent calls" onPress={loadRecentCalls} style={styles.customerPhoneAction} />
          </View>
        </View> : <Text style={styles.checkoutSectionTitle}>Customer</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 8 : 16 }}>
          <View style={{ flex: 1, minWidth: compact ? 0 : 140 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.text, marginBottom: compact ? 4 : 8 }}>{allowEmptyPhone ? 'Phone (optional)' : 'Phone'}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enter customer phone" style={styles.customerInputTrigger} onPress={() => setPhoneModalVisible(true)}><Text style={styles.customerInputValue}>{customerPhone || '04'}</Text></TouchableOpacity>
          </View>
          <View style={{ flex: 1, minWidth: compact ? 0 : 140 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.text, marginBottom: compact ? 4 : 8 }}>{compact ? 'Name' : 'Customer name'}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enter customer name" style={styles.customerInputTrigger} onPress={() => setNameModalVisible(true)}><Text style={[styles.customerInputValue, !customerName && { color: tokens.color.muted }]}>{customerName || 'Customer name'}</Text></TouchableOpacity>
          </View>
        </View>
        {!compact && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
          <Button mode="outlined" compact onPress={() => setSearchDialogVisible(true)} contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} hitSlop={2} textColor={tokens.color.text}>Find customer</Button>
          <Button mode="outlined" compact onPress={loadRecentCalls} contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} hitSlop={2} textColor={tokens.color.text}>Recent calls</Button>
        </View>}

        {customerLookupStatus !== 'idle' && <View style={styles.customerInlineState}>
          {customerLookupStatus === 'loading' ? <ActivityIndicator size="small" color="#2563eb" /> : null}
          <Text style={[helperStyle, styles.customerHelperText]}>{helperText}</Text>
        </View>}

        {(selectedCustomer || customerName.trim()) && (
          <View style={[styles.customerSummaryCompact, compact && { gap: 4, paddingVertical: 4 }]}>
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
            <View style={[styles.customerSummaryStatsRow, compact && { flexWrap: 'wrap' }]}>
              <View style={[styles.customerSummaryStatPill, compact && styles.customerSummaryStatPhone]}>
                <Text style={styles.customerSummaryStatLabel}>Points</Text>
                <Text style={styles.customerSummaryStatValue}>{rewardPointsBalance.toLocaleString()}</Text>
              </View>
              <View style={[styles.customerSummaryStatPill, compact && styles.customerSummaryStatPhone]}>
                <Text style={styles.customerSummaryStatLabel}>Orders</Text>
                <Text style={styles.customerSummaryStatValue}>{selectedCustomer?.totalOrders ?? 0}</Text>
              </View>
              <View style={[styles.customerSummaryStatPill, compact && styles.customerSummaryStatPhone]}>
                <Text style={styles.customerSummaryStatLabel}>Spent</Text>
                <Text style={styles.customerSummaryStatValue}>{formatMoney(selectedCustomer?.totalSpent)}</Text>
              </View>
              <View style={[styles.customerSummaryStatPill, compact && styles.customerSummaryStatPhone]}>
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
        title="Customer name"
        value={customerName}
        onDismiss={() => setNameModalVisible(false)}
        onSave={(value) => {
          onChangeName(value);
          setNameModalVisible(false);
        }}
      />

      <EditorSheet visible={searchDialogVisible} title="Find a customer" scrollable={false} onDismiss={() => setSearchDialogVisible(false)} footer={<><Button mode="outlined" onPress={() => setSearchDialogVisible(false)}>Cancel</Button><Button mode="outlined" onPress={loadRecentCalls}>Recent calls</Button></>}>
        {!!modalError && <Text style={styles.errorText}>{modalError}</Text>}
        <CustomerDirectoryList
          customers={modalMatches} searchQuery={searchQuery} onChangeSearchQuery={setSearchQuery}
          onSelectCustomer={(nextCustomer) => { onSelectCustomer(nextCustomer); setSearchDialogVisible(false); }}
          loading={loadingModalMatches} emptyText="No customers found." searchPlaceholder="Search by name or phone"
        />
        {searchDialogVisible && recentCallsSheet}
      </EditorSheet>

      {!searchDialogVisible && recentCallsSheet}
    </>
  );
}
