import { AppModal as Modal } from '@/components/ui/AppModal';
import { appDialog as Alert } from '@/lib/app-dialog';
import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import { useModalFocus } from '@/hooks/useModalFocus';
import { designTokens as t } from '@/lib/redesign';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, useWindowDimensions } from 'react-native';
import { IconButton } from 'react-native-paper';
import * as Sharing from 'expo-sharing';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { retainReceiptCapture, releaseReceiptCapture } from '@/lib/receipt-capture-lifecycle';

interface PrintSimulatorModalProps {
  visible: boolean;
  order: Order | null;
  imageUri: string | null;
  imageUris?: string[] | null;
  imageLabels?: string[] | null;
  title?: string;
  subtitle?: string;
  useModal?: boolean;
  onClose: () => void;
}

export const PrintSimulatorModal: React.FC<PrintSimulatorModalProps> = ({
  visible,
  order,
  imageUri,
  imageUris,
  imageLabels,
  title,
  subtitle,
  useModal = true,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const panelRef = useRef<View>(null);
  useModalFocus(panelRef, visible, onClose);
  const simulatorTitle = title || 'Print Simulation';
  const simulatorSubtitle = subtitle || `Order #${order ? getFriendlyOrderNumber(order.order_number) : ''}`;
  const images = useMemo(() => imageUris && imageUris.length > 0
    ? imageUris
    : imageUri
      ? [imageUri]
      : [], [imageUris, imageUri]);
  const [sharing, setSharing] = useState(false);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const previewOwners = useRef(new Set<string>());
  const ownershipKey = JSON.stringify([...new Set(images)]);
  useEffect(() => {
    const next = new Set<string>(visible ? JSON.parse(ownershipKey) : []);
    for (const uri of next) if (!previewOwners.current.has(uri)) retainReceiptCapture(uri);
    for (const uri of previewOwners.current) if (!next.has(uri)) releaseReceiptCapture(uri);
    previewOwners.current = next;
  }, [visible, ownershipKey]);
  useEffect(() => () => {
    previewOwners.current.forEach(releaseReceiptCapture);
    previewOwners.current.clear();
  }, []);

  const handleShare = async () => {
    if (!images[0] || sharing) return;
    
    setSharing(true);
    const sharedUri = images[0];
    retainReceiptCapture(sharedUri);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      
      await Sharing.shareAsync(images[0], {
        mimeType: 'image/png',
        dialogTitle: order ? `Receipt for Order #${getFriendlyOrderNumber(order.order_number)}` : simulatorTitle,
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt image');
    } finally {
      releaseReceiptCapture(sharedUri);
      setSharing(false);
    }
  };

  if (!visible) return null;

  const content = (
    <>
      <View style={[styles.simulatorOverlay, compact && { padding: 0 }]} >
        <View ref={panelRef} accessibilityViewIsModal style={[styles.simulatorCard, compact && { height: '100%', maxHeight: '100%', borderRadius: 0 }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.simulatorTitle}>{simulatorTitle}</Text>
              <Text style={styles.simulatorSubtitle}>{simulatorSubtitle}</Text>
              {!!imageLabels?.length && (
                <Text style={styles.simulatorHint}>
                  Labels show which section/printer rule each simulated ticket used.
                </Text>
              )}
            </View>
            <IconButton icon="close" size={24} onPress={onClose} hitSlop={4} accessibilityLabel="Close print preview" iconColor={t.color.text} style={styles.closeControl} />
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
                        style={[styles.receiptImage, imageRatios[uri] ? { aspectRatio: imageRatios[uri] } : null]}
                        resizeMode="contain"
                        accessibilityLabel={imageLabels?.[index] || `${simulatorTitle} receipt ${index + 1}`}
                        onLoad={(event) => { const { width, height } = event.nativeEvent.source; if (width > 0 && height > 0) setImageRatios((prev) => ({ ...prev, [uri]: width / height })); }}
                        onError={() => setFailedImages((prev) => ({ ...prev, [uri]: true }))}
                      />
                      {failedImages[uri] && <Text accessibilityRole="alert" style={styles.noImageText}>Preview image couldn’t load. Close the preview and try again.</Text>}
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
                mode="contained"
                contentStyle={{ minHeight: 48 }}
                icon="download"
                onPress={handleShare}
                loading={sharing}
                disabled={sharing}
                style={styles.downloadButton}
                labelStyle={styles.buttonLabel}
              >
                Download / Share
              </PaperButton>
            )}
            <PaperButton
              mode="outlined"
              contentStyle={{ minHeight: 48 }}
              onPress={onClose}
              style={styles.dismissButton}
              labelStyle={styles.buttonLabel}
            >
              Close preview
            </PaperButton>
          </View>
        </View>
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
    backgroundColor: t.color.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  simulatorCard: {
    backgroundColor: t.color.surface,
    borderRadius: t.radius.dialog,
    width: '100%',
    maxWidth: 620,
    height: 640,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    backgroundColor: t.color.surface,
    borderBottomColor: t.color.border,
  },
  closeControl: { width: 40, height: 40, margin: 0, borderRadius: 20, backgroundColor: '#F0F4F3' },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: t.radius.card,
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
    fontSize: 19,
    fontWeight: '800',
    color: t.color.text,
  },
  simulatorSubtitle: {
    fontSize: 14,
    color: t.color.muted,
    fontWeight: '500',
  },
  simulatorHint: {
    marginTop: 4,
    fontSize: 14,
    color: t.color.muted,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    backgroundColor: t.color.surface,
    borderRadius: 0,
    shadowColor: t.color.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,

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
    color: t.color.muted,
  },
  receiptImage: {
    width: '100%',
    aspectRatio: 0.7, // Receipts are usually tall

  },
  noImageContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  noImageText: {
    color: t.color.muted,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingVertical: 18,
    paddingHorizontal: 26,
    borderTopWidth: 1,
    borderTopColor: t.color.border,
    gap: 12,
  },
  downloadButton: {
    borderRadius: t.radius.control,
    borderColor: t.color.border,
  },
  dismissButton: {
    borderRadius: t.radius.control,
    borderColor: t.color.border,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
});
