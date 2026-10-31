import { AppModal as Modal } from '@/components/ui/AppModal';
import { ActionButton as PaperButton } from '@/components/ui/ActionButton';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Icon } from 'react-native-paper';
import { isSimulatorPrinter, type SavedPrinter } from '@/lib/escpos-printer';
import { designTokens as t } from '@/lib/redesign';
import { canRetryManualPrintRequest } from '@/lib/manual-print-reconciliation';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import { useModalFocus } from '@/hooks/useModalFocus';

export type ManualPrintMode = {
  label: string;
  icon?: string;
  disabled?: boolean;
  onSelectPrinter: (printer: SavedPrinter | null) => void | boolean | Promise<void | boolean>;
};

type ManualPrintButtonProps = {
  printers: SavedPrinter[];
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  icon?: string;
  mode?: 'button' | 'icon';
  style?: StyleProp<ViewStyle>;
  renderTrigger?: (state: { onPress: () => void; disabled: boolean; loading: boolean }) => React.ReactNode;
  onSelectPrinter: ManualPrintMode['onSelectPrinter'];
  printModes?: ManualPrintMode[];
  onVisibilityChange?: (visible: boolean) => void;
};

/** A printer is an action: selection submits exactly once, with no second Print step. */
export function ManualPrintButton({ printers, disabled = false, loading = false, label = 'Print', icon = 'printer', mode = 'button', style, renderTrigger, onSelectPrinter, printModes, onVisibilityChange }: ManualPrintButtonProps) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { onVisibilityChange?.(open); }, [open, onVisibilityChange]);
  const [selectedMode, setSelectedMode] = React.useState<ManualPrintMode | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // A ref closes the duplicate-tap window before React commits disabled controls.
  const submitting = React.useRef(false);
  const pickerDismissed = React.useRef<(() => void) | null>(null);
  const dismissBeforePreview = () => new Promise<void>((resolve) => {
    // UIKit cannot present the preview until this native modal finishes dismissing.
    if (Platform.OS === 'ios') pickerDismissed.current = resolve;
    setOpen(false);
    if (Platform.OS !== 'ios') resolve();
  });
  const unresolvedJobIds = React.useRef<string[]>([]);
  const [needsReview, setNeedsReview] = React.useState(false);
  const queue = usePrinterAutomationStore((state) => state.printJobs);
  const canRetry = canRetryManualPrintRequest(unresolvedJobIds.current, queue);
  const recordUnconfirmed = (before: Set<string>, printer: SavedPrinter) => {
    const jobs = usePrinterAutomationStore.getState().printJobs.filter((job) => !before.has(job.id) && job.printer.target === printer.target);
    unresolvedJobIds.current = jobs.map((job) => job.id);
    setNeedsReview(true);
    return jobs.length ? ` Request: ${jobs.map((job) => job.id).join(', ')}.` : '';
  };
  const panelRef = React.useRef<View>(null);
  const close = React.useCallback(() => { if (!submitting.current) setOpen(false); }, []);
  useModalFocus(panelRef, open, close);
  const begin = () => {
    setError(needsReview ? 'Check the previous request in the printer journal before retrying.' : null);
    setSelectedMode(printModes?.length ? null : { label, onSelectPrinter });
    setOpen(true);
  };
  const submit = async (printer: SavedPrinter) => {
    if (submitting.current || loading || needsReview || !selectedMode) return;
    const before = new Set(usePrinterAutomationStore.getState().printJobs.map((job) => job.id));
    submitting.current = true;
    setPending(true);
    setError(null);
    const preview = isSimulatorPrinter(printer);
    try {
      if (preview) await dismissBeforePreview();
      const result = await selectedMode.onSelectPrinter(printer);
      if (result === false) {
        if (preview) {
          setError('Could not open the receipt preview. Please try again.');
          setOpen(true);
        } else setError('The print could not be confirmed. Check this job in the printer journal before sending another copy.' + recordUnconfirmed(before, printer));
      } else {
        setOpen(false);
      }
    } catch (cause) {
      if (preview) {
        setError(cause instanceof Error ? cause.message : 'Could not open the receipt preview. Please try again.');
        setOpen(true);
      } else setError((cause instanceof Error ? cause.message : 'The print could not be confirmed. Check the printer journal before retrying.') + recordUnconfirmed(before, printer));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const busy = pending || loading;
  return <>
    {renderTrigger ? renderTrigger({ onPress: begin, disabled: disabled || busy, loading: loading || pending }) : mode === 'icon' ? <IconButton icon={icon} size={18} onPress={begin} loading={loading} disabled={disabled || busy} accessibilityLabel={label} style={style} /> : <PaperButton mode="outlined" icon={icon} onPress={begin} loading={loading} disabled={disabled || busy} style={style} accessibilityLabel={label} contentStyle={{ minHeight: 48 }}>{label}</PaperButton>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} onDismiss={() => {
      const resolve = pickerDismissed.current;
      pickerDismissed.current = null;
      resolve?.();
    }}>
      <View style={styles.overlay}>
        <View ref={panelRef} style={styles.panel} accessibilityViewIsModal>
          <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{selectedMode ? 'Choose printer' : 'Print order'}</Text><IconButton icon="close" hitSlop={4} accessibilityLabel="Close printer choices" disabled={busy} onPress={close} style={styles.closeControl} /></View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.hint}>{pending ? 'Submitting one print job. Please wait…' : selectedMode ? `${selectedMode.label} · Tap a printer to print immediately.` : 'Choose the copy, then tap a printer.'}</Text>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {!selectedMode ? printModes?.map((copy) => <TouchableOpacity key={copy.label} accessibilityRole="button" accessibilityLabel={copy.label} accessibilityState={{ disabled: !!copy.disabled || busy }} disabled={copy.disabled || busy} onPress={() => setSelectedMode(copy)} style={[styles.printer, (copy.disabled || busy) && styles.disabled]}><Text style={[styles.name, { flex: 1 }]}>{copy.label === 'Kitchen' ? 'Kitchen ticket' : copy.label === 'Ticket' ? 'Order ticket' : copy.label}</Text><Icon source="chevron-right" size={22} color={t.color.text} /></TouchableOpacity>) : printers.length ? printers.map((printer) => <TouchableOpacity key={printer.target} accessibilityRole="button" accessibilityLabel={`${printer.deviceName}, ${isSimulatorPrinter(printer) ? 'open preview' : 'print now'}`} accessibilityState={{ disabled: busy || needsReview }} disabled={busy || needsReview} style={[styles.printer, (busy || needsReview) && styles.disabled]} onPress={() => void submit(printer)}>
              <Icon source={isSimulatorPrinter(printer) ? 'eye-outline' : 'printer-outline'} size={22} color={t.color.text} />
              <View style={{ flex: 1 }}><Text style={styles.name}>{printer.deviceName}</Text><Text style={styles.hint}>{isSimulatorPrinter(printer) ? 'Open preview' : 'Print now'}</Text></View><Text style={styles.name}>›</Text>
            </TouchableOpacity>) : <Text style={styles.hint}>No saved printers. Add a printer in Settings.</Text>}
            {needsReview && <PaperButton disabled={busy || !canRetry} onPress={() => { setNeedsReview(false); setError(null); unresolvedJobIds.current = []; }}>Retry confirmed failed request</PaperButton>}
            {needsReview && !canRetry && <Text style={styles.hint}>This request is still queued, printing, or cannot be reconciled. Printer choices stay disabled to avoid a duplicate.</Text>}
            {selectedMode && !!printModes?.length && <PaperButton disabled={busy} onPress={() => { setSelectedMode(null); setError(null); }}>Back to copy types</PaperButton>}
            <PaperButton mode="outlined" accessibilityLabel="Cancel printing" disabled={busy} onPress={close}>Cancel</PaperButton>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 35, 42, 0.48)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 620, maxHeight: '90%', borderRadius: 24, backgroundColor: t.color.background, overflow: 'hidden' },
  header: { minHeight: 64, paddingVertical: 12, paddingLeft: 18, paddingRight: 18, backgroundColor: t.color.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: t.color.border },
  closeControl: { width: 40, height: 40, margin: 0, borderRadius: 20, backgroundColor: '#F0F4F3' },
  title: { flex: 1, fontSize: 19, fontWeight: '800', color: t.color.text },
  body: { padding: 18, gap: 10 },
  printer: { minHeight: 68, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, borderRadius: 10, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: t.color.text, fontSize: 16, fontWeight: '700' },
  hint: { color: t.color.muted, fontSize: 14, lineHeight: 21 },
  error: { color: t.color.danger, fontSize: 14, lineHeight: 21 },
  disabled: { opacity: 0.5 },
});
