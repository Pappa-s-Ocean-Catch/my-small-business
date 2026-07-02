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
  imageUris?: string[] | null;
  imageLabels?: string[] | null;
  useModal?: boolean;
  onClose: () => void;
}

export const PrintSimulatorModal: React.FC<PrintSimulatorModalProps> = ({
  visible,
  order,
  imageUri,
  imageUris,
  imageLabels,
  useModal = true,
  onClose,
}) => {
  const images = imageUris && imageUris.length > 0
    ? imageUris
    : imageUri
      ? [imageUri]
      : [];

  const handleShare = async () => {
    if (!images[0]) return;
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(images[0], {
        mimeType: 'image/png',
        dialogTitle: `Receipt for Order #${order ? getFriendlyOrderNumber(order.order_number) : ''}`,
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt image');
    }
  };

  if (!visible) return null;

  const content = (
    <>
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
            {images.length > 0 ? (
              <View style={styles.imagePreviewList}>
                {images.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.imagePreviewBlock}>
                    {images.length > 1 && (
                      <Text style={styles.copyLabel}>
                        {imageLabels?.[index] || `Receipt ${index + 1}/${images.length}`}
                      </Text>
                    )}
                    {images.length === 1 && imageLabels?.[0] ? (
                      <Text style={styles.copyLabel}>{imageLabels[0]}</Text>
                    ) : null}
                    <View style={styles.imagePreviewContainer}>
                      <Image 
                        source={{ uri }} 
                        style={styles.receiptImage} 
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noImageContainer}>
                <IconButton icon="image-off" size={48} iconColor="#94a3b8" />
                <Text style={styles.noImageText}>No image preview available for this print type.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {images.length > 0 && (
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
    </>
  );

  if (!useModal) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  simulatorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  simulatorCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
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
  imagePreviewList: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  imagePreviewBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  copyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
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
