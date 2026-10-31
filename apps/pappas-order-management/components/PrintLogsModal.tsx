import { AppModal as Modal } from '@/components/ui/AppModal';
import { WorkspaceHeader } from '@/components/ui';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { designTokens as t } from '@/lib/redesign';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';
import { BRAND_COLORS } from '@/utils/brand';

type PrintLogsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function JournalLogsModal({ visible, onClose }: PrintLogsModalProps) {
  const journalEntries = usePrinterAutomationStore((state) => state.journalEntries);
  const clearJournal = usePrinterAutomationStore((state) => state.clearJournal);

  const logLevelBadgeStyles = {
    info: styles.logLevelBadgeinfo,
    decision: styles.logLevelBadgedecision,
    success: styles.logLevelBadgesuccess,
    error: styles.logLevelBadgeerror,
  };

  const handleClearJournalLogs = () => {
    clearJournal();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalScreen}>
        <WorkspaceHeader title="Journal" onBack={onClose} showProfile={false} />
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.logsHeaderRow}>
            <Text style={styles.helper}>
              Review recent printer workflow events for this device. Newest entries appear first. Entries older than 30 minutes are removed automatically.
            </Text>
            <Button
              mode="text"
              icon="delete-outline"
              onPress={handleClearJournalLogs}
              disabled={journalEntries.length === 0}
            >
              Clear journal
            </Button>
          </View>

          {journalEntries.length === 0 ? (
            <View style={styles.logsEmptyState}>
              <Text style={styles.label}>No journal entries yet.</Text>
              <Text style={styles.helper}>Run a test print or wait for the next kitchen workflow event to populate this list.</Text>
            </View>
          ) : (
            journalEntries.map((entry) => (
              <View key={entry.id} style={styles.logCard}>
                <View style={styles.logCardHeader}>
                  <View style={[styles.logLevelBadge, logLevelBadgeStyles[entry.level]]}>
                    <Text style={styles.logLevelBadgeText}>{entry.level.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.logTimestamp}>{new Date(entry.timestamp).toLocaleString()}</Text>
                </View>
                <Text style={styles.logScope}>{entry.scope}</Text>
                <Text style={styles.logMessage}>{entry.message}</Text>
                {entry.orderNumber || entry.orderId ? (
                  <Text style={styles.logMeta}>
                    Order: {entry.orderNumber || entry.orderId}
                  </Text>
                ) : null}
                {entry.details ? (
                  <Text style={styles.logDetails}>{entry.details}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
        <View style={styles.modalFooter}>
          <Button mode="outlined" onPress={onClose}>
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScreen: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  modalHeader: {
    backgroundColor: BRAND_COLORS.header,
  },
  modalHeaderTitle: {
    color: t.color.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
  },
  modalFooter: {

    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: t.color.border,
    backgroundColor: t.color.surface,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  helper: {
    marginTop: 6,
    fontSize: 14,
    color: '#666',
  },
  logsHeaderRow: {
    gap: 8,
    marginBottom: 12,
  },
  logsEmptyState: {
    marginTop: 8,
    padding: 16,
    borderRadius: t.radius.card,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  logCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: t.radius.card,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: '#ececec',
    gap: 6,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logLevelBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  logLevelBadgeinfo: {
    backgroundColor: t.color.primaryTint,
  },
  logLevelBadgedecision: {
    backgroundColor: '#ede9fe',
  },
  logLevelBadgesuccess: {
    backgroundColor: t.color.successTint,
  },
  logLevelBadgeerror: {
    backgroundColor: t.color.dangerTint,
  },
  logLevelBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  logTimestamp: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: t.color.muted,
  },
  logScope: {
    fontSize: 14,
    fontWeight: '700',
    color: t.color.muted,
    textTransform: 'uppercase',
  },
  logMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: t.color.text,
  },
  logMeta: {
    fontSize: 14,
    color: t.color.muted,
  },
  logDetails: {
    fontSize: 14,
    color: '#334155',
  },
});
