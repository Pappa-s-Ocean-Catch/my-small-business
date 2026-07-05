import { create } from 'zustand';
import type { Order } from '@my-small-business/types';

export type JournalLevel = 'info' | 'decision' | 'success' | 'error';

export type JournalEntry = {
  id: string;
  timestamp: number;
  level: JournalLevel;
  scope: string;
  message: string;
  orderId?: string | null;
  orderNumber?: string | null;
  details?: string | null;
};

const JOURNAL_LIMIT = 300;

type PrinterAutomationState = {
  autoPrintToast: {
    visible: boolean;
    message: string;
  };
  journalEntries: JournalEntry[];
  preOrderSkipNotice: string | null;
  autoPrintSimulator: {
    visible: boolean;
    order: Order | null;
    imageUri: string | null;
    imageUris: string[];
    imageLabels: string[];
  };
  showToast: (message: string) => void;
  dismissToast: () => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  clearJournal: () => void;
  setPreOrderSkipNotice: (message: string | null) => void;
  showAutoPrintSimulator: (payload: {
    order: Order;
    imageUri: string | null;
    imageUris?: string[] | null;
    imageLabels?: string[] | null;
  }) => void;
  dismissAutoPrintSimulator: () => void;
};

export const usePrinterAutomationStore = create<PrinterAutomationState>((set) => ({
  autoPrintToast: {
    visible: false,
    message: '',
  },
  journalEntries: [],
  preOrderSkipNotice: null,
  autoPrintSimulator: {
    visible: false,
    order: null,
    imageUri: null,
    imageUris: [],
    imageLabels: [],
  },
  showToast: (message) => set({
    autoPrintToast: {
      visible: true,
      message,
    },
  }),
  dismissToast: () => set((state) => ({
    autoPrintToast: {
      ...state.autoPrintToast,
      visible: false,
    },
  })),
  addJournalEntry: (entry) => set((state) => ({
    journalEntries: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...entry,
      },
      ...state.journalEntries,
    ].slice(0, JOURNAL_LIMIT),
  })),
  clearJournal: () => set({ journalEntries: [] }),
  setPreOrderSkipNotice: (message) => set({ preOrderSkipNotice: message }),
  showAutoPrintSimulator: ({ order, imageUri, imageUris, imageLabels }) => set({
    autoPrintSimulator: {
      visible: true,
      order,
      imageUri,
      imageUris: imageUris || (imageUri ? [imageUri] : []),
      imageLabels: imageLabels || [],
    },
  }),
  dismissAutoPrintSimulator: () => set({
    autoPrintSimulator: {
      visible: false,
      order: null,
      imageUri: null,
      imageUris: [],
      imageLabels: [],
    },
  }),
}));
