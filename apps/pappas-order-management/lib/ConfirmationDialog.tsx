import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  error?: string | null;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  error = null,
}: ConfirmationDialogProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          confirmButton: '#ef4444',
          confirmButtonPressed: '#dc2626',
          iconBg: '#fee2e2',
          borderColor: '#fecaca',
        };
      case 'warning':
        return {
          confirmButton: '#f59e0b',
          confirmButtonPressed: '#d97706',
          iconBg: '#fef3c7',
          borderColor: '#fde68a',
        };
      case 'info':
        return {
          confirmButton: '#3b82f6',
          confirmButtonPressed: '#2563eb',
          iconBg: '#dbeafe',
          borderColor: '#bfdbfe',
        };
      default:
        return {
          confirmButton: '#ef4444',
          confirmButtonPressed: '#dc2626',
          iconBg: '#fee2e2',
          borderColor: '#fecaca',
        };
    }
  };

  const styles_variant = getVariantStyles();

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.iconContainer, { backgroundColor: styles_variant.iconBg }]}>
            <Text style={[styles.iconText, { color: styles_variant.confirmButton }]}>
              ⚠️
            </Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: styles_variant.confirmButton },
              ]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    // backgroundColor set dynamically
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
