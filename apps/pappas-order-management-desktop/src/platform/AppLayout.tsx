import { useState, type ReactNode } from 'react';
import './app-layout.css';

type ViewType = 'new-order' | 'live-orders' | 'customers' | 'settings';

type Props = {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppLayout({ currentView, onNavigate, onSignOut, children }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="app-layout">
      <aside className={`app-sidebar ${isExpanded ? 'expanded' : 'compact'}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setIsExpanded(!isExpanded)} title="Toggle sidebar">
            <span className="nav-icon">☰</span>
          </button>
          <div className="brand-wrap">
            <div className="brand-logo">P</div>
            <span className="brand-name">Pappas POS</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'new-order' ? 'active' : ''}`}
            onClick={() => onNavigate('new-order')}
            title="Checkout"
          >
            <span className="nav-icon">🛒</span>
            <span className="nav-label">Checkout</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'live-orders' ? 'active' : ''}`}
            onClick={() => onNavigate('live-orders')}
            title="Live Orders"
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">Live Orders</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'customers' ? 'active' : ''}`}
            onClick={() => onNavigate('customers')}
            title="Customers"
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Customers</span>
          </button>

          <div className="nav-divider" />

          <button 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
            title="Settings"
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button className="nav-item sign-out" onClick={onSignOut} title="Sign out">
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>
      
      <main className="app-content">
        {children}
      </main>
    </div>
  );
}
