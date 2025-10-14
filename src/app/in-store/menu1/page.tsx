'use client';

import PrintMenuLayout from '@/components/PrintMenuLayout';
import PrintButton from '@/components/PrintButton';
import { menuPage1 } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage1() {
  return (
    <>
      <PrintButton />
      <PrintMenuLayout pageTitle={menuPage1.title}>
        <div className="menu-grid">
          {menuPage1.categories.map((category) => (
            <div key={category.name} className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : 'gray'}`}>
              <div className="category-header">
                {category.name}
              </div>
              <div className="category-items">
                {category.items.map((item, itemIndex) => (
                  <div key={itemIndex} className={`menu-item ${item.highlight ? 'highlight' : ''}`}>
                    <div className="item-info">
                      <div className="item-name">{item.name}</div>
                      {item.description && (
                        <div className="item-description">{item.description}</div>
                      )}
                    </div>
                    <div className="item-price">
                      ${item.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PrintMenuLayout>
    </>
  );
}
