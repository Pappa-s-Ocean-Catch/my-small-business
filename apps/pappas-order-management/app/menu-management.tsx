import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Chip, Dialog, FAB, IconButton, Portal, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const [categories, setCategories] = useState<MobileSaleCategory[]>([]);
  const [products, setProducts] = useState<MobileSaleProduct[]>([]);
  const [addonGroups, setAddonGroups] = useState<MobileAddonGroup[]>([]);
  const [availableProducts, setAvailableProducts] = useState<MobileAvailableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [productEditorTab, setProductEditorTab] = useState<'overview' | 'seo' | 'ingredients' | 'addons' | 'bundle'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);
  const [productDialogVisible, setProductDialogVisible] = useState(false);
  const [pickerDialogVisible, setPickerDialogVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MobileSaleCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<MobileSaleProduct | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);

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
        next[pickerTarget.index] = { ...next[pickerTarget.index], productId: id, productName: name };
        return { ...prev, ingredients: next };
      });
    } else {
      setProductForm((prev) => {
        const next = [...prev.includedProducts];
        next[pickerTarget.index] = { ...next[pickerTarget.index], saleProductId: id, productName: name };
        return { ...prev, includedProducts: next };
      });
    }
    setPickerDialogVisible(false);
  };

  const renderCategoryRow = (category: MobileSaleCategory, isChild = false) => (
    <Card key={category.id} style={[styles.listCard, isChild ? styles.childCard : null]}>
      <Card.Content style={styles.rowHeader}>
        <View style={styles.rowText}>
          <Text variant="titleMedium">{category.name}</Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            {isChild ? `Sub-category of ${categoryNameById.get(category.parent_category_id || '') || 'Unknown'}` : 'Main category'}
          </Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            {formatSectionList(parseSectionList(category.section)) || 'No section fallback'}
          </Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            Sort #{category.sort_order ?? 0} • {category.is_active === false ? 'Inactive' : 'Active'}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <IconButton icon="pencil" onPress={() => openEditCategory(category)} />
          <IconButton icon="delete-outline" onPress={() => confirmDeleteCategory(category)} />
        </View>
      </Card.Content>
    </Card>
  );

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <TextInput mode="outlined" label="Name" value={productForm.name} onChangeText={(value) => setProductForm((prev) => ({ ...prev, name: value }))} />
      <TextInput mode="outlined" label="Description" value={productForm.description} onChangeText={(value) => setProductForm((prev) => ({ ...prev, description: value }))} multiline />
      <Text variant="labelMedium">Kitchen sections</Text>
      <View style={styles.checkboxList}>
        {KITCHEN_SECTION_OPTIONS.map((option) => {
          const selectedSections = parseSectionList(productForm.section);
          const checked = selectedSections.includes(option);
          return (
            <Checkbox.Item
              key={option}
              label={option}
              status={checked ? 'checked' : 'unchecked'}
              onPress={() => setProductForm((prev) => {
                const current = parseSectionList(prev.section);
                const next = current.includes(option)
                  ? current.filter((item) => item !== option)
                  : [...current, option];
                return { ...prev, section: formatSectionList(next) };
              })}
              style={styles.checkboxItem}
            />
          );
        })}
      </View>
      <Text variant="bodySmall" style={styles.helperText}>
        Select one or more sections. Leave everything unchecked to keep the default fried behavior.
      </Text>
      <TextInput mode="outlined" label="Search terms" value={productForm.searchTerm} onChangeText={(value) => setProductForm((prev) => ({ ...prev, searchTerm: value }))} />
      <TextInput mode="outlined" label="Price" value={productForm.price} onChangeText={(value) => setProductForm((prev) => ({ ...prev, price: value }))} keyboardType="decimal-pad" />
      <TextInput mode="outlined" label="Image URL" value={productForm.imageUrl} onChangeText={(value) => setProductForm((prev) => ({ ...prev, imageUrl: value }))} />
      <TextInput mode="outlined" label="Sort order" value={productForm.sortOrder} onChangeText={(value) => setProductForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
      <TextInput mode="outlined" label="Preparation minutes" value={productForm.prepMinutes} onChangeText={(value) => setProductForm((prev) => ({ ...prev, prepMinutes: value }))} keyboardType="number-pad" />

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
      <TextInput mode="outlined" label="Slug" value={productForm.slug} onChangeText={(value) => setProductForm((prev) => ({ ...prev, slug: value }))} />
      <TextInput mode="outlined" label="SEO title" value={productForm.seoTitle} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoTitle: value }))} />
      <TextInput mode="outlined" label="SEO description" value={productForm.seoDescription} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoDescription: value }))} multiline />
      <TextInput mode="outlined" label="SEO text" value={productForm.seoText} onChangeText={(value) => setProductForm((prev) => ({ ...prev, seoText: value }))} multiline />
    </View>
  );

  const renderIngredientsTab = () => (
    <View style={styles.tabContent}>
      <TextInput mode="outlined" label="Warning threshold units" value={productForm.warningThresholdUnits} onChangeText={(value) => setProductForm((prev) => ({ ...prev, warningThresholdUnits: value }))} keyboardType="number-pad" />
      <TextInput mode="outlined" label="Alert threshold units" value={productForm.alertThresholdUnits} onChangeText={(value) => setProductForm((prev) => ({ ...prev, alertThresholdUnits: value }))} keyboardType="number-pad" />
      <Button mode="outlined" icon="plus" onPress={() => setProductForm((prev) => ({
        ...prev,
        ingredients: [...prev.ingredients, { productId: '', productName: '', quantityRequired: '1', unitOfMeasure: 'units', isOptional: false, customerCanRemove: false, notes: '' }],
      }))}>
        Add Ingredient
      </Button>

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
            <TextInput mode="outlined" label="Quantity required" value={row.quantityRequired} onChangeText={(value) => setProductForm((prev) => {
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
            <TextInput mode="outlined" label="Notes" value={row.notes} onChangeText={(value) => setProductForm((prev) => {
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
      {addonGroups.map((group) => (
        <Checkbox.Item
          key={group.id}
          label={`${group.name}${group.description ? ` • ${group.description}` : ''}`}
          status={productForm.addonGroupIds.includes(group.id) ? 'checked' : 'unchecked'}
          onPress={() => setProductForm((prev) => ({
            ...prev,
            addonGroupIds: prev.addonGroupIds.includes(group.id)
              ? prev.addonGroupIds.filter((id) => id !== group.id)
              : [...prev.addonGroupIds, group.id],
          }))}
          style={styles.checkboxItem}
        />
      ))}
    </View>
  );

  const renderBundleTab = () => (
    <View style={styles.tabContent}>
      <Button mode="outlined" icon="plus" onPress={() => setProductForm((prev) => ({
        ...prev,
        includedProducts: [...prev.includedProducts, { saleProductId: '', productName: '', quantity: '1' }],
      }))}>
        Add Included Item
      </Button>
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
            <TextInput mode="outlined" label="Quantity" value={row.quantity} onChangeText={(value) => setProductForm((prev) => {
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
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Menu Management" subtitle="Categories and products" />
      </Appbar.Header>

      <View style={styles.managementNavWrap}>
        <SegmentedButtons
          value="menu"
          onValueChange={(value) => {
            if (value === 'addons') router.push('/addons-management');
          }}
          buttons={[
            { value: 'menu', label: 'Menu' },
            { value: 'addons', label: 'Add-ons' },
          ]}
        />
      </View>

      <Card style={styles.infoBanner}>
        <Card.Content style={styles.infoBannerContent}>
          <Text variant="titleSmall">Manage products and groups</Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            Use `Categories` to edit group fallback kitchen sections. Item priority is add-on, then product, then group.
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.segmentedWrap}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'products' | 'categories')}
          buttons={[
            { value: 'products', label: 'Products' },
            { value: 'categories', label: 'Categories' },
          ]}
        />
      </View>

      {activeTab === 'products' ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}
          ListHeaderComponent={
            <View style={styles.content}>
              <TextInput mode="outlined" label="Search products" value={searchQuery} onChangeText={setSearchQuery} style={styles.input} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip selected={selectedCategoryId === 'all'} onPress={() => setSelectedCategoryId('all')}>All</Chip>
                {groupedCategories.map((category) => (
                  <Chip key={category.id} selected={selectedCategoryId === category.id} onPress={() => setSelectedCategoryId(category.id)}>
                    {category.name}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.listCard}>
              <Card.Content style={styles.rowHeader}>
                <View style={styles.rowText}>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    ${(item.sale_price ?? 0).toFixed(2)} • {categoryNameById.get(item.sub_category_id || '') || categoryNameById.get(item.sale_category_id || '') || 'Uncategorised'}
                  </Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    {formatSectionList(parseSectionList(item.section)) || 'Default Fried'} • {item.is_featured ? 'Featured' : 'Standard'} • {item.is_active === false ? 'Inactive' : 'Active'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <IconButton icon="pencil" onPress={() => void openEditProduct(item)} />
                  <IconButton icon="delete-outline" onPress={() => confirmDeleteProduct(item)} />
                </View>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No products found.</Text> : null}
        />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />}>
          {groupedCategories.map((category) => (
            <View key={category.id}>
              {renderCategoryRow(category)}
              {category.children.map((child) => renderCategoryRow(child, true))}
            </View>
          ))}
          {!loading && groupedCategories.length === 0 && <Text style={styles.emptyText}>No categories found.</Text>}
        </ScrollView>
      )}

      <FAB icon={activeTab === 'products' ? 'plus' : 'shape-plus'} label={activeTab === 'products' ? 'Add Product' : 'Add Category'} style={styles.fab} onPress={activeTab === 'products' ? openCreateProduct : openCreateCategory} />

      <Portal>
        <Dialog visible={categoryDialogVisible} onDismiss={() => setCategoryDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>{editingCategory ? 'Edit Category' : 'New Category'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput mode="outlined" label="Name" value={categoryForm.name} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, name: value }))} />
              <TextInput mode="outlined" label="Description" value={categoryForm.description} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, description: value }))} multiline />
              <Text variant="labelMedium">Kitchen sections</Text>
              <View style={styles.checkboxList}>
                {KITCHEN_SECTION_OPTIONS.map((option) => {
                  const selectedSections = parseSectionList(categoryForm.section);
                  const checked = selectedSections.includes(option);
                  return (
                    <Checkbox.Item
                      key={`category-${option}`}
                      label={option}
                      status={checked ? 'checked' : 'unchecked'}
                      onPress={() => setCategoryForm((prev) => {
                        const current = parseSectionList(prev.section);
                        const next = current.includes(option)
                          ? current.filter((item) => item !== option)
                          : [...current, option];
                        return { ...prev, section: formatSectionList(next) };
                      })}
                      style={styles.checkboxItem}
                    />
                  );
                })}
              </View>
              <Text variant="bodySmall" style={styles.helperText}>
                Group fallback section used when add-ons and products do not define one.
              </Text>
              <TextInput mode="outlined" label="Sort order" value={categoryForm.sortOrder} onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, sortOrder: value }))} keyboardType="number-pad" />
              <Text variant="labelMedium">Parent category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip selected={categoryForm.parentCategoryId === ''} onPress={() => setCategoryForm((prev) => ({ ...prev, parentCategoryId: '' }))}>Main category</Chip>
                {topLevelCategories.filter((category) => category.id !== editingCategory?.id).map((category) => (
                  <Chip key={category.id} selected={categoryForm.parentCategoryId === category.id} onPress={() => setCategoryForm((prev) => ({ ...prev, parentCategoryId: category.id }))}>
                    {category.name}
                  </Chip>
                ))}
              </ScrollView>
              <View style={styles.switchRow}>
                <Text>Active</Text>
                <Switch value={categoryForm.isActive} onValueChange={(value) => setCategoryForm((prev) => ({ ...prev, isActive: value }))} />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setCategoryDialogVisible(false)}>Cancel</Button>
            <Button loading={saving} onPress={() => void saveCategory()}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={productDialogVisible} onDismiss={() => setProductDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>{editingProduct ? 'Edit Product' : 'New Product'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <SegmentedButtons
                value={productEditorTab}
                onValueChange={(value) => setProductEditorTab(value as typeof productEditorTab)}
                buttons={[
                  { value: 'overview', label: 'Overview' },
                  { value: 'seo', label: 'SEO' },
                  { value: 'ingredients', label: 'Ingredients' },
                  { value: 'addons', label: 'Add-ons' },
                  { value: 'bundle', label: 'Bundle' },
                ]}
              />
              {productEditorTab === 'overview' && renderOverviewTab()}
              {productEditorTab === 'seo' && renderSeoTab()}
              {productEditorTab === 'ingredients' && renderIngredientsTab()}
              {productEditorTab === 'addons' && renderAddonsTab()}
              {productEditorTab === 'bundle' && renderBundleTab()}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setProductDialogVisible(false)}>Cancel</Button>
            <Button loading={saving} onPress={() => void saveProduct()}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={pickerDialogVisible} onDismiss={() => setPickerDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>{pickerTarget?.type === 'ingredient' ? 'Select Inventory Product' : 'Select Menu Product'}</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Search" value={pickerSearch} onChangeText={setPickerSearch} />
          </Dialog.Content>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              {pickerOptions.map((option) => (
                <Button key={option.id} mode="outlined" style={styles.pickerButton} onPress={() => applyPickerSelection(option.id, option.name)}>
                  {option.name}{option.subtitle ? ` • ${option.subtitle}` : ''}
                </Button>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setPickerDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  flex: {
    flex: 1,
  },
  segmentedWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  managementNavWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  infoBannerContent: {
    gap: 4,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  listCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  childCard: {
    marginLeft: 32,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutedText: {
    color: '#6b7280',
  },
  helperText: {
    color: '#6b7280',
    marginTop: -4,
  },
  checkboxList: {
    gap: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
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
  },
  checkboxItem: {
    paddingHorizontal: 0,
  },
  tabContent: {
    gap: 12,
  },
  nestedCard: {
    backgroundColor: '#f8fafc',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexText: {
    flex: 1,
  },
  pickerButton: {
    justifyContent: 'flex-start',
  },
});
