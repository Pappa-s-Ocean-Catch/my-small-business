'use client';

import PrintMenuLayoutV2 from '@/components/PrintMenuLayoutV2';
import PrintButton from '@/components/PrintButton';
import { menuPage1 } from '@/data/print-menu-data';
import '@/styles/print-menu-v2.css';
import '@/styles/print-menu.css';

function colorToClass(color?: string): string {
  switch (color) {
    case '#dc2626': return 'red';
    case '#f97316': return 'orange';
    case '#16a34a': return 'green';
    case '#7c2d12': return 'brown';
    case '#0891b2': return 'cyan';
    case '#be185d': return 'pink';
    default: return 'gray';
  }
}

export default function Menu1V2() {
  // Use same column layout as v1 for consistency
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
      <PrintMenuLayoutV2 pageTitle={menuPage1.title} subtitle="Signature Burgers & Souvlaki">
        <div className="v2-columns">
          {/* Left Column */}
          <div className="v2-left-column">
            {leftColumnCategories.map((category) => {
              const key = colorToClass(category.color);
              return (
                <section key={category.name} className={`v2-card v2-accent-${key}`}>
                  <div className={`v2-card-header v2-header-${key}`}>{category.name}</div>
                  <div className="v2-card-body">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="v2-item">
                        <div>
                          <div className="v2-item-name">{item.name}</div>
                          {item.description && <div className="v2-item-desc">{item.description}</div>}
                        </div>
                        <div className="v2-item-price">${item.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          
          {/* Right Column */}
          <div className="v2-right-column">
            {rightColumnCategories.map((category) => {
              const key = colorToClass(category.color);
              return (
                <section key={category.name} className={`v2-card v2-accent-${key}`}>
                  <div className={`v2-card-header v2-header-${key}`}>{category.name}</div>
                  <div className="v2-card-body">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="v2-item">
                        <div>
                          <div className="v2-item-name">{item.name}</div>
                          {item.description && <div className="v2-item-desc">{item.description}</div>}
                        </div>
                        <div className="v2-item-price">${item.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </PrintMenuLayoutV2>
    </>
  );
}


