import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrderStatus } from '@my-small-business/types';
import { fetchCustomerSummary, type CustomerSummary, updateCustomerNameByContact } from '@/utils/customerSummary';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';
import { getApiUrl } from '../utils/orderUtils';
import { adjustCustomerRewardPoints } from '@/lib/reward-points';

function orderStatusColor(status: string): string {
  if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, status)) {
    return STATUS_COLORS[status as OrderStatus];
  }
  return '#64748b';
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
      return { label: 'Earned', color: '#15803d', background: '#dcfce7' };
    case 'used':
      return { label: 'Used', color: '#b45309', background: '#fef3c7' };
    case 'expired':
      return { label: 'Expired', color: '#b91c1c', background: '#fee2e2' };
    default:
      return { label: 'Manual Adjust', color: '#1d4ed8', background: '#dbeafe' };
  }
}

export function CustomerModal({
  email,
  phone,
  visible,
  onClose,
  onOrderPress,
  allowRewardAdjustments = false,
  onCustomerUpdated,
}: {
  email?: string;
  phone?: string;
  visible: boolean;
  onClose: () => void;
  onOrderPress: (orderId: string) => void;
  allowRewardAdjustments?: boolean;
  onCustomerUpdated?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 920;
  const isMedium = width >= 640;
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingMarketing, setSendingMarketing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingPoints, setEditingPoints] = useState(false);
  const [pointsDelta, setPointsDelta] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [savingPoints, setSavingPoints] = useState(false);

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    setCustomer(null);
    setEditingName(false);
    setEditingPoints(false);
    setDraftName('');
    setPointsDelta('');
    setPointsReason('');

    try {
      const data = await fetchCustomerSummary({ email, phone });
      setCustomer(data);
      setDraftName(data?.name ?? '');
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
  }, [email, phone, visible]);

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
    setDraftName(customer?.name ?? '');
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setDraftName(customer?.name ?? '');
    setEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter the customer name before saving.');
      return;
    }

    setSavingName(true);
    try {
      const result = await updateCustomerNameByContact({ profileId: customer?.profileId, name: trimmedName });
      setCustomer((current) => (current ? { ...current, name: trimmedName } : current));
      setDraftName(trimmedName);
      setEditingName(false);
      Alert.alert('Saved', result.updatedCount > 0 ? 'Customer name updated successfully.' : 'Name saved for this customer.');
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
            const url = getApiUrl('/api/marketing/send');
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerIds: [customer.profileId] }),
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

  const topPadding = isWide ? 16 : Math.max(insets.top, 10);
  const bottomPadding = Math.max(insets.bottom, 16);
  const modalShellStyle = isWide
    ? {
        width: Math.min(width - 48, 1120),
        height: Math.min(height - 32, 920),
        borderRadius: 28,
      }
    : {
        width,
        height,
        borderRadius: 0,
      };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, isWide && styles.modalBackdropWide]}>
        <Surface style={[styles.modalContent, modalShellStyle]} elevation={5}>
          <View style={[styles.header, { paddingTop: topPadding }]}>
            <View style={styles.headerInfo}>
              <Avatar.Text
                size={isMedium ? 60 : 52}
                label={customer ? getInitials(customer.name) : '??'}
                style={styles.avatar}
              />
              <View style={styles.headerTextContainer}>
                {editingName ? (
                  <View style={styles.nameEditorBlock}>
                    <TextInput
                      mode="outlined"
                      label="Customer name"
                      value={draftName}
                      onChangeText={setDraftName}
                      autoFocus
                      dense={!isMedium}
                      disabled={savingName}
                    />
                    <View style={styles.nameEditorActions}>
                      <Button mode="text" onPress={handleCancelEditName} disabled={savingName}>
                        Cancel
                      </Button>
                      <Button mode="contained" onPress={handleSaveName} loading={savingName} disabled={savingName}>
                        Save
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text variant={isMedium ? 'headlineSmall' : 'titleLarge'} style={styles.customerName}>
                      {loading ? 'Loading...' : customer?.name || 'Customer Summary'}
                    </Text>
                    {!!customer && (
                      <IconButton
                        icon="pencil-outline"
                        size={20}
                        onPress={handleStartEditName}
                        style={styles.editNameButton}
                      />
                    )}
                  </View>
                )}

                <View style={styles.contactRow}>
                  {customer?.email ? (
                    <Text style={styles.customerContact} onPress={() => handleEmail(customer.email)}>
                      {customer.email}
                    </Text>
                  ) : (
                    <Text style={styles.customerContactFallback}>{email || phone || 'Details'}</Text>
                  )}
                </View>
              </View>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} style={styles.closeIcon} />
          </View>

          <Divider />

          {loading && (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Fetching profile...</Text>
            </View>
          )}

          {error && (
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && customer && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 24 }]}
              showsVerticalScrollIndicator
            >
              {customer.phone ? (
                <View style={styles.phoneActionBox}>
                  <View style={styles.phoneNumberContainer}>
                    <MaterialCommunityIcons name="phone" size={24} color={theme.colors.primary} />
                    <Text variant="titleLarge" style={styles.phoneNumberText}>
                      {customer.phone}
                    </Text>
                  </View>
                  <IconButton
                    icon="phone-outline"
                    mode="contained"
                    containerColor={theme.colors.primary}
                    iconColor="#fff"
                    size={28}
                    onPress={() => handleCall(customer.phone)}
                  />
                </View>
              ) : null}

              <View style={[styles.statsContainer, !isMedium && styles.statsContainerCompact]}>
                <View style={styles.statBox}>
                  <MaterialCommunityIcons name="cart-outline" size={20} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={styles.statValue}>
                    {customer.totalOrders}
                  </Text>
                  <Text variant="labelSmall" style={styles.statLabel}>
                    Orders
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <MaterialCommunityIcons name="currency-usd" size={20} color="#16a34a" />
                  <Text variant="titleMedium" style={styles.statValue}>
                    ${customer.totalAmount.toFixed(2)}
                  </Text>
                  <Text variant="labelSmall" style={styles.statLabel}>
                    Spent
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <MaterialCommunityIcons name="star-outline" size={20} color="#ca8a04" />
                  <Text variant="titleMedium" style={styles.statValue}>
                    {customer.rewardPoints}
                  </Text>
                  <Text variant="labelSmall" style={styles.statLabel}>
                    Points
                  </Text>
                </View>
              </View>

              <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
                <View style={styles.primaryColumn}>
                  <View style={styles.section}>
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
                  </View>

                  <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Recent Orders
                    </Text>
                    {customer.orders.length === 0 ? (
                      <Text variant="bodyMedium" style={styles.emptyText}>
                        No recent orders found.
                      </Text>
                    ) : (
                      customer.orders.map((item) => (
                        <Card key={item.id} style={styles.orderCard} mode="contained" onPress={() => onOrderPress(item.id)}>
                          <Card.Content style={styles.orderCardContent}>
                            <View style={styles.orderTopRow}>
                              <View style={styles.orderInfo}>
                                <Text variant="titleSmall" style={styles.orderNumber}>
                                  {getFriendlyOrderNumber(item.orderNumber)}
                                </Text>
                                <View style={styles.orderDateStatusRow}>
                                  <Text variant="bodySmall" style={styles.orderDateMuted}>
                                    {formatDate(item.date)}
                                  </Text>
                                  <Text
                                    variant="bodySmall"
                                    style={[styles.orderStatusLabel, { color: orderStatusColor(item.status) }]}
                                  >
                                    {orderStatusLabel(item.status)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.orderPriceChevron}>
                                <Text variant="titleSmall" style={styles.orderPrice}>
                                  ${item.total.toFixed(2)}
                                </Text>
                                <MaterialCommunityIcons name="chevron-right" size={18} color="#94a3b8" />
                              </View>
                            </View>
                          </Card.Content>
                        </Card>
                      ))
                    )}
                  </View>

                  <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Reward History
                    </Text>
                    {customer.rewardHistory.length === 0 ? (
                      <Text variant="bodyMedium" style={styles.emptyText}>
                        No reward point activity yet.
                      </Text>
                    ) : (
                      customer.rewardHistory.map((item) => {
                        const tone = rewardHistoryTone(item.type);
                        return (
                          <Card key={item.id} style={styles.rewardCard} mode="contained">
                            <Card.Content style={styles.rewardCardContent}>
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
                              {item.orderId ? (
                                <Button mode="text" compact onPress={() => onOrderPress(item.orderId)} style={styles.rewardOrderButton}>
                                  View order
                                </Button>
                              ) : null}
                            </Card.Content>
                          </Card>
                        );
                      })
                    )}
                  </View>
                </View>

                <View style={styles.secondaryColumn}>
                  <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Actions
                    </Text>
                    <Button
                      mode="contained-tonal"
                      icon="pencil-outline"
                      onPress={handleStartEditName}
                      disabled={editingName}
                      style={styles.actionButton}
                    >
                      Edit Customer Name
                    </Button>
                    <Button
                      mode="contained-tonal"
                      icon="email-fast"
                      loading={sendingMarketing}
                      disabled={sendingMarketing || !customer.profileId}
                      onPress={handleSendMarketing}
                      style={styles.actionButton}
                    >
                      Send Marketing Email
                    </Button>
                    {allowRewardAdjustments ? (
                      editingPoints ? (
                        <View style={styles.pointsEditorCard}>
                          <TextInput
                            mode="outlined"
                            label="Points change"
                            value={pointsDelta}
                            onChangeText={setPointsDelta}
                            keyboardType="numbers-and-punctuation"
                            disabled={savingPoints}
                            placeholder="Use 500 or -500"
                          />
                          <TextInput
                            mode="outlined"
                            label="Reason"
                            value={pointsReason}
                            onChangeText={setPointsReason}
                            disabled={savingPoints}
                            multiline
                          />
                          <View style={styles.pointsEditorActions}>
                            <Button mode="text" onPress={() => setEditingPoints(false)} disabled={savingPoints}>
                              Cancel
                            </Button>
                            <Button mode="contained" onPress={handleAdjustPoints} loading={savingPoints} disabled={savingPoints}>
                              Save Points
                            </Button>
                          </View>
                        </View>
                      ) : (
                        <Button
                          mode="contained-tonal"
                          icon="star-cog-outline"
                          onPress={() => setEditingPoints(true)}
                          style={styles.actionButton}
                        >
                          Adjust Reward Points
                        </Button>
                      )
                    ) : null}
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalBackdropWide: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f8fafc',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    backgroundColor: '#e2e8f0',
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
    fontWeight: 'bold',
    color: '#1e293b',
    flexShrink: 1,
  },
  editNameButton: {
    margin: 0,
    marginLeft: 4,
  },
  nameEditorBlock: {
    gap: 10,
  },
  nameEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  contactRow: {
    marginTop: 2,
  },
  customerContact: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  customerContactFallback: {
    color: '#64748b',
  },
  closeIcon: {
    margin: 0,
    marginLeft: 12,
  },
  centerContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  errorText: {
    marginTop: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  phoneActionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 12,
  },
  phoneNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  phoneNumberText: {
    marginLeft: 12,
    fontWeight: 'bold',
    color: '#1e3a8a',
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
    backgroundColor: '#f8fafc',
  },
  statValue: {
    fontWeight: 'bold',
    marginTop: 4,
    color: '#1e293b',
  },
  statLabel: {
    color: '#64748b',
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
    flex: 1.6,
    minWidth: 0,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1e293b',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 10,
    color: '#64748b',
    flexShrink: 1,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1e293b',
  },
  actionButton: {
    marginTop: 8,
  },
  pointsEditorCard: {
    marginTop: 12,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  pointsEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  emptyText: {
    color: '#64748b',
  },
  orderCard: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  orderCardContent: {
    paddingVertical: 10,
  },
  rewardCard: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  rewardCardContent: {
    paddingVertical: 12,
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
    fontSize: 12,
    fontWeight: '700',
  },
  rewardDateMuted: {
    color: '#64748b',
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
    color: '#64748b',
  },
  rewardManualFlag: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  rewardCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rewardDescription: {
    color: '#0f172a',
    flex: 1,
  },
  rewardBalanceText: {
    color: '#475569',
    flexShrink: 0,
  },
  rewardAuditText: {
    color: '#64748b',
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
    color: '#1e293b',
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
    color: '#64748b',
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
    color: '#1e293b',
    fontWeight: '700',
  },
});
