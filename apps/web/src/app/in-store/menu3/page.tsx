'use client';

import PrintMenuLayout from '@/components/PrintMenuLayout';
import PrintButton from '@/components/PrintButton';
import { getPrintMenuCategoryBlockStyle, PrintMenuCategoryTitle } from '@/components/PrintMenuCategoryVisuals';
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
      <PrintMenuLayout pageTitle={menuPage3.title}>
        <div className={`menu3-layout ${hasMiddleColumn ? 'three-columns' : ''}`}>
          {/* Left Column - Promotional Items */}
          <div className="menu1-left-column">
            {promotionalCategories.map((category) => (
              <div
                key={category.name}
                className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#7c2d12' ? 'brown' : category.color === '#0891b2' ? 'cyan' : category.color === '#be185d' ? 'pink' : 'gray'}`}
                style={getPrintMenuCategoryBlockStyle(category.bgImage)}
              >
                {!category.visualOnly && (
                  <>
                    <div className="category-header">
                      <PrintMenuCategoryTitle name={category.name} icon={category.icon} />
                      {category.name === 'NEW ITEMS' && <span className="new-badge">NEW!</span>}
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
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Middle Column (optional) */}
          {hasMiddleColumn && (
            <div className="menu1-middle-column">
              {middleCategories!.map((category) => (
                <div
                  key={category.name}
                  className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#7c2d12' ? 'brown' : category.color === '#0891b2' ? 'cyan' : category.color === '#be185d' ? 'pink' : 'gray'}`}
                  style={getPrintMenuCategoryBlockStyle(category.bgImage)}
                >
                  {!category.visualOnly && (
                    <>
                      <div className="category-header">
                        <PrintMenuCategoryTitle name={category.name} icon={category.icon} />
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
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Right Column - Regular Items */}
          <div className="menu1-right-column">
            {regularCategories.map((category) => (
              <div
                key={category.name}
                className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#7c2d12' ? 'brown' : category.color === '#0891b2' ? 'cyan' : category.color === '#be185d' ? 'pink' : 'gray'}`}
                style={getPrintMenuCategoryBlockStyle(category.bgImage)}
              >
                {!category.visualOnly && (
                  <>
                    <div className="category-header">
                      <PrintMenuCategoryTitle name={category.name} icon={category.icon} />
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </PrintMenuLayout>
    </>
  );
}
