import React from 'react';
import { Alert, type StyleProp, type ViewStyle } from 'react-native';
import { Button as PaperButton, IconButton } from 'react-native-paper';
import type { SavedPrinter } from '@/lib/escpos-printer';

export type ManualPrintMode = {
  label: string;
  icon?: string;
  disabled?: boolean;
  onSelectPrinter: (printer: SavedPrinter | null) => void | Promise<void>;
};

type ManualPrintButtonProps = {
  printers: SavedPrinter[];
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  icon?: string;
  mode?: 'button' | 'icon';
  style?: StyleProp<ViewStyle>;
  onSelectPrinter: (printer: SavedPrinter | null) => void | Promise<void>;
  printModes?: ManualPrintMode[];
};

export function ManualPrintButton({
  printers,
  disabled = false,
  loading = false,
  label = 'Print',
  icon = 'printer',
  mode = 'button',
  style,
  onSelectPrinter,
  printModes,
}: ManualPrintButtonProps) {
  const choosePrinter = React.useCallback((onSelect: ManualPrintMode['onSelectPrinter']) => {
    if (printers.length <= 1) {
      void onSelect(printers[0] ?? null);
      return;
    }

    Alert.alert(
      'Choose printer',
      'Select the printer for this manual print.',
      [
        ...printers.map((printer) => ({
          text: printer.deviceName,
          onPress: () => {
            void onSelect(printer);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [printers]);

  const handlePress = React.useCallback(() => {
    if (printModes?.length) {
      Alert.alert(
        'Choose print type',
        'Select what you want to print.',
        [
          ...printModes.map((printMode) => ({
            text: printMode.label,
            onPress: () => choosePrinter(printMode.onSelectPrinter),
            disabled: printMode.disabled,
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }
    choosePrinter(onSelectPrinter);
  }, [choosePrinter, onSelectPrinter, printModes]);

  const button = mode === 'icon' ? (
    <IconButton
      icon={icon}
      size={18}
      onPress={handlePress}
      loading={loading}
      disabled={disabled || loading}
      accessibilityLabel={printModes?.length ? 'Choose print type' : label}
      style={style}
    />
  ) : (
    <PaperButton
      mode="outlined"
      icon={icon}
      onPress={handlePress}
      loading={loading}
      disabled={disabled || loading}
      compact
      style={style}
      accessibilityLabel={printModes?.length ? 'Choose print type' : label}
    >
      {label}
    </PaperButton>
  );

  return button;
}
