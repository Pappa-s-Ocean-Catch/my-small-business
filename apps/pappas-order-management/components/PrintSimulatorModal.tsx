import React from 'react';
import { View, Text, StyleSheet, Modal, Image, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { IconButton, Button as PaperButton, Surface } from 'react-native-paper';
import * as Sharing from 'expo-sharing';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';

interface PrintSimulatorModalProps {
  visible: boolean;
  order: Order | null;
  imageUri: string | null;
  onClose: () => void;
}

export const PrintSimulatorModal: React.FC<PrintSimulatorModalProps> = ({
  visible,
  order,
  imageUri,
  onClose,
}) => {
  const handleShare = async () => {
    if (!imageUri) return;
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: `Receipt for Order #${order ? getFriendlyOrderNumber(order.order_number) : ''}`,
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt image');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.simulatorOverlay}>
        <Surface style={styles.simulatorCard} elevation={5}>
          <View style={styles.header}>
            <View style={styles.headerIconContainer}>
               <IconButton icon="printer-check" size={32} iconColor="#10b981" style={styles.headerIcon} />
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.simulatorTitle}>Print Simulation</Text>
              <Text style={styles.simulatorSubtitle}>
                Order #{order ? getFriendlyOrderNumber(order.order_number) : ''}
              </Text>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          <ScrollView 
            style={styles.contentScroll} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: imageUri }} 
                  style={styles.receiptImage} 
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.noImageContainer}>
                <IconButton icon="image-off" size={48} iconColor="#94a3b8" />
                <Text style={styles.noImageText}>No image preview available for this print type.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {imageUri && (
              <PaperButton
                mode="outlined"
                icon="download"
                onPress={handleShare}
                style={styles.downloadButton}
                labelStyle={styles.buttonLabel}
              >
                Download / Share
              </PaperButton>
            )}
            <PaperButton
              mode="contained"
              onPress={onClose}
              style={styles.dismissButton}
              labelStyle={[styles.buttonLabel, { color: '#fff' }]}
            >
              Dismiss
            </PaperButton>
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  simulatorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  simulatorCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerIcon: {
    margin: 0,
  },
  headerTitleContainer: {
    flex: 1,
  },
  simulatorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  simulatorSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  contentScroll: {
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    // Add visual border to see margins
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  receiptImage: {
    width: '100%',
    aspectRatio: 0.7, // Receipts are usually tall
    minHeight: 400,
  },
  noImageContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  noImageText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  downloadButton: {
    borderRadius: 12,
    borderColor: '#e2e8f0',
  },
  dismissButton: {
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
});

