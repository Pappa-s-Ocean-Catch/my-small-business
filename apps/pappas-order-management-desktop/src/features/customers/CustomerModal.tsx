import { type DesktopOrder } from '../orders/order-types';
import '../orders/modals.css';

type Props = {
  order: DesktopOrder | null;
  onClose: () => void;
};

export function CustomerModal({ order, onClose }: Props) {
  if (!order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-header-info">
            <h2>Customer Details</h2>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              From Order {order.order_number ?? 'Unknown'}
            </span>
          </div>
          <button className="modal-close-button" onClick={onClose}>&times;</button>
        </header>

        <div className="modal-body">
          <section className="modal-section">
            <h3>Contact Information</h3>
            <div className="customer-info">
              <span className="customer-info-name">{order.customer_name || 'In-store Customer'}</span>
              {order.customer_phone ? (
                <span className="customer-info-detail">📞 {order.customer_phone}</span>
              ) : (
                <span className="customer-info-detail">No phone number provided</span>
              )}
              {order.customer_email ? (
                <span className="customer-info-detail">✉️ {order.customer_email}</span>
              ) : (
                <span className="customer-info-detail">No email provided</span>
              )}
            </div>
          </section>

          <section className="modal-section">
            <h3>Order History</h3>
            <div className="order-items-list" style={{ color: '#6b7280', fontSize: 14 }}>
              Coming soon: View past orders for {order.customer_name || 'this customer'}
            </div>
          </section>
        </div>

        <footer className="modal-footer">
          <button className="button-primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}
