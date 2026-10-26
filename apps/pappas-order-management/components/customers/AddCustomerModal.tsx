import { ActionButton as Button } from '@/components/ui/ActionButton';
import { FormField } from '@/components/ui';
import { CustomerWorkspaceEditor } from './CustomerWorkspaceEditor';
import React, { useMemo, useState } from 'react';
import { HelperText } from 'react-native-paper';

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
  title = 'Add customer',
  subtitle = 'Save a customer with name plus email, phone, or both.',
  submitLabel = 'Save customer',
  requireContact = true,
  showEmailField = true,
  showPhoneField = true,
  initialValues,
  showSaveAndAddMore = false,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [phone, setPhone] = useState(initialValues?.phone ?? '');

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
    onClose();
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
      return;
    }

    reset();
  };

  const dirty = name !== (initialValues?.name ?? '') || email !== (initialValues?.email ?? '') || phone !== (initialValues?.phone ?? '');
  return <CustomerWorkspaceEditor visible={visible} title={title} onDismiss={handleClose} dirty={dirty} pending={saving} footer={(dismiss) => <>
    <Button mode="outlined" onPress={dismiss} disabled={saving} contentStyle={{ minHeight: 48 }}>Cancel</Button>
    {showSaveAndAddMore && <Button mode="outlined" onPress={() => void handleSubmit({ keepOpen: true })} disabled={!canSubmit || saving} contentStyle={{ minHeight: 48 }}>Save & add more</Button>}
    <Button mode="contained" onPress={() => void handleSubmit()} loading={saving} disabled={!canSubmit || saving} contentStyle={{ minHeight: 48 }}>{submitLabel}</Button>
  </>}>
    <FormField label={showEmailField || showPhoneField ? "Name" : "Customer name"} value={name} onChangeText={setName} editable={!saving} autoCapitalize="words" />
    {showEmailField && <FormField label="Email" value={email} onChangeText={setEmail} editable={!saving} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />}
    {showPhoneField && <FormField label="Phone" value={phone} onChangeText={setPhone} editable={!saving} keyboardType="phone-pad" />}
    <HelperText type="info">{requireContact ? 'Name plus email or phone is required.' : 'Customer name is required.'}</HelperText>
  </CustomerWorkspaceEditor>;
}
