'use client';

import PrintMenuLayoutV3 from '@/components/PrintMenuLayoutV3';
import PrintButton from '@/components/PrintButton';
import { menuPage1 } from '@/data/print-menu-data';
import '@/styles/print-menu-v3.css';
import '@/styles/print-menu.css';

function colorHeadClass(color?: string): string {
  switch (color) {
    case '#dc2626': return 'amber'; // red -> warm header
    case '#f97316': return 'amber';
    case '#16a34a': return 'green';
    case '#7c2d12': return 'amber';
    case '#0891b2': return 'blue';
    case '#be185d': return 'violet';
    default: return 'blue';
  }
}

export default function Menu1V3() {
  // Split into two portrait columns intentionally
  const leftNames = ['BEEF BURGERS', 'CHICKEN BURGERS', 'FISH BURGERS'];
  const rightNames = menuPage1.categories
    .map((c) => c.name)
    .filter((n) => !leftNames.includes(n));

  const leftCats = leftNames
    .map((n) => menuPage1.categories.find((c) => c.name === n)!)
    .filter(Boolean);
  const rightCats = rightNames
    .map((n) => menuPage1.categories.find((c) => c.name === n)!)
    .filter(Boolean);

  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV3 pageTitle={menuPage1.title} subtitle="Burgers • Souvlaki • Sandwiches">
        <div className="v3-columns">
          <div>
            {leftCats.map((cat) => (
              <section key={cat.name} className="v3-card" style={{ marginBottom: '1rem' }}>
                <div className={`v3-card-head ${colorHeadClass(cat.color)}`}>{cat.name}</div>
                <div className="v3-card-body">
                  {cat.items.map((it, i) => (
                    <div key={i} className="v3-row">
                      <div>
                        <div className="v3-name">{it.name}</div>
                        {it.description && <div className="v3-desc">{it.description}</div>}
                      </div>
                      <div className="v3-price">${it.price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div>
            {rightCats.map((cat) => (
              <section key={cat.name} className="v3-card" style={{ marginBottom: '1rem' }}>
                <div className={`v3-card-head ${colorHeadClass(cat.color)}`}>{cat.name}</div>
                <div className="v3-card-body">
                  {cat.items.map((it, i) => (
                    <div key={i} className="v3-row">
                      <div>
                        <div className="v3-name">{it.name}</div>
                        {it.description && <div className="v3-desc">{it.description}</div>}
                      </div>
                      <div className="v3-price">${it.price.toFixed(2)}</div>
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


