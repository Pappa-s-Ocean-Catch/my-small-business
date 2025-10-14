'use client';

import PrintMenuLayoutV2 from '@/components/PrintMenuLayoutV2';
import PrintButton from '@/components/PrintButton';
import { menuPage3 } from '@/data/print-menu-data';
import '@/styles/print-menu-v2.css';
import '@/styles/print-menu.css';

function colorToClass(color?: string): string {
  switch (color) {
    case '#dc2626': return 'red';
    case '#f97316': return 'orange';
    case '#16a34a': return 'green';
    case '#f59e0b': return 'amber';
    case '#8b5cf6': return 'violet';
    case '#ec4899': return 'pink';
    case '#06b6d4': return 'cyan';
    case '#84cc16': return 'lime';
    default: return 'gray';
  }
}

export default function Menu3V2() {
  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV2 pageTitle={menuPage3.title} subtitle="Specials • New Items • Drinks">
        {(() => {
          // Reorder so MEAL FOR ONE appears first (left column) and rename to MEALS for display
          const mealForOneIdx = menuPage3.categories.findIndex((c) => c.name === 'MEAL FOR ONE');
          const ordered = [...menuPage3.categories];
          if (mealForOneIdx > 0) {
            const [mealCat] = ordered.splice(mealForOneIdx, 1);
            ordered.unshift(mealCat);
          }
          return (
            <div className="v2-masonry">
          {ordered.map((category) => {
            const key = colorToClass(category.color);
            return (
              <section key={category.name} className={`v2-card v2-accent-${key}`}>
                <div className={`v2-card-header v2-header-${key}`}>{category.name === 'MEAL FOR ONE' ? 'MEALS' : category.name}</div>
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
          );
        })()}
      </PrintMenuLayoutV2>
    </>
  );
}


