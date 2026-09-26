import { type DesktopOrder } from './order-types';
import './modals.css';

type Props = {
  order: DesktopOrder | null;
  onClose: () => void;
  onCustomerPress: (order: DesktopOrder) => void;
};

export function OrderDetailModal({ order, onClose, onCustomerPress }: Props) {
  if (!order) return null;

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-header-info">
            <h2>Order {order.order_number ?? 'Unknown'}</h2>
            <div className="modal-badges">
              <span className={`status-badge ${order.order_status}`}>{order.order_status}</span>
              <span className={`payment-badge ${order.payment_status}`}>{order.payment_status}</span>
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {new Date(order.created_at).toLocaleString()}
            </span>
          </div>
          <button className="modal-close-button" onClick={onClose}>&times;</button>
        </header>

        <div className="modal-body">
          <section className="modal-section" style={{ cursor: 'pointer' }} onClick={() => onCustomerPress(order)}>
            <h3>Customer Info &rarr;</h3>
            <div className="customer-info">
              <span className="customer-info-name">{order.customer_name || 'In-store'}</span>
              {order.customer_phone && <span className="customer-info-detail">{order.customer_phone}</span>}
              {order.customer_email && <span className="customer-info-detail">{order.customer_email}</span>}
            </div>
          </section>

          <section className="modal-section">
            <h3>Items ({totalItems})</h3>
            <div className="order-items-list">
              {order.items.map((item, index) => (
                <div key={index} className="order-item-row">
                  <div>
                    <div className="item-quantity-name">{item.quantity}x {item.product_name}</div>
                    {item.comment && <div className="item-comment">Note: {item.comment}</div>}
                    {item.removed_ingredients?.map((ing, i) => (
                      <div key={i} className="item-removed">No {ing}</div>
                    ))}
                    {item.addons?.map((addon, i) => (
                      <div key={i} className="item-addons">+ {addon.addon_item_name} (+${addon.addon_item_price.toFixed(2)})</div>
                    ))}
                  </div>
                  <div className="item-price">${item.subtotal.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="modal-section">
            <h3>Totals</h3>
            <div className="totals-grid">
              <div className="total-row">
                <span>Subtotal</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              {order.tax > 0 && (
                <div className="total-row">
                  <span>Tax</span>
                  <span>${order.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row grand-total">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="modal-footer">
          <button className="button-cancel" onClick={onClose}>Close</button>
          <button className="button-primary" onClick={() => window.alert('Print feature coming soon')}>Print Receipt</button>
        </footer>
      </div>
    </div>
  );
}
