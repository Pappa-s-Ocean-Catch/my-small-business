import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Surface, Text } from 'react-native-paper';
import type { Order } from '@my-small-business/types';

import { getOrder, updateOrderStatus } from '@/lib/orders';
import { openExternalUrl, sendPaymentLinkSms } from '@/lib/delivery';
import { usePendingOnlinePaymentsStore } from '@/stores/pendingOnlinePaymentsStore';
import { getFriendlyOrderNumber } from '@/utils/orderNumber';

function formatElapsed(createdAt: number, now: number) {
  const diffMs = Math.max(0, now - createdAt);
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m ago`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s ago`;
  }

  return `${seconds}s ago`;
}

export function PendingOnlinePaymentsOverlay() {
  const sessions = usePendingOnlinePaymentsStore((state) => state.sessions);
  const setMinimized = usePendingOnlinePaymentsStore((state) => state.setMinimized);
  const updateStatus = usePendingOnlinePaymentsStore((state) => state.updateStatus);
  const setSmsState = usePendingOnlinePaymentsStore((state) => state.setSmsState);
  const removeSession = usePendingOnlinePaymentsStore((state) => state.removeSession);
  const [now, setNow] = useState(Date.now());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pendingSessions = sessions.filter((session) => session.status === 'pending');
    if (pendingSessions.length === 0) return;

    const interval = setInterval(() => {
      pendingSessions.forEach((session) => {
        void getOrder(session.orderId).then((result) => {
          if (result.error || !result.data) {
            updateStatus(session.orderId, 'failed');
            return;
          }

          if (result.data.payment_status === 'paid') {
            removeSession(session.orderId);
          }
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [sessions, updateStatus, removeSession]);

  const activeSession = sessions.find((session) => !session.minimized && session.status === 'pending') || null;
  const minimizedSessions = sessions.filter((session) => session.minimized && session.status === 'pending');
  const activeElapsedText = useMemo(
    () => (activeSession ? formatElapsed(activeSession.createdAt, now) : null),
    [activeSession, now]
  );

  useEffect(() => {
    if (!activeSession?.orderId) {
      setActiveOrder(null);
      return;
    }

    let cancelled = false;
    const loadActiveOrder = async () => {
      const result = await getOrder(activeSession.orderId);
      if (!cancelled) {
        setActiveOrder(result.data || null);
      }
    };

    void loadActiveOrder();
    const interval = setInterval(() => {
      void loadActiveOrder();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeSession?.orderId]);

  const handleCancelOrder = (orderId: string) => {
    const session = sessions.find((item) => item.orderId === orderId);
    if (!session) return;

    Alert.alert(
      'Cancel pending payment order?',
      `Order ${session.orderNumber} will be cancelled and removed from the pending payment queue.`,
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await updateOrderStatus(orderId, 'cancelled');
              if (result.error) {
                setSmsState(orderId, 'error', result.error);
                return;
              }
              removeSession(orderId);
            })();
          },
        },
      ]
    );
  };

  const getSmsStatusText = (orderId: string) => {
    const session = sessions.find((item) => item.orderId === orderId);
    if (!session) return null;
    if (session.smsStatus === 'sending') return 'Sending SMS...';
    if (session.smsStatus === 'sent') return session.smsMessage || 'Payment link SMS sent.';
    if (session.smsStatus === 'error') return session.smsMessage || 'Failed to send payment link SMS.';
    return 'SMS not sent yet.';
  };

  const handleSendSms = async (orderId: string) => {
    const session = sessions.find((item) => item.orderId === orderId);
    if (!session) return;

    setSmsState(orderId, 'sending', null);
    try {
      await sendPaymentLinkSms({
        phone: session.customerPhone,
        customerName: session.customerName,
        paymentUrl: session.paymentUrl,
        orderId: session.orderId,
        deliveryAddress: session.deliveryAddress ?? undefined,
        totalAmount: session.totalAmount,
        deliveryFee: session.deliveryFee,
        deliveryEtaMinutes: session.deliveryEtaMinutes ?? undefined,
      });
      setSmsState(orderId, 'sent', 'Payment link SMS sent.');
    } catch (error) {
      setSmsState(orderId, 'error', error instanceof Error ? error.message : 'Failed to send payment link SMS');
    }
  };

  return (
    <>
      {activeSession && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.fullscreenShell}>
            <View style={styles.fullscreenPanel}>
              <Surface style={styles.header} elevation={1}>
                <View style={styles.headerTop}>
                  <View style={styles.headerTitleBlock}>
                    <Text style={styles.headerTitle}>Order {activeSession.orderNumber}</Text>
                    <Text style={styles.headerMeta}>Pending online payment</Text>
                  </View>
                  <IconButton icon="close" size={24} iconColor="#f8fafc" onPress={() => setMinimized(activeSession.orderId, true)} />
                </View>
                <View style={styles.headerSub}>
                  <View style={[styles.badge, styles.badgeWarning]}>
                    <Text style={styles.badgeText}>Awaiting Payment</Text>
                  </View>
                  {activeSession.isTestPayment && (
                    <View style={[styles.badge, styles.badgeTest]}>
                      <Text style={styles.badgeText}>Test Payment Mode</Text>
                    </View>
                  )}
                  <View style={[styles.badge, activeSession.smsStatus === 'sent' ? styles.badgeSuccess : activeSession.smsStatus === 'error' ? styles.badgeError : styles.badgeNeutral]}>
                    <Text style={styles.badgeText}>
                      {activeSession.smsStatus === 'sent' ? 'SMS Sent' : activeSession.smsStatus === 'error' ? 'SMS Failed' : activeSession.smsStatus === 'sending' ? 'Sending SMS' : 'SMS Pending'}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>
                    Created {activeElapsedText} • {new Date(activeSession.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              </Surface>

              <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
                <View style={styles.twoColumnLayout}>
                  <View style={styles.leftColumn}>
                    <View style={styles.summaryGrid}>
                      <Card style={styles.infoCard}>
                        <Card.Content>
                          <Text style={styles.cardTitle}>Customer</Text>
                          <Text style={styles.customerName}>{activeSession.customerName}</Text>
                          <Text style={styles.contactText}>{activeSession.customerPhone}</Text>
                        </Card.Content>
                      </Card>

                      <Card style={styles.infoCard}>
                        <Card.Content>
                          <Text style={styles.cardTitle}>Payment</Text>
                          <Text style={styles.amount}>${activeSession.totalAmount.toFixed(2)}</Text>
                          <Text style={styles.meta}>Delivery fee ${activeSession.deliveryFee.toFixed(2)} • Service fee ${activeSession.serviceFee.toFixed(2)}</Text>
                          {activeSession.isTestPayment && (
                            <Text style={styles.testPaymentText}>
                              Test phone matched. Stripe checkout has been reduced to the test payment amount.
                            </Text>
                          )}
                        </Card.Content>
                      </Card>
                    </View>

                    <Card style={styles.infoCard}>
                      <Card.Content>
                        <Text style={styles.cardTitle}>Next step</Text>
                        <Text style={styles.bodyText}>
                          Send the payment link to the customer, then keep this order open until payment is confirmed.
                        </Text>
                      </Card.Content>
                    </Card>

                    <Card style={styles.infoCard}>
                      <Card.Content>
                        <Text style={styles.cardTitle}>Payment Link</Text>
                        <Text style={styles.linkText}>{activeSession.paymentUrl}</Text>
                      </Card.Content>
                    </Card>

                    <Card style={styles.infoCard}>
                      <Card.Content>
                        <Text style={styles.cardTitle}>SMS Status</Text>
                        <Text style={activeSession.smsStatus === 'error' ? styles.errorText : activeSession.smsStatus === 'sent' ? styles.successText : styles.pendingText}>
                          {getSmsStatusText(activeSession.orderId)}
                        </Text>
                      </Card.Content>
                    </Card>
                  </View>

                  <View style={styles.rightColumn}>
                    <Card style={styles.infoCard}>
                      <Card.Content>
                        <Text style={styles.cardTitle}>Order Items</Text>
                        {(activeOrder?.items?.length || activeSession.itemSummaries.length > 0) ? (
                          <View style={styles.itemList}>
                            {(activeOrder?.items || activeSession.itemSummaries.map((item) => ({
                              id: item.id,
                              quantity: item.quantity,
                              product_name: item.productName,
                              subtotal: item.subtotal,
                              comment: item.comment,
                              removed_ingredients: item.removedIngredients,
                              addons: item.addons.map((addon) => ({
                                id: addon.id,
                                addon_item_name: addon.name,
                                addon_item_price: addon.price,
                              })),
                            }))).map((item) => (
                              <View key={item.id} style={styles.itemRow}>
                                <View style={styles.itemHeader}>
                                  <Text style={styles.itemName}>
                                    {item.quantity}x {item.product_name}
                                  </Text>
                                  <Text style={styles.itemPrice}>${item.subtotal.toFixed(2)}</Text>
                                </View>
                                {item.comment ? (
                                  <Text style={styles.itemComment}>Note: {item.comment}</Text>
                                ) : null}
                                {(item.removed_ingredients || []).length > 0 ? (
                                  <Text style={styles.itemMeta}>
                                    Remove: {item.removed_ingredients.join(', ')}
                                  </Text>
                                ) : null}
                                {item.addons?.length ? (
                                  <View style={styles.addonsList}>
                                    {item.addons.map((addon) => (
                                      <Text key={addon.id} style={styles.addonText}>
                                        + {addon.addon_item_name} (${Number(addon.addon_item_price || 0).toFixed(2)})
                                      </Text>
                                    ))}
                                  </View>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.bodyText}>Loading order items...</Text>
                        )}
                      </Card.Content>
                    </Card>

                    {activeOrder && (
                      <Card style={styles.infoCard}>
                        <Card.Content>
                          <Text style={styles.cardTitle}>Order Summary</Text>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order</Text>
                            <Text style={styles.summaryValue}>{getFriendlyOrderNumber(activeOrder.order_number)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>${activeOrder.subtotal.toFixed(2)}</Text>
                          </View>
                          {activeOrder.tax > 0 && (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Tax</Text>
                              <Text style={styles.summaryValue}>${activeOrder.tax.toFixed(2)}</Text>
                            </View>
                          )}
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Delivery</Text>
                            <Text style={styles.summaryValue}>${activeOrder.delivery_fee.toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Service fee</Text>
                            <Text style={styles.summaryValue}>${activeOrder.service_fee.toFixed(2)}</Text>
                          </View>
                          <View style={[styles.summaryRow, styles.summaryRowFinal]}>
                            <Text style={styles.summaryFinalLabel}>Total</Text>
                            <Text style={styles.summaryFinalValue}>${activeOrder.total.toFixed(2)}</Text>
                          </View>
                        </Card.Content>
                      </Card>
                    )}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.actionBar}>
                <Button mode="contained" icon="message-text-outline" onPress={() => void handleSendSms(activeSession.orderId)} loading={activeSession.smsStatus === 'sending'}>
                  {activeSession.smsStatus === 'sent' ? 'Resend SMS' : 'Send SMS'}
                </Button>
                <Button mode="outlined" icon="open-in-new" onPress={() => void openExternalUrl(activeSession.paymentUrl)}>
                  Open Link
                </Button>
                <Button mode="text" icon="close-circle-outline" textColor="#dc2626" onPress={() => handleCancelOrder(activeSession.orderId)}>
                  Cancel Order
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}

      {minimizedSessions.length > 0 && (
        <View style={styles.minimizedStack} pointerEvents="box-none">
          {minimizedSessions.map((session) => (
            <Card key={session.orderId} style={styles.minimizedCard}>
              <Card.Content style={styles.minimizedContent}>
                <View style={styles.minimizedText}>
                  <Text style={styles.minimizedTitle}>Awaiting Payment</Text>
                  <Text style={styles.minimizedMeta}>{session.orderNumber} • ${session.totalAmount.toFixed(2)}</Text>
                  {session.isTestPayment && <Text style={styles.minimizedTest}>Test payment mode</Text>}
                  <Text style={styles.minimizedMeta}>{formatElapsed(session.createdAt, now)}</Text>
                  <Text style={session.smsStatus === 'error' ? styles.minimizedError : styles.minimizedSms}>
                    {getSmsStatusText(session.orderId)}
                  </Text>
                </View>
                <View style={styles.minimizedActions}>
                  <Button compact mode="text" onPress={() => setMinimized(session.orderId, false)}>
                    Open
                  </Button>
                  <Button compact mode="text" onPress={() => void handleSendSms(session.orderId)}>
                    SMS
                  </Button>
                  <Button compact mode="text" textColor="#dc2626" onPress={() => handleCancelOrder(session.orderId)}>
                    Cancel
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.78)',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    padding: 0,
    zIndex: 9998,
  },
  fullscreenShell: {
    flex: 1,
    width: '100%',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  fullscreenPanel: {
    flex: 1,
    backgroundColor: '#eef2f6',
  },
  header: {
    paddingTop: 14,
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
  headerTitleBlock: { flex: 1, paddingRight: 12 },
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
  headerSub: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeWarning: { backgroundColor: '#d97706' },
  badgeSuccess: { backgroundColor: '#15803d' },
  badgeError: { backgroundColor: '#dc2626' },
  badgeNeutral: { backgroundColor: '#475569' },
  badgeTest: { backgroundColor: '#7c3aed' },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#c8d5e6',
    marginLeft: 'auto',
    fontWeight: '700',
  },
  scrollContent: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 132, gap: 14 },
  twoColumnLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  leftColumn: {
    flex: 1,
    gap: 14,
  },
  rightColumn: {
    flex: 1,
    gap: 14,
  },
  summaryGrid: { gap: 14 },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dde4ee',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#24364d', marginBottom: 8 },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  contactText: { fontSize: 14, color: '#4b5563', marginBottom: 2 },
  itemList: { gap: 10 },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  itemPrice: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  itemComment: {
    color: '#b45309',
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemMeta: {
    color: '#475569',
    fontSize: 13,
    marginTop: 4,
  },
  addonsList: {
    marginTop: 4,
    paddingLeft: 8,
    gap: 2,
  },
  addonText: {
    color: '#64748b',
    fontSize: 12,
  },
  amount: {
    color: '#1d4ed8',
    fontSize: 42,
    fontWeight: '900',
  },
  meta: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  testPaymentText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  summaryValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryRowFinal: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryFinalLabel: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  summaryFinalValue: {
    color: '#0f766e',
    fontSize: 22,
    fontWeight: '900',
  },
  bodyText: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  linkText: {
    color: '#2563eb',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: '#fbfdff',
    borderTopWidth: 1,
    borderTopColor: '#d7dee7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  pendingText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '700',
  },
  successText: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  minimizedStack: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    gap: 8,
    zIndex: 9997,
  },
  minimizedCard: {
    width: 280,
    borderRadius: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
  },
  minimizedText: {
    flex: 1,
  },
  minimizedTitle: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '900',
  },
  minimizedMeta: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  minimizedSms: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  minimizedTest: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  minimizedError: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  minimizedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
