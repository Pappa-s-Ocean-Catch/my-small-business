import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, HelperText, IconButton, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PosPhoneInputModal } from '@/components/pos/PosPhoneInputModal';
import { PosTextInputModal } from '@/components/pos/PosTextInputModal';
import { BRAND_COLORS } from '@/utils/brand';

type Props = {
  visible: boolean;
  saving?: boolean;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  requireContact?: boolean;
  showEmailField?: boolean;
  showPhoneField?: boolean;
  initialValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  showSaveAndAddMore?: boolean;
  onClose: () => void;
  onSubmit: (
    input: { name: string; email?: string; phone?: string },
    options?: { keepOpen?: boolean }
  ) => Promise<boolean | void> | boolean | void;
};

export function AddCustomerModal({
  visible,
  saving = false,
  title = 'Add Customer',
  subtitle = 'Save a customer with name plus email, phone, or both.',
  submitLabel = 'Save Customer',
  requireContact = true,
  showEmailField = true,
  showPhoneField = true,
  initialValues,
  showSaveAndAddMore = false,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(initialValues?.name ?? '');
    setEmail(initialValues?.email ?? '');
    setPhone(initialValues?.phone ?? '');
  }, [initialValues?.email, initialValues?.name, initialValues?.phone, visible]);

  const canSubmit = useMemo(() => {
    const hasName = name.trim().length > 0;
    if (!requireContact) return hasName;

    const hasEmail = showEmailField && email.trim().length > 0;
    const hasPhone = showPhoneField && phone.trim().length > 0;
    return hasName && (hasEmail || hasPhone);
  }, [email, name, phone, requireContact, showEmailField, showPhoneField]);

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

  const closeEditorOverlays = () => {
    setNameModalVisible(false);
    setEmailModalVisible(false);
    setPhoneModalVisible(false);
  };

  const handleSubmit = async (options?: { keepOpen?: boolean }) => {
    if (!canSubmit || saving) return;

    const result = await onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    }, options);

    if (result === false) {
      return;
    }

    if (options?.keepOpen) {
      reset();
      closeEditorOverlays();
      return;
    }

    reset();
  };

  return (
    <>
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.container}>
          <Surface style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]} elevation={1}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleBlock}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerMeta}>{subtitle}</Text>
              </View>
              <IconButton icon="close" size={24} iconColor="#f8fafc" onPress={handleClose} disabled={saving} />
            </View>
            <View style={styles.headerSub}>
              <View style={[styles.statusBadge, canSubmit ? styles.statusBadgeReady : styles.statusBadgeRequired]}>
                <Text style={styles.statusBadgeText}>{canSubmit ? 'Ready to Save' : 'Details Required'}</Text>
              </View>
            </View>
          </Surface>

          <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 96 }]}>
            <Surface style={styles.infoCard} elevation={0}>
              <Text style={styles.cardTitle}>Customer Details</Text>
              <TouchableOpacity style={styles.fieldTrigger} onPress={() => setNameModalVisible(true)} disabled={saving}>
                <Text style={styles.fieldLabel}>Name</Text>
                <Text style={[styles.fieldValue, !name ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                  {name || 'Tap to enter customer name'}
                </Text>
              </TouchableOpacity>
              {showEmailField ? (
                <TouchableOpacity style={styles.fieldTrigger} onPress={() => setEmailModalVisible(true)} disabled={saving}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <Text style={[styles.fieldValue, !email ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                    {email || 'Tap to enter email'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {showPhoneField ? (
                <TouchableOpacity style={styles.fieldTrigger} onPress={() => setPhoneModalVisible(true)} disabled={saving}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <Text style={[styles.fieldValue, !phone ? styles.fieldPlaceholder : null]} numberOfLines={1}>
                    {phone || 'Tap to enter phone'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <HelperText type={canSubmit ? 'info' : 'error'} visible>
                {canSubmit
                  ? requireContact
                    ? 'The customer will be added to the shared web/POS profile list.'
                    : 'Save the updated customer details.'
                  : requireContact
                    ? 'Name plus email or phone is required.'
                    : 'Customer name is required.'}
              </HelperText>
            </Surface>
          </ScrollView>

          <Surface style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]} elevation={4}>
            <View style={styles.primaryActionsRow}>
              {showSaveAndAddMore ? (
                <Button
                  mode="outlined"
                  onPress={() => void handleSubmit({ keepOpen: true })}
                  loading={saving}
                  disabled={!canSubmit || saving}
                  style={[styles.actionButton, styles.splitActionButton]}
                  contentStyle={styles.primaryActionButtonContent}
                >
                  Save & Add More
                </Button>
              ) : null}
              <Button
                mode="contained"
                onPress={() => void handleSubmit()}
                loading={saving}
                disabled={!canSubmit || saving}
                style={[
                  styles.primaryActionButton,
                  showSaveAndAddMore ? styles.splitActionButton : null,
                ]}
                contentStyle={styles.primaryActionButtonContent}
              >
                {showSaveAndAddMore ? 'Save & Close' : submitLabel}
              </Button>
            </View>
          </Surface>

          <PosTextInputModal
            visible={nameModalVisible}
            title="Enter Customer Name"
            value={name}
            placeholder="Enter customer name"
            renderInline
            onDismiss={() => setNameModalVisible(false)}
            onSave={(value) => {
              setName(value);
              setNameModalVisible(false);
            }}
          />

          {showEmailField ? (
            <PosTextInputModal
              visible={emailModalVisible}
              title="Enter Customer Email"
              value={email}
              placeholder="Enter customer email"
              extraKeys={['@', '.', '-', '_']}
              renderInline
              onDismiss={() => setEmailModalVisible(false)}
              onSave={(value) => {
                setEmail(value.toLowerCase());
                setEmailModalVisible(false);
              }}
            />
          ) : null}

          {showPhoneField ? (
            <PosPhoneInputModal
              visible={phoneModalVisible}
              value={phone}
              renderInline
              onDismiss={() => setPhoneModalVisible(false)}
              onSave={(value) => {
                setPhone(value);
                setPhoneModalVisible(false);
              }}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: BRAND_COLORS.header,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 20,
    paddingRight: 8,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f8fafc',
  },
  headerMeta: {
    fontSize: 14,
    color: '#b9c8dd',
    fontWeight: '600',
    marginTop: 4,
  },
  headerSub: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeReady: {
    backgroundColor: '#16a34a',
  },
  statusBadgeRequired: {
    backgroundColor: '#f97316',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
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
  actionBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
  },
  splitActionButton: {
    flex: 1,
  },
  primaryActionButton: {
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.header,
  },
  primaryActionButtonContent: {
    minHeight: 52,
  },
});
