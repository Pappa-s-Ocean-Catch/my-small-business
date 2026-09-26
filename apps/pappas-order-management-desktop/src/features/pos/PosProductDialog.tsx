import { useState } from 'react';
import type { DesktopCatalogProduct, CustomizationData, OrderItemAddon, CartLine } from './pos-types';

type Props = {
  product: DesktopCatalogProduct;
  customization: CustomizationData;
  onClose: () => void;
  onAdd: (product: Pick<CartLine, 'productId' | 'name' | 'salePriceCents' | 'addons' | 'removedIngredients' | 'notes'>) => void;
};

const money = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function PosProductDialog({ product, customization, onClose, onAdd }: Props) {
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const toggleAddon = (itemId: string, maxQuantity = 1) => {
    setAddons(prev => {
      const current = prev[itemId] || 0;
      if (current >= maxQuantity) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: current + 1 };
    });
  };

  const toggleRemoved = (ingredient: string) => {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(ingredient)) next.delete(ingredient);
      else next.add(ingredient);
      return next;
    });
  };

  const addonTotalCents = Object.entries(addons).reduce((total, [itemId, quantity]) => {
    const item = customization.groups.flatMap(g => g.items).find(i => i.id === itemId);
    return total + (item ? Math.round(item.extra_price * 100) * quantity : 0);
  }, 0);

  const totalCents = product.salePriceCents + addonTotalCents;

  const handleAdd = () => {
    const formattedAddons: OrderItemAddon[] = Object.entries(addons).flatMap(([itemId, quantity]) => {
      const item = customization.groups.flatMap(g => g.items).find(i => i.id === itemId);
      if (!item) return [];
      return [{
        addon_item_id: item.id,
        addon_item_name: item.name,
        addon_item_price: item.extra_price,
        quantity,
      }];
    });

    onAdd({
      productId: product.id,
      name: product.name,
      salePriceCents: product.salePriceCents,
      addons: formattedAddons,
      removedIngredients: Array.from(removed),
      notes,
    });
  };

  return (
    <div className="pos-dialog-backdrop">
      <div className="pos-dialog" role="dialog" aria-modal="true">
        <header className="dialog-header">
          <h2>{product.name}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="dialog-body">
          {customization.groups.map(group => (
            <section key={group.id} className="addon-group">
              <h3>{group.name} {group.is_required && <span className="required-badge">Required</span>}</h3>
              <div className="addon-grid">
                {group.items.map(item => {
                  const quantity = addons[item.id] || 0;
                  return (
                    <button
                      key={item.id}
                      className={`addon-button ${quantity > 0 ? 'selected' : ''}`}
                      onClick={() => toggleAddon(item.id, group.multiple_choice ? 99 : 1)}
                    >
                      <span className="addon-name">{item.name} {quantity > 1 ? `x${quantity}` : ''}</span>
                      {item.extra_price > 0 && <span className="addon-price">+{money(item.extra_price * 100)}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {customization.removableIngredients.length > 0 && (
            <section className="addon-group removable">
              <h3>Remove Ingredients</h3>
              <div className="addon-grid">
                {customization.removableIngredients.map(ing => (
                  <button
                    key={ing.id}
                    className={`addon-button ${removed.has(ing.ingredient_name) ? 'removed' : ''}`}
                    onClick={() => toggleRemoved(ing.ingredient_name)}
                  >
                    <span className="addon-name">{ing.ingredient_name}</span>
                    {removed.has(ing.ingredient_name) && <span className="addon-price">Removed</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="addon-group">
            <h3>Special Instructions</h3>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Any special requests?" 
              className="notes-input"
            />
          </section>
        </div>
        <footer className="dialog-footer">
          <button className="button-secondary" onClick={onClose}>Cancel</button>
          <button className="button-primary" onClick={handleAdd}>
            Add to Order — {money(totalCents)}
          </button>
        </footer>
      </div>
    </div>
  );
}
