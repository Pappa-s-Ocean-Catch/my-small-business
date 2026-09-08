import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Surface, useTheme, ActivityIndicator, RadioButton, Divider, HelperText } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeliveryQuotes, requestDelivery, getDeliveryRequestStatus, lookupOrder } from '../../lib/delivery-management';
import { canSubmitDelivery, addressKey, needsDeliveryRecovery, deliveryRequestMessage, selectedQuote } from '../../lib/delivery-management-state';
import type { DeliveryJobAddress, DeliveryRecipient, DeliveryRequest, DeliveryQuoteOption } from '../../../../libs/types/delivery-management';

type Props = {
  onSuccess?: () => void;
};

export function NewDeliveryForm({ onSuccess }: Props) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Link POS Order (Optional)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            mode="outlined"
            label="Order Reference / ID"
            value={orderReference}
            onChangeText={setOrderReference}
            disabled={isFormDisabled}
          />
          <Button mode="outlined" onPress={handleLookup} disabled={isFormDisabled || !orderReference} style={{ justifyContent: 'center' }}>
            Lookup
          </Button>
        </View>
      </Surface>

      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Dropoff Address</Text>
        <TextInput style={styles.input} mode="outlined" label="Address Line 1" value={address.address_line1} onChangeText={(t) => setAddress({ ...address, address_line1: t })} disabled={isFormDisabled} />
        <TextInput style={styles.input} mode="outlined" label="Address Line 2 (Optional)" value={address.address_line2} onChangeText={(t) => setAddress({ ...address, address_line2: t })} disabled={isFormDisabled} />
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" label="City" value={address.city} onChangeText={(t) => setAddress({ ...address, city: t })} disabled={isFormDisabled} />
          <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" label="State" value={address.state} onChangeText={(t) => setAddress({ ...address, state: t })} disabled={isFormDisabled} />
          <TextInput style={[styles.input, { flex: 1 }]} mode="outlined" label="Postcode" value={address.postcode} onChangeText={(t) => setAddress({ ...address, postcode: t })} disabled={isFormDisabled} />
        </View>
        <Button mode="contained" onPress={handleGetQuotes} disabled={isFormDisabled} loading={quotesMutation.isPending} style={{ marginTop: 12 }}>
          Get Quotes
        </Button>
      </Surface>

      {currentRequest && (
        <Surface style={styles.section} elevation={1}>
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
                    <Text variant="bodySmall" style={{ color: '#666' }}>
                      {q.pickupMinutes ? `Pickup in ~${q.pickupMinutes}m` : 'Time unknown'}
                    </Text>
                  </View>
                  <Text variant="titleMedium">${q.fee.toFixed(2)}</Text>
                </View>
              ))}
            </RadioButton.Group>
          )}
        </Surface>
      )}

      {currentRequest && currentRequest.quotes.length > 0 && (
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Recipient & Request</Text>
          <TextInput style={styles.input} mode="outlined" label="Name" value={recipient.name} onChangeText={(t) => setRecipient({ ...recipient, name: t })} disabled={isFormDisabled} />
          <TextInput style={styles.input} mode="outlined" label="Phone" keyboardType="phone-pad" value={recipient.phone} onChangeText={(t) => setRecipient({ ...recipient, phone: t })} disabled={isFormDisabled} />

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
        </Surface>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  content: {
    padding: 12,
    gap: 12,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  submitBtn: {
    marginTop: 16,
    paddingVertical: 6,
  },
  recoveryBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcccc',
  }
});
