import { POS_TILE_COLORS as COLOR_OPTIONS } from '@/lib/pos-tile-palette';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { PosGroupTile } from '@/components/pos/PosConfigurableTile';
import { getPosLayoutColumns, getPosLayoutMenuWidth, resolvePosTileAppearance, updatePosTileAppearance, type PosTileAppearance, type PosTileConfig } from '@/lib/pos-layout-config';
import { PosProductTile } from '@/components/pos/PosProductTile';
import { WorkspaceHeader } from '@/components/ui';
import { useWindowDimensions } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { FormField } from '@/components/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Checkbox, IconButton, Menu } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import ColorPicker, { BrightnessSlider, Preview } from 'reanimated-color-picker';
import { usePosCatalog } from '@/providers/PosCatalogProvider';
import { BRAND_COLORS } from '@/utils/brand';
import {
  DEFAULT_POS_BUTTON_COLOR,
  DEFAULT_POS_QUICK_ITEM_NOTES,
  DEFAULT_POS_QUICK_ORDER_NOTES,
  PosLayoutCategory,
  PosLayoutData,
  PosLayoutRecord,
  savePosLayout,
  applyPosLayout,
} from '../lib/pos-layouts';

type SaleCategory = {
  id: string;
  name: string;
  sort_order: number | null;
  parent_category_id: string | null;
};

type SaleProduct = {
  id: string;
  name: string;
  sale_price: number;
  sale_category_id: string | null;
  sub_category_id: string | null;
  sort_order: number | null;
};

type LayoutGroupView = Omit<PosLayoutCategory, 'sourceCategoryIds'> & {
  sourceCategoryIds: string[];
  displayName: string;
  sourceNames: string[];
  isVirtual: boolean;
};

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
};

const moveItem = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
};

const moveItemToIndex = <T,>(items: T[], index: number, targetIndex: number) => {
  if (index < 0 || index >= items.length) return items;
  if (targetIndex < 0 || targetIndex >= items.length || targetIndex === index) return items;

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
};

export default function PosLayoutSettingsScreen() {
  const { width: deviceWidth, fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const compact = contentWidth / fontScale < 600;

  const { snapshot: catalog, refresh: refreshCatalog } = usePosCatalog();
  const router = useRouter();
  const navigation = useNavigation();
  const [categories, setCategories] = useState<SaleCategory[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [layouts, setLayouts] = useState<PosLayoutRecord[]>([]);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('Default POS Layout');
  const [isDefault, setIsDefault] = useState(true);
  const [layout, setLayout] = useState<PosLayoutData>({
    version: 1,
    quickOrderNotes: DEFAULT_POS_QUICK_ORDER_NOTES,
    quickItemNotes: DEFAULT_POS_QUICK_ITEM_NOTES,
    categories: [],
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layoutMenuVisible, setLayoutMenuVisible] = useState(false);
  const [virtualDialogVisible, setVirtualDialogVisible] = useState(false);
  const [editingVirtualCategoryId, setEditingVirtualCategoryId] = useState<string | null>(null);
  const [virtualName, setVirtualName] = useState('');
  const [virtualSourceIds, setVirtualSourceIds] = useState<Record<string, boolean>>({});
  const [virtualHideSourceCategories, setVirtualHideSourceCategories] = useState(false);
  const [customColorPicker, setCustomColorPicker] = useState<{
    color: string;
    apply: (color: string) => void;
  } | null>(null);
  const [customColorDraft, setCustomColorDraft] = useState<string>('#111827');
  const initializedCatalog = useRef(false);
  const [deviceMenuVisible, setDeviceMenuVisible] = useState(false);
  const [previewDevice, setPreviewDevice] = useState(deviceWidth >= 1100 ? 'large' : 'tablet');
  const [showHidden, setShowHidden] = useState(true);
  const [appearanceScope, setAppearanceScope] = useState<'selected' | 'all'>('selected');
  const [tileTarget, setTileTarget] = useState<{ categoryId: string; productId?: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState('');
  const baseline = useRef('');
  const draftKey = JSON.stringify({ layout, layoutName, isDefault });
  const dirty = !!baseline.current && baseline.current !== draftKey;
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert('Leave layout draft?', 'Save the named layout to keep these changes for later.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const previewDeviceWidth = previewDevice === 'phone' ? 390 : previewDevice === 'large' ? 1366 : 1024;
  const previewMenuWidth = getPosLayoutMenuWidth(previewDeviceWidth, fontScale);
  const previewColumns = getPosLayoutColumns(layout, previewDeviceWidth, fontScale, previewMenuWidth);
  const targetCategory = layout.categories.find(c => c.categoryId === tileTarget?.categoryId);
  const targetTile = tileTarget?.productId ? targetCategory?.products.find(p => p.productId === tileTarget.productId) : targetCategory;
  const targetAppearance = resolvePosTileAppearance(layout, targetTile);
  const confirmReplace = (action: () => void) => dirty ? Alert.alert('Discard draft changes?', 'Your changes have not been saved.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: action }]) : action();
  const changeAppearance = (patch: PosTileAppearance) => {
    if (tileTarget) setLayout(current => updatePosTileAppearance(current, tileTarget, patch, appearanceScope));
  };
  const changeTile = (patch: Partial<PosTileConfig>) => {
    if (!tileTarget) return;
    setLayout(current => ({ ...current, categories: current.categories.map(c => c.categoryId !== tileTarget.categoryId ? c : tileTarget.productId ? { ...c, products: c.products.map(p => p.productId === tileTarget.productId ? { ...p, ...patch } : p) } : { ...c, ...patch }) }));
  };


  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parent_category_id),
    [categories]
  );

  const layoutGroupViews = useMemo<LayoutGroupView[]>(() => {
    const categoryById = new Map(topLevelCategories.map((category) => [category.id, category]));
    const topLevelCategoryIds = new Set(topLevelCategories.map((category) => category.id));
    return layout.categories
      .map((layoutCategory) => {
        const sourceCategoryIds = layoutCategory.sourceCategoryIds?.length
          ? layoutCategory.sourceCategoryIds
          : [layoutCategory.categoryId];
        const sourceNames = sourceCategoryIds
          .map((categoryId) => categoryById.get(categoryId)?.name)
          .filter((name): name is string => Boolean(name));
        if (sourceNames.length === 0) return null;

        return {
          ...layoutCategory,
          sourceCategoryIds,
          displayName: layoutCategory.label || layoutCategory.title || sourceNames[0],
          sourceNames,
          isVirtual: !topLevelCategoryIds.has(layoutCategory.categoryId),
        };
      })
      .filter((category): category is LayoutGroupView => Boolean(category));
  }, [layout.categories, topLevelCategories]);

  const selectedLayoutCategory = layoutGroupViews.find((category) => category.categoryId === selectedCategoryId) ?? null;
  const selectedCategoryName = selectedLayoutCategory?.displayName ?? 'Items';
  const quickOrderNotesText = (layout.quickOrderNotes ?? DEFAULT_POS_QUICK_ORDER_NOTES).join('\n');
  const quickItemNotesText = (layout.quickItemNotes ?? DEFAULT_POS_QUICK_ITEM_NOTES).join('\n');

  const categoryProducts = useMemo(() => {
    if (!selectedLayoutCategory) return [];

    const sourceCategoryIds = selectedLayoutCategory.sourceCategoryIds?.length
      ? selectedLayoutCategory.sourceCategoryIds
      : [selectedLayoutCategory.categoryId];
    const childCategoryIds = categories
      .filter((category) => sourceCategoryIds.includes(category.parent_category_id || ''))
      .map((category) => category.id);
    const categoryIds = new Set([...sourceCategoryIds, ...childCategoryIds]);

    return products.filter((product) => (
      (product.sale_category_id && categoryIds.has(product.sale_category_id))
      || (product.sub_category_id && categoryIds.has(product.sub_category_id))
    ));
  }, [categories, products, selectedLayoutCategory]);

  const orderedCategories = layoutGroupViews;

  const orderedProducts = useMemo(() => {
    const byId = new Map(categoryProducts.map((product) => [product.id, product]));
    return (selectedLayoutCategory?.products || [])
      .map((layoutProduct) => byId.get(layoutProduct.productId))
      .filter((product): product is SaleProduct => Boolean(product));
  }, [categoryProducts, selectedLayoutCategory]);

  const buildDefaultLayout = (nextCategories: SaleCategory[], nextProducts: SaleProduct[]): PosLayoutData => {
    const topCategories = nextCategories.filter((category) => !category.parent_category_id);
    return {
      version: 1,
      quickOrderNotes: DEFAULT_POS_QUICK_ORDER_NOTES,
      quickItemNotes: DEFAULT_POS_QUICK_ITEM_NOTES,
      categories: topCategories.map((category) => {
        const childCategoryIds = nextCategories
          .filter((child) => child.parent_category_id === category.id)
          .map((child) => child.id);
        const categoryIds = new Set([category.id, ...childCategoryIds]);
        return {
          categoryId: category.id,
          title: category.name,
          sourceCategoryIds: [category.id],
          showProductsOnTopLevel: false,
          color: DEFAULT_POS_BUTTON_COLOR,
          products: nextProducts
            .filter((product) => (
              (product.sale_category_id && categoryIds.has(product.sale_category_id))
              || (product.sub_category_id && categoryIds.has(product.sub_category_id))
            ))
            .map((product) => ({ productId: product.id })),
        };
      }),
    };
  };

  const syncLayoutWithCatalog = (
    sourceLayout: PosLayoutData,
    nextCategories: SaleCategory[],
    nextProducts: SaleProduct[]
  ): PosLayoutData => {
    const defaultLayout = buildDefaultLayout(nextCategories, nextProducts);
    const defaultByCategoryId = new Map(defaultLayout.categories.map((category) => [category.categoryId, category]));
    const sourceByCategoryId = new Map(sourceLayout.categories.map((category) => [category.categoryId, category]));
    const sourceCategoryIds = new Set(sourceLayout.categories.map((category) => category.categoryId));

    const syncCategory = (sourceCategory: PosLayoutCategory) => {
      const defaultCategory = defaultByCategoryId.get(sourceCategory.categoryId);
      if (defaultCategory) {
        const sourceProductIds = new Set(sourceCategory.products.map((product) => product.productId));
        const defaultProductIds = new Set(defaultCategory.products.map((product) => product.productId));
        const sourceProducts = sourceCategory.products.filter((product) => defaultProductIds.has(product.productId));
        const missingProducts = defaultCategory.products.filter((product) => !sourceProductIds.has(product.productId));

        return {
          ...sourceCategory,
          categoryId: defaultCategory.categoryId,
          title: sourceCategory.title || defaultCategory.title,
          sourceCategoryIds: sourceCategory.sourceCategoryIds || defaultCategory.sourceCategoryIds,
          hideSourceCategories: Boolean(sourceCategory.hideSourceCategories),
          showProductsOnTopLevel: Boolean(sourceCategory.showProductsOnTopLevel),
          color: sourceCategory.color || defaultCategory.color,
          products: [...sourceProducts, ...missingProducts],
        };
      }

      const category = sourceCategory;
        const sourceCategoryIds = category.sourceCategoryIds?.length ? category.sourceCategoryIds : [category.categoryId];
        const sourceCategorySet = new Set(sourceCategoryIds);
        const childCategoryIds = nextCategories
          .filter((child) => sourceCategoryIds.includes(child.parent_category_id || ''))
          .map((child) => child.id);
        const allCategoryIds = new Set([...sourceCategorySet, ...childCategoryIds]);
        const validProducts = nextProducts
          .filter((product) => (
            (product.sale_category_id && allCategoryIds.has(product.sale_category_id))
            || (product.sub_category_id && allCategoryIds.has(product.sub_category_id))
          ))
          .map((product) => product.id);
        const validProductSet = new Set(validProducts);
        const sourceProductIds = new Set(category.products.map((product) => product.productId));

        return {
          ...category,
          sourceCategoryIds,
          hideSourceCategories: Boolean(category.hideSourceCategories),
          products: [
            ...category.products.filter((product) => validProductSet.has(product.productId)),
            ...validProducts
              .filter((productId) => !sourceProductIds.has(productId))
              .map((productId) => ({ productId })),
          ],
        };
    };

    const syncedExistingCategories = sourceLayout.categories
      .map(syncCategory)
      .filter((category) => (category.sourceCategoryIds || [category.categoryId]).some((categoryId) => (
        nextCategories.some((sourceCategory) => sourceCategory.id === categoryId)
      )));

    const missingDefaultCategories = defaultLayout.categories
      .filter((category) => !sourceCategoryIds.has(category.categoryId));

    return {
      ...sourceLayout,
      version: 1,
      quickOrderNotes: sourceLayout.quickOrderNotes !== undefined
        ? sourceLayout.quickOrderNotes
        : DEFAULT_POS_QUICK_ORDER_NOTES,
      quickItemNotes: sourceLayout.quickItemNotes !== undefined
        ? sourceLayout.quickItemNotes
        : DEFAULT_POS_QUICK_ITEM_NOTES,
      categories: [...syncedExistingCategories, ...missingDefaultCategories],
    };
  };

  const loadData = async () => {
    setLoading(true);
    if (!catalog) return;
    setLoading(false);
    const nextCategories = catalog.categories as SaleCategory[];
    const nextProducts = catalog.products as SaleProduct[];
    const nextLayouts = catalog.layouts;
    const preferred = catalog.preferredLayout;
    const nextLayout = syncLayoutWithCatalog(preferred?.layout || buildDefaultLayout(nextCategories, nextProducts), nextCategories, nextProducts);

    setCategories(nextCategories);
    setProducts(nextProducts);
    setLayouts(nextLayouts);
    setLayoutId(nextLayouts.some(item => item.id === preferred?.id) ? preferred?.id ?? null : null);
    setLayoutName(preferred?.name ?? 'Default POS Layout');
    setIsDefault(preferred?.is_default ?? true);
    setLayout(nextLayout);
    baseline.current = JSON.stringify({ layout: nextLayout, layoutName: preferred?.name ?? 'Default POS Layout', isDefault: preferred?.is_default ?? true });
    setSelectedCategoryId(null);
    setTileTarget(nextLayout.categories[0] ? { categoryId: nextLayout.categories[0].categoryId } : null);
  };

  useEffect(() => {
    if (catalog && !initializedCatalog.current) {
      initializedCatalog.current = true;
      void loadData();
    }
  }, [catalog]);

  useEffect(() => { if (catalog) setLayouts(catalog.layouts); }, [catalog]);

  const selectLayout = (selected: PosLayoutRecord) => {
    const syncedLayout = syncLayoutWithCatalog(selected.layout, categories, products);
    setLayoutMenuVisible(false);
    setLayoutId(selected.id);
    setLayoutName(selected.name);
    setIsDefault(selected.is_default);
    setLayout(syncedLayout);
    baseline.current = JSON.stringify({ layout: syncedLayout, layoutName: selected.name, isDefault: selected.is_default });
    setSelectedCategoryId(null);
    setTileTarget(syncedLayout.categories[0] ? { categoryId: syncedLayout.categories[0].categoryId } : null);
  };

  const updateCategory = (categoryId: string, updater: (category: PosLayoutCategory) => PosLayoutCategory) => {
    setLayout((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => (
        category.categoryId === categoryId ? updater(category) : category
      )),
    }));
  };

  const updateCategoryColor = (categoryId: string, color: string) => {
    setLayout(current => updatePosTileAppearance(current, { categoryId }, { background: color }, appearanceScope));
  };

  const updateCategoryTitle = (categoryId: string, title: string) => {
    updateCategory(categoryId, (category) => ({ ...category, title }));
  };

  const toggleCategoryTopLevelProducts = (categoryId: string) => {
    updateCategory(categoryId, (category) => ({
      ...category,
      showProductsOnTopLevel: !category.showProductsOnTopLevel,
    }));
  };

  const updateQuickOrderNotes = (text: string) => {
    const notes = text
      .split(/\r?\n/)
      .map((note) => note.trim())
      .filter(Boolean);
    setLayout((current) => ({
      ...current,
      quickOrderNotes: notes,
    }));
  };

  const updateQuickItemNotes = (text: string) => {
    const notes = text
      .split(/\r?\n/)
      .map((note) => note.trim())
      .filter(Boolean);
    setLayout((current) => ({
      ...current,
      quickItemNotes: notes,
    }));
  };

  const updateProductColor = (productId: string, color: string) => {
    if (!selectedCategoryId) return;
    setLayout(current => updatePosTileAppearance(current, { categoryId: selectedCategoryId, productId }, { background: color }, appearanceScope));
  };

  const toggleProductQuickList = (productId: string) => {
    if (!selectedCategoryId) return;
    updateCategory(selectedCategoryId, (category) => ({
      ...category,
      products: category.products.map((product) => (
        product.productId === productId
          ? { ...product, showOnQuickList: !product.showOnQuickList }
          : product
      )),
    }));
  };

  const moveCategory = (index: number, direction: -1 | 1) => {
    setLayout((prev) => ({ ...prev, categories: moveItem(prev.categories, index, direction) }));
  };

  const moveCategoryToEdge = (index: number, edge: 'top' | 'bottom') => {
    setLayout((prev) => ({
      ...prev,
      categories: moveItemToIndex(prev.categories, index, edge === 'top' ? 0 : prev.categories.length - 1),
    }));
  };

  const moveProduct = (index: number, direction: -1 | 1) => {
    if (!selectedCategoryId) return;
    updateCategory(selectedCategoryId, (category) => ({
      ...category,
      products: moveItem(category.products, index, direction),
    }));
  };

  const moveProductToEdge = (index: number, edge: 'top' | 'bottom') => {
    if (!selectedCategoryId) return;
    updateCategory(selectedCategoryId, (category) => ({
      ...category,
      products: moveItemToIndex(category.products, index, edge === 'top' ? 0 : category.products.length - 1),
    }));
  };

  const startNewLayout = () => {
    const nextLayout = syncLayoutWithCatalog(buildDefaultLayout(categories, products), categories, products);
    setLayoutMenuVisible(false);
    setLayoutId(null);
    setLayoutName('New POS Layout');
    setIsDefault(false);
    setLayout(nextLayout);
    setSelectedCategoryId(null);
    setTileTarget(nextLayout.categories[0] ? { categoryId: nextLayout.categories[0].categoryId } : null);
  };

  const loadExample = (chip: boolean) => confirmReplace(() => {
    const example = buildDefaultLayout(categories, products);
    example.appearance = { background: '#FFFFFF', text: '#172E3A', fontSize: chip ? 14 : 16, fontWeight: 700, align: 'center', height: chip ? 88 : 116 };
    example.categories = example.categories.map(({ color, ...category }) => category);
    example.columnsExpanded = 4; example.columnsPhone = 2;
    if (chip) example.categories.sort((a, b) => Number(!/chip/i.test(a.title || '')) - Number(!/chip/i.test(b.title || '')));
    setLayoutId(null); setLayoutName(chip ? 'Default Chip' : 'Default POS'); setIsDefault(false); setLayout(example); setTileTarget(null); setLayoutMenuVisible(false);
    setStatus('Example loaded as a draft. Save or Apply when ready.');
  });

  const openVirtualGroupDialog = () => {
    setEditingVirtualCategoryId(null);
    setVirtualName('');
    setVirtualSourceIds({});
    setVirtualHideSourceCategories(false);
    setVirtualDialogVisible(true);
  };

  const openEditVirtualGroupDialog = (category: LayoutGroupView) => {
    setEditingVirtualCategoryId(category.categoryId);
    setVirtualName(category.title || category.displayName);
    setVirtualSourceIds(
      category.sourceCategoryIds.reduce<Record<string, boolean>>((acc, categoryId) => {
        acc[categoryId] = true;
        return acc;
      }, {})
    );
    setVirtualHideSourceCategories(Boolean(category.hideSourceCategories));
    setVirtualDialogVisible(true);
  };

  const toggleVirtualSource = (categoryId: string) => {
    setVirtualSourceIds((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const saveVirtualGroup = () => {
    const sourceCategoryIds = topLevelCategories
      .filter((category) => virtualSourceIds[category.id])
      .map((category) => category.id);

    if (sourceCategoryIds.length < 2) {
      Alert.alert('Virtual group', 'Choose at least two groups to merge.');
      return;
    }

    const sourceNames = sourceCategoryIds
      .map((categoryId) => topLevelCategories.find((category) => category.id === categoryId)?.name)
      .filter((name): name is string => Boolean(name));
    const title = virtualName.trim() || sourceNames.join(' + ');
    const virtualCategoryId = editingVirtualCategoryId || `virtual-${Date.now()}`;
    const syncedVirtualLayout = syncLayoutWithCatalog({
      version: 1,
      categories: [{
        ...layout.categories.find(c => c.categoryId === virtualCategoryId),
        categoryId: virtualCategoryId,
        title,
        sourceCategoryIds,
        hideSourceCategories: virtualHideSourceCategories,
        showProductsOnTopLevel: layout.categories.find(c => c.categoryId === virtualCategoryId)?.showProductsOnTopLevel ?? false,
        products: layout.categories.find(c => c.categoryId === virtualCategoryId)?.products || [],
      }],
    }, categories, products);
    const virtualGroup = syncedVirtualLayout.categories.find((category) => category.categoryId === virtualCategoryId);
    if (!virtualGroup) return;

    setLayout((prev) => ({
      ...prev,
      categories: editingVirtualCategoryId
        ? prev.categories.map((category) => (
          category.categoryId === editingVirtualCategoryId ? virtualGroup : category
        ))
        : [...prev.categories, virtualGroup],
    }));
    setSelectedCategoryId(virtualGroup.categoryId);
    setVirtualDialogVisible(false);
  };

  const deleteVirtualGroup = (categoryId: string) => {
    setLayout((prev) => ({
      ...prev,
      categories: prev.categories.filter((category) => category.categoryId !== categoryId),
    }));
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null);
    }
    setVirtualDialogVisible(false);
    setEditingVirtualCategoryId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
    const result = await savePosLayout({ id: layoutId ?? undefined, name: layoutName, layout, isDefault });

    if (result.error) {
      Alert.alert('POS layout', result.error);
      return;
    }

    setLayoutId(result.data?.id || layoutId);
    baseline.current = draftKey;
    setStatus('Named layout saved. Apply to this POS to change the live tiles.');
    await refreshCatalog('manual');
    } catch (error) { Alert.alert('POS layout', String(error)); } finally { setSaving(false); }
  };

  const handleUseLayout = async () => {
    setSaving(true);
    try {
      await applyPosLayout(layout, layoutName, layoutId);
      await refreshCatalog('selection');
      setStatus('Applied to this POS.');
    } catch (error) { Alert.alert('POS layout', String(error)); }
    finally { setSaving(false); }
  };

  const categoryColor = (categoryId: string) => (
    layout.categories.find((category) => category.categoryId === categoryId)?.color || DEFAULT_POS_BUTTON_COLOR
  );

  const productColor = (productId: string) => (
    selectedLayoutCategory?.products.find((product) => product.productId === productId)?.color
  );

  const openCustomColorPicker = (selectedColor: string | undefined, apply: (color: string) => void) => {
    setCustomColorDraft(selectedColor || DEFAULT_POS_BUTTON_COLOR);
    setCustomColorPicker({ color: selectedColor || DEFAULT_POS_BUTTON_COLOR, apply });
  };

  const applyCustomColor = () => {
    const normalizedColor = normalizeHexColor(customColorDraft);
    if (!normalizedColor || !customColorPicker) {
      Alert.alert('Custom color', 'Enter a valid hex color like #2563eb.');
      return;
    }

    customColorPicker.apply(normalizedColor);
    setCustomColorPicker(null);
  };

  const renderColorSwatches = (selectedColor: string | undefined, onSelect: (color: string) => void) => (
    <View style={styles.colorRow}>
      {COLOR_OPTIONS.map((color) => (
        <TouchableOpacity
          key={color}
          accessibilityLabel={`Use color ${color}`}
          onPress={() => onSelect(color)}
          style={[
            styles.colorSwatch,
            { backgroundColor: color },
            selectedColor === color ? styles.colorSwatchSelected : null,
          ]}
        />
      ))}
      <TouchableOpacity
        accessibilityLabel="Choose custom color"
        onPress={() => openCustomColorPicker(selectedColor, onSelect)}
        style={[styles.colorSwatch, styles.customColorSwatch]}
      >
        <Text style={styles.customColorPlusText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <WorkspaceHeader title="POS layout" />

      <View style={[styles.body, { padding: contentWidth >= 1100 ? 16 : 12 }, compact && { flexDirection: 'column' }]}>
        <View style={[styles.previewPane, previewDevice === 'phone' && { maxWidth: 390, alignSelf: 'center', width: '100%' }, compact && { flexBasis: 0, minHeight: 150 }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: t.color.border, borderRadius: 8, padding: 2, backgroundColor: '#EDF2F1' }}>{[{ value: 'groups', label: 'Groups' }, { value: 'items', label: 'Products' }].map(tab => <TouchableOpacity key={tab.value} accessibilityRole="tab" accessibilityState={{ selected: (selectedCategoryId ? 'items' : 'groups') === tab.value }} onPress={() => setSelectedCategoryId(tab.value === 'groups' ? null : layout.categories[0]?.categoryId || null)} style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6, backgroundColor: (selectedCategoryId ? 'items' : 'groups') === tab.value ? '#fff' : undefined }}><Text style={{ color: t.color.primaryPressed, fontSize: 13, fontWeight: '700' }}>{tab.label}</Text></TouchableOpacity>)}</View>
            <Menu visible={deviceMenuVisible} onDismiss={() => setDeviceMenuVisible(false)} anchor={<Button mode="outlined" compact onPress={() => setDeviceMenuVisible(true)} contentStyle={{ minHeight: 40 }}>{previewDevice === 'phone' ? 'Phone preview' : previewDevice === 'large' ? 'Large tablet' : 'Small tablet'}⌄</Button>}>{[{ value: 'tablet', label: 'Small tablet' }, { value: 'large', label: 'Large tablet' }, { value: 'phone', label: 'Phone preview' }].map(device => <Menu.Item key={device.value} title={device.label} onPress={() => { setPreviewDevice(device.value); setDeviceMenuVisible(false); }} />)}</Menu>
            <Button mode="outlined" compact buttonColor={showHidden ? t.color.primaryTint : t.color.surface} onPress={() => setShowHidden(v => !v)} contentStyle={{ minHeight: 40 }}>Show hidden</Button>
            {selectedCategoryId && <ScrollView horizontal><View style={{ flexDirection: 'row' }}>{orderedCategories.map(c => <Button key={c.categoryId} onPress={() => setSelectedCategoryId(c.categoryId)}>{c.displayName}</Button>)}</View></ScrollView>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border, borderTopLeftRadius: 12, borderTopRightRadius: 12, minHeight: 48, paddingHorizontal: 16 }}><Text style={{ color: t.color.text, fontSize: 15, fontWeight: '700' }}>Take order</Text><Text style={{ color: t.color.muted }}>⌕</Text></View>
          <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}><View style={{ width: previewMenuWidth, height: '100%' }}>
          {!selectedCategoryId ? (
            <FlatList
              data={orderedCategories.filter(c => showHidden || c.visible !== false)}
              keyExtractor={(item) => item.categoryId}
              numColumns={previewColumns}
              key={`layout-groups-${previewColumns}`}
              contentContainerStyle={styles.tileGrid}
              ListEmptyComponent={<Text style={styles.emptyText}>{loading ? 'Loading layout...' : 'No categories'}</Text>}
              renderItem={({ item }) => (
                <PosGroupTile label={item.label || item.displayName} columns={previewColumns} layout={layout} tileConfig={item} selected={tileTarget?.categoryId === item.categoryId && !tileTarget.productId} onPress={() => setTileTarget({ categoryId: item.categoryId })} />
              )}
            />
          ) : (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={() => setSelectedCategoryId(null)} style={styles.backButton}>
                  Groups
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle}>{selectedCategoryName}</Text>
                  <Text style={styles.menuSubtitle}>{orderedProducts.length} items</Text>
                </View>
              </View>
              <FlatList
                data={orderedProducts.filter(p => showHidden || selectedLayoutCategory?.products.find(c => c.productId === p.id)?.visible !== false)}
                keyExtractor={(item) => item.id}
                numColumns={previewColumns}
                key={`layout-products-${previewColumns}`}
                contentContainerStyle={styles.tileGrid}
                ListEmptyComponent={<Text style={styles.emptyText}>No items in this group</Text>}
                renderItem={({ item }) => {
                  return <PosProductTile product={item} groupName={selectedCategoryName} quantity={0} hasAddons={catalog?.customizableIds.has(item.id) || false} accent={productColor(item.id) || categoryColor(selectedCategoryId)} columns={previewColumns} layout={layout} tileConfig={selectedLayoutCategory?.products.find(p => p.productId === item.id)} onPress={() => setTileTarget({ categoryId: selectedCategoryId, productId: item.id })} preview />;
                }}
              />
            </>
          )}
          </View></ScrollView>
          <Text style={{ color: t.color.muted, fontSize: 13, marginTop: 12 }}>Tap a tile to edit its appearance. Changes appear here before you apply them to this POS. {status}</Text>
        </View>

        <View style={[styles.settingsPane, { width: contentWidth >= 1100 ? 300 : 280 }, compact && { width: '100%', flexBasis: 0, minHeight: 200, flex: 1 }]}><ScrollView contentContainerStyle={styles.settingsContent}>
          <View style={styles.controlPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Layout settings</Text>
              {isDefault && <Text style={styles.defaultBadge}>Default</Text>}
            </View>
            <View style={styles.menuBox}>
              <Menu
                visible={layoutMenuVisible}
                onDismiss={() => setLayoutMenuVisible(false)}
                anchor={(
                  <Button mode="outlined" icon="folder-open-outline" onPress={() => setLayoutMenuVisible(true)} style={styles.fullButton}>
                    {layoutId ? layoutName : 'Unsaved layout'}
                  </Button>
                )}
              >
                {layouts.map((item) => (
                  <Menu.Item key={item.id} onPress={() => confirmReplace(() => selectLayout(item))} title={`${item.name}${item.is_default ? ' (default)' : ''}`} />
                ))}
                <Menu.Item onPress={() => confirmReplace(startNewLayout)} title="New layout from menu" /><Menu.Item onPress={() => loadExample(false)} title="Example · Default POS" /><Menu.Item onPress={() => loadExample(true)} title="Example · Default Chip" />
              </Menu>
            </View>
            <FormField
              label="Layout name"
              mode="outlined"
              value={layoutName}
              onChangeText={setLayoutName}
              style={styles.input}
            />
          </View>
          <View style={styles.controlPanel}>

            <Text style={styles.panelTitle}>{dirty ? 'Unsaved draft' : 'Layout draft'}</Text>
            <Text style={styles.helperText}>{tileTarget ? `Selected ${tileTarget.productId ? 'product' : 'group'}` : 'Tap a preview tile to select it'}</Text>
            {tileTarget && <>
              <ChoiceTabs variant="choices" value={appearanceScope} onValueChange={v => setAppearanceScope(v as 'selected' | 'all')} buttons={[{ value: 'selected', label: 'Selected tile' }, { value: 'all', label: 'All tiles' }]} />
              <Text style={styles.editorSectionLabel}>Button background</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit button background" onPress={() => openCustomColorPicker(targetAppearance.background, background => changeAppearance({ background }))} style={{ height: 40, borderWidth: 1, borderColor: t.color.border, padding: 5, borderRadius: 8 }}><View style={{ flex: 1, backgroundColor: targetAppearance.background, borderWidth: 1, borderColor: t.color.border }} /></TouchableOpacity>
              <Text style={styles.editorSectionLabel}>Text colour</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit text colour" onPress={() => openCustomColorPicker(targetAppearance.text, text => changeAppearance({ text }))} style={{ height: 40, borderWidth: 1, borderColor: t.color.border, padding: 5, borderRadius: 8 }}><View style={{ flex: 1, backgroundColor: targetAppearance.text }} /></TouchableOpacity>
              <FormField label="Display label" value={targetTile?.label ?? (tileTarget.productId ? products.find(p => p.id === tileTarget.productId)?.name : targetCategory?.title) ?? ''} onChangeText={label => changeTile({ label })} />
              <Text style={styles.editorSectionLabel}>Text size</Text>
              <ChoiceTabs variant="choices" value={String(targetAppearance.fontSize)} onValueChange={v => changeAppearance({ fontSize: Number(v) })} buttons={[14,16,18,20,22].map(v => ({ value: String(v), label: String(v) }))} />
              <Text style={styles.editorSectionLabel}>Text weight</Text>
              <ChoiceTabs variant="choices" value={String(targetAppearance.fontWeight)} onValueChange={v => changeAppearance({ fontWeight: Number(v) })} buttons={[{ value: '400', label: 'Regular' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' }, { value: '800', label: 'Heavy' }]} />
              <ChoiceTabs variant="choices" value={targetAppearance.align} onValueChange={v => changeAppearance({ align: v as 'left' | 'center' | 'right' })} buttons={['left','center','right'].map(v => ({ value: v, label: v }))} />
              <Text style={styles.editorSectionLabel}>Minimum tile height</Text>
              <ChoiceTabs variant="choices" value={String(targetAppearance.height)} onValueChange={v => changeAppearance({ height: Number(v) })} buttons={[88,104,116,128,152].map(v => ({ value: String(v), label: String(v) }))} />
              {tileTarget.productId && <Button onPress={() => toggleProductQuickList(tileTarget.productId!)}>{targetTile && 'showOnQuickList' in targetTile && targetTile.showOnQuickList ? 'Hide from Quick List' : 'Show in Quick List'}</Button>}
              <Button onPress={() => changeTile({ visible: targetTile?.visible === false })}>{targetTile?.visible === false ? 'Restore tile' : 'Hide tile'}</Button>
            </>}
            <Text style={styles.panelTitle}>Responsive columns</Text>
            {(['columnsExpanded', 'columnsMedium', 'columnsPhone'] as const).map((key, i) => <View key={key}><Text style={styles.editorSectionLabel}>{['Large tablet', 'Small tablet', 'Phone'][i]}</Text><ChoiceTabs variant="choices" value={String(layout[key] ?? 'auto')} onValueChange={v => setLayout(current => ({ ...current, [key]: v === 'auto' ? undefined : Number(v) }))} buttons={['auto', ...(i === 2 ? ['1','2'] : ['2','3','4'])].map(v => ({ value: v, label: v === 'auto' ? 'Automatic' : v }))} /></View>)}
          </View>
          <Button mode="outlined" onPress={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Hide' : 'More'} layout settings</Button>
          {showAdvanced && <><View style={styles.controlPanel}>
            <TouchableOpacity style={styles.defaultRow} onPress={() => setIsDefault((value) => !value)}>
              <Checkbox.Android status={isDefault ? 'checked' : 'unchecked'} />
              <Text style={styles.defaultText}>Load as default layout</Text>
            </TouchableOpacity>
            <FormField
              label="Quick order notes"
              mode="outlined"
              value={quickOrderNotesText}
              onChangeText={updateQuickOrderNotes}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.multilineInput]}
            />
            <Text style={styles.helperText}>One option per line. These appear in POS and print as order notes.</Text>
            <FormField
              label="Quick item notes"
              mode="outlined"
              value={quickItemNotesText}
              onChangeText={updateQuickItemNotes}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.multilineInput]}
            />
            <Text style={styles.helperText}>One option per line. These appear as shortcuts in the Item note dialog.</Text>

          </View>

          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{selectedCategoryId ? selectedCategoryName : 'Groups'}</Text>
            <Text style={styles.countBadge}>
              {selectedCategoryId ? `${orderedProducts.length} items` : `${orderedCategories.length} groups`}
            </Text>
          </View>

          {!selectedCategoryId && (
            <View style={styles.editorHintRow}>
              <Button mode="outlined" icon="plus-box-outline" onPress={() => confirmReplace(startNewLayout)} style={styles.fullButton}>
                New layout from menu
              </Button>
              <Button mode="contained-tonal" icon="folder-plus-outline" onPress={openVirtualGroupDialog} style={styles.fullButton}>
                Create virtual group
              </Button>
            </View>
          )}

          {!selectedCategoryId && orderedCategories.map((category, index) => (
            <View key={category.categoryId} style={styles.editorRow}>
              <View style={styles.editorRowMain}>
                <View style={styles.editorSection}>
                  <Text style={styles.editorSectionLabel}>Identity</Text>
                  <View style={styles.editorTitleRow}>
                    <View style={[styles.editorColorDot, { backgroundColor: categoryColor(category.categoryId) }]} />
                    <Text style={styles.editorTitle}>{category.displayName}</Text>
                  </View>
                  <Text style={styles.editorSummaryText}>
                    {category.isVirtual
                      ? `Merged from ${category.sourceNames.join(' + ')}`
                      : `Source group: ${category.sourceNames.join(', ')}`}
                  </Text>
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.editorSectionLabel}>Label</Text>
                  <FormField
                    label="POS group name"
                    mode="outlined"
                    value={category.title || category.displayName}
                    onChangeText={(text) => updateCategoryTitle(category.categoryId, text)}
                    style={styles.inlineInput}
                  />
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.editorSectionLabel}>Behavior</Text>
                  <View style={styles.sourceBadgeRow}>
                    {category.sourceNames.map((name) => (
                      <Text key={name} style={styles.sourceBadge}>{name}</Text>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.inlineToggleRow}
                    onPress={() => toggleCategoryTopLevelProducts(category.categoryId)}
                  >
                    <Checkbox.Android status={category.showProductsOnTopLevel ? 'checked' : 'unchecked'} />
                    <Text style={styles.inlineToggleText}>Skip next level and show items here</Text>
                  </TouchableOpacity>
                  <Text style={styles.editorSummaryText}>
                    {category.showProductsOnTopLevel ? 'Shows items immediately on POS' : 'Keeps the next category level on POS'}
                  </Text>
                  {category.isVirtual && (
                    <TouchableOpacity
                      style={styles.inlineToggleRow}
                      onPress={() => openEditVirtualGroupDialog(category)}
                    >
                      <IconButton icon="pencil" size={18} />
                      <Text style={styles.inlineToggleText}>
                        {category.hideSourceCategories ? 'Edit virtual group and hidden source groups' : 'Edit virtual group'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.editorSectionLabel}>Appearance</Text>
                  {renderColorSwatches(categoryColor(category.categoryId), (color) => updateCategoryColor(category.categoryId, color))}
                </View>
              </View>
              <View style={styles.orderControls}>
                <IconButton icon="arrow-collapse-up" size={18} onPress={() => moveCategoryToEdge(index, 'top')} disabled={index === 0} />
                <IconButton icon="arrow-up" size={18} onPress={() => moveCategory(index, -1)} disabled={index === 0} />
                <IconButton icon="arrow-down" size={18} onPress={() => moveCategory(index, 1)} disabled={index === orderedCategories.length - 1} />
                <IconButton icon="arrow-collapse-down" size={18} onPress={() => moveCategoryToEdge(index, 'bottom')} disabled={index === orderedCategories.length - 1} />
                {category.isVirtual && (
                  <IconButton icon="trash-can-outline" size={18} onPress={() => deleteVirtualGroup(category.categoryId)} />
                )}
                <IconButton icon="chevron-right" size={18} onPress={() => setSelectedCategoryId(category.categoryId)} />
              </View>
            </View>
          ))}

          {selectedCategoryId && (
            <Button mode="outlined" icon="arrow-left" onPress={() => setSelectedCategoryId(null)} style={styles.fullButton}>
              Back to groups
            </Button>
          )}

          {selectedCategoryId && (
            <>
              {orderedProducts.map((product, index) => (
                <View key={product.id} style={styles.editorRow}>
                  <View style={styles.editorRowMain}>
                    <View style={styles.editorSection}>
                      <Text style={styles.editorSectionLabel}>Identity</Text>
                      <View style={styles.editorTitleRow}>
                        <View style={[styles.editorColorDot, { backgroundColor: productColor(product.id) || '#f9fafb' }]} />
                        <Text style={styles.editorTitle}>{product.name}</Text>
                      </View>
                    </View>
                    <View style={styles.editorSection}>
                      <Text style={styles.editorSectionLabel}>Behavior</Text>
                      <TouchableOpacity
                        style={styles.inlineToggleRow}
                        onPress={() => toggleProductQuickList(product.id)}
                      >
                        <Checkbox.Android
                          status={
                            selectedLayoutCategory?.products.find((layoutProduct) => layoutProduct.productId === product.id)?.showOnQuickList
                              ? 'checked'
                              : 'unchecked'
                          }
                        />
                        <Text style={styles.inlineToggleText}>Show on quick list</Text>
                      </TouchableOpacity>
                      <Text style={styles.editorSummaryText}>
                        {selectedLayoutCategory?.products.find((layoutProduct) => layoutProduct.productId === product.id)?.showOnQuickList
                          ? 'Appears in the POS quick list overlay'
                          : 'Only appears in its category flow'}
                      </Text>
                    </View>
                    <View style={styles.editorSection}>
                      <Text style={styles.editorSectionLabel}>Appearance</Text>
                      {renderColorSwatches(productColor(product.id), (color) => updateProductColor(product.id, color))}
                    </View>
                  </View>
                  <View style={styles.orderControls}>
                    <IconButton icon="arrow-collapse-up" size={18} onPress={() => moveProductToEdge(index, 'top')} disabled={index === 0} />
                    <IconButton icon="arrow-up" size={18} onPress={() => moveProduct(index, -1)} disabled={index === 0} />
                    <IconButton icon="arrow-down" size={18} onPress={() => moveProduct(index, 1)} disabled={index === orderedProducts.length - 1} />
                    <IconButton icon="arrow-collapse-down" size={18} onPress={() => moveProductToEdge(index, 'bottom')} disabled={index === orderedProducts.length - 1} />
                  </View>
                </View>
              ))}
            </>
          )}
          </>}
        </ScrollView><View style={{ padding: 16, borderTopWidth: 1, borderColor: t.color.border, flexDirection: 'column', gap: 8 }}><Button mode="outlined" contentStyle={{ minHeight: 48 }} loading={saving} disabled={saving || loading || !layoutName.trim()} onPress={handleSave}>Save layout</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={handleUseLayout} disabled={saving || loading}>Apply to this POS</Button><Button mode="outlined" onPress={() => router.push('/pos')}>Open POS</Button></View></View>
      </View>

        {virtualDialogVisible && <EditorSheet visible title={editingVirtualCategoryId ? 'Edit virtual group' : 'Create virtual group'} onDismiss={() => setVirtualDialogVisible(false)} footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setVirtualDialogVisible(false)}>Cancel</Button>{editingVirtualCategoryId && <Button textColor={t.color.danger} onPress={() => deleteVirtualGroup(editingVirtualCategoryId)}>Delete</Button>}<Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={!virtualName.trim() || Object.values(virtualSourceIds).filter(Boolean).length < 2} onPress={saveVirtualGroup}>{editingVirtualCategoryId ? 'Save group' : 'Create group'}</Button></>}>
            <FormField
              label="POS group name"
              mode="outlined"
              value={virtualName}
              onChangeText={setVirtualName}
              style={styles.input}
            />
            <Text style={{ fontSize: 14, fontWeight: '700', color: t.color.text }}>Source groups</Text>
            <Text style={{ color: t.color.muted, fontSize: 14 }}>Select at least two groups to combine.</Text>
            <View style={styles.virtualSourceList}>
              {topLevelCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={category.name}
                  accessibilityState={{ checked: !!virtualSourceIds[category.id] }}
                  style={styles.virtualSourceRow}
                  onPress={() => toggleVirtualSource(category.id)}
                >
                  <Checkbox.Android status={virtualSourceIds[category.id] ? 'checked' : 'unchecked'} />
                  <Text style={styles.virtualSourceText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.inlineToggleRow}
              onPress={() => setVirtualHideSourceCategories((value) => !value)}
            >
              <Checkbox.Android status={virtualHideSourceCategories ? 'checked' : 'unchecked'} />
              <Text style={styles.inlineToggleText}>Hide source groups on POS</Text>
            </TouchableOpacity>
        </EditorSheet>}

        {customColorPicker && <EditorSheet visible title="Custom colour"  onDismiss={() => setCustomColorPicker(null)} footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setCustomColorPicker(null)}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={!normalizeHexColor(customColorDraft)} onPress={applyCustomColor}>Apply colour</Button></>}>
            <FormField label="Hex colour" value={customColorDraft} onChangeText={setCustomColorDraft} autoCapitalize="none" autoCorrect={false} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: t.color.text }}>Colour palette</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[t.color.primary, t.color.navy, t.color.danger, '#C09235', '#81769B'].map((color) => <TouchableOpacity key={color} accessibilityRole="button" accessibilityLabel={`Use colour ${color}`} onPress={() => setCustomColorDraft(color)} style={{ width: 48, height: 48, borderRadius: 24, padding: 3, borderWidth: 1, borderColor: normalizeHexColor(customColorDraft)?.toUpperCase() === color.toUpperCase() ? t.color.primary : t.color.border }}><View style={{ flex: 1, borderRadius: 24, backgroundColor: color }} /></TouchableOpacity>)}</View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: t.color.text }}>Brightness</Text>
            <ColorPicker
              value={normalizeHexColor(customColorDraft) || DEFAULT_POS_BUTTON_COLOR}
              onChangeJS={(colors) => setCustomColorDraft(colors.hex)}
              onCompleteJS={(colors) => setCustomColorDraft(colors.hex)}
              thumbSize={28}
              sliderThickness={20}
              style={styles.colorPicker}
            >
              <BrightnessSlider style={styles.pickerSlider} />
              <Preview hideText style={{ height: 80, borderRadius: 16 }} />
            </ColorPicker>
        </EditorSheet>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.background },
  header: { backgroundColor: BRAND_COLORS.header },
  headerTitle: { color: t.color.surface, fontWeight: '700' },
  body: { flex: 1, flexDirection: 'row', gap: 16, padding: 16, minHeight: 0 },
  previewPane: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: 'transparent', borderRadius: t.radius.card, overflow: 'hidden' },
  settingsPane: { flexShrink: 0, minWidth: 0, minHeight: 0, backgroundColor: t.color.surface, borderRadius: t.radius.card },
  settingsContent: { padding: 16, gap: 16 },
  controlPanel: {
    gap: 12,
    backgroundColor: t.color.surface,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  panelTitle: { color: t.color.text, fontSize: 15, fontWeight: '700' },
  defaultBadge: {
    color: t.color.success,
    backgroundColor: t.color.successTint,
    borderRadius: t.radius.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '900',
  },
  countBadge: {
    color: t.color.text,
    backgroundColor: t.color.background,
    borderRadius: t.radius.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '900',
  },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { flexGrow: 1, minWidth: 130, borderRadius: t.radius.card },
  editorHintRow: { flexDirection: 'row', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  previewToolbar: { padding: 20, paddingBottom: 0, gap: 12 },
  searchButton: { borderRadius: t.radius.card },
  previewHint: { color: t.color.muted, fontSize: 14, fontWeight: '700' },
  tileGrid: { padding: 10, paddingBottom: 24 },
  groupCard: {
    flex: 1,
    minHeight: 132,
    margin: 5,
    borderRadius: t.radius.card,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  groupCardText: { color: t.color.text, fontSize: 16, fontWeight: '700', textAlign: 'left' },
  menuHeader: {
    minHeight: 82,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  backButton: { borderRadius: t.radius.card },
  menuHeaderText: { flex: 1 },
  menuTitle: { color: t.color.text, fontSize: 24, fontWeight: '800' },
  menuSubtitle: { color: t.color.muted, marginTop: 2 },
  productCard: {
    flex: 1,
    minHeight: 132,
    margin: 5,
    borderRadius: t.radius.card,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 12,
    justifyContent: 'space-between',
  },
  productName: { color: t.color.text, fontSize: 16, fontWeight: '800' },
  productPrice: { color: t.color.text, fontSize: 20, fontWeight: '900' },
  customColorText: { color: t.color.surface },
  emptyText: { color: t.color.muted, fontSize: 16, fontWeight: '700', padding: 24, textAlign: 'center' },
  menuBox: { zIndex: 10 },
  input: { backgroundColor: t.color.surface },
  multilineInput: { minHeight: 118 },
  helperText: { color: t.color.muted, fontSize: 14, fontWeight: '700' },
  inlineInput: { backgroundColor: t.color.surface },
  fullButton: { borderRadius: t.radius.card },
  defaultRow: { flexDirection: 'row', alignItems: 'center' },
  defaultText: { color: t.color.text, fontWeight: '700' },
  inlineToggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginLeft: -8 },
  inlineToggleText: { flex: 1, color: t.color.text, fontSize: 14, fontWeight: '700' },
  editorRow: {
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radius.card,
    padding: 16,
    flexDirection: 'column',
    gap: 16,
    backgroundColor: t.color.surface,
  },
  editorRowMain: { gap: 16 },
  editorSection: { gap: 8 },
  editorSectionLabel: { color: t.color.muted, fontSize: 14, fontWeight: '700' },
  editorSummaryText: { color: t.color.text, fontSize: 14, fontWeight: '700' },
  editorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorColorDot: {
    width: 16,
    height: 16,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  editorTitle: { color: t.color.text, fontSize: 14, fontWeight: '900' },
  orderControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
  sourceBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceBadge: {
    color: t.color.text,
    backgroundColor: t.color.border,
    borderRadius: t.radius.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '800',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.color.surface,
  },
  colorSwatchSelected: { borderColor: t.color.text },
  customColorSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface,
    borderColor: '#9ca3af',
  },
  customColorPlusText: { color: t.color.text, fontSize: 14, fontWeight: '900', lineHeight: 14 },
  dialog: { backgroundColor: t.color.surface },
  colorPicker: { width: '100%', gap: 12 },
  pickerPreview: { height: 42, borderRadius: t.radius.card },
  pickerPreviewText: { fontSize: 14, fontWeight: '800' },
  pickerPanel: { height: 210, borderRadius: t.radius.card },
  pickerSlider: { borderRadius: t.radius.card },
  virtualSourceList: { marginTop: 12, gap: 4 },
  virtualSourceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  virtualSourceText: { color: t.color.text, fontWeight: '800' },
});
