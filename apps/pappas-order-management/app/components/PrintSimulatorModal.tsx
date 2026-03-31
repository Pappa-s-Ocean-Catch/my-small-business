import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { IconButton, Button as PaperButton } from 'react-native-paper';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';

interface PrintSimulatorModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

export const PrintSimulatorModal: React.FC<PrintSimulatorModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.simulatorOverlay}>
        <View style={styles.simulatorCard}>
          <IconButton icon="printer-check" size={64} iconColor="#10b981" />
          <Text style={styles.simulatorTitle}>Print Simulation</Text>
          <Text style={styles.simulatorMessage}>
            Successfully simulated printing for order:
          </Text>
          <Text style={styles.simulatorOrderNumber}>
            #{order ? getFriendlyOrderNumber(order.order_number) : ''}
          </Text>
          <PaperButton
            mode="contained"
            onPress={onClose}
            style={styles.simulatorButton}
          >
            Dismiss
          </PaperButton>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  simulatorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  simulatorCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  simulatorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
    marginBottom: 8,
  },
  simulatorMessage: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  simulatorOrderNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#2563eb',
    marginBottom: 32,
    letterSpacing: 1,
  },
  simulatorButton: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
});
