export type EditedOrderPaymentChoice = 'cash' | 'card' | 'smartpay' | 'unpaid';

export function getEditedOrderPaymentAction(choice: EditedOrderPaymentChoice):
  | { kind: 'cash_tender' }
  | { kind: 'checkout'; payment: 'card' | 'smartpay' | 'no_pay' } {
  if (choice === 'cash') return { kind: 'cash_tender' };
  return { kind: 'checkout', payment: choice === 'unpaid' ? 'no_pay' : choice };
}
