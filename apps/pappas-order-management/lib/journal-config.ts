const rawJournalEnabled = process.env.EXPO_PUBLIC_ENABLE_JOURNAL_LOGS;

export const JOURNAL_LOGS_ENABLED = rawJournalEnabled == null
  ? true
  : rawJournalEnabled.trim().toLowerCase() !== 'false';
