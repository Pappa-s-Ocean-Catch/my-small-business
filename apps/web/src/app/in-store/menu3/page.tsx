'use client';

import PrintButton from '@/components/PrintButton';
import { inStoreCategoryLayouts, menuPage3, splitCategoriesByLayout } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage3() {
  const { leftCategories: promotionalCategories, middleCategories, rightCategories: regularCategories } = splitCategoriesByLayout(
    menuPage3,
    inStoreCategoryLayouts.menu3
  );
  const hasMiddleColumn = Boolean(middleCategories && middleCategories.length > 0);

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
          <div className={`menu3-layout ${hasMiddleColumn ? 'three-columns' : ''}`}>
            {/* Left Column - Promotional Items */}
            <div className="menu3-left-column">
              {promotionalCategories.map((category) => (
                <div key={category.name} className={`menu3-category promo-${category.color === '#dc2626' ? 'red' : category.color === '#f59e0b' ? 'amber' : category.color === '#8b5cf6' ? 'violet' : category.color === '#ec4899' ? 'pink' : category.color === '#06b6d4' ? 'cyan' : 'green'}`}>
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

            {/* Middle Column (optional) */}
            {hasMiddleColumn && (
              <div className="menu3-middle-column">
                {middleCategories!.map((category) => (
                  <div key={category.name} className={`menu3-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#f59e0b' ? 'amber' : category.color === '#8b5cf6' ? 'violet' : category.color === '#ec4899' ? 'pink' : category.color === '#06b6d4' ? 'cyan' : category.color === '#84cc16' ? 'lime' : 'gray'}`}>
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
            )}

            {/* Right Column - Regular Items */}
            <div className="menu3-right-column">
              {regularCategories.map((category) => (
                <div key={category.name} className={`menu3-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#f59e0b' ? 'amber' : category.color === '#8b5cf6' ? 'violet' : category.color === '#ec4899' ? 'pink' : category.color === '#06b6d4' ? 'cyan' : category.color === '#84cc16' ? 'lime' : 'gray'}`}>
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
