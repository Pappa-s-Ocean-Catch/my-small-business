import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { useWindowDimensions } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { FormField, Panel, SectionHeader } from '@/components/ui';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Surface, useTheme, ActivityIndicator, RadioButton, Divider, HelperText } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeliveryQuotes, requestDelivery, getDeliveryRequestStatus, lookupOrder } from '../../lib/delivery-management';
import { canSubmitDelivery, addressKey, needsDeliveryRecovery, deliveryRequestMessage, selectedQuote } from '../../lib/delivery-management-state';
import type { DeliveryJobAddress, DeliveryRecipient, DeliveryRequest, DeliveryQuoteOption } from '../../../../libs/types/delivery-management';

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function NewDeliveryForm({ onSuccess, onCancel }: Props) {
  const compact = useWindowDimensions().width < 600;
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [address, setAddress] = useState<DeliveryJobAddress>({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postcode: '',
  });

  const [recipient, setRecipient] = useState<DeliveryRecipient>({
    name: '',
    phone: '',
    email: '',
  });

  const [orderReference, setOrderReference] = useState('');
  const [orderId, setOrderId] = useState<string | undefined>(undefined);

  const [currentRequest, setCurrentRequest] = useState<DeliveryRequest | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [addressKeyHash, setAddressKeyHash] = useState('');

  // Invalidate quotes if address changes
  useEffect(() => {
    const newHash = addressKey(address);
    if (newHash !== addressKeyHash) {
      setCurrentRequest(null);
      setSelectedQuoteId(null);
      setAddressKeyHash(newHash);
    }
  }, [address]);

  // Lookup existing POS order
  const lookupMutation = useMutation({
    mutationFn: lookupOrder,
    onSuccess: (data) => {
      setOrderId(data.id);
      setRecipient(data.recipient);
      if (data.address) {
        setAddress(data.address);
      }
      Alert.alert('Linked', `Found order for ${data.recipient.name}`);
    },
    onError: (err: any) => {
      Alert.alert('Lookup Failed', err.message);
    }
  });

  // Get Quotes
  const quotesMutation = useMutation({
    mutationFn: getDeliveryQuotes,
    onSuccess: (data) => {
      setCurrentRequest(data.request);
      if (data.request.quotes.length > 0) {
        setSelectedQuoteId(data.request.quotes[0].id);
      }
    },
    onError: (err: any) => {
      Alert.alert('Quote Error', err.message);
    }
  });

  // Request Delivery
  const requestMutation = useMutation({
    mutationFn: requestDelivery,
    onSuccess: (data) => {
      setCurrentRequest(data);
      if (data.state === 'requested') {
        Alert.alert('Success', 'Delivery booked successfully!');
        queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
        onSuccess?.();
      }
    },
    onError: (err: any) => {
      Alert.alert('Booking Error', err.message);
    }
  });

  // Refresh status
  const refreshMutation = useMutation({
    mutationFn: getDeliveryRequestStatus,
    onSuccess: (data) => {
      setCurrentRequest(data);
      if (data.state === 'requested') {
        Alert.alert('Success', 'Delivery booked successfully!');
        queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
        onSuccess?.();
      }
    }
  });

  const handleLookup = () => {
    if (!orderReference.trim()) return;
    lookupMutation.mutate(orderReference.trim());
  };

  const handleGetQuotes = () => {
    if (!address.address_line1 || !address.city || !address.postcode) {
      Alert.alert('Missing Address', 'Please provide at least line 1, city, and postcode.');
      return;
    }
    quotesMutation.mutate(address);
  };

  const handleSubmit = () => {
    if (!currentRequest || !selectedQuoteId) return;
    if (!recipient.name || !recipient.phone) {
      Alert.alert('Missing Recipient', 'Please provide a name and phone number.');
      return;
    }

    const quote = selectedQuote(currentRequest, selectedQuoteId);
    if (!quote) return;

    requestMutation.mutate({
      quoteRequestId: currentRequest.id,
      provider: quote.provider,
      acceptedFee: quote.fee,
      currency: quote.currency,
      recipient,
      orderId,
    });
  };

  const handleRefreshState = () => {
    if (currentRequest) {
      refreshMutation.mutate(currentRequest.id);
    }
  };

  const isFormDisabled = quotesMutation.isPending || requestMutation.isPending || refreshMutation.isPending;
  const canSubmit = canSubmitDelivery(currentRequest, selectedQuoteId, isFormDisabled);
  const needsRecovery = currentRequest ? needsDeliveryRecovery(currentRequest.state) : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { padding: compact ? 12 : 16 }]} keyboardShouldPersistTaps="handled">
      <Panel style={[styles.section, { maxWidth: 940, padding: compact ? 18 : 20, gap: 20 }]}>
        <Panel style={{ backgroundColor: t.color.primaryTint, padding: 16 }}><Text>Get a quote before requesting a courier.</Text></Panel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          <View style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260, gap: 12 }}><FormField label="POS order reference (optional)" value={orderReference} onChangeText={setOrderReference} disabled={isFormDisabled} />{orderReference.trim() && !orderId ? <Button mode="outlined" onPress={handleLookup} loading={lookupMutation.isPending} disabled={isFormDisabled}>Look up order</Button> : null}</View>
          <FormField style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260 }} label="Address line 1" value={address.address_line1} onChangeText={(value) => setAddress({ ...address, address_line1: value })} disabled={isFormDisabled} />
          <FormField style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260 }} label="Address line 2 (optional)" value={address.address_line2} onChangeText={(value) => setAddress({ ...address, address_line2: value })} disabled={isFormDisabled} />
          <FormField style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260 }} label="City" value={address.city} onChangeText={(value) => setAddress({ ...address, city: value })} disabled={isFormDisabled} />
          <FormField style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260 }} label="State" value={address.state} onChangeText={(value) => setAddress({ ...address, state: value })} disabled={isFormDisabled} />
          <FormField style={{ flex: 1, flexBasis: compact ? '100%' : '45%', minWidth: compact ? '100%' : 260 }} label="Postcode" value={address.postcode} onChangeText={(value) => setAddress({ ...address, postcode: value })} disabled={isFormDisabled} keyboardType="number-pad" />
        </View>
      </Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>{onCancel && <Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={onCancel} disabled={isFormDisabled}>Cancel</Button>}<Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={handleGetQuotes} disabled={isFormDisabled} loading={quotesMutation.isPending}>Get delivery quote</Button></View>

      {currentRequest && (
        <Panel style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Select Provider</Text>
          {currentRequest.quotes.length === 0 ? (
            <Text variant="bodyMedium">No quotes available for this address.</Text>
          ) : (
            <RadioButton.Group onValueChange={setSelectedQuoteId as (val: string) => void} value={selectedQuoteId || ''}>
              {currentRequest.quotes.map((q) => (
                <View key={q.id} style={styles.quoteRow}>
                  <RadioButton value={q.id || ''} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{q.provider}</Text>
                    <Text variant="bodySmall" style={{ color: t.color.muted }}>
                      {q.pickupMinutes ? `Pickup in ~${q.pickupMinutes}m` : 'Time unknown'}
                    </Text>
                  </View>
                  <Text variant="titleMedium">${q.fee.toFixed(2)}</Text>
                </View>
              ))}
            </RadioButton.Group>
          )}
        </Panel>
      )}

      {currentRequest && currentRequest.quotes.length > 0 && (
        <Panel style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Recipient & Request</Text>
          <FormField style={styles.input} mode="outlined" label="Name" value={recipient.name} onChangeText={(t) => setRecipient({ ...recipient, name: t })} disabled={isFormDisabled} />
          <FormField style={styles.input} mode="outlined" label="Phone" keyboardType="phone-pad" value={recipient.phone} onChangeText={(t) => setRecipient({ ...recipient, phone: t })} disabled={isFormDisabled} />

          {needsRecovery && (
            <View style={styles.recoveryBox}>
              <Text variant="bodyMedium" style={{ color: theme.colors.error, marginBottom: 8 }}>
                {deliveryRequestMessage(currentRequest.state) || 'Request is in progress or uncertain state.'}
              </Text>
              <Button mode="outlined" onPress={handleRefreshState} loading={refreshMutation.isPending}>
                Check Status
              </Button>
            </View>
          )}

          {!needsRecovery && currentRequest.state === 'needs_confirmation' && (
            <HelperText type="error" visible>
              {deliveryRequestMessage(currentRequest.state)}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={requestMutation.isPending}
            style={styles.submitBtn}
            buttonColor={theme.colors.primary}
          >
            Request Delivery
          </Button>
        </Panel>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  content: {
    padding: 16,
    gap: 20,
    width: '100%',
  },
  section: {
    padding: 16,
    borderRadius: t.radius.card,
    backgroundColor: t.color.surface,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: t.color.surface,
  },
  row: {
    flexDirection: 'row',
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
  },
  submitBtn: {
    marginTop: 16,
    paddingVertical: 6,
  },
  recoveryBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff0f0',
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: '#ffcccc',
  }
});
