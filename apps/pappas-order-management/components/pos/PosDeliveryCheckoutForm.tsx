import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import { PosDiscountSection } from './PosDiscountSection';
import { PosCustomerSelector } from './PosCustomerSelector';
import type { Customer } from '../../lib/customers';
import type {
  AddressSuggestion,
  DeliveryAddressDraft,
  DeliveryFeeSummary,
  DeliveryQuoteResult,
} from '../../lib/delivery';
import {
  calculateDeliveryFees,
  fetchAddressDetails,
  fetchAddressSuggestions,
  requestDeliveryQuote,
} from '../../lib/delivery';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  onChangeCustomerPhone: (value: string) => void;
  customerName: string;
  onChangeCustomerName: (value: string) => void;
  customerLookupError: string | null;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  rewardPointsEnabled: boolean;
  rewardPointsBalance: number;
  rewardPointsDollarValue: number;
  rewardPointsApplied: boolean;
  appliedRewardPointsValue: number;
  onToggleRewardPoints: () => void;
  totals: { subtotal: number; tax: number; total: number };
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  selectDiscountPreset: (percent: number) => void;
  openDiscountDialog: () => void;
  cartItemsCount: number;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  onSubmitDeliveryOrder: (input: {
    address: DeliveryAddressDraft;
    quote: DeliveryQuoteResult;
  }) => Promise<void>;
};

export function PosDeliveryCheckoutForm({
  customerLookupStatus,
  customerPhone,
  onChangeCustomerPhone,
  customerName,
  onChangeCustomerName,
  customerLookupError,
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
  rewardPointsEnabled,
  rewardPointsBalance,
  rewardPointsDollarValue,
  rewardPointsApplied,
  appliedRewardPointsValue,
  onToggleRewardPoints,
  totals,
  discountLabel,
  discountAmount,
  activeDiscountPercent,
  selectDiscountPreset,
  openDiscountDialog,
  cartItemsCount,
  orderNoteText,
  setOrderNoteText,
  creatingOrder,
  smartpayProcessing,
  onSubmitDeliveryOrder,
}: Props) {
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddressDraft | null>(null);
  const [quote, setQuote] = useState<DeliveryQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingAddressDetails, setLoadingAddressDetails] = useState(false);
  const [loadingAddressPlaceId, setLoadingAddressPlaceId] = useState<string | null>(null);
  const [calculatingFees, setCalculatingFees] = useState(false);
  const [feeSummary, setFeeSummary] = useState<DeliveryFeeSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    setLoadingAddressPlaceId(suggestion.placeId);
    try {
      setLoadingAddressDetails(true);
      setQuoteError(null);
      const details = await fetchAddressDetails(suggestion.placeId);
      setSelectedAddress(details);
      setAddressQuery(suggestion.description);
      setSuggestions([]);
      setQuote(null);
      setFeeSummary(null);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Failed to load address details');
    } finally {
      setLoadingAddressDetails(false);
      setLoadingAddressPlaceId(null);
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
      if (result === undefined) {
        setAddressQuery('');
        setSuggestions([]);
        setSelectedAddress(null);
        setQuote(null);
        setFeeSummary(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestQuote = async () => {
    if (!selectedAddress) return;

    setQuoteError(null);
    setCalculatingFees(true);

    try {
      const nextQuote = await requestDeliveryQuote(selectedAddress);
      const nextFeeSummary = await calculateDeliveryFees({
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: nextQuote.fee,
      });
      setQuote(nextQuote);
      setFeeSummary(nextFeeSummary);
    } catch (error) {
      setQuote(null);
      setFeeSummary(null);
      setQuoteError(error instanceof Error ? error.message : 'Failed to get delivery quote');
    } finally {
      setCalculatingFees(false);
    }
  };

  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <PosCustomerSelector
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangePhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeName={onChangeCustomerName}
          customerLookupError={customerLookupError}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={onSelectCustomer}
          onClearCustomer={onClearCustomer}
          rewardPointsEnabled={rewardPointsEnabled}
          rewardPointsBalance={rewardPointsBalance}
          rewardPointsDollarValue={rewardPointsDollarValue}
          rewardPointsApplied={rewardPointsApplied}
          appliedRewardPointsValue={appliedRewardPointsValue}
          onToggleRewardPoints={onToggleRewardPoints}
        />

        <PosDiscountSection
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          onSelectPreset={selectDiscountPreset}
          onOpenMore={openDiscountDialog}
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
              setFeeSummary(null);
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
                  disabled={loadingAddressDetails}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverySuggestionTitle}>{suggestion.mainText}</Text>
                    {!!suggestion.secondaryText && (
                      <Text style={styles.deliverySuggestionMeta}>{suggestion.secondaryText}</Text>
                    )}
                  </View>
                  {loadingAddressPlaceId === suggestion.placeId ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : null}
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
              setSelectedAddress((current) => {
                if (!current) return current;
                return { ...current, delivery_instructions: value };
              });
            }}
            multiline
            style={[styles.checkoutInput, styles.checkoutNoteInput, styles.checkoutNoteInputLarge]}
            disabled={!selectedAddress}
          />

          <Button
            mode="outlined"
            icon="truck-delivery-outline"
            loading={calculatingFees}
            disabled={!selectedAddress || creatingOrder || submitting || smartpayProcessing || calculatingFees}
            onPress={() => void handleRequestQuote()}
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
              {discountAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount</Text>
                  <Text style={[styles.totalValue, styles.discountTotalValue]}>-${discountAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${totals.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Delivery fee</Text>
                <Text style={styles.totalValue}>${quote.fee.toFixed(2)}</Text>
              </View>
              {feeSummary && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Service fee</Text>
                  <Text style={styles.totalValue}>${feeSummary.serviceFee.toFixed(2)}</Text>
                </View>
              )}
              {feeSummary && (
                <View style={styles.totalRow}>
                  <Text style={styles.grandTotalLabel}>Customer total</Text>
                  <Text style={styles.grandTotalValue}>${feeSummary.totalAmount.toFixed(2)}</Text>
                </View>
              )}
              <Text style={styles.deliveryQuoteMeta}>
                {quote.provider_name} • ETA {quote.estimated_duration_minutes ?? '-'} min
              </Text>
              {!!quote.distance_km && (
                <Text style={styles.deliveryQuoteMeta}>Distance {quote.distance_km.toFixed(1)} km</Text>
              )}
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
            || !feeSummary
          }
          onPress={() => void handleRequestDelivery()}
          style={styles.placeOrderButton}
          buttonColor="#2563eb"
        >
          Request Online Delivery
        </Button>
      </View>
    </ScrollView>
  );
}
