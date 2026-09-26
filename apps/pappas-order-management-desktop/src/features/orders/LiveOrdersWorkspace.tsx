import { useEffect, useState } from 'react';
import type { LiveOrdersState } from './live-orders-store';
import { getAppSettings } from '../settings/SettingsWorkspace';
import { isDesktopLiveOrder } from './live-order-eligibility';
import { OrderDetailModal } from './OrderDetailModal';
import { CustomerModal } from '../customers/CustomerModal';
import { type DesktopOrder } from './order-types';
import './live-orders.css';

type Tab = 'live' | 'on-the-way' | 'completed';

export function LiveOrdersWorkspace({ store }: { store: { getState(): LiveOrdersState; subscribe(listener: (state: LiveOrdersState) => void): () => void; refresh(reason: 'startup' | 'manual' | 'realtime'): Promise<void> } }) {
  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [selectedOrder, setSelectedOrder] = useState<DesktopOrder | null>(null);
  const [selectedCustomerOrder, setSelectedCustomerOrder] = useState<DesktopOrder | null>(null);
  const settings = getAppSettings();
  
  useEffect(() => store.subscribe(setState), [store]);
  useEffect(() => { void store.refresh('startup').catch(() => undefined); }, [store]);

  const filteredOrders = state.orders.filter(order => {
    if (activeTab === 'completed') return order.order_status === 'completed' || order.order_status === 'cancelled';
    if (activeTab === 'on-the-way') return order.order_status === 'on_the_way';
    // Live orders
    return isDesktopLiveOrder(order);
  });

  return (
    <main className="pos-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header className="pos-header">
        <div>
          <p className="eyebrow">PAPPAS POS</p>
          <h1>Orders</h1>
        </div>
        <div className="header-actions">
          <button className="button-secondary" onClick={() => { void store.refresh('manual').catch(() => undefined); }}>
            Refresh
          </button>
        </div>
      </header>
      
      <div className="tabs-container">
        <button className={`tab-button ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Orders</button>
        <button className={`tab-button ${activeTab === 'on-the-way' ? 'active' : ''}`} onClick={() => setActiveTab('on-the-way')}>On the way</button>
        <button className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completed</button>
      </div>

      <section className="orders-content" aria-live="polite">
        {state.status === 'loading' && <p className="empty-state">Loading Orders…</p>}
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.status !== 'loading' && filteredOrders.length === 0 && <p className="empty-state">No {activeTab} orders right now.</p>}
        
        <div className={`orders-grid layout-${settings.liveOrderCardLayout} cards-${settings.liveOrderCardsPerScreen}`}>
          {filteredOrders.map((order) => (
            <article 
              className={`order-card layout-${settings.liveOrderCardLayout}`} 
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              style={{ cursor: 'pointer' }}
            >
              <div className="order-card-header">
                <strong>{order.order_number ?? 'Order'}</strong>
                <span className={`status-badge ${order.order_status}`}>{order.order_status}</span>
              </div>
              <div className="order-card-body">
                <span className="customer-name">{order.customer_name ?? 'In-store'}</span>
                <span className="order-type">{order.order_type}</span>
              </div>
              <div className="order-card-footer">
                <span className={`payment-badge ${order.payment_status}`}>{order.payment_status}</span>
                <strong>${order.total.toFixed(2)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedOrder && (
        <OrderDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onCustomerPress={(order) => setSelectedCustomerOrder(order)}
        />
      )}

      {selectedCustomerOrder && (
        <CustomerModal 
          order={selectedCustomerOrder}
          onClose={() => setSelectedCustomerOrder(null)}
        />
      )}
    </main>
  );
}
