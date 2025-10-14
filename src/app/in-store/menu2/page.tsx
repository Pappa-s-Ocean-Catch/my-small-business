'use client';

import PrintMenuLayout from '@/components/PrintMenuLayout';
import PrintButton from '@/components/PrintButton';
import { menuPage2 } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage2() {
  // Separate PACKS and SIDES categories for left side, others for right side
  const packsCategory = menuPage2.categories.find(cat => cat.name === 'PACKS');
  const sidesCategory = menuPage2.categories.find(cat => cat.name === 'SIDES');
  const otherCategories = menuPage2.categories.filter(cat => cat.name !== 'PACKS' && cat.name !== 'SIDES');

  return (
    <>
      <PrintButton />
      <div className="print-menu-container">
              {/* Simple Menu Header */}
              <header className="simple-menu-header">
                <h1 className="simple-title">FISH & CHIPS & SIDES</h1>
              </header>
        
        <main className="print-menu-main">
          <div className="menu2-special-layout">
            {/* Left side - PACKS and SIDES categories (60% width) */}
            <div className="menu2-left-column">
              {packsCategory && (
                <div className={`menu-category packs-special-card category-${packsCategory.color === '#dc2626' ? 'red' : 'gray'}`}>
                  <div className="category-header">
                    {packsCategory.name}
                  </div>
                  <div className="category-items">
                    {packsCategory.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="menu-item pack-item">
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
              )}
              
              {sidesCategory && (
                <div className={`menu-category category-${sidesCategory.color === '#dc2626' ? 'red' : sidesCategory.color === '#f97316' ? 'orange' : sidesCategory.color === '#16a34a' ? 'green' : 'gray'}`}>
                  <div className="category-header">
                    {sidesCategory.name}
                  </div>
                  <div className="category-items">
                    {sidesCategory.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="menu-item">
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
              )}
            </div>
            
            {/* Right side - Other categories (40% width) */}
            <div className="menu2-right-column">
              {otherCategories.map((category) => (
                <div key={category.name} className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : 'gray'}`}>
                  <div className="category-header">
                    {category.name}
                  </div>
                  <div className="category-items">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="menu-item">
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
          </div>
        </main>
        
        <footer className="print-menu-footer">
          <div className="footer-content">
            EFTPOS AVAILABLE • DINE IN AVAILABLE
          </div>
        </footer>
      </div>
    </>
  );
}
