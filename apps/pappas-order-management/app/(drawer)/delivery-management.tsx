import { WorkspaceHeader } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import { PageHeader } from '@/components/ui';
import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Appbar, useTheme } from 'react-native-paper';
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
      <WorkspaceHeader title={view === 'new' ? 'New delivery' : view === 'detail' ? 'Delivery details' : 'Deliveries'} onBack={view !== 'list' ? handleBackToList : undefined} />


      <View style={styles.content}>
        {view === 'list' && (
          <DeliveryOrdersList onSelectOrder={handleSelectOrder} onNewDelivery={() => setView('new')} />
        )}

        {view === 'detail' && selectedOrder && (
          <DeliveryOrderDetail
            id={selectedOrder.id}
            reference={selectedOrder.reference}
            onBack={handleBackToList}
          />
        )}

        {view === 'new' && (
          <NewDeliveryForm onSuccess={handleDeliveryCreated} onCancel={handleBackToList} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.color.surface,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
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
