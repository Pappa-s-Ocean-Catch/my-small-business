'use client';

import PrintMenuLayoutV3 from '@/components/PrintMenuLayoutV3';
import PrintButton from '@/components/PrintButton';
import { menuPage2 } from '@/data/print-menu-data';
import '@/styles/print-menu-v3.css';
import '@/styles/print-menu.css';

function head(color?: string): string {
  switch (color) {
    case '#dc2626': return 'amber';
    case '#f97316': return 'amber';
    case '#16a34a': return 'green';
    case '#059669': return 'green';
    case '#0ea5e9': return 'blue';
    case '#f59e0b': return 'amber';
    case '#8b5cf6': return 'violet';
    case '#e11d48': return 'violet';
    default: return 'blue';
  }
}

export default function Menu2V3() {
  // Use same column layout as v1 for consistency
  const leftColumnOrder = ['PACKS', 'SIDES', 'CHICKEN BREAST NUGGETS'];
  const rightColumnOrder = menuPage2.categories
    .map((c) => c.name)
    .filter((n) => !leftColumnOrder.includes(n));

  const left = leftColumnOrder
    .map((name) => menuPage2.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage2.categories[number] => Boolean(cat));

  const right = rightColumnOrder
    .map((name) => menuPage2.categories.find((cat) => cat.name === name))
    .filter((cat): cat is typeof menuPage2.categories[number] => Boolean(cat));

  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV3 pageTitle="FISH & CHIPS & SIDES" subtitle="Packs • Fish • Sides">
        <div className="v3-columns">
          <div>
            {left.map((cat) => (
              <section key={cat.name} className="v3-card" style={{ marginBottom: '1rem' }}>
                <div className={`v3-card-head ${head(cat.color)}`}>{cat.name}</div>
                <div className="v3-card-body">
                  {cat.items.map((it, i) => (
                    <div key={i} className="v3-row">
                      <div>
                        <div className="v3-name">{it.name}</div>
                        {it.description && <div className="v3-desc">{it.description}</div>}
                      </div>
                      <div className="v3-price">{it.priceRange || `$${it.price.toFixed(2)}`}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div>
            {right.map((cat) => (
              <section key={cat.name} className="v3-card" style={{ marginBottom: '1rem' }}>
                <div className={`v3-card-head ${head(cat.color)}`}>{cat.name}</div>
                <div className="v3-card-body">
                  {cat.items.map((it, i) => (
                    <div key={i} className="v3-row">
                      <div>
                        <div className="v3-name">{it.name}</div>
                        {it.description && <div className="v3-desc">{it.description}</div>}
                      </div>
                      <div className="v3-price">{it.priceRange || `$${it.price.toFixed(2)}`}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </PrintMenuLayoutV3>
    </>
  );
}


