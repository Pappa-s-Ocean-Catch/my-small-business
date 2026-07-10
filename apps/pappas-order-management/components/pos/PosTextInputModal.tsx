import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Dialog, IconButton, Portal } from 'react-native-paper';

import { styles } from '../../app/pos.styles';

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onDismiss: () => void;
  onSave: (value: string) => void;
};

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const;

export function PosTextInputModal({
  visible,
  title,
  value,
  onDismiss,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [value, visible]);

  const appendKey = (key: string) => {
    if (key === 'DONE') {
      if (draft.trim()) onSave(draft.trim());
      return;
    }

    if (key === 'CLEAR') {
      setDraft('');
      return;
    }

    if (key === 'DEL') {
      setDraft((current) => current.slice(0, -1));
      return;
    }

    if (key === 'SPACE') {
      setDraft((current) => `${current} `);
      return;
    }

    setDraft((current) => `${current}${key}`);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.textEntryDialog}>
        <View style={styles.textEntryTitleRow}>
          <Dialog.Title>{title}</Dialog.Title>
          <IconButton icon="close" size={30} onPress={onDismiss} style={styles.textEntryCloseButton} />
        </View>
        <Dialog.Content>
          <View style={styles.textEntryHeaderRow}>
            <View style={styles.textEntryDisplay}>
              <Text style={[styles.textEntryDisplayText, !draft ? styles.textEntryPlaceholder : null]} numberOfLines={2}>
                {draft || 'Enter customer name'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.textEntryDoneButton, !draft.trim() ? styles.textEntryDoneButtonDisabled : null]}
              onPress={() => {
                if (draft.trim()) onSave(draft.trim());
              }}
              disabled={!draft.trim()}
            >
              <Text style={styles.textEntryDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textEntryKeyboard}>
            {KEYBOARD_ROWS.map((row, index) => (
              <View
                key={`row-${index}`}
                style={[
                  styles.textEntryKeyboardRow,
                  index === 1 ? styles.textEntryKeyboardRowInset : null,
                  index === 2 ? styles.textEntryKeyboardRowWideInset : null,
                ]}
              >
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.textEntryKey}
                    onPress={() => appendKey(key)}
                  >
                    <Text style={styles.textEntryKeyText}>{key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.textEntryKeyboardRow}>
              <TouchableOpacity
                style={[styles.textEntryWideKey, styles.textEntrySecondaryKey]}
                onPress={() => appendKey('SPACE')}
              >
                <Text style={styles.textEntryKeyText}>SPACE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textEntryActionKey, styles.textEntrySecondaryKey]}
                onPress={() => appendKey('DEL')}
              >
                <Text style={styles.textEntryKeyText}>DEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textEntryActionKey, styles.textEntrySecondaryKey]}
                onPress={() => appendKey('CLEAR')}
              >
                <Text style={styles.textEntryKeyText}>CLEAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textEntryActionKey, styles.textEntryPrimaryKey, !draft.trim() ? styles.textEntryActionKeyDisabled : null]}
                onPress={() => appendKey('DONE')}
                disabled={!draft.trim()}
              >
                <Text style={styles.textEntryPrimaryKeyText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
