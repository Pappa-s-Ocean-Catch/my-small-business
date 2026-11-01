import { AppModal as Modal } from '@/components/ui/AppModal';
import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { OrderDetailController } from './OrderDetailController';
import { FullScreenModalHeader } from '@/components/ui/FullScreenModal';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Clipboard, Linking, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, IconButton, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrderStatus } from '@my-small-business/types';
import { fetchCustomerSummary, type CustomerSummary, updateCustomerNameByContact } from '@/utils/customerSummary';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';
import { getApiUrl } from '../utils/orderUtils';
import { adjustCustomerRewardPoints } from '@/lib/reward-points';
import { getCustomerCoupons, toggleCouponActive, type CustomerCouponItem } from '@/lib/coupons';
import { AddCustomerModal } from '@/components/customers/AddCustomerModal';
import { supabase } from '@/lib/supabase';
import { MetricCard, StatusBadge, FormField, designTokens as t } from '@/components/ui';

function orderStatusColor(status: string): string {
  if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, status)) {
    return STATUS_COLORS[status as OrderStatus];
  }
  return t.color.muted;
}

function orderStatusLabel(status: string): string {
  if (Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
    return STATUS_LABELS[status as OrderStatus];
  }
  return status.replace(/_/g, ' ');
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function rewardHistoryTone(type: string) {
  switch (type) {
    case 'earned':
      return { label: 'Earned', color: t.color.success, background: t.color.successTint };
    case 'used':
      return { label: 'Used', color: t.color.warning, background: t.color.warningTint };
    case 'expired':
      return { label: 'Expired', color: t.color.danger, background: t.color.dangerTint };
    default:
      return { label: 'Manual Adjust', color: t.color.primary, background: t.color.primaryTint };
  }
}

export function CustomerModal({
  email,
  phone,
  profileId,
  visible,
  onClose,
  allowRewardAdjustments = false,
  onCustomerUpdated,
}: {
  email?: string;
  phone?: string;
  profileId?: string;
  visible: boolean;
  onClose: () => void;
  onOrderPress?: (orderId: string) => void;
  allowRewardAdjustments?: boolean;
  onCustomerUpdated?: () => void;
}) {
  // Present from this native Modal's controller. Sibling modals can appear behind
  // the profile on iOS; keeping the profile mounted also preserves its scroll.
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  useEffect(() => { if (!visible) setDetailOrderId(null); }, [visible]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [expandedRewards, setExpandedRewards] = useState<Record<string, boolean>>({});
  const [expandedCoupons, setExpandedCoupons] = useState<Record<string, boolean>>({});
  const isMedium = width >= 640;
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingMarketing, setSendingMarketing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [pointsDelta, setPointsDelta] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [savingPoints, setSavingPoints] = useState(false);
  const [customerCoupons, setCustomerCoupons] = useState<CustomerCouponItem[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [togglingCouponId, setTogglingCouponId] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    try {
      Clipboard.setString(code);
      Alert.alert('Copied', `Coupon code "${code}" copied to clipboard.`);
    } catch {
      Alert.alert('Copied', `Coupon code "${code}" copied.`);
    }
  };

  const loadCoupons = async (c: CustomerSummary | null) => {
    if (!c) {
      setCustomerCoupons([]);
      return;
    }
    setLoadingCoupons(true);
    const { data } = await getCustomerCoupons({ userId: c.profileId, customerEmail: c.email });
    setCustomerCoupons(data);
    setLoadingCoupons(false);
  };

  const handleToggleCustomerCoupon = async (item: CustomerCouponItem) => {
    const newStatus = !item.coupon.is_active;
    setTogglingCouponId(item.coupon.id);
    const { success, error: toggleErr } = await toggleCouponActive(item.coupon.id, newStatus);
    setTogglingCouponId(null);
    if (success && customer) {
      await loadCoupons(customer);
    } else if (toggleErr) {
      Alert.alert('Error', toggleErr);
    }
  };

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    setCustomer(null);
    setEditingPoints(false);
    setPointsDelta('');
    setPointsReason('');

    try {
      const data = await fetchCustomerSummary({ email, phone, profileId });
      setCustomer(data);
      if (!data) setError('No customer data found for this contact.');
    } catch {
      setError('Failed to load customer details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    void loadCustomer();
  }, [email, phone, profileId, visible]);

  useEffect(() => {
    if (customer) {
      void loadCoupons(customer);
    }
  }, [customer]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || '??';

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    const url = `tel:${phoneNumber.replace(/\s+/g, '')}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Calling is not supported on this device.');
      }
    });
  };

  const handleEmail = (emailAddress: string) => {
    if (!emailAddress) return;
    const url = `mailto:${emailAddress}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No email app found on this device.');
      }
    });
  };

  const handleStartEditName = () => {
    setShowEditCustomerModal(true);
  };

  const handleSaveName = async (input: { name: string }) => {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter the customer name before saving.');
      return;
    }

    setSavingName(true);
    try {
      await updateCustomerNameByContact({ profileId: customer?.profileId, name: trimmedName });
      setCustomer((current) => (current ? { ...current, name: trimmedName } : current));
      setShowEditCustomerModal(false);
      onCustomerUpdated?.();
      Alert.alert('Saved', 'Customer name updated successfully.');
    } catch (saveError: any) {
      Alert.alert('Error', saveError?.message || 'Failed to update customer name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSendMarketing = async () => {
    if (!customer?.profileId) {
      Alert.alert('Error', 'This customer does not have a registered profile ID and cannot receive marketing emails.');
      return;
    }

    Alert.alert('Confirm', `Send a marketing email with a 1-time coupon to ${customer.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setSendingMarketing(true);
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
              throw new Error(sessionError?.message || 'Missing authenticated session');
            }

            const url = getApiUrl('/api/marketing/send');
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                customers: [{
                  id: customer.profileId,
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                }],
                discountPercentage: 10,
                channels: ['email'],
              }),
            });

            const result = await response.json();
            if (!response.ok) {
              throw new Error(result.error || 'Failed to send marketing email');
            }

            Alert.alert('Success', `Marketing email sent successfully to ${customer.name}`);
          } catch (sendError: any) {
            Alert.alert('Error', sendError.message);
          } finally {
            setSendingMarketing(false);
          }
        },
      },
    ]);
  };

  const handleAdjustPoints = async () => {
    const trimmedReason = pointsReason.trim();
    const delta = Number(pointsDelta);

    if (!customer?.profileId) {
      Alert.alert('Error', 'This customer does not have a saved profile to adjust.');
      return;
    }
    if (!Number.isFinite(delta) || delta === 0 || !Number.isInteger(delta)) {
      Alert.alert('Invalid points', 'Enter a whole number of points to add or remove.');
      return;
    }
    if (!trimmedReason) {
      Alert.alert('Reason required', 'Please add a short note for this manual adjustment.');
      return;
    }

    setSavingPoints(true);
    try {
      const result = await adjustCustomerRewardPoints({
        userId: customer.profileId,
        pointsDelta: delta,
        description: trimmedReason,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to adjust reward points');
      }

      setEditingPoints(false);
      setPointsDelta('');
      setPointsReason('');
      await loadCustomer();
      onCustomerUpdated?.();
      Alert.alert('Saved', 'Reward point balance updated successfully.');
    } catch (adjustError: any) {
      Alert.alert('Error', adjustError?.message || 'Failed to adjust reward points.');
    } finally {
      setSavingPoints(false);
    }
  };

  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} transparent={false} presentationStyle="fullScreen" animationType="slide" onRequestClose={onClose}>
      <View accessibilityElementsHidden={!!detailOrderId || showEditCustomerModal} importantForAccessibility={detailOrderId || showEditCustomerModal ? 'no-hide-descendants' : 'auto'} pointerEvents={detailOrderId || showEditCustomerModal ? 'none' : 'auto'} style={{ flex: 1 }}>
      <View accessibilityViewIsModal style={styles.container}>
        <FullScreenModalHeader
          title={error ? 'Customer not found' : loading ? 'Loading customer…' : customer?.name || 'Customer profile'}
          subtitle={customer?.signUpDate ? `Customer since ${new Date(customer.signUpDate).toLocaleDateString([], { month: 'long', year: 'numeric' })}` : email || phone || 'Customer details'}
          onClose={onClose} closeLabel="Close customer profile"
          actions={customer ? <IconButton icon="pencil-outline" accessibilityLabel="Edit customer name" iconColor="#f8fafc" onPress={handleStartEditName} /> : undefined}
        />

        <View style={styles.contentArea}>
          {loading && (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Fetching profile...</Text>
            </View>
          )}

          {error && (
            <View style={styles.centerContainer}>
              <View style={error.startsWith('No customer data') ? { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.primaryTint } : undefined}><MaterialCommunityIcons name={error.startsWith('No customer data') ? 'account-group-outline' : 'alert-circle-outline'} size={error.startsWith('No customer data') ? 32 : 64} color={error.startsWith('No customer data') ? t.color.primary : t.color.danger} /></View>
              <Text style={[styles.sectionTitle, { fontSize: 24, marginTop: 20 }]}>{error.startsWith('No customer data') ? 'No linked customer' : 'Customer details unavailable'}</Text>
              <Text style={[styles.emptyText, { textAlign: 'center', maxWidth: 360, lineHeight: 24, marginBottom: 20 }]}>{error.startsWith('No customer data') ? 'No customer is linked to this order. Return to the order to continue.' : error}</Text>
              <Button mode="outlined" onPress={error.startsWith('No customer data') ? onClose : () => void loadCustomer()}>{error.startsWith('No customer data') ? 'Back to order' : 'Retry'}</Button>
            </View>
          )}

          {!loading && !error && customer && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingHorizontal: width < 1100 ? 12 : 16, paddingBottom: bottomPadding + 24 }]}
              showsVerticalScrollIndicator
            >

              <View style={[styles.statsContainer, !isMedium && styles.statsContainerCompact]}>
                <MetricCard style={isMedium ? styles.metricTablet : styles.metricPhone} label="Orders" value={customer.totalOrders} />
                <MetricCard style={isMedium ? styles.metricTablet : styles.metricPhone} label="Total spend" value={formatMoney(customer.totalAmount)} />
                <MetricCard style={isMedium ? styles.metricTablet : styles.metricPhone} label="Reward points" value={customer.rewardPoints.toLocaleString()} /><MetricCard style={isMedium ? styles.metricTablet : styles.metricPhone} label="Last order" value={customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'} />
              </View>

              <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
                <View style={styles.primaryColumn}>
                  <View style={styles.section}>
                    <View style={styles.sectionHeadingRow}><Text style={[styles.sectionTitle, styles.headingInRow]}>Contact details</Text><Button compact contentStyle={{ minHeight: 32 }} hitSlop={{ top: 8, bottom: 8 }} style={styles.headerSecondaryAction} labelStyle={styles.headerSecondaryLabel} onPress={() => setShowContactDetails((value) => !value)}>{showContactDetails ? 'Hide details' : 'Details'}</Button></View>
              {customer.phone ? (
                <View style={styles.phoneActionBox}>
                  <View style={styles.phoneNumberContainer}>
                    <MaterialCommunityIcons name="phone" size={18} color={t.color.muted} />
                    <Text variant="bodyLarge" style={styles.phoneNumberText}>
                      {customer.phone}
                    </Text>
                  </View>
                  <IconButton
                    icon="phone-outline"
                    mode="outlined"
                    iconColor={t.color.text}
                    size={20}
                    style={styles.contactCallButton}
                    accessibilityLabel="Call customer"
                    onPress={() => handleCall(customer.phone)}
                  />
                </View>
              ) : null}

                    {customer.email && <Text onPress={() => handleEmail(customer.email)} style={[styles.infoText, { marginLeft: 0, marginBottom: 16 }]}>{customer.email}</Text>}
                    <Button mode="outlined" onPress={handleStartEditName} style={{ alignSelf: 'flex-start', marginBottom: 16 }} contentStyle={{ minHeight: 48 }}>Edit name</Button>
                    {showContactDetails && <View>
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="calendar-account" size={18} color="#64748b" />
                      <Text variant="bodyMedium" style={styles.infoText}>
                        Member since: <Text style={styles.bold}>{formatDate(customer.signUpDate)}</Text>
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="clock-outline" size={18} color="#64748b" />
                      <Text variant="bodyMedium" style={styles.infoText}>
                        Last order: <Text style={styles.bold}>{formatDate(customer.lastOrderDate)}</Text>
                      </Text>
                    </View>
                    </View>}
                  </View>

                  <View style={styles.section}>
                    <View style={styles.sectionHeadingRow}><Text variant="titleMedium" style={[styles.sectionTitle, styles.headingInRow]}>Recent orders</Text>
                      {customer.orders.length > 2 && <Button compact contentStyle={{ minHeight: 32 }} hitSlop={{ top: 8, bottom: 8 }} style={styles.headerSecondaryAction} labelStyle={styles.headerSecondaryLabel} onPress={() => setShowAllOrders((value) => !value)}>{showAllOrders ? 'Show fewer' : 'View all'}</Button>}
                    </View>
                    {customer.orders.length === 0 ? (
                      <Text variant="bodyMedium" style={styles.emptyText}>
                        No recent orders found.
                      </Text>
                    ) : (
                      customer.orders.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, showAllOrders ? undefined : 2).map((item) => (
                        <Card key={item.id} nativeID={`customer-order-${item.id}`} accessibilityRole="button" accessibilityLabel={`Open order ${getFriendlyOrderNumber(item.orderNumber)}`} style={styles.orderCard} mode="contained" onPress={() => setDetailOrderId(item.id)}>
                          <Card.Content style={styles.orderCardContent}>
                            <View style={styles.orderTopRow}>
                              <View style={styles.orderInfo}>
                                <Text variant="titleSmall" style={styles.orderNumber}>
                                  #{getFriendlyOrderNumber(item.orderNumber)}
                                </Text>
                                <Text variant="bodySmall" style={styles.orderSummary}>{new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · {orderStatusLabel(item.status)} · ${item.total.toFixed(2)}</Text>
                              </View>
                            </View>
                          </Card.Content>
                        </Card>
                      ))
                    )}
                  </View>




                </View>

                <View style={styles.secondaryColumn}>
<View style={styles.section}>
                    <View style={styles.sectionHeadingRow}><Text variant="titleMedium" style={[styles.sectionTitle, styles.headingInRow]}>{editingPoints ? 'Adjust points' : 'Rewards'}</Text>
                      {customer.rewardHistory.length > 2 && <Button compact contentStyle={{ minHeight: 32 }} hitSlop={{ top: 8, bottom: 8 }} style={styles.headerSecondaryAction} labelStyle={styles.headerSecondaryLabel} onPress={() => setShowAllRewards((value) => !value)}>{showAllRewards ? 'Show fewer' : 'View history'}</Button>}
                    </View>
                    {customer.rewardHistory.length === 0 ? (
                      <Text variant="bodyMedium" style={styles.emptyText}>
                        No reward point activity yet.
                      </Text>
                    ) : (
                      customer.rewardHistory.slice(0, showAllRewards ? undefined : 2).map((item) => {
                        const tone = rewardHistoryTone(item.type);
                        const linkedOrder = customer.orders.find(order => order.id === item.orderId);
                        const rewardTitle = item.orderId ? linkedOrder ? `${tone.label} from order #${getFriendlyOrderNumber(linkedOrder.orderNumber)}` : `${tone.label} · Linked order` : item.description || `${tone.label} reward points`;
                        return (
                          <View key={item.id} style={styles.rewardCard}>
                            <View style={styles.compactSummaryRow}>
                              <View style={styles.summaryInfo} nativeID={item.orderId ? `customer-reward-order-${item.orderId}` : undefined}><TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={item.orderId ? linkedOrder ? `Open order ${getFriendlyOrderNumber(linkedOrder.orderNumber)}` : 'Open linked order' : `${tone.label} reward details`} onPress={() => { if (item.orderId) setDetailOrderId(item.orderId); else setExpandedRewards(value => ({ ...value, [item.id]: !value[item.id] })); }}>
                                <Text style={[styles.summaryTitle, item.orderId && { color: t.color.primary }]}>{rewardTitle}</Text><Text style={styles.summaryMeta}>{formatDate(item.createdAt)}</Text>
                              </TouchableOpacity></View>
                              <StatusBadge label={`${item.points > 0 ? '+' : ''}${item.points.toLocaleString()} pts`} tone={item.points >= 0 ? 'success' : 'danger'} />
                              <IconButton icon={expandedRewards[item.id] ? 'chevron-up' : 'chevron-down'} size={20} style={{ margin: 0 }} accessibilityLabel={`${expandedRewards[item.id] ? 'Hide' : 'Show'} reward details`} accessibilityState={{ expanded: !!expandedRewards[item.id] }} onPress={() => setExpandedRewards(value => ({ ...value, [item.id]: !value[item.id] }))} />
                            </View>
                            {expandedRewards[item.id] && <View style={styles.rewardCardContent}>
                              <View style={styles.rewardCardTopRow}>
                                <View style={styles.rewardCardInfo}>
                                  <View style={[styles.rewardBadge, { backgroundColor: tone.background }]}>
                                    <Text style={[styles.rewardBadgeText, { color: tone.color }]}>{tone.label}</Text>
                                  </View>
                                  <Text variant="bodySmall" style={styles.rewardDateMuted}>
                                    {formatDate(item.createdAt)}
                                  </Text>
                                </View>
                                <View style={styles.rewardCardAmountBlock}>
                                  <Text variant="titleSmall" style={[styles.rewardPointsAmount, { color: tone.color }]}>
                                    {item.points > 0 ? '+' : ''}{item.points.toLocaleString()} pts
                                  </Text>
                                  {item.dollarValue > 0 ? (
                                    <Text variant="bodySmall" style={styles.rewardDollarValue}>
                                      {formatMoney(item.dollarValue)}
                                    </Text>
                                  ) : null}
                                  {item.type === 'adjusted' ? (
                                    <Text variant="bodySmall" style={styles.rewardManualFlag}>
                                      {item.adjustmentType === 'debit' ? 'Manual debit' : 'Manual credit'}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              <View style={styles.rewardCardBottomRow}>
                                <Text variant="bodyMedium" style={styles.rewardDescription}>
                                  {item.description || 'Reward point activity'}
                                </Text>
                                <Text variant="bodySmall" style={styles.rewardBalanceText}>
                                  Balance {item.balanceAfter.toLocaleString()}
                                </Text>
                              </View>
                              {item.type === 'adjusted' && item.adjustedByName ? (
                                <Text variant="bodySmall" style={styles.rewardAuditText}>
                                  Updated by {item.adjustedByName}
                                </Text>
                              ) : null}
                            </View>}
                          </View>
                        );
                      })
                    )}
                    {allowRewardAdjustments ? (
                      editingPoints ? (
                        <View style={styles.pointsEditorCard}>
                          <FormField
                            mode="outlined"
                            label="Points change"
                            value={pointsDelta}
                            onChangeText={setPointsDelta}
                            keyboardType="numbers-and-punctuation"
                            disabled={savingPoints}
                            placeholder="Use 500 or -500"
                          />
                          <FormField
                            mode="outlined"
                            label="Reason"
                            value={pointsReason}
                            onChangeText={setPointsReason}
                            disabled={savingPoints}
                            multiline
                          />
                          {Number.isFinite(Number(pointsDelta)) && pointsDelta.trim() ? <Text accessibilityLiveRegion="polite" style={styles.infoText}>Current: {customer.rewardPoints.toLocaleString()} · Resulting: {(customer.rewardPoints + Number(pointsDelta)).toLocaleString()} points</Text> : null}
                          <View style={styles.pointsEditorActions}>
                            <Button mode="text" onPress={() => setEditingPoints(false)} disabled={savingPoints}>
                              Cancel
                            </Button>
                            <Button mode="contained" onPress={handleAdjustPoints} loading={savingPoints} disabled={savingPoints}>
                              Save points
                            </Button>
                          </View>
                        </View>
                      ) : (
                        <Button
                          mode="outlined"
                          onPress={() => setEditingPoints(true)}
                          style={[styles.actionButton, { alignSelf: 'flex-start' }]}
                        >
                          Adjust points
                        </Button>
                      )
                    ) : null}
                  </View>
<View style={styles.section}>
                    <View style={styles.sectionHeadingRow}><Text variant="titleMedium" style={[styles.sectionTitle, styles.headingInRow]}>Coupons & offers</Text>{customerCoupons.length > 2 && <Button compact contentStyle={{ minHeight: 32 }} hitSlop={{ top: 8, bottom: 8 }} style={styles.headerSecondaryAction} labelStyle={styles.headerSecondaryLabel} onPress={() => setShowAllCoupons((value) => !value)}>{showAllCoupons ? 'Show fewer' : 'View all'}</Button>}</View>
                    {loadingCoupons ? (
                      <ActivityIndicator size="small" style={{ marginVertical: 12 }} />
                    ) : customerCoupons.length === 0 ? (
                      <Text variant="bodyMedium" style={styles.emptyText}>
                        No coupons assigned to this customer.
                      </Text>
                    ) : (
                      customerCoupons.slice(0, showAllCoupons ? undefined : 2).map((item) => {
                        const isToggling = togglingCouponId === item.coupon.id;
                        const badgeColor =
                          item.status === 'active' ? '#2e7d32' :
                          item.status === 'redeemed' ? '#616161' :
                          item.status === 'expired' ? '#d32f2f' : '#ed6c02';
                        const badgeBg =
                          item.status === 'active' ? '#e8f5e9' :
                          item.status === 'redeemed' ? '#f5f5f5' :
                          item.status === 'expired' ? '#ffebee' : '#fff3e0';

                        return (
                          <View key={item.coupon.id} style={styles.rewardCard}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.coupon.code}. ${expandedCoupons[item.coupon.id] ? 'Hide' : 'Show'} coupon details and controls`} accessibilityState={{ expanded: !!expandedCoupons[item.coupon.id] }} onPress={() => setExpandedCoupons((value) => ({ ...value, [item.coupon.id]: !value[item.coupon.id] }))} style={styles.compactSummaryRow}>
                              <View style={styles.summaryInfo}><Text style={styles.summaryTitle}>{item.coupon.code}</Text><Text style={styles.summaryMeta}>{item.coupon.discount_type === 'percent' ? `${item.coupon.discount_value}% off` : `${formatMoney(item.coupon.discount_value)} off`}{item.coupon.ends_at ? ` · Ends ${new Date(item.coupon.ends_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</Text></View>
                              <StatusBadge label={item.statusLabel} tone={item.status === 'active' ? 'success' : item.status === 'expired' ? 'danger' : 'neutral'} />
                              <MaterialCommunityIcons name={expandedCoupons[item.coupon.id] ? 'chevron-up' : 'chevron-down'} size={16} color={t.color.muted} />
                            </TouchableOpacity>
                            {expandedCoupons[item.coupon.id] && <View style={styles.rewardCardContent}>
                              <View style={styles.rewardCardTopRow}>
                                <View style={styles.rewardCardInfo}>
                                  <View style={[styles.rewardBadge, { backgroundColor: badgeBg }]}>
                                    <Text style={[styles.rewardBadgeText, { color: badgeColor }]}>
                                      {item.statusLabel}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}
                                    onPress={() => handleCopyCode(item.coupon.code)}
                                  >
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold', color: '#1565c0' }}>
                                      {item.coupon.code}
                                    </Text>
                                    <MaterialCommunityIcons name="content-copy" size={14} color="#1565c0" style={{ marginLeft: 4 }} />
                                  </TouchableOpacity>
                                </View>
                                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                  {item.coupon.discount_type === 'percent'
                                    ? `${item.coupon.discount_value}% OFF`
                                    : `${item.coupon.discount_value.toFixed(2)} OFF`}
                                </Text>
                              </View>
                              <View style={styles.rewardCardBottomRow}>
                                <Text variant="bodyMedium" style={styles.rewardDescription}>
                                  {item.coupon.title}
                                </Text>
                                <Text variant="bodySmall" style={styles.rewardBalanceText}>
                                  Used {item.userRedemptionsCount} {item.coupon.max_uses_per_user != null ? `/ ${item.coupon.max_uses_per_user}` : ''} times
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                                <Text variant="bodySmall" style={{ color: '#555' }}>
                                  Active Status
                                </Text>
                                <Switch
                                  value={item.coupon.is_active}
                                  onValueChange={() => handleToggleCustomerCoupon(item)}
                                  disabled={isToggling}
                                />
                              </View>
                            </View>}
                          </View>
                        );
                      })
                    )}
                    <Button
                      mode="outlined"
                      loading={sendingMarketing}
                      disabled={sendingMarketing || !customer.profileId}
                      onPress={handleSendMarketing}
                      style={[styles.actionButton, { alignSelf: 'flex-start' }]}
                    >
                      Marketing email
                    </Button>
                  </View>

                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      </View>
      <AddCustomerModal
        visible={showEditCustomerModal}
        saving={savingName}
        title="Edit customer name"
        subtitle="Update the saved customer name for this profile."
        submitLabel="Save Name"
        requireContact={false}
        showEmailField={false}
        showPhoneField={false}
        initialValues={{
          name: customer?.name || '',
        }}
        onClose={() => {
          if (savingName) return;
          setShowEditCustomerModal(false);
        }}
        onSubmit={handleSaveName}
      />
      {visible && detailOrderId && <OrderDetailController orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  header: {
    backgroundColor: t.color.background,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    backgroundColor: t.color.primary,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  customerName: {
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 34,
    color: t.color.text,
    flexShrink: 1,
  },
  editNameButton: {
    margin: 0,
    marginLeft: 4,
  },
  headerSub: {
    marginTop: 2,
  },
  headerMeta: {
    fontSize: 14,
    color: t.color.muted,
    fontWeight: '400',
  },
  closeIcon: { width: 40, height: 40, margin: 0, borderRadius: 20, backgroundColor: '#F0F4F3' },
  contactCallButton: { width: 48, height: 48, margin: 0, borderColor: t.color.border, borderRadius: 10 },
  metricTablet: { flex: 1, minWidth: 120 },
  metricPhone: { flexBasis: '46%', flexGrow: 1, minWidth: 120 },
  contentArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: t.color.muted,
  },
  errorText: {
    marginTop: 12,
    color: t.color.danger,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  phoneActionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 0,
    backgroundColor: t.color.surface,
    borderRadius: 16,
    gap: 12,
  },
  phoneNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  phoneNumberText: {
    marginLeft: 10,
    color: t.color.text,
    flexShrink: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsContainerCompact: {
    flexWrap: 'wrap',
  },
  statBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    flex: 1,
    minWidth: 100,
    borderRadius: 16,
    backgroundColor: t.color.background,
  },
  statValue: {
    fontWeight: 'bold',
    marginTop: 4,
    color: t.color.text,
  },
  statLabel: {
    color: t.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contentGrid: {
    gap: 20,
  },
  contentGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    flex: 1,
    minWidth: 0,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    marginBottom: 20,
    padding: 20,
    borderRadius: t.radius.card,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 12,
    color: t.color.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 10,
    color: t.color.muted,
    flexShrink: 1,
  },
  bold: {
    fontWeight: 'bold',
    color: t.color.text,
  },
  actionButton: {
    marginTop: 8,
  },
  pointsEditorCard: {
    marginTop: 12,
    gap: 16,
  },
  pointsEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  emptyText: {
    color: t.color.muted,
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  headingInRow: { marginBottom: 0 },
  headerSecondaryAction: { alignSelf: 'flex-start' },
  headerSecondaryLabel: { fontSize: 13, marginHorizontal: 6 },
  orderSummary: { fontSize: 13, lineHeight: 19, color: t.color.muted, marginTop: 4 },
  compactSummaryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 78, gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  summaryInfo: { flex: 1, minWidth: 0 },
  summaryTitle: { color: t.color.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  summaryMeta: { color: t.color.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  orderCard: {
    marginBottom: 0,
    borderRadius: 0,
    backgroundColor: t.color.surface, borderBottomWidth: 1, borderBottomColor: t.color.border,
  },
  orderCardContent: {
    paddingVertical: 10,
  },
  rewardCard: {
    marginBottom: 0,
    borderRadius: 0,
    backgroundColor: t.color.surface, borderBottomWidth: 1, borderBottomColor: t.color.border,
  },
  rewardCardContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  rewardCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  rewardCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rewardBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rewardBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rewardDateMuted: {
    color: t.color.muted,
  },
  rewardCardAmountBlock: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  rewardPointsAmount: {
    fontWeight: '700',
  },
  rewardDollarValue: {
    color: t.color.muted,
  },
  rewardManualFlag: {
    color: t.color.primary,
    fontWeight: '600',
  },
  rewardCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rewardDescription: {
    color: t.color.text,
    flex: 1,
  },
  rewardBalanceText: {
    color: t.color.muted,
    flexShrink: 0,
  },
  rewardAuditText: {
    color: t.color.muted,
  },
  rewardOrderButton: {
    alignSelf: 'flex-start',
    marginLeft: -8,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  orderInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: t.color.text,
    fontWeight: '700',
  },
  orderDateStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
    gap: 8,
  },
  orderDateMuted: {
    color: t.color.muted,
    flexShrink: 0,
  },
  orderStatusLabel: {
    fontWeight: '600',
    textAlign: 'right',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  orderPriceChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  orderPrice: {
    color: t.color.text,
    fontWeight: '700',
  },
});
