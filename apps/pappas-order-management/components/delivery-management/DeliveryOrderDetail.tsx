import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, Surface, useTheme, Button, Divider } from 'react-native-paper';
import { getDeliveryOrderDetail } from '../../lib/delivery-management';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  id: string;
  reference: string;
  onBack: () => void;
};

export function DeliveryOrderDetail({ id, reference, onBack }: Props) {
  const theme = useTheme();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['delivery-detail', id, reference],
    queryFn: () => getDeliveryOrderDetail(id, reference),
  });

  if (isLoading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centerContent}>
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>Failed to load delivery details</Text>
        <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 16 }}>Retry</Button>
        <Button mode="text" onPress={onBack} style={{ marginTop: 8 }}>Go Back</Button>
      </View>
    );
  }

  const { order, onDemand, onDemandError } = data;

  return (
    <View style={styles.container}>
      <Surface style={styles.headerBar} elevation={1}>
        <Button icon="arrow-left" mode="text" onPress={onBack} style={styles.backButton}>Back</Button>
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Delivery {order.reference}</Text>
      </Surface>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Status</Text>
          <Text variant="bodyLarge">{order.status}</Text>
          {onDemandError && (
            <Text variant="bodyMedium" style={{ color: theme.colors.error, marginTop: 4 }}>
              Error: {onDemandError}
            </Text>
          )}
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Customer Info</Text>
          <Text variant="bodyMedium">Name: {order.customerName}</Text>
          <Text variant="bodyMedium">Phone: {order.customerPhone}</Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Addresses</Text>
          <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>Pickup:</Text>
          <Text variant="bodyMedium" style={{ marginBottom: 8 }}>{order.pickupAddress}</Text>
          <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>Dropoff:</Text>
          <Text variant="bodyMedium">{order.deliveryAddress}</Text>
        </Surface>

        {order.driverName && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Driver Info</Text>
            <Text variant="bodyMedium">Name: {order.driverName}</Text>
            <Text variant="bodyMedium">Phone: {order.driverPhone}</Text>
            {order.trackingUrl && (
              <Button 
                mode="outlined" 
                icon="map-marker" 
                onPress={() => Linking.openURL(order.trackingUrl!)}
                style={{ marginTop: 12 }}
              >
                Track Driver
              </Button>
            )}
          </Surface>
        )}

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Fees & Details</Text>
          <Text variant="bodyMedium">Delivery Fee: ${order.deliveryFee?.toFixed(2) ?? 'N/A'}</Text>
          <Text variant="bodyMedium">Created At: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</Text>
        </Surface>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  backButton: {
    marginRight: 16,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
