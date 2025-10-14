'use client';

import PrintButton from '@/components/PrintButton';
import { menuPage3 } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage3() {
  // Separate promotional items from regular items
  const promotionalCategories = menuPage3.categories.filter(cat => 
    ['NEW ITEMS', 'CHIPS & GRAVY', 'TUBS', 'MEAL FOR ONE'].includes(cat.name)
  );
  const regularCategories = menuPage3.categories.filter(cat => 
    !['NEW ITEMS', 'CHIPS & GRAVY', 'TUBS', 'MEAL FOR ONE'].includes(cat.name)
  );

  return (
    <>
      <PrintButton />
      <div className="menu3-clean-container">
        {/* Clean Header */}
              <header className="menu3-header">
                <h1 className="menu3-title">🔥 SPECIALS & NEW ITEMS 🔥</h1>
                <p className="menu3-subtitle">Fresh & Delicious</p>
              </header>

        <main className="menu3-main">
          <div className="menu3-layout">
            {/* Left Column - Promotional Items */}
            <div className="menu3-left-column">
              {promotionalCategories.map((category) => (
                <div key={category.name} className={`menu3-category promo-${category.color === '#dc2626' ? 'red' : 'green'}`}>
                  <div className="menu3-category-header">
                    <h2 className="menu3-category-title">{category.name}</h2>
                    {category.name === 'NEW ITEMS' && <span className="new-badge">NEW!</span>}
                  </div>
                  <div className="menu3-items">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className={`menu3-item ${item.highlight ? 'highlighted' : ''}`}>
                        <div className="menu3-item-content">
                          <div className="menu3-item-name">{item.name}</div>
                          {item.description && (
                            <div className="menu3-item-desc">{item.description}</div>
                          )}
                        </div>
                        <div className="menu3-item-price">
                          ${item.price.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column - Regular Items */}
            <div className="menu3-right-column">
              {regularCategories.map((category) => (
                <div key={category.name} className={`menu3-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : 'gray'}`}>
                  <div className="menu3-category-header">
                    <h2 className="menu3-category-title">{category.name}</h2>
                  </div>
                  <div className="menu3-items">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="menu3-item">
                        <div className="menu3-item-content">
                          <div className="menu3-item-name">{item.name}</div>
                          {item.description && (
                            <div className="menu3-item-desc">{item.description}</div>
                          )}
                        </div>
                        <div className="menu3-item-price">
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

        <footer className="menu3-footer">
          <div className="menu3-footer-content">
            <p>🎉 Try our new items today! 🎉</p>
            <p>Phone Orders: 9743 8150 • 87 Unitt St, Melton VIC 3337</p>
          </div>
        </footer>
      </div>
    </>
  );
}
