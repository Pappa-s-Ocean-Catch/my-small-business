import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui/EditorSheet';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { CatalogueTabs } from '@/components/ui/CatalogueTabs';
import { SearchField } from '@/components/ui';
import { ManagementRow } from '@/components/ui/ManagementRow';
import { WorkspaceHeader } from '@/components/ui';
import { useWindowDimensions } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { FormField, SectionHeader, Panel } from '@/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Checkbox, Chip, Icon, IconButton, Portal, Switch, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createMobileSaleCategory,
  createMobileSaleProduct,
  deleteMobileSaleCategory,
  deleteMobileSaleProduct,
  fetchMobileAddonGroups,
  fetchMobileAvailableProducts,
  fetchMobileSaleCategories,
  fetchMobileSaleProductDetails,
  fetchMobileSaleProducts,
  fetchSaleProductAddonGroupIds,
  MobileAddonGroup,
  MobileAvailableProduct,
  MobileSaleCategory,
  MobileSaleProduct,
  MobileSaleProductInclude,
  MobileSaleProductIngredient,
  updateMobileSaleCategory,
  updateMobileSaleProduct,
} from '@/lib/menu-admin';

type CategoryFormState = {
  name: string;
  description: string;
  section: string;
  sortOrder: string;
  parentCategoryId: string;
  isActive: boolean;
};

type ProductFormState = {
  name: string;
  description: string;
  section: string;
  searchTerm: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoText: string;
  price: string;
  imageUrl: string;
  saleCategoryId: string;
  subCategoryId: string;
  sortOrder: string;
  prepMinutes: string;
  isActive: boolean;
  isFeatured: boolean;
  warningThresholdUnits: string;
  alertThresholdUnits: string;
  addonGroupIds: string[];
  ingredients: ProductIngredientFormRow[];
  includedProducts: ProductIncludeFormRow[];
};

type ProductIngredientFormRow = {
  productId: string;
  productName: string;
  quantityRequired: string;
  unitOfMeasure: string;
  isOptional: boolean;
  customerCanRemove: boolean;
  notes: string;
};

type ProductIncludeFormRow = {
  saleProductId: string;
  productName: string;
  quantity: string;
};

type PickerTarget =
  | { type: 'ingredient'; index: number }
  | { type: 'include'; index: number };

const emptyCategoryForm: CategoryFormState = {
  name: '',
  description: '',
  section: '',
  sortOrder: '0',
  parentCategoryId: '',
  isActive: true,
};

const emptyProductForm: ProductFormState = {
  name: '',
  description: '',
  section: '',
  searchTerm: '',
  slug: '',
  seoTitle: '',
  seoDescription: '',
  seoText: '',
  price: '0',
  imageUrl: '',
  saleCategoryId: '',
  subCategoryId: '',
  sortOrder: '0',
  prepMinutes: '0',
  isActive: true,
  isFeatured: false,
  warningThresholdUnits: '',
  alertThresholdUnits: '',
  addonGroupIds: [],
  ingredients: [],
  includedProducts: [],
};

const DEFAULT_UNITS = ['units', 'cups', 'grams', 'ml', 'tbsp', 'tsp', 'lbs', 'oz'];
const KITCHEN_SECTION_OPTIONS = ['Fried', 'Grilled', 'Till'];

const parseIntSafe = (value: string, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatSafe = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSectionList = (value?: string | null) =>
  Array.from(
    new Set(
      (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is string => KITCHEN_SECTION_OPTIONS.includes(item))
    )
  );

const formatSectionList = (values: string[]) => parseSectionList(values.join(',')).join(',');

const toIngredientRow = (ingredient: MobileSaleProductIngredient): ProductIngredientFormRow => ({
  productId: ingredient.product_id,
  productName: ingredient.product_name || '',
  quantityRequired: String(ingredient.quantity_required ?? 1),
  unitOfMeasure: ingredient.unit_of_measure || 'units',
  isOptional: Boolean(ingredient.is_optional),
  customerCanRemove: Boolean(ingredient.customer_can_remove),
  notes: ingredient.notes || '',
});

const toIncludeRow = (row: MobileSaleProductInclude): ProductIncludeFormRow => ({
  saleProductId: row.included_sale_product_id,
  productName: row.included_product_name || '',
  quantity: String(row.quantity ?? 1),
});

export default function MenuManagementScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 600;
  const router = useRouter();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const [categories, setCategories] = useState<MobileSaleCategory[]>([]);
  const [products, setProducts] = useState<MobileSaleProduct[]>([]);
  const [addonGroups, setAddonGroups] = useState<MobileAddonGroup[]>([]);
  const [availableProducts, setAvailableProducts] = useState<MobileAvailableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  useEffect(() => {
    if (requestedTab === 'products' || requestedTab === 'categories') setActiveTab(requestedTab);
  }, [requestedTab]);
  const [productEditorTab, setProductEditorTab] = useState<'overview' | 'seo' | 'ingredients' | 'addons' | 'bundle'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);
  const [parentCategoryExpanded, setParentCategoryExpanded] = useState(false);
  useEffect(() => { setParentCategoryExpanded(false); }, [categoryDialogVisible]);
  const [productDialogVisible, setProductDialogVisible] = useState(false);
  const [pickerDialogVisible, setPickerDialogVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MobileSaleCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<MobileSaleProduct | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [productBaseline, setProductBaseline] = useState('');
  const [categoryBaseline, setCategoryBaseline] = useState('');
  useEffect(() => { if (productDialogVisible) setProductBaseline(JSON.stringify(productForm)); }, [productDialogVisible]);
  useEffect(() => { if (categoryDialogVisible) setCategoryBaseline(JSON.stringify(categoryForm)); }, [categoryDialogVisible]);


  const loadData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const [nextCategories, nextProducts, nextAddonGroups, nextAvailableProducts] = await Promise.all([
        fetchMobileSaleCategories(),
        fetchMobileSaleProducts(),
        fetchMobileAddonGroups(),
        fetchMobileAvailableProducts(),
      ]);

      setCategories(nextCategories);
      setProducts(nextProducts);
      setAddonGroups(nextAddonGroups);
      setAvailableProducts(nextAvailableProducts);
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Unable to load menu data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parent_category_id),
    [categories]
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const groupedCategories = useMemo(
    () => topLevelCategories.map((category) => ({
      ...category,
      children: categories.filter((child) => child.parent_category_id === category.id),
    })),
    [categories, topLevelCategories]
  );

  const visibleCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    return groupedCategories.flatMap((category) => {
      const parentMatches = !query || category.name.toLowerCase().includes(query);
      const children = parentMatches ? category.children : category.children.filter((child) => child.name.toLowerCase().includes(query));
      return parentMatches || children.length ? [category, ...children] : [];
    });
  }, [groupedCategories, categorySearch]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === 'all'
          || product.sale_category_id === selectedCategoryId
          || product.sub_category_id === selectedCategoryId;
      const search = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !search
        || product.name.toLowerCase().includes(search)
        || product.description?.toLowerCase().includes(search)
        || product.search_term?.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategoryId]);

  const subCategoriesForForm = useMemo(
    () => categories.filter((category) => category.parent_category_id === productForm.saleCategoryId),
    [categories, productForm.saleCategoryId]
  );

  const availableSaleProductsForBundle = useMemo(
    () => products.filter((product) => product.id !== editingProduct?.id),
    [products, editingProduct?.id]
  );

  const pickerOptions = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (pickerTarget?.type === 'ingredient') {
      return availableProducts
        .filter((item) => !query || item.name.toLowerCase().includes(query) || item.sku?.toLowerCase().includes(query))
        .map((item) => ({ id: item.id, name: item.name, subtitle: item.sku || 'Inventory product' }));
    }

    return availableSaleProductsForBundle
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .map((item) => ({ id: item.id, name: item.name, subtitle: `$${(item.sale_price ?? 0).toFixed(2)}` }));
  }, [availableProducts, availableSaleProductsForBundle, pickerSearch, pickerTarget]);

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      ...emptyCategoryForm,
      parentCategoryId: selectedCategoryId !== 'all' && categories.some((category) => category.id === selectedCategoryId)
        ? selectedCategoryId
        : '',
    });
    setCategoryDialogVisible(true);
  };

  const openEditCategory = (category: MobileSaleCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      section: formatSectionList(parseSectionList(category.section)),
      sortOrder: String(category.sort_order ?? 0),
      parentCategoryId: category.parent_category_id || '',
      isActive: category.is_active !== false,
    });
    setCategoryDialogVisible(true);
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductEditorTab('overview');
    setProductForm({
      ...emptyProductForm,
      saleCategoryId: topLevelCategories.find((category) => category.id === selectedCategoryId)?.id || '',
      subCategoryId: categories.find((category) => category.id === selectedCategoryId && category.parent_category_id)?.id || '',
    });
    setProductDialogVisible(true);
  };

  const openEditProduct = async (product: MobileSaleProduct) => {
    try {
      setSaving(true);
      const [details, productAddonGroupIds] = await Promise.all([
        fetchMobileSaleProductDetails(product.id),
        fetchSaleProductAddonGroupIds(product.id),
      ]);
      setEditingProduct(product);
      setProductEditorTab('overview');
      setProductForm({
        name: details.name,
        description: details.description || '',
        section: formatSectionList(parseSectionList(details.section)),
        searchTerm: details.search_term || '',
        slug: details.slug || '',
        seoTitle: details.seo_title || '',
        seoDescription: details.seo_description || '',
        seoText: details.seo_text || '',
        price: String(details.sale_price ?? 0),
        imageUrl: details.image_url || '',
        saleCategoryId: details.sale_category_id || '',
        subCategoryId: details.sub_category_id || '',
        sortOrder: String(details.sort_order ?? 0),
        prepMinutes: String(details.preparation_time_minutes ?? 0),
        isActive: details.is_active !== false,
        isFeatured: details.is_featured === true,
        warningThresholdUnits: details.warning_threshold_units == null ? '' : String(details.warning_threshold_units),
        alertThresholdUnits: details.alert_threshold_units == null ? '' : String(details.alert_threshold_units),
        addonGroupIds: productAddonGroupIds,
        ingredients: details.ingredients.map(toIngredientRow),
        includedProducts: details.included_products.map(toIncludeRow),
      });
      setProductDialogVisible(true);
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Unable to load product details.');
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        section: formatSectionList(parseSectionList(categoryForm.section)),
        sort_order: parseIntSafe(categoryForm.sortOrder),
        parent_category_id: categoryForm.parentCategoryId || null,
        is_active: categoryForm.isActive,
      };

      if (editingCategory) await updateMobileSaleCategory(editingCategory.id, payload);
      else await createMobileSaleCategory(payload);

      setCategoryDialogVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  };

  const buildProductPayload = () => ({
    name: productForm.name,
    description: productForm.description,
    section: formatSectionList(parseSectionList(productForm.section)),
    search_term: productForm.searchTerm,
    slug: productForm.slug,
    seo_title: productForm.seoTitle,
    seo_description: productForm.seoDescription,
    seo_text: productForm.seoText,
    sale_price: parseFloatSafe(productForm.price),
    image_url: productForm.imageUrl,
    sale_category_id: productForm.saleCategoryId || null,
    sub_category_id: productForm.subCategoryId || null,
    sort_order: parseIntSafe(productForm.sortOrder),
    is_active: productForm.isActive,
    is_featured: productForm.isFeatured,
    preparation_time_minutes: parseIntSafe(productForm.prepMinutes),
    warning_threshold_units: productForm.warningThresholdUnits.trim() ? parseIntSafe(productForm.warningThresholdUnits) : null,
    alert_threshold_units: productForm.alertThresholdUnits.trim() ? parseIntSafe(productForm.alertThresholdUnits) : null,
    addon_group_ids: productForm.addonGroupIds,
    ingredients: productForm.ingredients.map((row) => ({
      product_id: row.productId,
      quantity_required: parseFloatSafe(row.quantityRequired, 1),
      unit_of_measure: row.unitOfMeasure,
      is_optional: row.isOptional,
      customer_can_remove: row.customerCanRemove,
      notes: row.notes,
    })),
    included_products: productForm.includedProducts.map((row) => ({
      included_sale_product_id: row.saleProductId,
      quantity: parseIntSafe(row.quantity, 1),
    })),
  });

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      setProductEditorTab('overview');
      Alert.alert('Name required', 'Please enter a product name.');
      return;
    }

    try {
      setSaving(true);
      const payload = buildProductPayload();
      if (editingProduct) await updateMobileSaleProduct(editingProduct.id, payload);
      else await createMobileSaleProduct(payload);
      setProductDialogVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCategory = (category: MobileSaleCategory) => {
    Alert.alert('Delete category', `Delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMobileSaleCategory(category.id);
            await loadData();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete category.');
          }
        },
      },
    ]);
  };

  const confirmDeleteProduct = (product: MobileSaleProduct) => {
    Alert.alert('Delete product', `Delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMobileSaleProduct(product.id);
            await loadData();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete product.');
          }
        },
      },
    ]);
  };

  const openPicker = (target: PickerTarget) => {
    setPickerTarget(target);
    setPickerSearch('');
    setPickerDialogVisible(true);
  };

  const applyPickerSelection = (id: string, name: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.type === 'ingredient') {
      setProductForm((prev) => {
        const next = [...prev.ingredients];
        next[pickerTarget.index] = { ...(next[pickerTarget.index] ?? { quantityRequired: '1', unitOfMeasure: 'units', isOptional: false, customerCanRemove: false, notes: '' }), productId: id, productName: name };
        return { ...prev, ingredients: next };
      });
    } else {
      setProductForm((prev) => {
        const next = [...prev.includedProducts];
        next[pickerTarget.index] = { ...(next[pickerTarget.index] ?? { quantity: '1' }), saleProductId: id, productName: name };
        return { ...prev, includedProducts: next };
      });
    }
    setPickerDialogVisible(false);
  };

  const renderCategoryRow = (category: MobileSaleCategory, index: number) => (
    <ManagementRow key={category.id} first={index === 0} last={index === visibleCategories.length - 1} title={category.name} description={`${category.parent_category_id ? `Sub-category of ${categoryNameById.get(category.parent_category_id) || 'Unknown'}` : 'Main category'} · ${formatSectionList(parseSectionList(category.section)) || 'No section fallback'} · Sort ${category.sort_order ?? 0}`} active={category.is_active !== false} indent={!!category.parent_category_id} onEdit={() => openEditCategory(category)} onDelete={() => confirmDeleteCategory(category)} />
  );

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 20 }}>
        <View style={{ flex: 1, gap: 16 }}>
          <FormField label="Name" value={productForm.name} onChangeText={(name) => setProductForm((prev) => ({ ...prev, name }))} />
          <FormField label="Description" multiline value={productForm.description} onChangeText={(description) => setProductForm((prev) => ({ ...prev, description }))} />
          <FormField label="Search terms" value={productForm.searchTerm} onChangeText={(searchTerm) => setProductForm((prev) => ({ ...prev, searchTerm }))} />
          <FormField label="Sort order" keyboardType="number-pad" value={productForm.sortOrder} onChangeText={(sortOrder) => setProductForm((prev) => ({ ...prev, sortOrder }))} />
        </View>
        <View style={{ flex: 1, gap: 16 }}>
          <FormField label="Price" keyboardType="decimal-pad" value={productForm.price} onChangeText={(price) => setProductForm((prev) => ({ ...prev, price }))} />
          <View style={{ minHeight: 130, gap: 20 }}><Text style={{ fontWeight: '700' }}>Kitchen section</Text><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{KITCHEN_SECTION_OPTIONS.map((option) => {
            const selected = parseSectionList(productForm.section).includes(option);
            return <Button key={option} mode="outlined" hitSlop={2} buttonColor={selected ? t.color.primaryTint : t.color.surface} textColor={selected ? t.color.primary : t.color.text} contentStyle={{ height: 44, minHeight: 44 }} labelStyle={{ fontSize: 14, marginHorizontal: 15, marginVertical: 9 }} style={{ height: 44, borderColor: selected ? '#80B9B5' : t.color.border }} accessibilityState={{ selected }} onPress={() => setProductForm((prev) => { const current = parseSectionList(prev.section); return { ...prev, section: formatSectionList(current.includes(option) ? current.filter((item) => item !== option) : [...current, option]) }; })}>{option}</Button>;
          })}</View></View>
          <FormField label="Image URL" value={productForm.imageUrl} onChangeText={(imageUrl) => setProductForm((prev) => ({ ...prev, imageUrl }))} />
          <FormField label="Preparation time (minutes)" keyboardType="number-pad" value={productForm.prepMinutes} onChangeText={(prepMinutes) => setProductForm((prev) => ({ ...prev, prepMinutes }))} />
        </View>
      </View>
      <Text variant="labelMedium">Main category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {topLevelCategories.map((category) => (
          <Chip
            key={category.id}
            selected={productForm.saleCategoryId === category.id}
            onPress={() => setProductForm((prev) => ({ ...prev, saleCategoryId: category.id, subCategoryId: '' }))}
          >
            {category.name}
          </Chip>
        ))}
      </ScrollView>

      {subCategoriesForForm.length > 0 && (
        <>
          <Text variant="labelMedium">Sub-category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip selected={productForm.subCategoryId === ''} onPress={() => setProductForm((prev) => ({ ...prev, subCategoryId: '' }))}>None</Chip>
            {subCategoriesForForm.map((category) => (
              <Chip
                key={category.id}
                selected={productForm.subCategoryId === category.id}
                onPress={() => setProductForm((prev) => ({ ...prev, subCategoryId: category.id }))}
              >
                {category.name}
              </Chip>
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.switchRow}>
        <Text>Active</Text>
        <Switch value={productForm.isActive} onValueChange={(value) => setProductForm((prev) => ({ ...prev, isActive: value }))} />
      </View>
      <View style={styles.switchRow}>
        <Text>Featured</Text>
        <Switch value={productForm.isFeatured} onValueChange={(value) => setProductForm((prev) => ({ ...prev, isFeatured: value }))} />
      </View>
    </View>
  );

  const renderSeoTab = () => (
    <View style={styles.tabContent}>
      <FormField mode="outlined" label="Slug" value={productForm.slug} onChangeText={(value) => setProductForm((prev) => ({ ...prev, slug: value }))} />
      <FormField mode="outlined" label="SEO title" value={productForm.seoTitle} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoTitle: value }))} />
      <FormField mode="outlined" label="SEO description" value={productForm.seoDescription} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoDescription: value }))} multiline />
      <FormField mode="outlined" label="SEO text" value={productForm.seoText} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoText: value }))} multiline />
    </View>
  );

  const renderIngredientsTab = () => (
    <View style={styles.tabContent}>
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 20 }}>
        <FormField style={{ flex: 1 }} label="Warning threshold units" value={productForm.warningThresholdUnits} onChangeText={(value) => setProductForm((prev) => ({ ...prev, warningThresholdUnits: value }))} keyboardType="number-pad" />
        <FormField style={{ flex: 1 }} label="Alert threshold units" value={productForm.alertThresholdUnits} onChangeText={(value) => setProductForm((prev) => ({ ...prev, alertThresholdUnits: value }))} keyboardType="number-pad" />
      </View>
      <SectionHeader title="Inventory ingredients" action={<Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => openPicker({ type: 'ingredient', index: productForm.ingredients.length })}>Link inventory product</Button>} />
      {!productForm.ingredients.length && <Panel><Text style={styles.mutedText}>No inventory products linked yet.</Text></Panel>}

      {productForm.ingredients.map((row, index) => (
        <Card key={`ingredient-${index}`} style={styles.nestedCard}>
          <Card.Content style={styles.tabContent}>
            <View style={styles.inlineRow}>
              <Text variant="titleSmall" style={styles.flexText}>{row.productName || 'Choose inventory product'}</Text>
              <IconButton icon="delete-outline" onPress={() => setProductForm((prev) => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }))} />
            </View>
            <Button mode="outlined" onPress={() => openPicker({ type: 'ingredient', index })}>
              {row.productName ? 'Change Inventory Product' : 'Select Inventory Product'}
            </Button>
            <FormField mode="outlined" label="Quantity required" value={row.quantityRequired} onChangeText={(value) => setProductForm((prev) => {
              const next = [...prev.ingredients];
              next[index] = { ...next[index], quantityRequired: value };
              return { ...prev, ingredients: next };
            })} keyboardType="decimal-pad" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DEFAULT_UNITS.map((unit) => (
                <Chip
                  key={unit}
                  selected={row.unitOfMeasure === unit}
                  onPress={() => setProductForm((prev) => {
                    const next = [...prev.ingredients];
                    next[index] = { ...next[index], unitOfMeasure: unit };
                    return { ...prev, ingredients: next };
                  })}
                >
                  {unit}
                </Chip>
              ))}
            </ScrollView>
            <FormField mode="outlined" label="Notes" value={row.notes} onChangeText={(value) => setProductForm((prev) => {
              const next = [...prev.ingredients];
              next[index] = { ...next[index], notes: value };
              return { ...prev, ingredients: next };
            })} multiline />
            <View style={styles.switchRow}>
              <Text>Optional</Text>
              <Switch value={row.isOptional} onValueChange={(value) => setProductForm((prev) => {
                const next = [...prev.ingredients];
                next[index] = { ...next[index], isOptional: value };
                return { ...prev, ingredients: next };
              })} />
            </View>
            <View style={styles.switchRow}>
              <Text>Customer can remove</Text>
              <Switch value={row.customerCanRemove} onValueChange={(value) => setProductForm((prev) => {
                const next = [...prev.ingredients];
                next[index] = { ...next[index], customerCanRemove: value };
                return { ...prev, ingredients: next };
              })} />
            </View>
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderAddonsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.mutedText}>Choose modifier groups available for this product.</Text>
      {addonGroups.map((group) => <View key={group.id} style={{ minHeight: 68, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: t.color.border, gap: 16 }}>
        <View style={{ flex: 1 }}><Text>{group.name}</Text>{group.description && <Text style={styles.mutedText}>{group.description}</Text>}</View>
        <Switch accessibilityLabel={group.name} value={productForm.addonGroupIds.includes(group.id)} onValueChange={(value) => setProductForm((prev) => ({ ...prev, addonGroupIds: value ? [...prev.addonGroupIds, group.id] : prev.addonGroupIds.filter((id) => id !== group.id) }))} />
      </View>)}
    </View>
  );

  const renderBundleTab = () => (
    <View style={styles.tabContent}>
      {productForm.includedProducts.length > 0 ? <SectionHeader title="Included menu items" action={<Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => openPicker({ type: 'include', index: productForm.includedProducts.length })}>Add included item</Button>} /> : <View style={{ minHeight: 280, justifyContent: 'center', alignItems: 'center', gap: 14 }}><View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: t.color.primaryTint, alignItems: 'center', justifyContent: 'center' }}><Icon source="shopping-outline" size={34} color={t.color.primary} /></View><Text style={{ fontSize: 25, fontWeight: '700', color: t.color.text }}>Build a bundle</Text><Text style={{ color: t.color.muted, fontSize: 16 }}>Add included products and quantities.</Text><Button mode="outlined" onPress={() => openPicker({ type: 'include', index: 0 })}>Add included item</Button></View>}
      {productForm.includedProducts.map((row, index) => (
        <Card key={`include-${index}`} style={styles.nestedCard}>
          <Card.Content style={styles.tabContent}>
            <View style={styles.inlineRow}>
              <Text variant="titleSmall" style={styles.flexText}>{row.productName || 'Choose menu item'}</Text>
              <IconButton icon="delete-outline" onPress={() => setProductForm((prev) => ({ ...prev, includedProducts: prev.includedProducts.filter((_, i) => i !== index) }))} />
            </View>
            <Button mode="outlined" onPress={() => openPicker({ type: 'include', index })}>
              {row.productName ? 'Change Included Item' : 'Select Included Item'}
            </Button>
            <FormField mode="outlined" label="Quantity" value={row.quantity} onChangeText={(value) => setProductForm((prev) => {
              const next = [...prev.includedProducts];
              next[index] = { ...next[index], quantity: value };
              return { ...prev, includedProducts: next };
            })} keyboardType="number-pad" />
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      <WorkspaceHeader title={activeTab === 'products' ? 'Menu products' : 'Menu categories'} />
      <CatalogueTabs value={activeTab} compact={compact} onValueChange={(value) => { if (value === 'addons') router.replace('/addons-management'); else setActiveTab(value); }} />
      <View style={{ paddingHorizontal: compact ? 12 : 16, paddingVertical: 20, flexDirection: compact ? 'column' : 'row', alignItems: 'stretch', gap: 8 }}>
        {activeTab === 'products' ? <SearchField placeholder="Search products" value={searchQuery} onChangeText={setSearchQuery} style={{ flex: compact ? undefined : 1 }} /> : <SearchField placeholder="Search categories" value={categorySearch} onChangeText={setCategorySearch} style={{ flex: compact ? undefined : 1 }} />}
        <Button mode="contained" contentStyle={{ minHeight: 48 }} onPress={activeTab === 'products' ? openCreateProduct : openCreateCategory}>{activeTab === 'products' ? 'Add product' : 'Add category'}</Button>
      </View>
      {activeTab === 'products' ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}
          ListHeaderComponent={
            <View style={{ paddingBottom: 20 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Button mode="outlined" contentStyle={{ minHeight: 48 }} style={{ backgroundColor: selectedCategoryId === 'all' ? t.color.primaryTint : t.color.surface }} onPress={() => setSelectedCategoryId('all')}>All</Button>
                {groupedCategories.map((category) => (
                  <Button mode="outlined" contentStyle={{ minHeight: 48 }} style={{ backgroundColor: selectedCategoryId === category.id ? t.color.primaryTint : t.color.surface }} key={category.id} onPress={() => setSelectedCategoryId(category.id)}>
                    {category.name}
                  </Button>
                ))}
              </ScrollView>
            </View>
          }
          contentContainerStyle={[styles.listContent, { paddingHorizontal: compact ? 12 : 16 }]}
          renderItem={({ item, index }) => (
            <ManagementRow first={index === 0} last={index === filteredProducts.length - 1} title={item.name} description={`${categoryNameById.get(item.sub_category_id || '') || categoryNameById.get(item.sale_category_id || '') || 'Uncategorised'} · $${(item.sale_price ?? 0).toFixed(2)}`} active={item.is_active !== false} onEdit={() => void openEditProduct(item)} onDelete={() => confirmDeleteProduct(item)} />
          )}
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No products found.</Text> : null}
        />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={{ paddingHorizontal: compact ? 12 : 16, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}>
          {visibleCategories.map(renderCategoryRow)}
          {!loading && visibleCategories.length === 0 && <Text style={styles.emptyText}>No categories found.</Text>}
        </ScrollView>
      )}



      <Portal>
        <EditorSheet visible={categoryDialogVisible} title={editingCategory ? 'Edit category' : 'New category'} pending={saving} dirty={JSON.stringify(categoryForm) !== categoryBaseline} onDismiss={() => setCategoryDialogVisible(false)} footer={(dismiss) => <><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={saving} onPress={dismiss}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={saving || !categoryForm.name.trim()} loading={saving} onPress={() => void saveCategory()}>Save category</Button></>}>
              <FormField mode="outlined" label="Name" value={categoryForm.name} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, name: value }))} />
              <FormField mode="outlined" label="Description" value={categoryForm.description} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, description: value }))} multiline />
              <View style={{ gap: 8 }}><Text style={{ fontSize: 14, fontWeight: '700', color: t.color.text }}>Kitchen section</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {KITCHEN_SECTION_OPTIONS.map((option) => {
                    const selected = parseSectionList(categoryForm.section).includes(option);
                    return <Button key={`category-${option}`} mode="outlined" hitSlop={2} accessibilityState={{ selected }} buttonColor={selected ? t.color.primaryTint : t.color.surface} textColor={selected ? t.color.primary : t.color.text} style={{ height: 44, borderColor: selected ? '#80B9B5' : t.color.border }} contentStyle={{ height: 44, minHeight: 44 }} labelStyle={{ fontSize: 14, marginHorizontal: 15, marginVertical: 9 }} onPress={() => setCategoryForm((prev) => {
                      const current = parseSectionList(prev.section);
                      return { ...prev, section: formatSectionList(current.includes(option) ? current.filter((item) => item !== option) : [...current, option]) };
                    })}>{option}</Button>;
                  })}
                </View>
              </View>
              <Text variant="bodySmall" style={styles.helperText}>
                Group fallback section used when add-ons and products do not define one.
              </Text>
              <FormField mode="outlined" label="Sort order" value={categoryForm.sortOrder} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <View style={{ gap: 8 }}>
                <Button mode="outlined" icon={parentCategoryExpanded ? 'chevron-up' : 'chevron-down'} accessibilityLabel={`Parent category: ${categoryForm.parentCategoryId ? categoryNameById.get(categoryForm.parentCategoryId) || 'Unknown category' : 'Main category'}`} accessibilityState={{ expanded: parentCategoryExpanded }} onPress={() => setParentCategoryExpanded((expanded) => !expanded)} contentStyle={{ minHeight: 48, flexDirection: 'row-reverse', justifyContent: 'space-between' }} labelStyle={{ flex: 1, textAlign: 'left', fontWeight: '400' }}>{categoryForm.parentCategoryId ? categoryNameById.get(categoryForm.parentCategoryId) || 'Unknown category' : 'Parent category · Main category'}</Button>
                {parentCategoryExpanded && <View style={{ maxHeight: 220, borderWidth: 1, borderColor: t.color.border, borderRadius: 10, overflow: 'hidden', backgroundColor: t.color.surface }}><ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {[{ id: '', name: 'Main category' }, ...topLevelCategories.filter((category) => category.id !== editingCategory?.id)].map((category) => <Button key={category.id || 'main-category'} mode="text" icon={categoryForm.parentCategoryId === category.id ? 'radiobox-marked' : 'radiobox-blank'} textColor={categoryForm.parentCategoryId === category.id ? t.color.primary : t.color.text} contentStyle={{ minHeight: 48, justifyContent: 'flex-start' }} onPress={() => { setCategoryForm((prev) => ({ ...prev, parentCategoryId: category.id })); setParentCategoryExpanded(false); }}>{category.name}</Button>)}
                </ScrollView></View>}
              </View>
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <Switch value={categoryForm.isActive} onValueChange={(value) => setCategoryForm((prev) => ({ ...prev, isActive: value }))} />
              </View>
        </EditorSheet>

        <EditorSheet visible={productDialogVisible} title={editingProduct ? 'Edit product' : 'New product'} subtitle={editingProduct?.name} size="wide" pending={saving} dirty={JSON.stringify(productForm) !== productBaseline} onDismiss={() => setProductDialogVisible(false)} footer={(dismiss) => <><Button mode="outlined" contentStyle={{ minHeight: 48 }} disabled={saving} onPress={dismiss}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={saving || !productForm.name.trim()} loading={saving} onPress={() => void saveProduct()}>Save product</Button></>}>
          <ChoiceTabs value={productEditorTab} onValueChange={(value) => setProductEditorTab(value as typeof productEditorTab)} buttons={[{ value: 'overview', label: 'Overview' }, { value: 'seo', label: 'SEO' }, { value: 'ingredients', label: 'Ingredients' }, { value: 'addons', label: 'Add-ons' }, { value: 'bundle', label: 'Bundle' }]} />
          {productEditorTab === 'overview' && renderOverviewTab()}
          {productEditorTab === 'seo' && renderSeoTab()}
          {productEditorTab === 'ingredients' && renderIngredientsTab()}
          {productEditorTab === 'addons' && renderAddonsTab()}
          {productEditorTab === 'bundle' && renderBundleTab()}
        <EditorSheet visible={pickerDialogVisible} size="wide" title={pickerTarget?.type === 'ingredient' ? 'Select inventory product' : 'Select menu product'} onDismiss={() => setPickerDialogVisible(false)} footer={<Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={() => setPickerDialogVisible(false)}>Cancel</Button>}>
          <SearchField placeholder={pickerTarget?.type === 'ingredient' ? 'Search inventory products' : 'Search menu products'} value={pickerSearch} onChangeText={setPickerSearch} />
          <View style={{ borderWidth: 1, borderColor: t.color.border, borderRadius: 16, overflow: 'hidden' }}>{pickerOptions.map((option, index) => <View key={option.id} style={{ minHeight: 70, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.color.surface, borderTopWidth: index ? 1 : 0, borderColor: t.color.border }}><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: t.color.text, fontSize: 16, fontWeight: '700' }}>{option.name}{option.subtitle ? ` · ${option.subtitle}` : ''}</Text><Text style={styles.mutedText}>{pickerTarget?.type === 'ingredient' ? 'Inventory product' : 'Menu product'}</Text></View><Button mode="outlined" onPress={() => applyPickerSelection(option.id, option.name)} accessibilityLabel={`Select ${option.name}`}>Select</Button></View>)}</View>
          {!pickerOptions.length && <Text style={styles.mutedText}>No products found.</Text>}
        </EditorSheet>
        </EditorSheet>


      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.color.background,
  },
  flex: {
    flex: 1,
  },
  segmentedWrap: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  managementNavWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  infoBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: t.color.surface,
  },
  infoBannerContent: {
    gap: 4,
  },
  content: {
    padding: 12,
    gap: 12,
  },
  input: {
    backgroundColor: t.color.surface,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  listCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: t.color.surface,
    borderWidth: 1, borderColor: t.color.border,
    borderRadius: t.radius.card,
  },
  childCard: {
    marginLeft: 20,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  mutedText: {
    color: t.color.muted,
  },
  helperText: {
    color: t.color.muted,
    marginTop: -4,
  },
  checkboxList: {
    gap: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: t.color.muted,
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialog: {
    maxHeight: '92%',
  },
  dialogContent: {
    gap: 12,
    paddingBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkboxItem: {
    paddingHorizontal: 0,
  },
  tabContent: {
    gap: 12,
  },
  nestedCard: {
    backgroundColor: t.color.background,
    borderWidth: 1, borderColor: t.color.border,
    borderRadius: t.radius.card,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  flexText: {
    flex: 1,
  },
  pickerButton: {
    justifyContent: 'flex-start',
  },
});
