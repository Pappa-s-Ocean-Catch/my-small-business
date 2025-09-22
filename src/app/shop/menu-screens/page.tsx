'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FaPlus, FaSave, FaTrash, FaGripVertical, FaEye, FaEyeSlash, FaExternalLinkAlt } from 'react-icons/fa';
import { 
  listMenuScreens,
  createMenuScreen,
  updateMenuScreen,
  deleteMenuScreen,
  getMenuScreenWithCategories,
  replaceMenuScreenCategories,
  getMenuScreenCategoryUsageCounts,
  type MenuScreen
} from '@/app/actions/menu-screens';
import { getSaleCategories, type SaleCategory } from '@/app/actions/sale-products';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

type ScreenWithCats = {
  screen: MenuScreen;
  categories: Array<{ id: string; sale_category_id: string; sort_order: number; column_index?: number }>;
};

export default function MenuScreensBuilderPage() {
  const [screens, setScreens] = useState<MenuScreen[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<ScreenWithCats | null>(null);
  const [saleCategories, setSaleCategories] = useState<SaleCategory[]>([]);
  const [availableCategories, setAvailableCategories] = useState<SaleCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [showImages, setShowImages] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);
  const [numColumns, setNumColumns] = useState<number>(3);
  const [columnAssignments, setColumnAssignments] = useState<Record<string, number>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ open: boolean; id: string | null; name: string }>(
    { open: false, id: null, name: '' }
  );

  useEffect(() => {
    void loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [screensRes, catsRes, usageRes] = await Promise.all([
        listMenuScreens(),
        getSaleCategories(),
        getMenuScreenCategoryUsageCounts()
      ]);
      if (screensRes.error) { setError(screensRes.error); return; }
      if (catsRes.error) { setError(catsRes.error); return; }
      if (usageRes.error) { setError(usageRes.error); return; }
      setScreens(screensRes.data ?? []);
      const cats = (catsRes.data ?? []).filter(c => c.is_active !== false);
      setSaleCategories(cats);
      setAvailableCategories(cats);
      setUsageCounts(usageRes.data ?? {});
      if ((screensRes.data ?? []).length > 0) {
        void selectScreen((screensRes.data ?? [])[0].id);
      }
    } catch (e) {
      setError('Failed to load menu screens');
    } finally {
      setLoading(false);
    }
  };

  const selectScreen = async (id: string) => {
    const details = await getMenuScreenWithCategories(id);
    if (details.error || !details.data) { setError(details.error ?? 'Failed to fetch screen'); return; }
    const orderedIds = details.data.categories
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.sale_category_id);
    setSelectedScreen({
      screen: details.data.screen,
      categories: details.data.categories.map(c => ({ id: c.id, sale_category_id: c.sale_category_id, sort_order: c.sort_order, column_index: (c as unknown as { column_index?: number }).column_index }))
    });
    setSelectedCategoryIds(orderedIds);
    setShowImages(Boolean(details.data.screen.show_images));
    setNumColumns(Number((details.data.screen as unknown as { num_columns?: number }).num_columns ?? 3));
    const assign: Record<string, number> = {};
    for (const c of details.data.categories) {
      assign[c.sale_category_id] = Number((c as unknown as { column_index?: number }).column_index ?? 0);
    }
    setColumnAssignments(assign);
    // Update available list to exclude selected
    const selectedSet = new Set(orderedIds);
    setAvailableCategories(saleCategories.filter(c => !selectedSet.has(c.id)));
  };

  const handleCreate = async () => {
    const baseSlug = `screen-${(screens.length + 1)}`;
    const res = await createMenuScreen({ slug: baseSlug, name: `Screen ${screens.length + 1}`, is_published: false, sort_order: screens.length });
    if (res.error || !res.data) { setError(res.error ?? 'Failed to create screen'); return; }
    const updated = await listMenuScreens();
    if (!updated.error && updated.data) setScreens(updated.data);
    void selectScreen(res.data.id);
  };

  const handleSaveBasics = async (input: { name?: string; slug?: string; is_published?: boolean; show_images?: boolean; subtitle?: string }) => {
    if (!selectedScreen) return;
    const res = await updateMenuScreen(selectedScreen.screen.id, input);
    if (res.error || !res.data) { setError(res.error ?? 'Failed to update'); toast.error(res.error ?? 'Failed to update'); return; }
    setSelectedScreen({ screen: res.data as MenuScreen, categories: selectedScreen.categories });
    const refreshed = await listMenuScreens();
    if (!refreshed.error && refreshed.data) setScreens(refreshed.data);
    toast.success('Basics saved');
  };

  const handleDeleteScreen = async () => {
    if (!showDeleteDialog.id) return;
    const res = await deleteMenuScreen(showDeleteDialog.id);
    if (res.error) { setError(res.error); return; }
    setShowDeleteDialog({ open: false, id: null, name: '' });
    const updated = await listMenuScreens();
    if (!updated.error && updated.data) setScreens(updated.data);
    setSelectedScreen(null);
    setSelectedCategoryIds([]);
  };

  // Drag-and-drop via native HTML5
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);

  const selectedCategoryObjects = useMemo(() => {
    const map = new Map(saleCategories.map(c => [c.id, c] as const));
    return selectedCategoryIds.map(id => map.get(id)).filter(Boolean) as SaleCategory[];
  }, [selectedCategoryIds, saleCategories]);

  const addCategory = (id: string) => {
    if (selectedCategoryIds.includes(id)) return;
    setSelectedCategoryIds(ids => [...ids, id]);
    setAvailableCategories(prev => prev.filter(c => c.id !== id));
  };

  const removeCategory = (id: string) => {
    setSelectedCategoryIds(ids => ids.filter(x => x !== id));
    const cat = saleCategories.find(c => c.id === id);
    if (cat) setAvailableCategories(prev => [...prev, cat]);
  };

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (overId: string) => {
    if (!draggingId || draggingId === overId) return;
    setSelectedCategoryIds(ids => {
      const from = ids.indexOf(draggingId);
      const to = ids.indexOf(overId);
      if (from === -1 || to === -1) return ids;
      const clone = [...ids];
      clone.splice(from, 1);
      clone.splice(to, 0, draggingId);
      return clone;
    });
  };
  const onDragEnd = () => setDraggingId(null);

  const onDropToColumn = (columnIndex: number) => {
    if (!draggingId) return;
    setColumnAssignments(prev => ({ ...prev, [draggingId]: columnIndex }));
    setHoverColumn(null);
  };

  const saveOrder = async () => {
    if (!selectedScreen) return;
    try {
      setSavingOrder(true);
      const res = await replaceMenuScreenCategories(selectedScreen.screen.id, selectedCategoryIds);
      if (res.error) { setError(res.error); toast.error(`Failed to save: ${res.error}`); return; }
      toast.success('Order saved');
    } finally {
      setSavingOrder(false);
    }
    // refresh usage counts so gray-out updates
    const refreshedUsage = await getMenuScreenCategoryUsageCounts();
    if (!refreshedUsage.error && refreshedUsage.data) setUsageCounts(refreshedUsage.data);
  };

  const saveLayout = async () => {
    if (!selectedScreen) return;
    // Build per-column sort order based on current selectedCategoryIds order filtered by column
    const payload: Array<{ categoryId: string; columnIndex: number; sortOrder: number }> = [];
    for (let col = 0; col < numColumns; col++) {
      const inCol = selectedCategoryIds.filter(id => (columnAssignments[id] ?? 0) === col);
      inCol.forEach((id, idx) => payload.push({ categoryId: id, columnIndex: col, sortOrder: idx }));
    }
    const { ok, error } = await (await import('@/app/actions/menu-screens')).saveMenuScreenColumnsLayout(selectedScreen.screen.id, numColumns, payload);
    if (!ok) {
      toast.error(`Failed to save layout: ${error ?? 'Unknown error'}`);
    } else {
      toast.success('Layout saved');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Menu Screens</h1>
        <button onClick={handleCreate} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <FaPlus /> New Screen
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 border-b">
          {screens.map(s => (
            <div key={s.id} className={`px-3 py-2 cursor-pointer whitespace-nowrap ${selectedScreen?.screen.id === s.id ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-900'}`}
                 onClick={() => void selectScreen(s.id)}>
              <span className="truncate">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
          {selectedScreen && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-neutral-900 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Basics</h2>
                  <div className="flex items-center gap-2">
                    {selectedScreen?.screen.slug && (
                      <a
                        href={`/menu/${selectedScreen.screen.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        <FaExternalLinkAlt /> Preview
                      </a>
                    )}
                    <button
                      onClick={() => void handleSaveBasics({
                        name: selectedScreen.screen.name,
                        slug: selectedScreen.screen.slug,
                        is_published: selectedScreen.screen.is_published,
                        show_images: showImages,
                        subtitle: (selectedScreen.screen as unknown as { subtitle?: string }).subtitle ?? ''
                      })}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <FaSave /> Save Basics
                    </button>
                    <button
                      onClick={() => setShowDeleteDialog({ open: true, id: selectedScreen!.screen.id, name: selectedScreen!.screen.name })}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-sm text-gray-600">Name</span>
                    <input
                      className="mt-1 w-full border px-3 py-2 bg-white dark:bg-neutral-950"
                      value={selectedScreen.screen.name}
                      onChange={(e) => setSelectedScreen(s => s ? { ...s, screen: { ...s.screen, name: e.target.value } } : s)}
                      onBlur={() => void handleSaveBasics({ name: selectedScreen.screen.name })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Slug</span>
                    <input
                      className="mt-1 w-full border px-3 py-2 bg-white dark:bg-neutral-950"
                      value={selectedScreen.screen.slug}
                      onChange={(e) => setSelectedScreen(s => s ? { ...s, screen: { ...s.screen, slug: e.target.value.replace(/\s+/g, '-').toLowerCase() } } : s)}
                      onBlur={() => void handleSaveBasics({ slug: selectedScreen.screen.slug })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Subtitle</span>
                    <input
                      className="mt-1 w-full border px-3 py-2 bg-white dark:bg-neutral-950"
                      value={(selectedScreen.screen as unknown as { subtitle?: string }).subtitle ?? ''}
                      onChange={(e) => setSelectedScreen(s => s ? { ...s, screen: { ...s.screen, ...(s.screen as unknown as { subtitle?: string }), subtitle: e.target.value } as unknown as MenuScreen } : s)}
                      onBlur={() => void handleSaveBasics({ subtitle: (selectedScreen.screen as unknown as { subtitle?: string }).subtitle ?? '' })}
                    />
                  </label>
                  <label className="flex items-center gap-3 mt-6">
                    <input
                      type="checkbox"
                      checked={selectedScreen.screen.is_published}
                      onChange={(e) => void handleSaveBasics({ is_published: e.target.checked })}
                    />
                    <span className="text-sm">Published</span>
                  </label>
                  <label className="flex items-center gap-3 mt-6">
                    <input
                      type="checkbox"
                      checked={showImages}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setShowImages(next);
                        await handleSaveBasics({ show_images: next });
                      }}
                    />
                    <span className="text-sm">Show Images</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                <div className="bg-white dark:bg-neutral-900 p-4 w-full lg:w-1/3">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-medium">Available Categories</h2>
                  </div>
                  <ul className="space-y-2">
                    {availableCategories
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(cat => (
                      <li key={cat.id} className={`flex items-center justify-between px-3 py-2 rounded shadow-sm ${usageCounts[cat.id] ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-neutral-800'}`}>
                        <span>{cat.name}</span>
                        <button className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 disabled:opacity-60" onClick={() => addCategory(cat.id)}>
                          <FaPlus className="w-4 h-4" /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-4 w-full lg:w-2/3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="font-medium">Screen Layout</h2>
                      <label className="text-sm flex items-center gap-2">
                        Columns
                        <select value={numColumns} onChange={(e) => setNumColumns(Number(e.target.value))} className="border rounded px-2 py-1">
                          {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void saveLayout()} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        <FaSave /> Save Layout
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: numColumns }, (_, colIdx) => (
                      <div key={colIdx}
                           className={`min-h-32 rounded p-3 bg-gray-50 dark:bg-neutral-900 transition-colors ${hoverColumn === colIdx ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-neutral-800' : ''}`}
                           onDragOver={(e) => { e.preventDefault(); }}
                           onDragEnter={() => setHoverColumn(colIdx)}
                           onDragLeave={() => setHoverColumn((prev) => (prev === colIdx ? null : prev))}
                           onDrop={() => onDropToColumn(colIdx)}>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Column {colIdx + 1}</div>
                        <ul className="space-y-2">
                          {selectedCategoryObjects
                            .filter(cat => (columnAssignments[cat.id] ?? 0) === colIdx)
                            .map(cat => (
                              <li key={cat.id}
                                  draggable
                                  onDragStart={() => onDragStart(cat.id)}
                                  onDragOver={(e) => { e.preventDefault(); onDragOver(cat.id); }}
                                  onDragEnd={onDragEnd}
                                  className="flex items-center justify-between px-3 py-2 rounded bg-white dark:bg-neutral-800 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <FaGripVertical className="text-gray-400" />
                                  <span>{cat.name}</span>
                                </div>
                                <button className="text-red-600 hover:text-red-700" onClick={() => removeCategory(cat.id)}>
                                  <FaTrash />
                                </button>
                              </li>
                          ))}
                        </ul>
                        {draggingId && (selectedCategoryObjects.filter(cat => (columnAssignments[cat.id] ?? 0) === colIdx).length === 0) && (
                          <div className={`mt-2 text-xs text-gray-400 ${hoverColumn === colIdx ? 'text-blue-600' : ''}`}>
                            Drop here
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      <ConfirmationDialog
        isOpen={showDeleteDialog.open}
        title="Delete Menu Screen"
        message={`Are you sure you want to delete "${showDeleteDialog.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onClose={() => setShowDeleteDialog({ open: false, id: null, name: '' })}
        onConfirm={() => { void handleDeleteScreen(); }}
      />
    </div>
  );
}


