import type { CartLine } from './pos-types';

export type CartState = { lines: CartLine[]; subtotalCents: number };
export type CartProduct = Pick<CartLine, 'productId' | 'name' | 'salePriceCents' | 'addons' | 'removedIngredients' | 'notes'>;

function lineTotal(line: CartLine): number {
  const addonTotal = line.addons.reduce((sum, addon) => sum + Math.round((addon.addon_item_price ?? 0) * 100) * (addon.quantity ?? 1), 0);
  return (line.salePriceCents + addonTotal) * line.quantity;
}

function createState(lines: CartLine[]): CartState {
  return { lines, subtotalCents: lines.reduce((total, line) => total + lineTotal(line), 0) };
}

function addonKey(line: Pick<CartLine, 'addons' | 'removedIngredients' | 'notes'>): string {
  return JSON.stringify([line.addons.map(a => a.addon_item_id).sort(), line.removedIngredients.slice().sort(), line.notes]);
}

export function createCartStore() {
  let state = createState([]);
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  const update = (lines: CartLine[]) => { state = createState(lines); publish(); };

  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    addProduct(product: CartProduct) {
      const existing = state.lines.find((line) => line.productId === product.productId && addonKey(line) === addonKey(product));
      update(existing
        ? state.lines.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...state.lines, { ...product, id: crypto.randomUUID(), quantity: 1 }]);
    },
    setQuantity(id: string, quantity: number) {
      const safeQuantity = Math.max(0, Math.floor(quantity));
      update(safeQuantity === 0
        ? state.lines.filter((line) => line.id !== id)
        : state.lines.map((line) => line.id === id ? { ...line, quantity: safeQuantity } : line));
    },
    removeLine(id: string) { update(state.lines.filter((line) => line.id !== id)); },
    clear() { update([]); },
  };
}
