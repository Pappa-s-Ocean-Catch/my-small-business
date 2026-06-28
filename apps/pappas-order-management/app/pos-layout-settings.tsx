import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, Checkbox, Dialog, IconButton, Menu, Portal, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import ColorPicker, { BrightnessSlider, HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_POS_BUTTON_COLOR,
  DEFAULT_POS_QUICK_ORDER_NOTES,
  fetchPosLayouts,
  PosLayoutCategory,
  PosLayoutData,
  PosLayoutRecord,
  savePosLayout,
  setSelectedPosLayoutId,
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

const COLOR_OPTIONS = [
  '#1f2937',
  '#1d4ed8',
  '#047857',
  '#b91c1c',
  '#7e22ce',
  '#c2410c',
  '#0f766e',
  '#ca8a04',
  '#be123c',
  '#4338ca',
  '#0369a1',
  '#15803d',
  '#a16207',
  '#0e7490',
  '#6d28d9',
  '#9f1239',
];

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
  const router = useRouter();
  const [categories, setCategories] = useState<SaleCategory[]>([]);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [layouts, setLayouts] = useState<PosLayoutRecord[]>([]);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('Default POS Layout');
  const [isDefault, setIsDefault] = useState(true);
  const [layout, setLayout] = useState<PosLayoutData>({
    version: 1,
    quickOrderNotes: DEFAULT_POS_QUICK_ORDER_NOTES,
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
  const [customColorDraft, setCustomColorDraft] = useState('#111827');

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
          displayName: layoutCategory.title || sourceNames[0],
          sourceNames,
          isVirtual: !topLevelCategoryIds.has(layoutCategory.categoryId),
        };
      })
      .filter((category): category is LayoutGroupView => Boolean(category));
  }, [layout.categories, topLevelCategories]);

  const selectedLayoutCategory = layoutGroupViews.find((category) => category.categoryId === selectedCategoryId) ?? null;
  const selectedCategoryName = selectedLayoutCategory?.displayName ?? 'Items';
  const quickOrderNotesText = (layout.quickOrderNotes?.length ? layout.quickOrderNotes : DEFAULT_POS_QUICK_ORDER_NOTES).join('\n');

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
      .filter((category) => category.sourceCategoryIds.some((categoryId) => (
        nextCategories.some((sourceCategory) => sourceCategory.id === categoryId)
      )));

    const missingDefaultCategories = defaultLayout.categories
      .filter((category) => !sourceCategoryIds.has(category.categoryId));

    return {
      version: 1,
      quickOrderNotes: sourceLayout.quickOrderNotes?.length
        ? sourceLayout.quickOrderNotes
        : DEFAULT_POS_QUICK_ORDER_NOTES,
      categories: [...syncedExistingCategories, ...missingDefaultCategories],
    };
  };

  const loadData = async () => {
    setLoading(true);
    const [categoryResult, productResult, layoutResult] = await Promise.all([
      supabase
        .from('sale_categories')
        .select('id, name, sort_order, parent_category_id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('sale_products')
        .select('id, name, sale_price, sale_category_id, sub_category_id, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      fetchPosLayouts(),
    ]);

    setLoading(false);
    if (categoryResult.error || productResult.error || layoutResult.error) {
      Alert.alert('POS layout', categoryResult.error?.message || productResult.error?.message || layoutResult.error || 'Could not load layout data.');
      return;
    }

    const nextCategories = (categoryResult.data || []) as SaleCategory[];
    const nextProducts = (productResult.data || []) as SaleProduct[];
    const nextLayouts = layoutResult.data || [];
    const preferred = nextLayouts.find((item) => item.is_default) || nextLayouts[0] || null;
    const nextLayout = syncLayoutWithCatalog(preferred?.layout || buildDefaultLayout(nextCategories, nextProducts), nextCategories, nextProducts);

    setCategories(nextCategories);
    setProducts(nextProducts);
    setLayouts(nextLayouts);
    setLayoutId(preferred?.id ?? null);
    setLayoutName(preferred?.name ?? 'Default POS Layout');
    setIsDefault(preferred?.is_default ?? true);
    setLayout(nextLayout);
    setSelectedCategoryId(nextLayout.categories[0]?.categoryId ?? null);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectLayout = (selected: PosLayoutRecord) => {
    const syncedLayout = syncLayoutWithCatalog(selected.layout, categories, products);
    setLayoutMenuVisible(false);
    setLayoutId(selected.id);
    setLayoutName(selected.name);
    setIsDefault(selected.is_default);
    setLayout(syncedLayout);
    setSelectedCategoryId(syncedLayout.categories[0]?.categoryId ?? null);
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
    updateCategory(categoryId, (category) => ({ ...category, color }));
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

  const updateProductColor = (productId: string, color: string) => {
    if (!selectedCategoryId) return;
    updateCategory(selectedCategoryId, (category) => ({
      ...category,
      products: category.products.map((product) => (
        product.productId === productId ? { ...product, color } : product
      )),
    }));
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
    setSelectedCategoryId(nextLayout.categories[0]?.categoryId ?? null);
  };

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
        categoryId: virtualCategoryId,
        title,
        sourceCategoryIds,
        hideSourceCategories: virtualHideSourceCategories,
        showProductsOnTopLevel: false,
        color: DEFAULT_POS_BUTTON_COLOR,
        products: [],
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
    const result = await savePosLayout({ id: layoutId ?? undefined, name: layoutName, layout, isDefault });
    setSaving(false);

    if (result.error) {
      Alert.alert('POS layout', result.error);
      return;
    }

    Alert.alert('POS layout', 'Layout saved.');
    await loadData();
  };

  const handleUseLayout = async () => {
    if (!layoutId) {
      Alert.alert('POS layout', 'Save this layout before using it on POS.');
      return;
    }

    await setSelectedPosLayoutId(layoutId);
    router.back();
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
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} iconColor="#fff" />
        <Appbar.Content title="POS Layout" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="content-save" onPress={handleSave} iconColor="#fff" disabled={saving} />
      </Appbar.Header>

      <View style={styles.body}>
        <View style={styles.previewPane}>
          <View style={styles.previewToolbar}>
            <Button mode="contained" icon="magnify" style={styles.searchButton}>Search items</Button>
          </View>

          {!selectedCategoryId ? (
            <FlatList
              data={orderedCategories}
              keyExtractor={(item) => item.categoryId}
              numColumns={3}
              key="layout-groups"
              contentContainerStyle={styles.tileGrid}
              ListEmptyComponent={<Text style={styles.emptyText}>{loading ? 'Loading layout...' : 'No categories'}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.groupCard, { backgroundColor: categoryColor(item.categoryId) }]}
                  onPress={() => setSelectedCategoryId(item.categoryId)}
                >
                  <Text style={styles.groupCardText} numberOfLines={3}>{item.displayName}</Text>
                </TouchableOpacity>
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
                data={orderedProducts}
                keyExtractor={(item) => item.id}
                numColumns={3}
                key="layout-products"
                contentContainerStyle={styles.tileGrid}
                ListEmptyComponent={<Text style={styles.emptyText}>No items in this group</Text>}
                renderItem={({ item }) => {
                  const color = productColor(item.id);
                  return (
                    <View style={[styles.productCard, color ? { backgroundColor: color, borderColor: color } : null]}>
                      <Text style={[styles.productName, color ? styles.customColorText : null]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[styles.productPrice, color ? styles.customColorText : null]}>${item.sale_price.toFixed(2)}</Text>
                    </View>
                  );
                }}
              />
            </>
          )}
        </View>

        <ScrollView style={styles.settingsPane} contentContainerStyle={styles.settingsContent}>
          <View style={styles.controlPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Layout</Text>
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
                  <Menu.Item key={item.id} onPress={() => selectLayout(item)} title={`${item.name}${item.is_default ? ' (default)' : ''}`} />
                ))}
                <Menu.Item onPress={startNewLayout} title="New layout from menu" />
              </Menu>
            </View>
            <TextInput
              label="Layout name"
              mode="outlined"
              value={layoutName}
              onChangeText={setLayoutName}
              style={styles.input}
            />
            <TouchableOpacity style={styles.defaultRow} onPress={() => setIsDefault((value) => !value)}>
              <Checkbox status={isDefault ? 'checked' : 'unchecked'} />
              <Text style={styles.defaultText}>Load as default layout</Text>
            </TouchableOpacity>
            <TextInput
              label="Quick order notes"
              mode="outlined"
              value={quickOrderNotesText}
              onChangeText={updateQuickOrderNotes}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.multilineInput]}
            />
            <Text style={styles.helperText}>One option per line. These appear in POS and print as order notes.</Text>
            <View style={styles.actionRow}>
              <Button mode="contained" icon="content-save" onPress={handleSave} loading={saving} disabled={saving} style={styles.actionButton}>
                Save
              </Button>
              <Button mode="outlined" icon="play-box-outline" onPress={handleUseLayout} style={styles.actionButton}>
                Use on POS
              </Button>
            </View>
          </View>

          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{selectedCategoryId ? selectedCategoryName : 'Groups'}</Text>
            <Text style={styles.countBadge}>
              {selectedCategoryId ? `${orderedProducts.length} items` : `${orderedCategories.length} groups`}
            </Text>
          </View>

          {!selectedCategoryId && (
            <View style={styles.editorHintRow}>
              <Button mode="outlined" icon="plus-box-outline" onPress={startNewLayout} style={styles.fullButton}>
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
                <View style={styles.editorTitleRow}>
                  <View style={[styles.editorColorDot, { backgroundColor: categoryColor(category.categoryId) }]} />
                  <Text style={styles.editorTitle}>{category.displayName}</Text>
                </View>
                <TextInput
                  label="POS group name"
                  mode="outlined"
                  value={category.title || category.displayName}
                  onChangeText={(text) => updateCategoryTitle(category.categoryId, text)}
                  style={styles.inlineInput}
                />
                <View style={styles.sourceBadgeRow}>
                  {category.sourceNames.map((name) => (
                    <Text key={name} style={styles.sourceBadge}>{name}</Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.inlineToggleRow}
                  onPress={() => toggleCategoryTopLevelProducts(category.categoryId)}
                >
                  <Checkbox status={category.showProductsOnTopLevel ? 'checked' : 'unchecked'} />
                  <Text style={styles.inlineToggleText}>Skip next level and show items here</Text>
                </TouchableOpacity>
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
                {renderColorSwatches(categoryColor(category.categoryId), (color) => updateCategoryColor(category.categoryId, color))}
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
                    <View style={styles.editorTitleRow}>
                      <View style={[styles.editorColorDot, { backgroundColor: productColor(product.id) || '#f9fafb' }]} />
                      <Text style={styles.editorTitle}>{product.name}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.inlineToggleRow}
                      onPress={() => toggleProductQuickList(product.id)}
                    >
                      <Checkbox
                        status={
                          selectedLayoutCategory?.products.find((layoutProduct) => layoutProduct.productId === product.id)?.showOnQuickList
                            ? 'checked'
                            : 'unchecked'
                        }
                      />
                      <Text style={styles.inlineToggleText}>Show on quick list</Text>
                    </TouchableOpacity>
                    {renderColorSwatches(productColor(product.id), (color) => updateProductColor(product.id, color))}
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
        </ScrollView>
      </View>

      <Portal>
        <Dialog visible={virtualDialogVisible} onDismiss={() => setVirtualDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>{editingVirtualCategoryId ? 'Edit virtual group' : 'Create virtual group'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="POS group name"
              mode="outlined"
              value={virtualName}
              onChangeText={setVirtualName}
              style={styles.input}
            />
            <View style={styles.virtualSourceList}>
              {topLevelCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.virtualSourceRow}
                  onPress={() => toggleVirtualSource(category.id)}
                >
                  <Checkbox status={virtualSourceIds[category.id] ? 'checked' : 'unchecked'} />
                  <Text style={styles.virtualSourceText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.inlineToggleRow}
              onPress={() => setVirtualHideSourceCategories((value) => !value)}
            >
              <Checkbox status={virtualHideSourceCategories ? 'checked' : 'unchecked'} />
              <Text style={styles.inlineToggleText}>Hide source groups on POS</Text>
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVirtualDialogVisible(false)}>Cancel</Button>
            {editingVirtualCategoryId && (
              <Button textColor="#dc2626" onPress={() => deleteVirtualGroup(editingVirtualCategoryId)}>Delete</Button>
            )}
            <Button onPress={saveVirtualGroup}>{editingVirtualCategoryId ? 'Save' : 'Create'}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(customColorPicker)} onDismiss={() => setCustomColorPicker(null)} style={styles.dialog}>
          <Dialog.Title>Custom color</Dialog.Title>
          <Dialog.Content>
            <ColorPicker
              value={customColorDraft}
              onChangeJS={(colors) => setCustomColorDraft(colors.hex)}
              onCompleteJS={(colors) => setCustomColorDraft(colors.hex)}
              thumbSize={28}
              sliderThickness={20}
              style={styles.colorPicker}
            >
              <Preview style={styles.pickerPreview} textStyle={styles.pickerPreviewText} />
              <Panel1 style={styles.pickerPanel} />
              <HueSlider style={styles.pickerSlider} />
              <BrightnessSlider style={styles.pickerSlider} />
            </ColorPicker>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCustomColorPicker(null)}>Cancel</Button>
            <Button onPress={applyCustomColor}>Apply</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { backgroundColor: '#1f2937' },
  headerTitle: { color: '#fff', fontWeight: '700' },
  body: { flex: 1, flexDirection: 'row', gap: 12, padding: 12 },
  previewPane: { flex: 1, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
  settingsPane: { flex: 1, backgroundColor: '#fff', borderRadius: 8 },
  settingsContent: { padding: 10, gap: 8 },
  controlPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  defaultBadge: {
    color: '#166534',
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  countBadge: {
    color: '#374151',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, borderRadius: 8 },
  editorHintRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  previewToolbar: { padding: 10, paddingBottom: 0 },
  searchButton: { borderRadius: 8 },
  tileGrid: { padding: 10, paddingBottom: 24 },
  groupCard: {
    flex: 1,
    minHeight: 132,
    margin: 5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#243244',
  },
  groupCardText: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  menuHeader: {
    minHeight: 82,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: { borderRadius: 8 },
  menuHeaderText: { flex: 1 },
  menuTitle: { color: '#111827', fontSize: 24, fontWeight: '800' },
  menuSubtitle: { color: '#6b7280', marginTop: 2 },
  productCard: {
    flex: 1,
    minHeight: 132,
    margin: 5,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    justifyContent: 'space-between',
  },
  productName: { color: '#111827', fontSize: 16, fontWeight: '800' },
  productPrice: { color: '#dc2626', fontSize: 20, fontWeight: '900' },
  customColorText: { color: '#fff' },
  emptyText: { color: '#6b7280', fontSize: 16, fontWeight: '700', padding: 24, textAlign: 'center' },
  menuBox: { zIndex: 10 },
  input: { backgroundColor: '#fff' },
  multilineInput: { minHeight: 118 },
  helperText: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  inlineInput: { backgroundColor: '#fff' },
  fullButton: { borderRadius: 8 },
  defaultRow: { flexDirection: 'row', alignItems: 'center' },
  defaultText: { color: '#111827', fontWeight: '700' },
  inlineToggleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: -8 },
  inlineToggleText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  editorRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#f9fafb',
  },
  editorRowMain: { flex: 1, gap: 6 },
  editorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  editorTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  orderControls: { flexDirection: 'row', alignItems: 'center' },
  sourceBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceBadge: {
    color: '#374151',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  colorSwatchSelected: { borderColor: '#111827' },
  customColorSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderColor: '#9ca3af',
  },
  customColorPlusText: { color: '#111827', fontSize: 14, fontWeight: '900', lineHeight: 14 },
  dialog: { backgroundColor: '#fff' },
  colorPicker: { width: '100%', gap: 12 },
  pickerPreview: { height: 42, borderRadius: 8 },
  pickerPreviewText: { fontSize: 13, fontWeight: '800' },
  pickerPanel: { height: 210, borderRadius: 8 },
  pickerSlider: { borderRadius: 8 },
  virtualSourceList: { marginTop: 12, gap: 4 },
  virtualSourceRow: { flexDirection: 'row', alignItems: 'center' },
  virtualSourceText: { color: '#111827', fontWeight: '800' },
});
