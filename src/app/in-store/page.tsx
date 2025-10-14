'use client';

import Link from 'next/link';
import { FaPrint, FaUtensils, FaFish, FaGift } from 'react-icons/fa';
import { storeInfo } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function InStoreMenuIndex() {
  const menuPages = [
    {
      id: 'menu1',
      title: 'Main Menu',
      description: 'Burgers, Fish, Souvlaki & Packs',
      icon: FaUtensils,
      href: '/in-store/menu1',
      color: 'bg-red-600'
    },
    {
      id: 'menu2', 
      title: 'Fish & Sides',
      description: 'Fresh Fish, Chips & Seafood Sides',
      icon: FaFish,
      href: '/in-store/menu2',
      color: 'bg-blue-600'
    },
    {
      id: 'menu3',
      title: 'Packs & Specials', 
      description: 'Family Packs & New Items',
      icon: FaGift,
      href: '/in-store/menu3',
      color: 'bg-green-600'
    }
  ];

  return (
    <div className="print-menu-container">
      <header className="print-menu-header">
        <div className="store-name">
          {storeInfo.name}
        </div>
        <div className="store-info">
          <div className="info-row">
            <span>{storeInfo.address}</span>
          </div>
          <div className="info-row">
            <span>{storeInfo.phone}</span>
          </div>
          <div className="info-row">
            <span>{storeInfo.hours}</span>
          </div>
        </div>
        <div className="payment-info">
          <div className="payment-badge">{storeInfo.payment}</div>
        </div>
      </header>

      <main className="print-menu-main">
        <div className="page-title">IN-STORE MENU SELECTION</div>
        
        <div className="menu-selection-grid">
          {menuPages.map((page) => {
            const IconComponent = page.icon;
            return (
              <Link key={page.id} href={page.href} className="menu-page-card">
                <div className={`card-icon ${page.color}`}>
                  <IconComponent className="icon" />
                </div>
                <div className="card-content">
                  <h3 className="card-title">{page.title}</h3>
                  <p className="card-description">{page.description}</p>
                </div>
                <div className="card-action">
                  <FaPrint className="print-icon" />
                  <span>View & Print</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="print-instructions">
          <h3>Print Instructions</h3>
          <ul>
            <li>Each menu page is designed for A0 size printing (841mm x 1189mm)</li>
            <li>Use high-quality paper for best results</li>
            <li>Ensure color printing is enabled for optimal appearance</li>
            <li>Print at 100% scale for proper sizing</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
