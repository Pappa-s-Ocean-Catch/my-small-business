'use client';

import PrintMenuLayoutV3 from '@/components/PrintMenuLayoutV3';
import PrintButton from '@/components/PrintButton';
import { menuPage3 } from '@/data/print-menu-data';
import '@/styles/print-menu-v3.css';
import '@/styles/print-menu.css';

export default function Menu3V3() {
  // Order MEAL FOR ONE first and show as MEALS
  const mealIdx = menuPage3.categories.findIndex((c) => c.name === 'MEAL FOR ONE');
  const ordered = [...menuPage3.categories];
  if (mealIdx > 0) {
    const [meal] = ordered.splice(mealIdx, 1);
    ordered.unshift(meal);
  }

  // Distribute for requested order: Left top -> NEW ITEMS, TUBS, then MEALS, CHIPS & GRAVY; Right -> remaining
  const leftOrder = ['NEW ITEMS', 'TUBS', 'DRINKS', 'MEAL FOR ONE'];
  const leftCats = leftOrder
    .map((name) => ordered.find((c) => c.name === name))
    .filter((c): c is typeof ordered[number] => Boolean(c));
  const rightCats = ordered.filter((c) => !leftOrder.includes(c.name));

  const headClass = (name: string) =>
    name === 'NEW ITEMS' ? 'amber' :
    name === 'CHIPS & GRAVY' ? 'violet' :
    name === 'TUBS' ? 'green' :
    name === 'DRINKS' ? 'green' :
    'amber';

  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV3 pageTitle={menuPage3.title} subtitle="Specials • New Items • Drinks">
        <div className="v3-columns">
          <div>
            {leftCats.map((cat) => (
              <section key={cat.name} className="v3-card" style={{ marginBottom: '1rem' }}>
                <div className={`v3-card-head ${cat.name === 'MEAL FOR ONE' ? 'blue' : headClass(cat.name)}`}>{cat.name === 'MEAL FOR ONE' ? 'MEALS' : cat.name}</div>
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
                <div className={`v3-card-head ${headClass(cat.name)}`}>{cat.name}</div>
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


