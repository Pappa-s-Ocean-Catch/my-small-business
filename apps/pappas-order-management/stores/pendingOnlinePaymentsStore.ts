import { create } from 'zustand';

export type PendingOnlinePaymentSession = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentUrl: string;
  deliveryAddress: string | null;
  deliveryEtaMinutes: number | null;
  totalAmount: number;
  deliveryFee: number;
  serviceFee: number;
  isTestPayment: boolean;
  itemSummaries: Array<{
    id: string;
    quantity: number;
    productName: string;
    subtotal: number;
    comment: string | null;
    removedIngredients: string[];
    addons: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  }>;
  status: 'pending' | 'paid' | 'failed';
  smsStatus: 'idle' | 'sending' | 'sent' | 'error';
  smsMessage: string | null;
  createdAt: number;
  minimized: boolean;
};

type PendingOnlinePaymentsState = {
  sessions: PendingOnlinePaymentSession[];
  upsertSession: (session: Omit<PendingOnlinePaymentSession, 'status' | 'smsStatus' | 'smsMessage' | 'createdAt' | 'minimized'>) => void;
  setMinimized: (orderId: string, minimized: boolean) => void;
  updateStatus: (orderId: string, status: PendingOnlinePaymentSession['status']) => void;
  setSmsState: (
    orderId: string,
    smsStatus: PendingOnlinePaymentSession['smsStatus'],
    smsMessage?: string | null
  ) => void;
  removeSession: (orderId: string) => void;
};

export const usePendingOnlinePaymentsStore = create<PendingOnlinePaymentsState>((set) => ({
  sessions: [],
  upsertSession: (session) => set((state) => {
    const existing = state.sessions.find((item) => item.orderId === session.orderId);
    const nextSession: PendingOnlinePaymentSession = existing ? {
      ...existing,
      ...session,
      minimized: false,
      status: existing.status,
      smsStatus: existing.smsStatus,
      smsMessage: existing.smsMessage,
    } : {
      ...session,
      status: 'pending',
      smsStatus: 'idle',
      smsMessage: null,
      createdAt: Date.now(),
      minimized: false,
    };

    return {
      sessions: [
        nextSession,
        ...state.sessions.filter((item) => item.orderId !== session.orderId),
      ],
    };
  }),
  setMinimized: (orderId, minimized) => set((state) => ({
    sessions: state.sessions.map((session) => (
      session.orderId === orderId ? { ...session, minimized } : session
    )),
  })),
  updateStatus: (orderId, status) => set((state) => ({
    sessions: state.sessions.map((session) => (
      session.orderId === orderId ? { ...session, status } : session
    )),
  })),
  setSmsState: (orderId, smsStatus, smsMessage = null) => set((state) => ({
    sessions: state.sessions.map((session) => (
      session.orderId === orderId ? { ...session, smsStatus, smsMessage } : session
    )),
  })),
  removeSession: (orderId) => set((state) => ({
    sessions: state.sessions.filter((session) => session.orderId !== orderId),
  })),
}));
