'use client';

import { useState, useEffect, useMemo, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaPlus, FaEdit, FaTrash, FaUtensils, FaTag, FaClock, FaBox, FaChevronDown, FaChevronRight, FaFilter, FaSave, FaTimes, FaGripVertical, FaSearch } from 'react-icons/fa';
import { FaEye, FaEyeSlash } from 'react-icons/fa6';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/Icon';
import type { SaleProduct } from '@/app/actions/sale-products';
import Modal from '@/components/Modal';
import { ActionButton } from '@/components/ActionButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { ProductSearch } from '@/components/ProductSearch';
import { ImageUpload } from '@/components/ImageUpload';
import { AIImageGenerator } from '@/components/AIImageGenerator';
import { ImageDownloadButton } from '@/components/ImageDownloadButton';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'react-toastify';
import {
  getSaleProducts,
  getSaleCategories,
  createSaleProduct,
  updateSaleProduct,
  updateSaleProductImage,
  deleteSaleProduct,
  createSaleCategory,
  updateSaleCategory,
  deleteSaleCategory,
  setSaleCategorySortOrders,
  setSaleProductSortOrders,
  getAvailableProducts,
  type SaleProductWithDetails,
  type SaleCategory
} from '@/app/actions/sale-products';
import { getAddonGroups, getSaleProductAddonGroups, type AddonGroupWithItems } from '@/app/actions/addons';

function SortHandle(props: ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
      className={`p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${props.className ?? ''}`}
      title={props.title ?? 'Drag to reorder'}
      aria-label={props['aria-label'] ?? 'Drag to reorder'}
    >
      <Icon icon={FaGripVertical} className="h-3.5 w-3.5" />
    </button>
  );
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (args: { handleProps: ButtonHTMLAttributes<HTMLButtonElement>; isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        handleProps: {
          ...attributes,
          ...listeners,
        },
        isDragging,
      })}
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [saleProducts, setSaleProducts] = useState<SaleProductWithDetails[]>([]);
  const [saleCategories, setSaleCategories] = useState<SaleCategory[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    purchase_price: number;
    unit_price: number;
    total_units: number;
    units_per_box: number;
  }>>([]);
  const [addonGroups, setAddonGroups] = useState<AddonGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMainCategoryOrder, setSavingMainCategoryOrder] = useState(false);
  const [savingSubCategoryOrderByParent, setSavingSubCategoryOrderByParent] = useState<Record<string, boolean>>({});
  const [savingProductOrderByGroup, setSavingProductOrderByGroup] = useState<Record<string, boolean>>({});

  // Filter states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SaleProductWithDetails | null>(null);
  const [editingCategory, setEditingCategory] = useState<SaleCategory | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'product' | 'category'; id: string; name: string } | null>(null);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    slug: '',
    seo_title: '',
    seo_description: '',
    seo_text: '',
    sort_order: 0,
    sale_price: 0,
    image_url: '',
    sale_category_id: '',
    sub_category_id: '',
    preparation_time_minutes: 0,
    is_active: true,
    is_featured: false,
    warning_threshold_units: '' as string | number,
    alert_threshold_units: '' as string | number,
    ingredients: [] as Array<{
      product_id: string;
      quantity_required: number;
      unit_of_measure: string;
      is_optional: boolean;
      notes: string;
    }>,
    included_products: [] as Array<{
      included_sale_product_id: string;
      quantity: number;
    }>,
    addon_group_ids: [] as string[]
  });

  // Tab state for product form
  const [activeProductTab, setActiveProductTab] = useState<'overview' | 'seo' | 'ingredients' | 'bundle' | 'addons'>('overview');

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    parent_category_id: '',
    is_active: true
  });

  const hasLoadedRef = useRef(false);

  // Load data
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsResult, categoriesResult, availableProductsResult, addonGroupsResult] = await Promise.all([
        getSaleProducts(),
        getSaleCategories(),
        getAvailableProducts(),
        getAddonGroups()
      ]);

      if (productsResult.error) {
        setError(productsResult.error);
        return;
      }

      if (categoriesResult.error) {
        setError(categoriesResult.error);
        return;
      }

      if (availableProductsResult.error) {
        setError(availableProductsResult.error);
        return;
      }

      if (addonGroupsResult.error) {
        console.error('Error loading add-on groups:', addonGroupsResult.error);
        // Don't fail the whole page if add-ons fail to load
      }

      setSaleProducts(productsResult.data || []);
      setSaleCategories(categoriesResult.data || []);
      setAvailableProducts(availableProductsResult.data || []);
      setAddonGroups(addonGroupsResult.data || []);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Organize categories into hierarchy
  const categoryHierarchy = useMemo(() => {
    const mainCategories = saleCategories.filter(cat => !cat.parent_category_id);
    const subCategories = saleCategories.filter(cat => cat.parent_category_id);

    const bySortThenName = (a: SaleCategory, b: SaleCategory) => {
      const sa = Number(a.sort_order ?? 0);
      const sb = Number(b.sort_order ?? 0);
      if (sa !== sb) return sa - sb;
      return (a.name ?? '').localeCompare(b.name ?? '');
    };

    return [...mainCategories]
      .sort(bySortThenName)
      .map(mainCat => ({
        ...mainCat,
        sub_categories: subCategories
          .filter(subCat => subCat.parent_category_id === mainCat.id)
          .sort(bySortThenName)
      }));
  }, [saleCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const persistCategorySortOrders = async (updates: Array<{ id: string; sort_order: number }>) => {
    const res = await setSaleCategorySortOrders(updates);
    if (res.error) {
      toast.error(res.error);
      await loadData();
      return false;
    }
    return true;
  };

  const handleMainCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const mainCats = categoryHierarchy;
    const oldIndex = mainCats.findIndex((c) => c.id === String(active.id));
    const newIndex = mainCats.findIndex((c) => c.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(mainCats, oldIndex, newIndex);
    const updates = reordered.map((c, idx) => ({ id: c.id, sort_order: idx }));

    setSaleCategories((prev) =>
      prev.map((c) => {
        const u = updates.find((x) => x.id === c.id);
        return u ? { ...c, sort_order: u.sort_order } : c;
      })
    );

    setSavingMainCategoryOrder(true);
    await persistCategorySortOrders(updates);
    setSavingMainCategoryOrder(false);
  };

  const handleSubCategoryDragEnd = async (parentId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const parent = categoryHierarchy.find((c) => c.id === parentId);
    const subs = parent?.sub_categories ?? [];
    const oldIndex = subs.findIndex((c) => c.id === String(active.id));
    const newIndex = subs.findIndex((c) => c.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(subs, oldIndex, newIndex);
    const updates = reordered.map((c, idx) => ({ id: c.id, sort_order: idx }));

    setSaleCategories((prev) =>
      prev.map((c) => {
        const u = updates.find((x) => x.id === c.id);
        return u ? { ...c, sort_order: u.sort_order } : c;
      })
    );

    setSavingSubCategoryOrderByParent((p) => ({ ...p, [parentId]: true }));
    await persistCategorySortOrders(updates);
    setSavingSubCategoryOrderByParent((p) => ({ ...p, [parentId]: false }));
  };

  const productGroupKey = (categoryId: string, subCategoryId: string | null) =>
    `${categoryId}:${subCategoryId ?? 'null'}`;

  const persistProductSortOrders = async (updates: Array<{ id: string; sort_order: number }>) => {
    const res = await setSaleProductSortOrders(updates);
    if (res.error) {
      toast.error(res.error);
      await loadData();
      return false;
    }
    return true;
  };

  const sortProductsByOrderThenName = (products: SaleProductWithDetails[]): SaleProductWithDetails[] => {
    return [...products].sort((a, b) => {
      const sa = Number((a as unknown as { sort_order?: number }).sort_order ?? 0);
      const sb = Number((b as unknown as { sort_order?: number }).sort_order ?? 0);
      if (sa !== sb) return sa - sb;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  };

  const handleProductDragEnd = async (
    categoryId: string,
    subCategoryId: string | null,
    productsInGroup: SaleProductWithDetails[],
    event: DragEndEvent
  ) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = productsInGroup.findIndex((p) => p.id === String(active.id));
    const newIndex = productsInGroup.findIndex((p) => p.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(productsInGroup, oldIndex, newIndex);
    const updates = reordered.map((p, idx) => ({ id: p.id, sort_order: idx }));

    setSaleProducts((prev) =>
      prev.map((p) => {
        const u = updates.find((x) => x.id === p.id);
        return u ? ({ ...p, sort_order: u.sort_order } as SaleProductWithDetails) : p;
      })
    );

    const key = productGroupKey(categoryId, subCategoryId);
    setSavingProductOrderByGroup((m) => ({ ...m, [key]: true }));
    await persistProductSortOrders(updates);
    setSavingProductOrderByGroup((m) => ({ ...m, [key]: false }));
  };

  const getCategoryNameForProduct = (product: SaleProduct): string | undefined => {
    if (product.sub_category_id) {
      const sub = saleCategories.find(c => c.id === product.sub_category_id);
      if (sub?.name) return sub.name;
    }
    const main = saleCategories.find(c => c.id === product.sale_category_id);
    return main?.name ?? undefined;
  };

  const toSlug = (value: string): string => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Filter products based on selected category and search
  const filteredProducts = useMemo(() => {
    let filtered = saleProducts;

    // Filter by category
    if (selectedCategoryId) {
      if (selectedSubCategoryId) {
        filtered = filtered.filter(product => product.sub_category_id === selectedSubCategoryId);
      } else {
        filtered = filtered.filter(product => product.sale_category_id === selectedCategoryId);
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sub_category_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return sortProductsByOrderThenName(filtered);
  }, [saleProducts, selectedCategoryId, selectedSubCategoryId, searchTerm]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string | null, subCategoryId: string | null = null) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId(subCategoryId);
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setSearchTerm('');
  };

  // Modal handlers
  const openProductModal = async (product?: SaleProductWithDetails) => {
    if (product) {
      setEditingProduct(product);
      // Load add-on groups for this product
      const addonGroupsResult = await getSaleProductAddonGroups(product.id);
      const selectedAddonGroupIds = addonGroupsResult.data?.map(g => g.id) || [];

      const includes = (product as unknown as { included_products?: Array<{ included_sale_product_id: string; quantity: number }> }).included_products || [];

      setProductForm({
        name: product.name,
        description: product.description || '',
        slug: (product as unknown as { slug?: string | null }).slug ?? '',
        seo_title: (product as unknown as { seo_title?: string | null }).seo_title ?? '',
        seo_description: (product as unknown as { seo_description?: string | null }).seo_description ?? '',
        seo_text: (product as unknown as { seo_text?: string | null }).seo_text ?? '',
        sort_order: Number((product as unknown as { sort_order?: number }).sort_order ?? 0),
        sale_price: product.sale_price,
        image_url: product.image_url || '',
        sale_category_id: product.sale_category_id || '',
        sub_category_id: product.sub_category_id || '',
        preparation_time_minutes: product.preparation_time_minutes,
        is_active: product.is_active,
        is_featured: (product as unknown as { is_featured?: boolean }).is_featured ?? false,
        warning_threshold_units: (product as unknown as { warning_threshold_units?: number | null }).warning_threshold_units ?? '',
        alert_threshold_units: (product as unknown as { alert_threshold_units?: number | null }).alert_threshold_units ?? '',
        ingredients: product.ingredients.map(ing => ({
          product_id: ing.product_id,
          quantity_required: ing.quantity_required,
          unit_of_measure: ing.unit_of_measure,
          is_optional: ing.is_optional,
          notes: ing.notes || ''
        })),
        included_products: includes.map((i) => ({
          included_sale_product_id: i.included_sale_product_id,
          quantity: Number(i.quantity || 1),
        })),
        addon_group_ids: selectedAddonGroupIds
      });
    } else {
      setEditingProduct(null);

      const defaultCategoryId = selectedCategoryId || '';
      const defaultSubCategoryId = selectedSubCategoryId || '';
      const siblings = saleProducts.filter(
        (p) => (p.sale_category_id || '') === defaultCategoryId && (p.sub_category_id || '') === defaultSubCategoryId
      );
      const maxSiblingOrder = siblings.reduce(
        (max, p) => Math.max(max, Number((p as unknown as { sort_order?: number }).sort_order ?? 0)),
        -1
      );

      setProductForm({
        name: '',
        description: '',
        slug: '',
        seo_title: '',
        seo_description: '',
        seo_text: '',
        sort_order: maxSiblingOrder + 1,
        sale_price: 0,
        image_url: '',
        sale_category_id: defaultCategoryId,
        sub_category_id: defaultSubCategoryId,
        preparation_time_minutes: 0,
        is_active: true,
        is_featured: false,
        warning_threshold_units: '',
        alert_threshold_units: '',
        ingredients: [],
        included_products: [],
        addon_group_ids: []
      });
    }
    setActiveProductTab('overview'); // Reset to overview tab
    setShowProductModal(true);
  };

  const openCategoryModal = (category?: SaleCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        sort_order: category.sort_order,
        parent_category_id: category.parent_category_id || '',
        is_active: category.is_active
      });
    } else {
      setEditingCategory(null);
      const defaultParentCategoryId = selectedSubCategoryId ? (selectedCategoryId || '') : '';
      const siblings = saleCategories.filter(
        (c) => (c.parent_category_id || '') === defaultParentCategoryId
      );
      const maxSiblingOrder = siblings.reduce((max, c) => Math.max(max, Number(c.sort_order ?? 0)), -1);
      setCategoryForm({
        name: '',
        description: '',
        sort_order: maxSiblingOrder + 1,
        parent_category_id: defaultParentCategoryId,
        is_active: true
      });
    }
    setShowCategoryModal(true);
  };

  const openDeleteDialog = (type: 'product' | 'category', id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setShowDeleteDialog(true);
  };

  // Form submission handlers
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const result = await updateSaleProduct(editingProduct.id, {
          ...productForm,
          warning_threshold_units: productForm.warning_threshold_units === '' ? null : Number(productForm.warning_threshold_units),
          alert_threshold_units: productForm.alert_threshold_units === '' ? null : Number(productForm.alert_threshold_units),
          addon_group_ids: productForm.addon_group_ids,
          included_products: productForm.included_products,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Product updated successfully');
      } else {
        const result = await createSaleProduct({
          ...productForm,
          warning_threshold_units: productForm.warning_threshold_units === '' ? null : Number(productForm.warning_threshold_units),
          alert_threshold_units: productForm.alert_threshold_units === '' ? null : Number(productForm.alert_threshold_units),
          addon_group_ids: productForm.addon_group_ids,
          included_products: productForm.included_products,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Product created successfully');
      }
      setShowProductModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save product');
      console.error('Error saving product:', err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const result = await updateSaleCategory(editingCategory.id, categoryForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Category updated successfully');
      } else {
        const result = await createSaleCategory(categoryForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Category created successfully');
      }
      setShowCategoryModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save category');
      console.error('Error saving category:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      let result;
      if (deletingItem.type === 'product') {
        result = await deleteSaleProduct(deletingItem.id);
      } else {
        result = await deleteSaleCategory(deletingItem.id);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${deletingItem.type === 'product' ? 'Product' : 'Category'} deleted successfully`);
      setShowDeleteDialog(false);
      loadData();
    } catch (err) {
      toast.error(`Failed to delete ${deletingItem.type}`);
      console.error('Error deleting:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Menu</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selectedCategoryHasSubCategories = Boolean(
    selectedCategoryId && categoryHierarchy.find((c) => c.id === selectedCategoryId)?.sub_categories?.length
  );

  const canReorderCurrentProducts =
    isAdmin &&
    !searchTerm &&
    Boolean(selectedCategoryId) &&
    (Boolean(selectedSubCategoryId) || !selectedCategoryHasSubCategories);

  const currentProductGroupKey = selectedCategoryId ? productGroupKey(selectedCategoryId, selectedSubCategoryId) : null;
  const savingProductOrder = Boolean(currentProductGroupKey && savingProductOrderByGroup[currentProductGroupKey]);

  const renderProductCard = (product: SaleProductWithDetails, dragHandle?: ReactNode) => (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
      {product.image_url ? (
        <div className="h-48 bg-gray-200 dark:bg-neutral-700 relative group">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isAdmin && (
            <ImageDownloadButton
              imageUrl={product.image_url}
              fileName={`${(() => {
                const cat = getCategoryNameForProduct(product);
                const catSlug = cat ? toSlug(cat) : 'uncategorized';
                const prodSlug = toSlug(product.name);
                return `${catSlug}-${prodSlug}.jpg`;
              })()}`}
            />
          )}
        </div>
      ) : (
        <ImagePlaceholder
          productName={product.name}
          description={product.description ?? undefined}
          ingredients={(product.ingredients?.map((ing) => {
            const maybeName = (ing as unknown as { name?: string }).name;
            return maybeName ?? String(ing);
          }) || []).filter(Boolean)}
          category={undefined}
          onImageGenerated={async (imageUrl) => {
            try {
              const { error } = await updateSaleProductImage(product.id, imageUrl);

              if (error) {
                toast.error('Failed to update product with new image');
                return;
              }

              setSaleProducts(prev =>
                prev.map(p =>
                  p.id === product.id
                    ? ({ ...p, image_url: imageUrl } as SaleProductWithDetails)
                    : p
                )
              );
              toast.success('Image generated and updated successfully!');
            } catch (error) {
              console.error('Error updating product:', error);
              toast.error('Failed to update product with new image');
            }
          }}
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              <Link href={`/shop/menu/${product.id}`} className="hover:underline">
                {product.name}
              </Link>
            </h3>
            <div className="text-xs text-gray-500 dark:text-gray-400">#{Number((product as unknown as { sort_order?: number }).sort_order ?? 0)}</div>
          </div>
          <div className="flex gap-1">
            {dragHandle}
            <Link
              href={`/shop/menu/${product.id}`}
              className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              title="View details"
            >
              <Icon icon={FaEye} className="h-4 w-4" />
            </Link>
            <button
              onClick={() => openProductModal(product)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Edit product"
            >
              <Icon icon={FaEdit} className="h-4 w-4" />
            </button>
            <button
              onClick={() => openDeleteDialog('product', product.id, product.name)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete product"
            >
              <Icon icon={FaTrash} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {product.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Category Info */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Icon icon={FaTag} className="text-blue-600" />
            <span className="text-gray-700 dark:text-gray-300">
              {product.category_name}
              {product.sub_category_name && (
                <span className="text-gray-500 dark:text-gray-400">
                  {' '}• {product.sub_category_name}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Price and Details */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-green-600">
                ${product.sale_price.toFixed(2)}
              </span>
            </div>
            {product.preparation_time_minutes > 0 && (
              <div className="flex items-center gap-1">
                <Icon icon={FaClock} className="text-orange-600" />
                <span>{product.preparation_time_minutes}m</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {product.is_available ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Icon icon={FaEye} className="h-3 w-3 mr-1" />
                Available
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                <Icon icon={FaEyeSlash} className="h-3 w-3 mr-1" />
                Unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Icon icon={FaUtensils} className="text-blue-600" />
                Menu Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your menu categories and products with sub-category support
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <ActionButton
                onClick={() => openCategoryModal()}
                icon={<Icon icon={FaTag} />}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Add Category
              </ActionButton>
              <ActionButton
                onClick={() => openProductModal()}
                icon={<Icon icon={FaPlus} />}
                className="w-full sm:w-auto"
              >
                Add Product
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Categories */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700">
              <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon icon={FaFilter} className="text-blue-600" />
                  Categories
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {filteredProducts.length} products
                </p>
              </div>

              <div className="p-4">
                {/* All Products Filter */}
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${!selectedCategoryId
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">All Products</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {saleProducts.length}
                    </span>
                  </div>
                </button>

                {/* Category List */}
                <div className="space-y-1">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMainCategoryDragEnd}>
                    <SortableContext items={categoryHierarchy.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      {categoryHierarchy.map((category) => (
                        <div key={category.id}>
                          <SortableRow id={category.id} disabled={savingMainCategoryOrder}>
                            {({ handleProps }) => (
                              <div className="group relative flex items-stretch gap-1">
                                <div className="pt-2">
                                  <SortHandle
                                    {...handleProps}
                                    disabled={savingMainCategoryOrder}
                                    className="ml-1"
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    if (category.sub_categories.length > 0) {
                                      toggleCategory(category.id);
                                    } else {
                                      handleCategorySelect(category.id);
                                    }
                                  }}
                                  className={`flex-1 text-left p-3 pr-12 rounded-lg mb-1 transition-colors ${selectedCategoryId === category.id && !selectedSubCategoryId
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                    : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {category.sub_categories.length > 0 && (
                                        expandedCategories.has(category.id) ? (
                                          <Icon icon={FaChevronDown} className="h-3 w-3" />
                                        ) : (
                                          <Icon icon={FaChevronRight} className="h-3 w-3" />
                                        )
                                      )}
                                      <span className="font-medium">{category.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">#{category.sort_order}</span>
                                    </div>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {saleProducts.filter(p => p.sale_category_id === category.id).length}
                                    </span>
                                  </div>
                                </button>

                                {/* Category Actions */}
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCategoryModal(category);
                                      }}
                                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                      title="Edit category"
                                    >
                                      <Icon icon={FaEdit} className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteDialog('category', category.id, category.name);
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete category"
                                    >
                                      <Icon icon={FaTrash} className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableRow>

                          {/* Sub Categories */}
                          {expandedCategories.has(category.id) && category.sub_categories.length > 0 && (
                            <div className="ml-4 space-y-1">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(e) => handleSubCategoryDragEnd(category.id, e)}
                              >
                                <SortableContext
                                  items={category.sub_categories.map((s) => s.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {category.sub_categories.map((subCategory) => (
                                    <SortableRow
                                      key={subCategory.id}
                                      id={subCategory.id}
                                      disabled={Boolean(savingSubCategoryOrderByParent[category.id])}
                                    >
                                      {({ handleProps }) => (
                                        <div className="group relative flex items-stretch gap-1">
                                          <div className="pt-1">
                                            <SortHandle
                                              {...handleProps}
                                              disabled={Boolean(savingSubCategoryOrderByParent[category.id])}
                                              className="ml-1"
                                            />
                                          </div>
                                          <button
                                            onClick={() => handleCategorySelect(category.id, subCategory.id)}
                                            className={`flex-1 text-left p-2 pr-12 rounded-lg transition-colors ${selectedSubCategoryId === subCategory.id
                                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                              : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400'
                                              }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm">{subCategory.name}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">#{subCategory.sort_order}</span>
                                              </div>
                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {saleProducts.filter(p => p.sub_category_id === subCategory.id).length}
                                              </span>
                                            </div>
                                          </button>

                                          {/* Sub-Category Actions */}
                                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex gap-1">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openCategoryModal(subCategory);
                                                }}
                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="Edit sub-category"
                                              >
                                                <Icon icon={FaEdit} className="h-3 w-3" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openDeleteDialog('category', subCategory.id, subCategory.name);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Delete sub-category"
                                              >
                                                <Icon icon={FaTrash} className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </SortableRow>
                                  ))}
                                </SortableContext>
                              </DndContext>
                            </div>
                          )}
                        </div>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                {/* Clear Filters */}
                {(selectedCategoryId || searchTerm) && (
                  <button
                    onClick={clearFilters}
                    className="w-full mt-4 p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Products */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <Icon icon={FaUtensils} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Products Grid */}
            {isAdmin && (
              <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {searchTerm
                  ? 'Drag reorder is disabled while searching.'
                  : !selectedCategoryId
                    ? 'Select a category to drag-reorder products.'
                    : selectedCategoryHasSubCategories && !selectedSubCategoryId
                      ? 'Select a sub-category to drag-reorder products.'
                      : canReorderCurrentProducts
                        ? (savingProductOrder ? 'Saving order…' : 'Drag the handle to reorder products.')
                        : null}
              </div>
            )}

            {canReorderCurrentProducts && selectedCategoryId ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) =>
                  handleProductDragEnd(selectedCategoryId, selectedSubCategoryId, filteredProducts, event)
                }
              >
                <SortableContext items={filteredProducts.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {filteredProducts.map((product) => (
                      <SortableRow key={product.id} id={product.id} disabled={savingProductOrder}>
                        {({ handleProps }) =>
                          renderProductCard(
                            product,
                            <SortHandle
                              {...handleProps}
                              disabled={savingProductOrder}
                              title="Drag to reorder product"
                            />
                          )
                        }
                      </SortableRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {filteredProducts.map((product) => (
                  <div key={product.id}>{renderProductCard(product)}</div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Icon icon={FaUtensils} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No products found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchTerm || selectedCategoryId
                    ? 'Try adjusting your search or filter criteria'
                    : 'Get started by adding your first product'
                  }
                </p>
                {!searchTerm && !selectedCategoryId && (
                  <button
                    onClick={() => openProductModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Icon icon={FaPlus} className="h-4 w-4 mr-2" />
                    Add Product
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Product Modal */}
        <Modal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          size="xl"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Icon icon={FaTimes} className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <ActionButton
                onClick={async () => {
                  await handleProductSubmit({ preventDefault: () => { } } as React.FormEvent);
                }}
                variant="primary"
                size="md"
                icon={editingProduct ? <Icon icon={FaSave} className="w-4 h-4" /> : <Icon icon={FaPlus} className="w-4 h-4" />}
                loadingText={editingProduct ? 'Updating...' : 'Creating...'}
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </ActionButton>
            </div>
          }
        >
          <form id="product-form" className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 dark:border-neutral-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  type="button"
                  onClick={() => setActiveProductTab('overview')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${activeProductTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon icon={FaUtensils} className="w-4 h-4 inline mr-2" />
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProductTab('seo')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${activeProductTab === 'seo'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon icon={FaSearch} className="w-4 h-4 inline mr-2" />
                  SEO
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProductTab('ingredients')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${activeProductTab === 'ingredients'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon icon={FaBox} className="w-4 h-4 inline mr-2" />
                  Ingredients
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProductTab('addons')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${activeProductTab === 'addons'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon icon={FaTag} className="w-4 h-4 inline mr-2" />
                  Add-ons
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProductTab('bundle')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${activeProductTab === 'bundle'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon icon={FaBox} className="w-4 h-4 inline mr-2" />
                  Pack Includes
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeProductTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Product Name</span>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="Enter product name"
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Price</span>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.sale_price}
                      onChange={(e) => setProductForm({ ...productForm, sale_price: parseFloat(e.target.value) || 0 })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Sort Order</span>
                    <input
                      type="number"
                      min="0"
                      value={productForm.sort_order}
                      onChange={(e) => setProductForm({ ...productForm, sort_order: parseInt(e.target.value) || 0 })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="0"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    rows={3}
                    className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                    placeholder="Enter product description"
                  />
                </label>

                {/* Image Upload Section */}
                <div className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Product Image</span>
                  <div className="space-y-3">
                    {productForm.image_url && (
                      <div className="relative">
                        <img
                          src={productForm.image_url}
                          alt="Product preview"
                          className="w-full h-48 object-cover rounded-xl border border-gray-300 dark:border-neutral-600"
                        />
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, image_url: '' })}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                        >
                          <Icon icon={FaTrash} className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* AI Image Generator */}
                    <AIImageGenerator
                      onImageGenerated={(url) => setProductForm({ ...productForm, image_url: url || '' })}
                      currentImageUrl={productForm.image_url}
                      productName={productForm.name}
                      description={productForm.description}
                      category={(() => {
                        const mainCategory = saleCategories.find(cat => cat.id === productForm.sale_category_id);
                        const subCategory = saleCategories.find(cat => cat.id === productForm.sub_category_id);
                        if (subCategory) return `${mainCategory?.name || ''} - ${subCategory.name}`;
                        return mainCategory?.name || '';
                      })()}
                      ingredients={productForm.ingredients.map(ing => {
                        const product = availableProducts.find(p => p.id === ing.product_id);
                        return product ? `${product.name} (${ing.quantity_required} ${ing.unit_of_measure})` : '';
                      }).filter(Boolean)}
                      className="w-full"
                    />

                    {/* Traditional Image Upload */}
                    <div className="border-t border-gray-200 dark:border-neutral-700 pt-3">
                      <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Or upload your own image:</div>
                      <ImageUpload
                        onImageChange={(url) => setProductForm({ ...productForm, image_url: url || '' })}
                        currentImageUrl={productForm.image_url}
                        type="sale_product"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Main Category</span>
                    <select
                      value={productForm.sale_category_id}
                      onChange={(e) => setProductForm({ ...productForm, sale_category_id: e.target.value, sub_category_id: '' })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    >
                      <option value="">Select Category</option>
                      {categoryHierarchy.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Sub Category</span>
                    <select
                      value={productForm.sub_category_id}
                      onChange={(e) => setProductForm({ ...productForm, sub_category_id: e.target.value })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      disabled={!productForm.sale_category_id}
                    >
                      <option value="">No Sub Category</option>
                      {productForm.sale_category_id && categoryHierarchy
                        .find(cat => cat.id === productForm.sale_category_id)
                        ?.sub_categories.map((subCategory) => (
                          <option key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Preparation Time (minutes)</span>
                    <input
                      type="number"
                      min="0"
                      value={productForm.preparation_time_minutes}
                      onChange={(e) => setProductForm({ ...productForm, preparation_time_minutes: parseInt(e.target.value) || 0 })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="0"
                    />
                  </label>

                  <div className="flex flex-col gap-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={productForm.is_active}
                        onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Product is active
                      </span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={productForm.is_featured}
                        onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })}
                        className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Featured on home page
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeProductTab === 'seo' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50 p-4">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Public URL</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    If left blank, the system generates a slug from the product name.
                  </div>

                  <label className="grid gap-2 mt-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Slug</span>
                    <input
                      type="text"
                      value={productForm.slug}
                      onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                      className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="e.g. cheeseburger"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Example URL: <span className="font-mono">/order/product/{(productForm.slug || 'your-slug').trim() || 'your-slug'}</span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">SEO Title</span>
                    <input
                      type="text"
                      value={productForm.seo_title}
                      onChange={(e) => setProductForm({ ...productForm, seo_title: e.target.value })}
                      className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="Defaults to product name"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">SEO Description</span>
                    <textarea
                      value={productForm.seo_description}
                      onChange={(e) => setProductForm({ ...productForm, seo_description: e.target.value })}
                      rows={3}
                      className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                      placeholder="Defaults to product description"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">SEO Text (optional)</span>
                    <textarea
                      value={productForm.seo_text}
                      onChange={(e) => setProductForm({ ...productForm, seo_text: e.target.value })}
                      rows={5}
                      className="min-h-24 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                      placeholder="Extra marketing/SEO copy to show on the product page"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeProductTab === 'ingredients' && (
              <div className="space-y-4">
                {/* Ingredient-based thresholds in modal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="grid gap-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Warning Threshold (buildable units)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={productForm.warning_threshold_units}
                      onChange={(e) => setProductForm({ ...productForm, warning_threshold_units: e.target.value })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="e.g. 10"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Alert Threshold (buildable units)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={productForm.alert_threshold_units}
                      onChange={(e) => setProductForm({ ...productForm, alert_threshold_units: e.target.value })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="e.g. 5"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recipe Ingredients</h3>
                  <button
                    type="button"
                    onClick={() => setProductForm({
                      ...productForm,
                      ingredients: [...productForm.ingredients, {
                        product_id: '',
                        quantity_required: 1,
                        unit_of_measure: 'units',
                        is_optional: false,
                        notes: ''
                      }]
                    })}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icon icon={FaPlus} className="w-4 h-4" />
                    Add Ingredient
                  </button>
                </div>

                {productForm.ingredients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Icon icon={FaBox} className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h4 className="text-lg font-medium mb-2">No ingredients added yet</h4>
                    <p className="text-sm mb-4">Build your recipe by adding ingredients from your inventory</p>
                    <button
                      type="button"
                      onClick={() => setProductForm({
                        ...productForm,
                        ingredients: [...productForm.ingredients, {
                          product_id: '',
                          quantity_required: 1,
                          unit_of_measure: 'units',
                          is_optional: false,
                          notes: ''
                        }]
                      })}
                      className="flex items-center gap-2 px-4 py-2 mx-auto text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Icon icon={FaPlus} className="w-4 h-4" />
                      Add First Ingredient
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productForm.ingredients.map((ingredient, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50">
                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Product
                          </label>
                          <ProductSearch
                            products={availableProducts}
                            selectedProductId={ingredient.product_id}
                            onProductSelect={(productId) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].product_id = productId;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={ingredient.quantity_required}
                            onChange={(e) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].quantity_required = parseFloat(e.target.value) || 0;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                            placeholder="1"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Unit
                          </label>
                          <select
                            value={ingredient.unit_of_measure}
                            onChange={(e) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].unit_of_measure = e.target.value;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                          >
                            <option value="units">Units</option>
                            <option value="cups">Cups</option>
                            <option value="grams">Grams</option>
                            <option value="ml">ML</option>
                            <option value="tbsp">Tablespoons</option>
                            <option value="tsp">Teaspoons</option>
                            <option value="lbs">Pounds</option>
                            <option value="oz">Ounces</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-center">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={ingredient.is_optional}
                              onChange={(e) => {
                                const newIngredients = [...productForm.ingredients];
                                newIngredients[index].is_optional = e.target.checked;
                                setProductForm({ ...productForm, ingredients: newIngredients });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">Optional</span>
                          </label>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newIngredients = productForm.ingredients.filter((_, i) => i !== index);
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove ingredient"
                          >
                            <Icon icon={FaTrash} className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeProductTab === 'addons' && (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Add-on Groups
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                    Choose which add-on groups customers can select from when ordering this item
                  </p>
                </div>

                {addonGroups.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Icon icon={FaTag} className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h4 className="text-lg font-medium mb-2">No add-on groups available</h4>
                    <p className="text-sm mb-4">Create add-on groups first to attach them to menu items</p>
                    <Link
                      href="/shop/addons"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Icon icon={FaTag} className="w-4 h-4" />
                      Go to Add-ons Management
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addonGroups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-start gap-3 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50 hover:bg-gray-100/50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={productForm.addon_group_ids.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProductForm({
                                ...productForm,
                                addon_group_ids: [...productForm.addon_group_ids, group.id]
                              });
                            } else {
                              setProductForm({
                                ...productForm,
                                addon_group_ids: productForm.addon_group_ids.filter(id => id !== group.id)
                              });
                            }
                          }}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {group.name}
                            </span>
                            {group.is_required && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Required
                              </span>
                            )}
                            {!group.is_active && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                Inactive
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {group.description}
                            </p>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                            {group.items.length > 0 && (
                              <span className="ml-2">
                                ({group.items.filter(i => i.is_active).map(i => i.name).join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeProductTab === 'bundle' && (
              <div className="space-y-4">
                <div className="mb-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pack / Bundle Includes</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Use this for compound products like “Pack for 1”. Customers will see included items and savings.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Included items: <span className="font-medium">{productForm.included_products.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductForm({
                      ...productForm,
                      included_products: [...productForm.included_products, { included_sale_product_id: '', quantity: 1 }]
                    })}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icon icon={FaPlus} className="w-4 h-4" />
                    Add Included Item
                  </button>
                </div>

                {productForm.included_products.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                    <Icon icon={FaBox} className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h4 className="text-lg font-medium mb-2">No included products</h4>
                    <p className="text-sm">Add menu items that this pack includes.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const currentId = editingProduct?.id ?? '';
                      const originalTotal = productForm.included_products.reduce((sum, row) => {
                        const p = saleProducts.find(sp => sp.id === row.included_sale_product_id);
                        const price = p ? Number(p.sale_price || 0) : 0;
                        return sum + price * Math.max(1, Number(row.quantity || 1));
                      }, 0);
                      const savings = Math.max(0, originalTotal - Number(productForm.sale_price || 0));

                      return (
                        <>
                          <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50 p-3">
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 dark:text-gray-300">
                                Original total: <span className="font-semibold">${originalTotal.toFixed(2)}</span>
                              </div>
                              <div className="text-gray-700 dark:text-gray-300">
                                Pack price: <span className="font-semibold">${Number(productForm.sale_price || 0).toFixed(2)}</span>
                              </div>
                              <div className={`font-semibold ${savings > 0 ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                Save: ${savings.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {productForm.included_products.map((row, index) => {
                            const selectedElsewhere = new Set(
                              productForm.included_products
                                .filter((_, i) => i !== index)
                                .map(r => r.included_sale_product_id)
                                .filter(Boolean)
                            );

                            const selectedProduct = saleProducts.find(sp => sp.id === row.included_sale_product_id);
                            const selectedPrice = selectedProduct ? Number(selectedProduct.sale_price || 0) : 0;

                            return (
                              <div
                                key={`${index}-${row.included_sale_product_id}`}
                                className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50"
                              >
                                <div className="sm:col-span-4">
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Included product
                                  </label>
                                  <select
                                    value={row.included_sale_product_id}
                                    onChange={(e) => {
                                      const next = [...productForm.included_products];
                                      next[index] = { ...next[index], included_sale_product_id: e.target.value };
                                      setProductForm({ ...productForm, included_products: next });
                                    }}
                                    className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                                  >
                                    <option value="">Select a menu item</option>
                                    {saleProducts
                                      .slice()
                                      .sort((a, b) => a.name.localeCompare(b.name))
                                      .map((p) => {
                                        const disabled = (currentId && p.id === currentId) || (selectedElsewhere.has(p.id) && p.id !== row.included_sale_product_id);
                                        return (
                                          <option key={p.id} value={p.id} disabled={disabled}>
                                            {p.name} — ${Number(p.sale_price || 0).toFixed(2)}
                                          </option>
                                        );
                                      })}
                                  </select>
                                  {row.included_sale_product_id && (
                                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                      Line total: ${((Math.max(1, Number(row.quantity || 1)) * selectedPrice) || 0).toFixed(2)}
                                    </div>
                                  )}
                                </div>

                                <div className="sm:col-span-1">
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Qty
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={row.quantity}
                                    onChange={(e) => {
                                      const next = [...productForm.included_products];
                                      next[index] = { ...next[index], quantity: Math.max(1, parseInt(e.target.value || '1', 10)) };
                                      setProductForm({ ...productForm, included_products: next });
                                    }}
                                    className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                                  />
                                </div>

                                <div className="sm:col-span-1 flex items-end justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = productForm.included_products.filter((_, i) => i !== index);
                                      setProductForm({ ...productForm, included_products: next });
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Remove included product"
                                  >
                                    <Icon icon={FaTrash} className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

          </form>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title={editingCategory ? 'Edit Category' : 'Add Category'}
          size="lg"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Icon icon={FaTimes} className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <ActionButton
                onClick={async () => {
                  await handleCategorySubmit({ preventDefault: () => { } } as React.FormEvent);
                }}
                variant="primary"
                size="md"
                icon={editingCategory ? <Icon icon={FaSave} className="w-4 h-4" /> : <Icon icon={FaTag} className="w-4 h-4" />}
                loadingText={editingCategory ? 'Updating...' : 'Creating...'}
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </ActionButton>
            </div>
          }
        >
          <form id="category-form" className="space-y-4">
            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Category Name</span>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                placeholder="Enter category name"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows={3}
                className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                placeholder="Enter category description"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Parent Category</span>
                <select
                  value={categoryForm.parent_category_id}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parent_category_id: e.target.value })}
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                >
                  <option value="">Main Category</option>
                  {categoryHierarchy.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Sort Order</span>
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                  placeholder="0"
                />
              </label>
            </div>

            <div className="flex items-center justify-start">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category is active
                </span>
              </label>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title={`Delete ${deletingItem?.type === 'product' ? 'Product' : 'Category'}`}
          message={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
        />
      </div>
    </div>
  );
}