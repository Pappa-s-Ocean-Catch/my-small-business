import React from 'react';
import { Alert } from 'react-native';
import { Button as PaperButton, IconButton } from 'react-native-paper';
import type { SavedPrinter } from '@/lib/escpos-printer';

type ManualPrintButtonProps = {
  printers: SavedPrinter[];
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  icon?: string;
  mode?: 'button' | 'icon';
  onSelectPrinter: (printer: SavedPrinter | null) => void | Promise<void>;
};

export function ManualPrintButton({
  printers,
  disabled = false,
  loading = false,
  label = 'Print',
  icon = 'printer',
  mode = 'button',
  onSelectPrinter,
}: ManualPrintButtonProps) {
  const handlePress = React.useCallback(() => {
    if (printers.length <= 1) {
      void onSelectPrinter(printers[0] ?? null);
      return;
    }

    Alert.alert(
      'Choose printer',
      'Select the printer for this manual print.',
      [
        ...printers.map((printer) => ({
          text: printer.deviceName,
          onPress: () => {
            void onSelectPrinter(printer);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [onSelectPrinter, printers]);

  if (mode === 'icon') {
    return (
      <IconButton
        icon={icon}
        size={18}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityLabel={label}
      />
    );
  }

  return (
    <PaperButton
      mode="outlined"
      icon={icon}
      onPress={handlePress}
      loading={loading}
      disabled={disabled || loading}
      compact
    >
      {label}
    </PaperButton>
  );
}
