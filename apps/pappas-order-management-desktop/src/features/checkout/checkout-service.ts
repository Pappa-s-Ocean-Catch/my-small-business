import type { PosGateway, SavedPosOrder } from '@my-small-business/pos-domain';
import type { CartLine } from '../pos/pos-types';

export type CheckoutInput = { lines: CartLine[]; paymentMethod: 'cash' | 'card'; userId: string };
export type CheckoutOutcome = { kind: 'saved'; order: SavedPosOrder } | { kind: 'failed'; message: string };

function lineTotal(line: CartLine): number {
  const addonTotal = line.addons.reduce((sum, addon) => sum + Math.round((addon.addon_item_price ?? 0) * 100) * (addon.quantity ?? 1), 0);
  return (line.salePriceCents + addonTotal) * line.quantity;
}

export function createCheckoutService({ gateway, newId }: { gateway: Pick<PosGateway, 'saveOrder'>; newId: () => string }) {
  let pending = false;
  return { async submitCashCardOrder(input: CheckoutInput): Promise<CheckoutOutcome> {
    if (pending) return { kind: 'failed', message: 'Checkout is already in progress.' };
    if (input.lines.length === 0) return { kind: 'failed', message: 'Add at least one item before payment.' };
    pending = true;
    const subtotalCents = input.lines.reduce((total, line) => total + lineTotal(line), 0);
    try {
      const order = await gateway.saveOrder({ orderId: null, order: {
        client_checkout_attempt_id: newId(), user_id: input.userId, customer_name: 'INSTORE', customer_email: '', customer_phone: '',
        payment_method: input.paymentMethod, payment_method_detail: input.paymentMethod, payment_status: 'paid', order_channel: 'instore', order_type: 'pickup', order_status: 'confirmed',
        subtotal: subtotalCents / 100, tax: 0, delivery_fee: 0, service_fee: 0, promotion_discount: 0, coupon_discount: 0, total: subtotalCents / 100,
      }, items: input.lines.map((line) => {
        const itemSubtotalCents = lineTotal(line);
        return {
          product_id: line.productId, product_name: line.name, product_description: null, product_image_url: null, base_price: line.salePriceCents / 100,
          override_price: null, quantity: line.quantity, subtotal: itemSubtotalCents / 100, section: null, removed_ingredients: line.removedIngredients, comment: line.notes || null, addons: line.addons,
        };
      }) });
      return { kind: 'saved', order };
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : 'Unable to save order.' };
    } finally { pending = false; }
  } };
}
