import { createContext, useContext } from 'react';
import type { Order } from '@my-small-business/types';

export type InstoreCustomerReceiptPrintAction = {
  printInstoreCustomerReceipt: (order: Order) => Promise<void>;
  printInstoreInstantTicket: (order: Order) => Promise<void>;
};

export const InstoreCustomerReceiptPrintContext = createContext<InstoreCustomerReceiptPrintAction | null>(null);

export function useInstoreCustomerReceiptPrint(): InstoreCustomerReceiptPrintAction {
  const action = useContext(InstoreCustomerReceiptPrintContext);
  if (!action) {
    throw new Error('useInstoreCustomerReceiptPrint must be used inside PrinterAutomationProvider.');
  }
  return action;
}
