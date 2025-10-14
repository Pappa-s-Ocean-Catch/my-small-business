'use client';

import PrintMenuLayout from '@/components/PrintMenuLayout';
import PrintButton from '@/components/PrintButton';
import { menuPage1 } from '@/data/print-menu-data';
import '@/styles/print-menu.css';

export default function MenuPage1() {
  // Separate categories for left and right columns with explicit ordering
  const leftColumnOrder = ['BEEF BURGERS', 'SOUVLAKI'];
  const rightColumnOrder = ['CHICKEN BURGERS', 'FISH BURGERS', 'VEGETARIAN BURGERS', 'STEAK SANDWICHES', 'MAKE A COMBO'];

  const leftColumnCategories = leftColumnOrder
    .map((name) => menuPage1.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage1.categories[number] => Boolean(cat));

  const rightColumnCategories = rightColumnOrder
    .map((name) => menuPage1.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage1.categories[number] => Boolean(cat));

  return (
    <>
      <PrintButton />
      <PrintMenuLayout pageTitle={menuPage1.title}>
        <div className="menu1-custom-layout">
          {/* Left Column */}
          <div className="menu1-left-column">
            {leftColumnCategories.map((category) => (
              <div key={category.name} className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#7c2d12' ? 'brown' : category.color === '#0891b2' ? 'cyan' : category.color === '#be185d' ? 'pink' : 'gray'}`}>
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

          {/* Right Column */}
          <div className="menu1-right-column">
            {rightColumnCategories.map((category) => (
              <div key={category.name} className={`menu-category category-${category.color === '#dc2626' ? 'red' : category.color === '#f97316' ? 'orange' : category.color === '#16a34a' ? 'green' : category.color === '#7c2d12' ? 'brown' : category.color === '#0891b2' ? 'cyan' : category.color === '#be185d' ? 'pink' : 'gray'}`}>
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
        </div>
      </PrintMenuLayout>
    </>
  );
}
