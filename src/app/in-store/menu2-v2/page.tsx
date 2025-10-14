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
  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV2 pageTitle="FISH & CHIPS & SIDES" subtitle="Packs • Fish • Sides">
        {(() => {
          // Make a copy and ensure CHIPS comes before SIDES to balance columns
          const ordered = [...menuPage2.categories];
          const chipsIdx = ordered.findIndex((c) => c.name === 'CHIPS');
          const sidesIdx = ordered.findIndex((c) => c.name === 'SIDES');
          if (chipsIdx !== -1 && sidesIdx !== -1 && chipsIdx > sidesIdx) {
            const tmp = ordered[chipsIdx];
            ordered[chipsIdx] = ordered[sidesIdx];
            ordered[sidesIdx] = tmp;
          }
          return (
            <div className="v2-masonry">
              {ordered.map((category) => {
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
          );
        })()}
      </PrintMenuLayoutV2>
    </>
  );
}


