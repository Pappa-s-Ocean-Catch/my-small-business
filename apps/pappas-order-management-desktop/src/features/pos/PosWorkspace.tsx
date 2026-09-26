import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { productsForCategories } from '@my-small-business/pos-domain';
import { createCartStore } from './cart-store';
import type { CartLine, DesktopCatalogCategory, DesktopCatalogProduct, DesktopCatalogSnapshot } from './pos-types';
import type { CheckoutOutcome } from '../checkout/checkout-service';
import { PosProductDialog } from './PosProductDialog';
import './pos.css';

type Props = {
  snapshot: DesktopCatalogSnapshot;
  onRefresh: () => void;
  refreshing: boolean;
  onCheckout?: (lines: CartLine[], paymentMethod: 'cash' | 'card') => Promise<CheckoutOutcome>;
};

const money = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

function lineTotal(line: CartLine): number {
  const addonTotal = line.addons.reduce((sum, addon) => sum + Math.round((addon.addon_item_price ?? 0) * 100) * (addon.quantity ?? 1), 0);
  return (line.salePriceCents + addonTotal) * line.quantity;
}

export function PosWorkspace({ snapshot, onRefresh, refreshing, onCheckout }: Props) {
  const cart = useMemo(() => createCartStore(), []);
  const cartState = useSyncExternalStore(cart.subscribe, cart.getState, cart.getState);
  const topLevelCategories = snapshot.categories.filter((category) => !category.parent_category_id);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(topLevelCategories[0]?.id ?? null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [selectedProductForCart, setSelectedProductForCart] = useState<DesktopCatalogProduct | null>(null);

  useEffect(() => {
    if (!selectedCategoryId || !topLevelCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(topLevelCategories[0]?.id ?? null);
    }
  }, [selectedCategoryId, topLevelCategories]);

  const selectedCategory = topLevelCategories.find((category) => category.id === selectedCategoryId) ?? null;
  const childCategoryIds = selectedCategory
    ? snapshot.categories.filter((category) => category.parent_category_id === selectedCategory.id).map((category) => category.id)
    : [];
  const products = selectedCategory ? productsForCategories<DesktopCatalogProduct>(snapshot, [selectedCategory.id, ...childCategoryIds]) : snapshot.products;

  const handleProductClick = (product: DesktopCatalogProduct) => {
    const customizations = snapshot.customizations.get(product.id);
    if (customizations && (customizations.groups.length > 0 || customizations.removableIngredients.length > 0)) {
      setSelectedProductForCart(product);
    } else {
      cart.addProduct({ productId: product.id, name: product.name, salePriceCents: product.salePriceCents, addons: [], removedIngredients: [], notes: '' });
    }
  };

  return <main className="pos-shell">
    <header className="pos-header">
      <div><p className="eyebrow">PAPPAS POS</p><h1>New in-store order</h1></div>
      <div className="header-actions"><button className="button-secondary" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh menu'}</button></div>
    </header>
    <section className="pos-layout" aria-label="Point of sale workspace">
      <nav className="category-pane" aria-label="Product categories">
        <p className="pane-label">Menu</p>
        {topLevelCategories.map((category) => <button key={category.id} className={category.id === selectedCategoryId ? 'category-button selected' : 'category-button'} onClick={() => setSelectedCategoryId(category.id)}>{category.name}</button>)}
      </nav>
      <section className="menu-pane" aria-live="polite">
        <div className="pane-heading"><div><p className="pane-label">Products</p><h2>{selectedCategory?.name ?? 'All products'}</h2></div><span>{products.length} items</span></div>
        {products.length === 0 ? <div className="empty-state">No active products are available.</div> : <div className="product-grid">{products.map((product) => <button className="product-card" key={product.id} onClick={() => handleProductClick(product)}><span>{product.name}</span><strong>{money(product.salePriceCents)}</strong></button>)}</div>}
      </section>
      <aside className="cart-pane" aria-label="Current order">
        <div className="pane-heading"><div><p className="pane-label">Current order</p><h2>{cartState.lines.length ? `${cartState.lines.length} items` : 'Empty cart'}</h2></div>{cartState.lines.length > 0 && <button className="text-button" onClick={() => cart.clear()}>Clear</button>}</div>
        <div className="cart-lines">{cartState.lines.length === 0 ? <p className="empty-cart">Choose a product to start an order.</p> : cartState.lines.map((line) => <div className="cart-line" key={line.id}><div><strong>{line.name}</strong><span className="cart-secondary-price">{money(lineTotal(line) / line.quantity)} each</span>{line.addons.length > 0 && <div className="cart-secondary-price">{line.addons.map(a => `${a.addon_item_name}${a.quantity && a.quantity > 1 ? ` x${a.quantity}` : ''}`).join(', ')}</div>}{line.removedIngredients.length > 0 && <div className="cart-secondary-price" style={{ color: '#dc2626' }}>No {line.removedIngredients.join(', No ')}</div>}{line.notes && <div className="cart-secondary-price" style={{ fontStyle: 'italic' }}>Note: {line.notes}</div>}</div><div className="cart-item-price-block"><span>{money(lineTotal(line))}</span><div className="quantity-control"><button aria-label={`Decrease ${line.name}`} onClick={() => cart.setQuantity(line.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button aria-label={`Increase ${line.name}`} onClick={() => cart.setQuantity(line.id, line.quantity + 1)}>+</button></div></div></div>)}</div>
        <div className="cart-footer"><div className="total-row"><span>Total</span><strong>{money(cartState.subtotalCents)}</strong></div>{checkoutError && <p className="error" role="alert">{checkoutError}</p>}<div className="payment-actions">{(['cash', 'card'] as const).map((paymentMethod) => <button key={paymentMethod} disabled={cartState.lines.length === 0 || checkoutPending || !onCheckout} onClick={async () => { if (!onCheckout) return; setCheckoutPending(true); setCheckoutError(null); const result = await onCheckout(cartState.lines, paymentMethod); setCheckoutPending(false); if (result.kind === 'saved') cart.clear(); else setCheckoutError(result.message); }}>{checkoutPending ? 'Saving…' : paymentMethod === 'cash' ? 'Cash' : 'Card'}</button>)}</div></div>
      </aside>
    </section>
    {selectedProductForCart && (
      <PosProductDialog
        product={selectedProductForCart}
        customization={snapshot.customizations.get(selectedProductForCart.id)!}
        onClose={() => setSelectedProductForCart(null)}
        onAdd={(productData) => {
          cart.addProduct(productData);
          setSelectedProductForCart(null);
        }}
      />
    )}
  </main>;
}
