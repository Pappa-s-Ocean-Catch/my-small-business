'use client';

import { useMemo } from 'react';

export type PublicMenuScreenModel = {
  id: string;
  name: string;
  subtitle?: string | null;
  show_images: boolean;
  num_columns: number;
};

export type PublicSaleCategory = {
  id: string;
  name: string;
  parent_category_id?: string | null;
};

export type PublicSaleProduct = {
  id: string;
  name: string;
  description?: string | null;
  sale_price: number;
  image_url?: string | null;
  sale_category_id?: string | null;
  sub_category_id?: string | null;
};

export function PublicMenuRenderer({
  screen,
  categories,
  products,
  selectedCategoryIds,
  categoryColumnMap
}: {
  screen: PublicMenuScreenModel;
  categories: PublicSaleCategory[];
  products: PublicSaleProduct[];
  selectedCategoryIds: string[];
  categoryColumnMap: Record<string, { columnIndex: number; sortOrder: number }>;
}) {
  const categoryChildrenMap = useMemo(() => {
    const children: Record<string, string[]> = {};
    for (const c of categories) {
      if (c.parent_category_id) {
        const parentId = c.parent_category_id;
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(c.id);
      }
    }
    return children;
  }, [categories]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: '#ff6363' }}>{screen.name}</h1>
        {screen.subtitle && <p className="text-sm text-neutral-600">{screen.subtitle}</p>}
      </div>
      {/* Mobile: single column, full width, preserving column + sort order */}
      <div className="md:hidden space-y-6">
        {selectedCategoryIds
          .map(id => categories.find(c => c.id === id))
          .filter((c): c is PublicSaleCategory => Boolean(c))
          .sort((a,b) => {
            const ca = categoryColumnMap[a.id]?.columnIndex ?? 0;
            const cb = categoryColumnMap[b.id]?.columnIndex ?? 0;
            if (ca !== cb) return ca - cb;
            const sa = categoryColumnMap[a.id]?.sortOrder ?? 0;
            const sb = categoryColumnMap[b.id]?.sortOrder ?? 0;
            return sa - sb;
          })
          .map(cat => {
            const includeIds = new Set<string>([cat.id, ...(categoryChildrenMap[cat.id] ?? [])]);
            const items = products.filter(p => {
              const saleCatOk = p.sale_category_id ? includeIds.has(p.sale_category_id) : false;
              const subCatOk = p.sub_category_id ? includeIds.has(p.sub_category_id) : false;
              return saleCatOk || subCatOk;
            });
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="rounded-xl shadow-sm border bg-white overflow-hidden">
                <div className="px-4 py-3 font-bold text-lg" style={{ background: '#fff0e6', color: '#ff6363' }}>{cat.name}</div>
                <ul className="divide-y">
                  {items.map(item => (
                    <li key={item.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900">{item.name}</div>
                        {item.description && <div className="text-sm text-neutral-600">{item.description}</div>}
                      </div>
                      {screen?.show_images && item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                      )}
                      <div className="font-bold text-neutral-900 whitespace-nowrap">${Number(item.sale_price).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>

      {/* Desktop: multi-column grid */}
      <div className={`hidden md:grid gap-6`} style={{ gridTemplateColumns: `repeat(${screen.num_columns || 3}, minmax(0, 1fr))` }}>
        {Array.from({ length: screen.num_columns || 3 }, (_, colIdx) => (
          <div key={colIdx} className="space-y-6">
            {selectedCategoryIds
              .map(id => categories.find(c => c.id === id))
              .filter((c): c is PublicSaleCategory => Boolean(c))
              .filter(cat => (categoryColumnMap[cat.id]?.columnIndex ?? 0) === colIdx)
              .sort((a,b) => {
                const sa = categoryColumnMap[a.id]?.sortOrder ?? 0;
                const sb = categoryColumnMap[b.id]?.sortOrder ?? 0;
                return sa - sb;
              })
              .map(cat => {
                const includeIds = new Set<string>([cat.id, ...(categoryChildrenMap[cat.id] ?? [])]);
                const items = products.filter(p => {
                  const saleCatOk = p.sale_category_id ? includeIds.has(p.sale_category_id) : false;
                  const subCatOk = p.sub_category_id ? includeIds.has(p.sub_category_id) : false;
                  return saleCatOk || subCatOk;
                });
                if (items.length === 0) return null;
                return (
                  <div key={cat.id} className="rounded-xl shadow-sm border bg-white overflow-hidden">
                    <div className="px-4 py-3 font-bold text-lg" style={{ background: '#fff0e6', color: '#ff6363' }}>{cat.name}</div>
                    <ul className="divide-y">
                      {items.map(item => (
                        <li key={item.id} className="p-4 flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-neutral-900">{item.name}</div>
                            {item.description && <div className="text-sm text-neutral-600">{item.description}</div>}
                          </div>
                          {screen?.show_images && item.image_url && (
                            <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                          )}
                          <div className="font-bold text-neutral-900 whitespace-nowrap">${Number(item.sale_price).toFixed(2)}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


