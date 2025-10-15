'use client';

import PrintMenuLayoutV2 from '@/components/PrintMenuLayoutV2';
import PrintButton from '@/components/PrintButton';
import { menuPage2 } from '@/data/print-menu-data';
import '@/styles/print-menu-v2.css';
import '@/styles/print-menu.css';

function colorToClass(color?: string): string {
  switch (color) {
    case '#dc2626': return 'red';
    case '#f97316': return 'orange';
    case '#16a34a': return 'green';
    case '#059669': return 'emerald';
    case '#0ea5e9': return 'sky';
    case '#f59e0b': return 'amber';
    case '#8b5cf6': return 'violet';
    case '#e11d48': return 'rose';
    default: return 'gray';
  }
}

export default function Menu2V2() {
  // Use same column layout as v1 for consistency
  const leftColumnOrder = ['PACKS', 'SIDES', 'CHICKEN BREAST NUGGETS'];
  const rightColumnOrder = menuPage2.categories
    .map((c) => c.name)
    .filter((n) => !leftColumnOrder.includes(n));

  const leftCats = leftColumnOrder
    .map((name) => menuPage2.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage2.categories[number] => Boolean(cat));

  const rightCats = rightColumnOrder
    .map((name) => menuPage2.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage2.categories[number] => Boolean(cat));

  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV2 pageTitle="FISH & CHIPS & SIDES" subtitle="Packs • Fish • Sides">
        <div className="v2-columns">
          {/* Left Column */}
          <div className="v2-left-column">
            {leftCats.map((category) => {
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
                        <div className="v2-item-price">{item.priceRange || `$${item.price.toFixed(2)}`}</div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          
          {/* Right Column */}
          <div className="v2-right-column">
            {rightCats.map((category) => {
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
                        <div className="v2-item-price">{item.priceRange || `$${item.price.toFixed(2)}`}</div>
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


