'use client';

import PrintButton from '@/components/PrintButton';
import { getPrintMenuCategoryBlockStyle, PrintMenuCategoryTitle } from '@/components/PrintMenuCategoryVisuals';
import { inStoreCategoryLayouts, menuPage2, splitCategoriesByLayout } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage2() {
  const { leftCategories, middleCategories, rightCategories } = splitCategoriesByLayout(menuPage2, inStoreCategoryLayouts.menu2);
  const hasMiddleColumn = Boolean(middleCategories && middleCategories.length > 0);

  const categoryClass = (color?: string): string => {
    return color === '#dc2626'
      ? 'red'
      : color === '#f97316'
        ? 'orange'
        : color === '#16a34a'
          ? 'green'
          : color === '#059669'
            ? 'emerald'
            : color === '#0ea5e9'
              ? 'sky-blue'
              : color === '#f59e0b'
                ? 'amber'
                : color === '#8b5cf6'
                  ? 'violet'
                  : color === '#e11d48'
                    ? 'rose'
                    : 'gray';
  };

  const renderCategory = (category: (typeof leftCategories)[number]) => {
    const isPacks = category.name.trim().toUpperCase() === 'PACKS';
    return (
      <div
        key={category.name}
        className={`menu-category ${isPacks ? 'packs-special-card' : ''} category-${categoryClass(category.color)}`}
        style={getPrintMenuCategoryBlockStyle(category.bgImage)}
      >
        <div className="category-header">
          <PrintMenuCategoryTitle name={category.name} icon={category.icon} />
        </div>
        <div className="category-items">
          {category.items.map((item, itemIndex) => (
            <div key={itemIndex} className={`menu-item ${isPacks ? 'pack-item' : ''}`}>
              <div className="item-info">
                <div className="item-name">{item.name}</div>
                {item.description && <div className="item-description">{item.description}</div>}
              </div>
              <div className="item-price">{item.priceRange || `$${item.price.toFixed(2)}`}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <PrintButton />
      <div className="print-menu-container">
        {/* Simple Menu Header */}
        <header className="simple-menu-header">
          <h1 className="simple-title">FISH & CHIPS & SIDES</h1>
        </header>

        <main className="print-menu-main">
          <div className={`menu2-special-layout ${hasMiddleColumn ? 'three-columns' : ''}`}>
            {/* Left side - respects inStoreCategoryLayouts.menu2.left */}
            <div className="menu2-left-column">
              {leftCategories.map(renderCategory)}
            </div>

            {/* Middle side - respects inStoreCategoryLayouts.menu2.middleCollumn */}
            {hasMiddleColumn && (
              <div className="menu2-middle-column">
                {middleCategories!.map(renderCategory)}
              </div>
            )}

            {/* Right side - respects inStoreCategoryLayouts.menu2.right */}
            <div className="menu2-right-column">
              {rightCategories.map(renderCategory)}
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
