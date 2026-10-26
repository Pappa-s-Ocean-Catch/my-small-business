import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Dialog, Portal, Text } from 'react-native-paper';
import type { Customer } from '@/lib/customers';
import { EditorSheet, FormField, designTokens as t } from '@/components/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with the entered phone and name. Should resolve to a customer record or create one.
   */
  onSubmit: (phone: string, name: string) => Promise<{ data: Customer | null; error: string | null }>;
};

export default function CustomerInfoModal({ visible, onClose, onSubmit }: Props) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onSubmit(phone.trim(), name.trim());
      if (result.error) {
        setError(result.error);
      } else {
        // success, close modal
        onClose();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save customer information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditorSheet
      visible={visible}
      title="Customer information"
      subtitle="Find or create the customer for this order."
      onDismiss={onClose}
      dirty={Boolean(phone || name)}
      pending={loading}
      footer={(requestDismiss) => <><Button onPress={requestDismiss} disabled={loading}>Cancel</Button><Button mode="contained" onPress={handleConfirm} loading={loading} disabled={loading || !phone} contentStyle={{ minHeight: 52 }}>Use customer</Button></>}
    >
      <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" disabled={loading} />
      <FormField label="Name" value={name} onChangeText={setName} disabled={loading} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: '#fff',
  },
  input: {
    marginBottom: 12,
  },
  error: {
    color: t.color.danger,
    marginTop: 8,
  },
});
