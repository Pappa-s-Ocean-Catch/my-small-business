import React, { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { IconButton } from 'react-native-paper';

import { styles } from './pos.styles';

type Props = {
  visible: boolean;
  value: string;
  onDismiss: () => void;
  onSave: (value: string) => void;
  renderInline?: boolean;
};

const PHONE_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '03', '04', '0',
  'clear', 'backspace', 'done',
] as const;

const DEFAULT_PHONE_PREFIX = '04';

function isValidAustralianPhoneNumber(value: string) {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 10 && digitsOnly.startsWith('04')) return true;
  if (digitsOnly.length === 10 && digitsOnly.startsWith('03')) return true;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('614')) return true;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('613')) return true;
  return false;
}

export function PosPhoneInputModal({
  visible,
  value,
  onDismiss,
  onSave,
  renderInline = false,
}: Props) {
  const [draft, setDraft] = useState(value || DEFAULT_PHONE_PREFIX);
  const isValid = isValidAustralianPhoneNumber(draft);

  useEffect(() => {
    if (visible) {
      setDraft(value || DEFAULT_PHONE_PREFIX);
    }
  }, [value, visible]);

  const appendDigit = (key: typeof PHONE_KEYS[number]) => {
    if (key === 'done') {
      if (isValid) {
        onSave(draft);
      }
      return;
    }

    if (key === 'clear') {
      setDraft('');
      return;
    }

    if (key === 'backspace') {
      setDraft((current) => {
        if (current.length <= 1) return '';
        return current.slice(0, -1);
      });
      return;
    }

    if (key === '03' || key === '04') {
      setDraft(key);
      return;
    }

    setDraft((current) => `${current}${key}`);
  };

  const content = (
    <View style={styles.overlayScrim}>
      <View style={styles.overlayCenter}>
        <View style={styles.phonePadDialog}>
          <View style={styles.phonePadTitleRow}>
            <Text style={styles.overlayTitle}>Enter Phone Number</Text>
            <IconButton icon="close" size={30} onPress={onDismiss} style={styles.phonePadCloseButton} />
          </View>
          <View style={styles.overlayBody}>
            <View style={styles.phonePadHeaderRow}>
              <View style={styles.phonePadDisplay}>
                <Text style={styles.phonePadDisplayText} numberOfLines={1}>
                  {draft || 'Enter phone number'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.phonePadDoneButton, !isValid ? styles.phonePadDoneButtonDisabled : null]}
                onPress={() => {
                  if (isValid) onSave(draft);
                }}
                disabled={!isValid}
              >
                <Text style={styles.phonePadDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.phonePadGrid}>
              {PHONE_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.phonePadKey,
                    key === 'backspace' || key === 'clear' ? styles.phonePadKeySecondary : null,
                    key === 'done' ? styles.phonePadKeyPrimary : null,
                    key === 'done' && !isValid ? styles.phonePadKeyDisabled : null,
                  ]}
                  onPress={() => appendDigit(key)}
                  disabled={key === 'done' && !isValid}
                >
                  <Text style={styles.phonePadKeyText}>
                    {key === 'backspace' ? 'DEL' : key === 'clear' ? 'CLEAR' : key === 'done' ? 'DONE' : key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return renderInline ? (
    visible ? content : null
  ) : (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {content}
    </Modal>
  );
}
