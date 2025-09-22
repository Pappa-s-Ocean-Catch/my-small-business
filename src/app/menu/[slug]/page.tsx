'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMenuScreenBySlug, getMenuScreenWithCategories } from '@/app/actions/menu-screens';
import { getSaleCategories, getSaleProducts, type SaleCategory, type SaleProductWithDetails } from '@/app/actions/sale-products';
import { FaExpand, FaCompress } from 'react-icons/fa';

export default function PublicMenuScreenPage() {
  const params = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<{ id: string; name: string; subtitle?: string | null; show_images: boolean; num_columns: number } | null>(null);
  const [categories, setCategories] = useState<SaleCategory[]>([]);
  const [products, setProducts] = useState<SaleProductWithDetails[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryColumnMap, setCategoryColumnMap] = useState<Record<string, { columnIndex: number; sortOrder: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        if (!document.fullscreenElement) {
          try {
            await document.documentElement.requestFullscreen();
          } catch {}
        }
      }, 60_000);
    };

    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'touchstart'];
    const options: AddEventListenerOptions = { passive: true };
    events.forEach(evt => window.addEventListener(evt, resetTimer, options));
    resetTimer();
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    void loadData();
    async function loadData() {
      try {
        setLoading(true);
        const slug = params?.slug;
        if (!slug) { setError('Missing menu'); return; }
        const [screenRes, catsRes, productsRes, detailsRes] = await Promise.all([
          getMenuScreenBySlug(slug),
          getSaleCategories(),
          getSaleProducts(),
          // We'll fetch selected categories for this screen
          (async (): Promise<{ data: { screen: { id: string }; categories: Array<{ sale_category_id: string; sort_order: number }> } | null; error?: string | null }> => {
            const bySlug = await getMenuScreenBySlug(slug);
            if (bySlug.error || !bySlug.data) return { data: null };
            return await getMenuScreenWithCategories(bySlug.data.id);
          })()
        ]);
        if (screenRes.error || !screenRes.data) { setError(screenRes.error ?? 'Menu not found'); return; }
        setScreen({ id: screenRes.data.id, name: screenRes.data.name, subtitle: screenRes.data.subtitle ?? null, show_images: Boolean(screenRes.data.show_images), num_columns: Number(screenRes.data.num_columns || 3) });
        if (catsRes.error || !catsRes.data) { setError(catsRes.error ?? 'Failed to load categories'); return; }
        setCategories(catsRes.data.filter(c => c.is_active !== false));
        if (productsRes.error || !productsRes.data) { setError(productsRes.error ?? 'Failed to load products'); return; }
        setProducts(productsRes.data.filter(p => p.is_active !== false));
        if (!detailsRes.error && detailsRes.data) {
          const catsDetailed = detailsRes.data.categories as Array<{ sale_category_id: string; sort_order: number; column_index: number }>;
          const sorted = catsDetailed
            .slice()
            .sort((a,b)=> a.column_index - b.column_index || a.sort_order - b.sort_order);
          const ids = sorted.map(c=>c.sale_category_id);
          setSelectedCategoryIds(ids);
          const cmap: Record<string, { columnIndex: number; sortOrder: number }> = {};
          for (const c of catsDetailed) {
            cmap[c.sale_category_id] = { columnIndex: Number(c.column_index ?? 0), sortOrder: Number(c.sort_order ?? 0) };
          }
          setCategoryColumnMap(cmap);
        }
      } catch (e) {
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    }
  }, [params?.slug]);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xl">Loading menu...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!screen) return null;

  return (
    <div className="min-h-screen w-full p-6" style={{ background: '#fff8f0' }}>
      <div className="max-w-7xl mx-auto">
        <button
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={async () => {
            try {
              if (document.fullscreenElement) {
                await document.exitFullscreen();
              } else {
                await document.documentElement.requestFullscreen();
              }
            } catch (e) {
              // noop
            }
          }}
          className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center w-14 h-14 rounded-lg bg-transparent text-neutral-800/80 hover:text-neutral-900 hover:bg-neutral-900/5 backdrop-blur transition-colors"
        >
          {isFullscreen ? <FaCompress className="w-7 h-7" /> : <FaExpand className="w-7 h-7" />}
        </button>
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: '#ff6363' }}>{screen.name}</h1>
          {screen.subtitle && <p className="text-sm text-neutral-600">{screen.subtitle}</p>}
        </div>
        <div className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${screen.num_columns || 3}, minmax(0, 1fr))` }}>
          {Array.from({ length: screen.num_columns || 3 }, (_, colIdx) => (
            <div key={colIdx} className="space-y-6">
              {selectedCategoryIds
                .map(id => categories.find(c => c.id === id))
                .filter((c): c is SaleCategory => Boolean(c))
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
                    const subCatOk = (p as unknown as { sub_category_id?: string }).sub_category_id ? includeIds.has((p as unknown as { sub_category_id?: string }).sub_category_id as string) : false;
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
    </div>
  );
}


