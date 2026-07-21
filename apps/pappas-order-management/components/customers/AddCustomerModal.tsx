import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, Portal, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PosPhoneInputModal } from '@/components/pos/PosPhoneInputModal';
import { PosTextInputModal } from '@/components/pos/PosTextInputModal';

type Props = {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; email?: string; phone?: string }) => Promise<void> | void;
};

export function AddCustomerModal({ visible, saving = false, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);

  const canSubmit = useMemo(() => name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0), [email, name, phone]);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    setNameModalVisible(false);
    setEmailModalVisible(false);
    setPhoneModalVisible(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;

    await onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    reset();
  };

  return (
    <>
      <Portal>
        <Dialog visible={visible} onDismiss={handleClose} style={styles.dialog}>
          <Surface style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]} elevation={0}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="headlineSmall" style={styles.title}>Add Customer</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  Save a customer with name plus email, phone, or both.
                </Text>
              </View>
              <IconButton icon="close" onPress={handleClose} disabled={saving} />
            </View>

            <View style={styles.form}>
              <TouchableOpacity style={styles.fieldTrigger} onPress={() => setNameModalVisible(true)} disabled={saving}>
                <Text style={styles.fieldLabel}>Name</Text>
                <Text style={[styles.fieldValue, !name ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                  {name || 'Tap to enter customer name'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fieldTrigger} onPress={() => setEmailModalVisible(true)} disabled={saving}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={[styles.fieldValue, !email ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                  {email || 'Tap to enter email'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fieldTrigger} onPress={() => setPhoneModalVisible(true)} disabled={saving}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <Text style={[styles.fieldValue, !phone ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                  {phone || '04'}
                </Text>
              </TouchableOpacity>
              <HelperText type={canSubmit ? 'info' : 'error'} visible>
                {canSubmit ? 'The customer will be added to the shared web/POS profile list.' : 'Name plus email or phone is required.'}
              </HelperText>
            </View>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Button mode="text" onPress={handleClose} disabled={saving}>Cancel</Button>
              <Button mode="contained" onPress={handleSubmit} loading={saving} disabled={!canSubmit || saving}>
                Save Customer
              </Button>
            </View>
          </Surface>
        </Dialog>
      </Portal>

      <PosTextInputModal
        visible={nameModalVisible}
        title="Enter Customer Name"
        value={name}
        placeholder="Enter customer name"
        onDismiss={() => setNameModalVisible(false)}
        onSave={(value) => {
          setName(value);
          setNameModalVisible(false);
        }}
      />

      <PosTextInputModal
        visible={emailModalVisible}
        title="Enter Customer Email"
        value={email}
        placeholder="Enter customer email"
        extraKeys={['@', '.', '-', '_']}
        onDismiss={() => setEmailModalVisible(false)}
        onSave={(value) => {
          setEmail(value.toLowerCase());
          setEmailModalVisible(false);
        }}
      />

      <PosPhoneInputModal
        visible={phoneModalVisible}
        value={phone}
        onDismiss={() => setPhoneModalVisible(false)}
        onSave={(value) => {
          setPhone(value);
          setPhoneModalVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  dialog: {
    alignSelf: 'center',
    width: '92%',
    maxWidth: 720,
    backgroundColor: '#fff',
  },
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 20,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#0f172a',
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
  },
  form: {
    gap: 14,
  },
  fieldTrigger: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  fieldValue: {
    fontSize: 17,
    color: '#0f172a',
    fontWeight: '600',
  },
  fieldPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 20,
  },
});
