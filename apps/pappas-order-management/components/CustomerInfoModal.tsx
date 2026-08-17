import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Dialog, Portal, Text } from 'react-native-paper';
import type { Customer } from '@/lib/customers';

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
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={styles.dialog}>
        <Dialog.Title>Customer Info</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose} disabled={loading}>Cancel</Button>
          <Button onPress={handleConfirm} loading={loading} disabled={loading || !phone}>Ok</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
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
    color: '#b91c1c',
    marginTop: 8,
  },
});
