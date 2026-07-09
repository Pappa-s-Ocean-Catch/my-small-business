import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { styles } from '../../app/pos.styles';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import type {
  AddressSuggestion,
  DeliveryAddressDraft,
  DeliveryQuoteResult,
} from '../../lib/delivery';
import {
  fetchAddressDetails,
  fetchAddressSuggestions,
  openSmsComposer,
  requestDeliveryQuote,
} from '../../lib/delivery';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerLookupError: string | null;
  totals: { subtotal: number; tax: number; total: number };
  cartItemsCount: number;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  onSubmitDeliveryOrder: (input: {
    address: DeliveryAddressDraft;
    quote: DeliveryQuoteResult;
  }) => Promise<{ orderId: string; paymentUrl: string; serviceFee: number; deliveryFee: number; totalAmount: number } | null>;
  checkDeliveryPaymentStatus: (orderId: string) => Promise<'pending' | 'paid' | 'failed'>;
};

export function PosDeliveryCheckoutForm({
  customerLookupStatus,
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  customerLookupError,
  totals,
  cartItemsCount,
  orderNoteText,
  setOrderNoteText,
  creatingOrder,
  smartpayProcessing,
  onSubmitDeliveryOrder,
  checkDeliveryPaymentStatus,
}: Props) {
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddressDraft | null>(null);
  const [quote, setQuote] = useState<DeliveryQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingAddressDetails, setLoadingAddressDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<{
    orderId: string;
    paymentUrl: string;
    serviceFee: number;
    deliveryFee: number;
    totalAmount: number;
  } | null>(null);
  const [paymentPolling, setPaymentPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (addressQuery.trim().length < 3 || selectedAddress) {
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
  }, [addressQuery, selectedAddress]);

  useEffect(() => {
    if (!paymentRequest?.orderId) return;

    let cancelled = false;
    setPaymentPolling(true);

    const interval = setInterval(() => {
      checkDeliveryPaymentStatus(paymentRequest.orderId)
        .then((status) => {
          if (cancelled) return;
          if (status === 'paid') {
            setPaymentPolling(false);
            setPaymentRequest(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPaymentPolling(false);
          }
        });
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkDeliveryPaymentStatus, paymentRequest]);

  const displayTotal = useMemo(() => (
    paymentRequest?.totalAmount ?? totals.total
  ), [paymentRequest?.totalAmount, totals.total]);

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    try {
      setLoadingAddressDetails(true);
      setQuoteError(null);
      const details = await fetchAddressDetails(suggestion.placeId);
      setSelectedAddress(details);
      setAddressQuery(suggestion.description);
      setSuggestions([]);
      setQuote(null);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Failed to load address details');
    } finally {
      setLoadingAddressDetails(false);
    }
  };

  const handleRequestDelivery = async () => {
    if (!selectedAddress || !quote) return;

    setSubmitting(true);
    try {
      const result = await onSubmitDeliveryOrder({
        address: selectedAddress,
        quote,
      });
      if (result) {
        setPaymentRequest(result);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const messageBody = paymentRequest
    ? `Hi ${customerName || 'there'}, your Pappas delivery payment link is ${paymentRequest.paymentUrl}`
    : '';

  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <View style={styles.checkoutSummaryCard}>
          <Text style={styles.checkoutSummaryEyebrow}>Delivery order</Text>
          <Text style={styles.checkoutSummaryTotal}>${displayTotal.toFixed(2)}</Text>
          <Text style={styles.checkoutSummaryMeta}>{cartItemsCount} items • Online payment required</Text>
          <Text style={styles.checkoutSummaryMeta}>
            {paymentRequest ? 'Awaiting customer payment' : 'Get quote, then send payment link'}
          </Text>
        </View>

        <TextInput
          label="Phone"
          mode="outlined"
          value={customerPhone}
          onChangeText={(value) => {
            setCustomerPhone(value);
            if (customerLookupStatus === 'found') setCustomerName('');
          }}
          keyboardType="phone-pad"
          style={styles.checkoutInput}
        />
        <View style={styles.lookupRow}>
          {customerLookupStatus === 'loading' && <Text style={styles.lookupText}>Looking up customer...</Text>}
          {customerLookupStatus === 'found' && <Text style={styles.foundText}>Existing customer found</Text>}
          {customerLookupStatus === 'new' && <Text style={styles.newText}>No customer found. A new customer will be created.</Text>}
          {customerLookupStatus === 'error' && <Text style={styles.errorText}>{customerLookupError}</Text>}
        </View>
        <TextInput
          label="Name"
          mode="outlined"
          value={customerName}
          onChangeText={setCustomerName}
          style={styles.checkoutInput}
        />

        <View style={styles.deliveryPanel}>
          <Text style={styles.checkoutSectionTitle}>Delivery address</Text>
          <TextInput
            label="Search address"
            mode="outlined"
            value={addressQuery}
            onChangeText={(value) => {
              setAddressQuery(value);
              setSelectedAddress(null);
              setQuote(null);
              setPaymentRequest(null);
              setQuoteError(null);
            }}
            style={styles.checkoutInput}
          />
          {loadingSuggestions && <Text style={styles.lookupText}>Searching addresses...</Text>}

          {suggestions.length > 0 && (
            <View style={styles.deliverySuggestionList}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.placeId}
                  style={styles.deliverySuggestionCard}
                  onPress={() => void chooseSuggestion(suggestion)}
                >
                  <Text style={styles.deliverySuggestionTitle}>{suggestion.mainText}</Text>
                  {!!suggestion.secondaryText && (
                    <Text style={styles.deliverySuggestionMeta}>{suggestion.secondaryText}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loadingAddressDetails && <Text style={styles.lookupText}>Loading address details...</Text>}

          {selectedAddress && (
            <View style={styles.deliveryAddressCard}>
              <Text style={styles.deliveryAddressLine}>{selectedAddress.address_line1}</Text>
              {!!selectedAddress.address_line2 && (
                <Text style={styles.deliveryAddressMeta}>{selectedAddress.address_line2}</Text>
              )}
              <Text style={styles.deliveryAddressMeta}>
                {[selectedAddress.city, selectedAddress.state, selectedAddress.postcode].filter(Boolean).join(' ')}
              </Text>
            </View>
          )}

          <TextInput
            label="Delivery instructions"
            mode="outlined"
            value={selectedAddress?.delivery_instructions || ''}
            onChangeText={(value) => {
              setSelectedAddress((current) => (current ? { ...current, delivery_instructions: value } : current));
            }}
            multiline
            style={[styles.checkoutInput, styles.checkoutNoteInput, styles.checkoutNoteInputLarge]}
            disabled={!selectedAddress}
          />

          <Button
            mode="outlined"
            icon="truck-delivery-outline"
            disabled={!selectedAddress || creatingOrder || submitting || smartpayProcessing}
            onPress={() => {
              if (!selectedAddress) return;
              setQuoteError(null);
              void (async () => {
                try {
                  const nextQuote = await requestDeliveryQuote(selectedAddress);
                  setQuote(nextQuote);
                } catch (error) {
                  setQuoteError(error instanceof Error ? error.message : 'Failed to get delivery quote');
                }
              })();
            }}
          >
            Get delivery quote
          </Button>

          {!!quoteError && <Text style={styles.errorText}>{quoteError}</Text>}

          {quote && (
            <View style={styles.deliveryQuoteCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Order subtotal</Text>
                <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${totals.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Delivery fee</Text>
                <Text style={styles.totalValue}>${quote.fee.toFixed(2)}</Text>
              </View>
              {paymentRequest && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Service fee</Text>
                  <Text style={styles.totalValue}>${paymentRequest.serviceFee.toFixed(2)}</Text>
                </View>
              )}
              <Text style={styles.deliveryQuoteMeta}>
                {quote.provider_name} • ETA {quote.estimated_duration_minutes ?? '-'} min
              </Text>
            </View>
          )}
        </View>

        <TextInput
          label="Order note"
          mode="outlined"
          value={orderNoteText}
          onChangeText={setOrderNoteText}
          multiline
          style={[styles.checkoutInput, styles.checkoutNoteInput, styles.checkoutNoteInputLarge]}
        />

        <Button
          mode="contained"
          icon="credit-card-outline"
          loading={submitting || creatingOrder}
          disabled={
            creatingOrder
            || smartpayProcessing
            || submitting
            || cartItemsCount === 0
            || !customerPhone.trim()
            || !customerName.trim()
            || !selectedAddress
            || !quote
          }
          onPress={() => void handleRequestDelivery()}
          style={styles.placeOrderButton}
          buttonColor="#2563eb"
        >
          Request Online Delivery
        </Button>

        {paymentRequest && (
          <View style={styles.secondaryActionsPanel}>
            <Text style={styles.secondaryActionsTitle}>Payment link</Text>
            <Text style={styles.deliveryQuoteMeta}>Order created. Send the customer their Stripe payment link.</Text>
            <View style={styles.secondaryActionsRow}>
              <Button
                mode="contained"
                icon="message-text-outline"
                onPress={() => void openSmsComposer(customerPhone, messageBody)}
                style={styles.secondaryActionButton}
              >
                Send SMS
              </Button>
            </View>
            {paymentPolling && (
              <Text style={styles.lookupText}>Polling payment status every 5 seconds...</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
