import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, IconButton, Modal, Portal, Surface, Text, TextInput } from 'react-native-paper';
import type { Order } from '@my-small-business/types';

import { getOrder, updateOrderStatus, updatePendingDeliveryOrder } from '@/lib/orders';
import {
  calculateDeliveryFees,
  createStripeCheckoutSession,
  fetchAddressDetails,
  fetchAddressSuggestions,
  openExternalUrl,
  requestDeliveryQuote,
  sendPaymentLinkSms,
  type AddressSuggestion,
  type DeliveryAddressDraft,
} from '@/lib/delivery';
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
  const upsertSession = usePendingOnlinePaymentsStore((state) => state.upsertSession);
  const [now, setNow] = useState(Date.now());
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [editAddressVisible, setEditAddressVisible] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingAddressDetails, setLoadingAddressDetails] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddressDraft | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [requoteLoading, setRequoteLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [updatedQuoteFee, setUpdatedQuoteFee] = useState<number | null>(null);
  const [updatedEtaMinutes, setUpdatedEtaMinutes] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    if (!editAddressVisible || addressQuery.trim().length < 3 || selectedAddress) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingSuggestions(true);
    const timer = setTimeout(() => {
      fetchAddressSuggestions(addressQuery)
        .then((data) => {
          if (!cancelled) setSuggestions(data);
        })
        .catch((error) => {
          if (!cancelled) setQuoteError(error instanceof Error ? error.message : 'Failed to search addresses');
        })
        .finally(() => {
          if (!cancelled) setLoadingSuggestions(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressQuery, editAddressVisible, selectedAddress]);

  const formatDeliveryAddress = (address: DeliveryAddressDraft) => (
    [
      address.address_line1,
      address.address_line2,
      [address.city, address.state, address.postcode].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ')
  );

  const getActiveOrderAddressDraft = (): DeliveryAddressDraft | null => {
    if (!activeOrder?.delivery_address_line1) return null;
    return {
      address_line1: activeOrder.delivery_address_line1,
      address_line2: activeOrder.delivery_address_line2 || undefined,
      city: activeOrder.delivery_city || '',
      state: activeOrder.delivery_state || '',
      postcode: activeOrder.delivery_postcode || '',
      country: activeOrder.delivery_country || 'AU',
      latitude: activeOrder.delivery_latitude ?? undefined,
      longitude: activeOrder.delivery_longitude ?? undefined,
      delivery_instructions: activeOrder.delivery_instructions || undefined,
    };
  };

  const resetAddressEditor = () => {
    setAddressQuery('');
    setSuggestions([]);
    setLoadingSuggestions(false);
    setLoadingAddressDetails(false);
    setSelectedAddress(null);
    setQuoteError(null);
    setRequoteLoading(false);
    setSavingAddress(false);
    setUpdatedQuoteFee(null);
    setUpdatedEtaMinutes(null);
  };

  const openAddressEditor = () => {
    const currentAddress = getActiveOrderAddressDraft();
    resetAddressEditor();
    if (currentAddress) {
      setSelectedAddress(currentAddress);
      setAddressQuery(formatDeliveryAddress(currentAddress));
      setUpdatedQuoteFee(activeOrder?.delivery_fee ?? null);
      setUpdatedEtaMinutes(activeOrder?.delivery_eta_minutes ?? null);
    }
    setEditAddressVisible(true);
  };

  const closeAddressEditor = () => {
    setEditAddressVisible(false);
    resetAddressEditor();
  };

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    try {
      setLoadingAddressDetails(true);
      setQuoteError(null);
      setUpdatedQuoteFee(null);
      setUpdatedEtaMinutes(null);
      const details = await fetchAddressDetails(suggestion.placeId);
      setSelectedAddress(details);
      setAddressQuery(suggestion.description);
      setSuggestions([]);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Failed to load address details');
    } finally {
      setLoadingAddressDetails(false);
    }
  };

  const handleRequoteAddress = async () => {
    if (!selectedAddress) return;

    setQuoteError(null);
    setRequoteLoading(true);
    try {
      const nextQuote = await requestDeliveryQuote(selectedAddress);
      setUpdatedQuoteFee(nextQuote.fee);
      setUpdatedEtaMinutes(nextQuote.estimated_duration_minutes);
    } catch (error) {
      setUpdatedQuoteFee(null);
      setUpdatedEtaMinutes(null);
      setQuoteError(error instanceof Error ? error.message : 'Failed to get updated quote');
    } finally {
      setRequoteLoading(false);
    }
  };

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

  const handleSaveUpdatedAddress = async () => {
    if (!activeSession || !activeOrder || !selectedAddress) return;

    setQuoteError(null);
    setSavingAddress(true);

    try {
      const nextQuote = await requestDeliveryQuote(selectedAddress);
      const discountedSubtotal = Math.max(0, activeOrder.subtotal - (activeOrder.promotion_discount || 0));
      const nextFeeSummary = await calculateDeliveryFees({
        subtotal: discountedSubtotal,
        tax: activeOrder.tax,
        deliveryFee: nextQuote.fee,
      });

      const checkoutSession = await createStripeCheckoutSession({
        orderId: activeOrder.id,
        customerEmail: activeOrder.customer_email || undefined,
        customerName: activeOrder.customer_name || undefined,
        customerPhone: activeOrder.customer_phone || undefined,
        items: activeSession.itemSummaries.map((item) => ({
          name: item.productName,
          description: [
            item.comment ? `Note: ${item.comment}` : null,
            item.removedIngredients.length ? `Remove: ${item.removedIngredients.join(', ')}` : null,
            item.addons.length ? `Add-ons: ${item.addons.map((addon) => addon.name).join(', ')}` : null,
          ].filter(Boolean).join(' • ') || undefined,
          quantity: item.quantity,
          price: Number((item.subtotal / Math.max(item.quantity, 1)).toFixed(2)),
        })),
        subtotal: discountedSubtotal,
        promotionDiscount: activeOrder.promotion_discount || 0,
        tax: activeOrder.tax,
        deliveryFee: nextQuote.fee,
        orderType: 'delivery',
      });

      const finalTotalAmount = Number((nextFeeSummary.orderBaseAmount + nextQuote.fee + checkoutSession.serviceFee).toFixed(2));

      const updateResult = await updatePendingDeliveryOrder(activeOrder.id, {
        address: selectedAddress,
        quote: nextQuote,
        deliveryFee: nextQuote.fee,
        serviceFee: checkoutSession.serviceFee,
        totalAmount: finalTotalAmount,
      });

      if (updateResult.error || !updateResult.data) {
        throw new Error(updateResult.error || 'Failed to update delivery order');
      }

      upsertSession({
        orderId: activeOrder.id,
        orderNumber: activeSession.orderNumber,
        customerName: activeSession.customerName,
        customerPhone: activeSession.customerPhone,
        paymentUrl: checkoutSession.shortUrl || checkoutSession.url,
        deliveryAddress: formatDeliveryAddress(selectedAddress),
        deliveryEtaMinutes: nextQuote.estimated_duration_minutes,
        totalAmount: finalTotalAmount,
        deliveryFee: nextQuote.fee,
        serviceFee: checkoutSession.serviceFee,
        isTestPayment: Boolean(checkoutSession.isTestPhoneCheckout),
        itemSummaries: activeSession.itemSummaries,
      });
      setActiveOrder(updateResult.data);
      closeAddressEditor();
      Alert.alert('Address updated', 'Delivery address, quote, and payment link have been updated. Resend the SMS to the customer.');
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Failed to update delivery address');
    } finally {
      setSavingAddress(false);
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
                          {!!activeSession.deliveryAddress && (
                            <>
                              <Text style={[styles.cardTitle, styles.inlineSectionTitle]}>Delivery Address</Text>
                              <Text style={styles.bodyText}>{activeSession.deliveryAddress}</Text>
                              <Button mode="text" compact icon="pencil" onPress={openAddressEditor} style={styles.inlineActionButton}>
                                Update address
                              </Button>
                            </>
                          )}
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

      <Portal>
        <Modal visible={editAddressVisible} onDismiss={closeAddressEditor} contentContainerStyle={styles.addressModal}>
          <ScrollView contentContainerStyle={styles.addressModalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.addressModalTitle}>Update Delivery Address</Text>
            <TextInput
              label="Search address"
              mode="outlined"
              value={addressQuery}
              onChangeText={(value) => {
                setAddressQuery(value);
                setSelectedAddress(null);
                setSuggestions([]);
                setQuoteError(null);
                setUpdatedQuoteFee(null);
                setUpdatedEtaMinutes(null);
              }}
            />

            {loadingSuggestions && <Text style={styles.pendingText}>Searching addresses...</Text>}

            {suggestions.length > 0 && (
              <View style={styles.suggestionList}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity key={suggestion.placeId} style={styles.suggestionCard} onPress={() => void chooseSuggestion(suggestion)}>
                    <Text style={styles.suggestionTitle}>{suggestion.mainText}</Text>
                    {!!suggestion.secondaryText && <Text style={styles.suggestionMeta}>{suggestion.secondaryText}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {loadingAddressDetails && <Text style={styles.pendingText}>Loading address details...</Text>}

            {selectedAddress && (
              <>
                <View style={styles.selectedAddressCard}>
                  <Text style={styles.bodyText}>{selectedAddress.address_line1}</Text>
                  {!!selectedAddress.address_line2 && <Text style={styles.bodyText}>{selectedAddress.address_line2}</Text>}
                  <Text style={styles.bodyText}>
                    {[selectedAddress.city, selectedAddress.state, selectedAddress.postcode].filter(Boolean).join(' ')}
                  </Text>
                </View>

                <TextInput
                  label="Delivery instructions"
                  mode="outlined"
                  value={selectedAddress.delivery_instructions || ''}
                  onChangeText={(value) => {
                    setSelectedAddress((current) => (current ? { ...current, delivery_instructions: value } : current));
                  }}
                  multiline
                />

                <Button mode="outlined" icon="truck-delivery-outline" onPress={() => void handleRequoteAddress()} loading={requoteLoading}>
                  Recalculate quote
                </Button>
              </>
            )}

            {updatedQuoteFee != null && (
              <Card style={styles.infoCard}>
                <Card.Content>
                  <Text style={styles.cardTitle}>Updated Delivery Quote</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Current delivery fee</Text>
                    <Text style={styles.summaryValue}>${(activeOrder?.delivery_fee || 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Updated delivery fee</Text>
                    <Text style={styles.summaryValue}>${updatedQuoteFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Updated ETA</Text>
                    <Text style={styles.summaryValue}>{updatedEtaMinutes ?? '-'} min</Text>
                  </View>
                </Card.Content>
              </Card>
            )}

            {!!quoteError && <Text style={styles.errorText}>{quoteError}</Text>}

            <View style={styles.addressModalActions}>
              <Button mode="text" onPress={closeAddressEditor}>Cancel</Button>
              <Button
                mode="contained"
                onPress={() => void handleSaveUpdatedAddress()}
                loading={savingAddress}
                disabled={!selectedAddress || savingAddress}
              >
                Save address update
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
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
  inlineSectionTitle: { marginTop: 14 },
  inlineActionButton: { alignSelf: 'flex-start', marginTop: 6, marginLeft: -8 },
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
  addressModal: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '88%',
  },
  addressModalContent: {
    padding: 20,
    gap: 12,
  },
  addressModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10243f',
  },
  suggestionList: {
    gap: 8,
  },
  suggestionCard: {
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10243f',
  },
  suggestionMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  selectedAddressCard: {
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f8fafc',
    gap: 2,
  },
  addressModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
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
