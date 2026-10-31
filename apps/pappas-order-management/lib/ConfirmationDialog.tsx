import React from 'react';
import { Text, View } from 'react-native';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { ActionButton } from '@/components/ui/ActionButton';
import { designTokens as t } from '@/lib/redesign';

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
/** Controlled confirmations share the same frame and controls as other app editors. */
export function ConfirmationDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger', isLoading = false, error = null }: ConfirmationDialogProps) {
  return <EditorSheet visible={isOpen} title={title} onDismiss={onClose} pending={isLoading} size="confirm" footer={<>
    <ActionButton mode="outlined" onPress={onClose} disabled={isLoading}>{cancelText}</ActionButton>
    <ActionButton mode="contained" onPress={onConfirm} loading={isLoading} disabled={isLoading} textColor={variant === 'danger' ? t.color.danger : undefined} buttonColor={variant === 'danger' ? t.color.dangerTint : undefined}>{confirmText}</ActionButton>
  </>}><View style={{ gap: 16 }}><Text style={{ color: t.color.text, fontSize: 16, lineHeight: 24 }}>{message}</Text>{error && <Text accessibilityRole="alert" style={{ color: t.color.danger, fontSize: 14, lineHeight: 21 }}>{error}</Text>}</View></EditorSheet>;
}
