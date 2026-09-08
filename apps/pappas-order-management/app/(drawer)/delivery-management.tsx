import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Appbar, SegmentedButtons, useTheme } from 'react-native-paper';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { DeliveryOrdersList } from '../../components/delivery-management/DeliveryOrdersList';
import { DeliveryOrderDetail } from '../../components/delivery-management/DeliveryOrderDetail';
import { NewDeliveryForm } from '../../components/delivery-management/NewDeliveryForm';
import type { ShipdayDeliveryRecord } from '../../../../libs/types/delivery-management';

export default function DeliveryManagementScreen() {
  const theme = useTheme();
  
  const [view, setView] = useState('list');
  const [selectedOrder, setSelectedOrder] = useState<ShipdayDeliveryRecord | null>(null);

  const handleSelectOrder = (order: ShipdayDeliveryRecord) => {
    setSelectedOrder(order);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
    setView('list');
  };

  const handleDeliveryCreated = () => {
    setView('list');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        {Platform.OS !== 'web' && <DrawerToggleButton tintColor={theme.colors.onSurface} />}
        <Appbar.Content title="Delivery Management" />
      </Appbar.Header>

      {view !== 'detail' && (
        <View style={styles.segmentContainer}>
          <SegmentedButtons
            value={view}
            onValueChange={setView}
            buttons={[
              { value: 'list', label: 'Deliveries' },
              { value: 'new', label: 'New Delivery' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>
      )}

      <View style={styles.content}>
        {view === 'list' && (
          <DeliveryOrdersList onSelectOrder={handleSelectOrder} />
        )}
        
        {view === 'detail' && selectedOrder && (
          <DeliveryOrderDetail 
            id={selectedOrder.id} 
            reference={selectedOrder.reference} 
            onBack={handleBackToList} 
          />
        )}

        {view === 'new' && (
          <NewDeliveryForm onSuccess={handleDeliveryCreated} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  segmentedButtons: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    flex: 1,
  },
});
