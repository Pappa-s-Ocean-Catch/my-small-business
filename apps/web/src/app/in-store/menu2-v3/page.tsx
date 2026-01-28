'use client';

import PrintMenuLayoutV3 from '@/components/PrintMenuLayoutV3';
import PrintButton from '@/components/PrintButton';
import { getPrintMenuCategoryBlockStyle, PrintMenuCategoryTitle } from '@/components/PrintMenuCategoryVisuals';
import { inStoreCategoryLayouts, menuPage2, splitCategoriesByLayout } from '@/data/print-menu-data';
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
  const { leftCategories: left, middleCategories: middle, rightCategories: right } = splitCategoriesByLayout(menuPage2, inStoreCategoryLayouts.menu2);
  const hasMiddleColumn = Boolean(middle && middle.length > 0);

  return (
    <>
      <PrintButton />
      <PrintMenuLayoutV3 pageTitle="FISH & CHIPS & SIDES" subtitle="Packs • Fish • Sides">
        <div className={`v3-columns ${hasMiddleColumn ? 'three-columns' : ''}`}>
          <div>
            {left.map((cat) => (
              <section
                key={cat.name}
                className="v3-card"
                style={{ marginBottom: '1rem', ...(getPrintMenuCategoryBlockStyle(cat.bgImage) ?? {}) }}
              >
                <div className={`v3-card-head ${head(cat.color)}`}>
                  <PrintMenuCategoryTitle name={cat.name} icon={cat.icon} />
                </div>
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

          {hasMiddleColumn && (
            <div>
              {middle!.map((cat) => (
                <section
                  key={cat.name}
                  className="v3-card"
                  style={{ marginBottom: '1rem', ...(getPrintMenuCategoryBlockStyle(cat.bgImage) ?? {}) }}
                >
                  <div className={`v3-card-head ${head(cat.color)}`}>
                    <PrintMenuCategoryTitle name={cat.name} icon={cat.icon} />
                  </div>
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
          )}

          <div>
            {right.map((cat) => (
              <section
                key={cat.name}
                className="v3-card"
                style={{ marginBottom: '1rem', ...(getPrintMenuCategoryBlockStyle(cat.bgImage) ?? {}) }}
              >
                <div className={`v3-card-head ${head(cat.color)}`}>
                  <PrintMenuCategoryTitle name={cat.name} icon={cat.icon} />
                </div>
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


