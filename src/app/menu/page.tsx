'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PublicMenuRenderer, type PublicMenuScreenModel, type PublicSaleCategory, type PublicSaleProduct } from '@/components/PublicMenuRenderer';

export default function UniversalMenuPage() {
  const supabase = getSupabaseClient();
  const [screens, setScreens] = useState<PublicMenuScreenModel[]>([]);
  const [categories, setCategories] = useState<PublicSaleCategory[]>([]);
  const [products, setProducts] = useState<PublicSaleProduct[]>([]);
  const [screenCategories, setScreenCategories] = useState<Record<string, Array<{ sale_category_id: string; column_index: number; sort_order: number }>>>({});
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        // public readable per RLS
        const [{ data: screensData }, { data: catsData }, { data: prodsData }] = await Promise.all([
          supabase.from('menu_screens').select('id, name, subtitle, show_images, num_columns, is_published').order('sort_order'),
          supabase.from('sale_categories').select('id, name, parent_category_id').order('sort_order'),
          supabase.from('sale_products').select('id, name, description, sale_price, image_url, sale_category_id, sub_category_id').eq('is_active', true)
        ]);
        setScreens((screensData ?? []) as unknown as PublicMenuScreenModel[]);
        setCategories((catsData ?? []) as unknown as PublicSaleCategory[]);
        setProducts((prodsData ?? []) as unknown as PublicSaleProduct[]);
        // fetch per-screen category layout
        const layout: Record<string, Array<{ sale_category_id: string; column_index: number; sort_order: number }>> = {};
        for (const s of (screensData ?? [])) {
          const { data: rows } = await supabase
            .from('menu_screen_categories')
            .select('sale_category_id, column_index, sort_order')
            .eq('menu_screen_id', s.id)
            .order('column_index, sort_order');
          layout[s.id] = rows ?? [];
        }
        setScreenCategories(layout);
        if ((screensData ?? []).length > 0) setActiveScreenId((screensData ?? [])[0].id);
      } catch (e) {
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeScreen = useMemo(() => screens.find(s => s.id === activeScreenId) ?? null, [screens, activeScreenId]);
  const selectedCategoryIds = useMemo(() => (activeScreenId ? (screenCategories[activeScreenId] ?? []).map(r => r.sale_category_id) : []), [screenCategories, activeScreenId]);
  const categoryColumnMap = useMemo(() => {
    const map: Record<string, { columnIndex: number; sortOrder: number }> = {};
    if (!activeScreenId) return map;
    for (const r of (screenCategories[activeScreenId] ?? [])) {
      map[r.sale_category_id] = { columnIndex: r.column_index ?? 0, sortOrder: r.sort_order ?? 0 };
    }
    return map;
  }, [screenCategories, activeScreenId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl">Loading menu…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!activeScreen || screens.length === 0) return <div className="min-h-screen flex items-center justify-center">No menu available</div>;

  return (
    <div className="min-h-screen w-full" style={{ background: '#fff8f0' }}>
      <aside className="fixed left-0 top-0 h-screen w-16 md:w-20 bg-gradient-to-b from-white to-rose-50/70 backdrop-blur border-r z-20">
        <div className="h-full p-2 flex flex-col gap-2">
          {screens.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveScreenId(s.id)}
              className={`relative flex-1 min-h-12 w-full flex items-center justify-center transition-all ${activeScreenId === s.id ? 'text-rose-600' : 'text-neutral-700 hover:text-neutral-900'}`}
              title={s.name}
            >
              {activeScreenId === s.id ? (
                <div className="absolute right-0 top-0 h-full w-[3px] md:w-[4px] bg-gradient-to-b from-pink-500 to-yellow-400 rounded-l" />
              ) : null}
              <span className="block transform -rotate-90 origin-center text-xs md:text-sm font-semibold tracking-wide px-1 py-0.5 rounded">
                {s.name}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-h-screen pl-16 md:pl-20 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <PublicMenuRenderer
            screen={activeScreen}
            categories={categories}
            products={products}
            selectedCategoryIds={selectedCategoryIds}
            categoryColumnMap={categoryColumnMap}
          />
        </div>
      </main>
    </div>
  );
}


