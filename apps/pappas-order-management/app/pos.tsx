import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Appbar, Button, Dialog, Divider, IconButton, Portal, TextInput } from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderItemAddon, PaymentStatus } from '@my-small-business/types';
import { savePosOrder, updatePosOrder } from '../lib/orders';
import { createCustomerIfNotExists, findCustomerByPhone } from '../lib/customers';
import {
  DEFAULT_POS_BUTTON_COLOR,
  DEFAULT_POS_QUICK_ORDER_NOTES,
  fetchPreferredPosLayout,
  PosLayoutData,
} from '../lib/pos-layouts';
import { formatKitchenSectionValue, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';
import { CashTenderModal } from '../components/CashTenderModal';

type SaleCategory = {
  id: string;
  name: string;
  section?: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  parent_category_id: string | null;
};

type SaleProduct = {
  id: string;
  name: string;
  description: string | null;
  section?: string | null;
  search_term: string | null;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type TopSellerProduct = SaleProduct & {
  total_quantity_sold: number;
  total_orders: number;
};

type AddonItem = {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
  section?: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type AddonGroup = {
  id: string;
  name: string;
  is_required: boolean;
  multiple_choice: boolean;
  display_order: number | null;
  items: AddonItem[];
};

type RemovableIngredient = {
  id: string;
  ingredient_name: string;
};

type PosCartItem = OrderItem & {
  id: string;
  addons: OrderItemAddon[];
};

type PosPaymentChoice = 'card' | 'cash' | 'no_pay';
type PosInstorePaymentChoice = 'card' | 'cash' | 'unpaid';
type PosCheckoutPaymentOverride = PosPaymentChoice | 'smartpay';
type CashTenderMode = 'pickup' | 'instore';

type LayoutCategoryButton = {
  id: string;
  name: string;
  color: string;
  showProductsOnTopLevel: boolean;
};

const newLocalId = () => `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const addonSelectionKey = (addons: OrderItemAddon[]) => (
  JSON.stringify(addons.map((addon) => addon.addon_item_id).sort())
);

const addonTotal = (addons: OrderItemAddon[]) => (
  addons.reduce((sum, addon) => sum + (addon.addon_item_price || 0), 0)
);

const cartItemHasCustomizations = (item: Pick<OrderItem, 'addons' | 'removed_ingredients' | 'comment'>) => (
  (item.addons || []).length > 0
  || (item.removed_ingredients || []).length > 0
  || Boolean(item.comment)
);

const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;
const TOP_SELLERS_CACHE_TTL_MS = 5 * 60 * 1000;
const POS_CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const PRODUCT_TILE_PALETTE = [
  { backgroundColor: '#fff7ed', borderColor: '#fed7aa', priceColor: '#c2410c' },
  { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0', priceColor: '#047857' },
  { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', priceColor: '#1d4ed8' },
  { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8', priceColor: '#be185d' },
  { backgroundColor: '#f0fdfa', borderColor: '#99f6e4', priceColor: '#0f766e' },
  { backgroundColor: '#fefce8', borderColor: '#fde68a', priceColor: '#a16207' },
];
const ADDON_GROUP_PALETTE = [
  { backgroundColor: '#eff6ff', borderColor: '#93c5fd', labelColor: '#1d4ed8' },
  { backgroundColor: '#ecfdf5', borderColor: '#86efac', labelColor: '#047857' },
  { backgroundColor: '#fff7ed', borderColor: '#fdba74', labelColor: '#c2410c' },
  { backgroundColor: '#fdf2f8', borderColor: '#f9a8d4', labelColor: '#be185d' },
  { backgroundColor: '#f0fdfa', borderColor: '#5eead4', labelColor: '#0f766e' },
  { backgroundColor: '#fefce8', borderColor: '#fde047', labelColor: '#a16207' },
];

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

type CustomizationData = {
  groups: AddonGroup[];
  removableIngredients: RemovableIngredient[];
};

const catalogCache = {
  categories: null as CacheEntry<SaleCategory[]> | null,
  allProducts: null as CacheEntry<SaleProduct[]> | null,
  productsByCategory: new Map<string, CacheEntry<SaleProduct[]>>(),
  hasCustomizationByProduct: new Map<string, CacheEntry<boolean>>(),
  customizationByProduct: new Map<string, CacheEntry<CustomizationData>>(),
  topSellersToday: null as CacheEntry<TopSellerProduct[]> | null,
};

const isCacheFresh = <T,>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> => (
  Boolean(entry && entry.expiresAt > Date.now())
);

const cacheEntry = <T,>(data: T, ttlMs = CATALOG_CACHE_TTL_MS): CacheEntry<T> => ({
  data,
  expiresAt: Date.now() + ttlMs,
});

const getFreshCacheEntry = <K, T>(cache: Map<K, CacheEntry<T>>, key: K) => {
  const entry = cache.get(key);
  if (isCacheFresh(entry)) return entry;
  if (entry) cache.delete(key);
  return null;
};

const pruneExpiredCacheEntries = <K, T>(cache: Map<K, CacheEntry<T>>, now = Date.now()) => {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
};

const pruneCatalogCache = () => {
  const now = Date.now();
  if (catalogCache.categories && catalogCache.categories.expiresAt <= now) catalogCache.categories = null;
  if (catalogCache.allProducts && catalogCache.allProducts.expiresAt <= now) catalogCache.allProducts = null;
  if (catalogCache.topSellersToday && catalogCache.topSellersToday.expiresAt <= now) {
    catalogCache.topSellersToday = null;
  }
  pruneExpiredCacheEntries(catalogCache.productsByCategory, now);
  pruneExpiredCacheEntries(catalogCache.hasCustomizationByProduct, now);
  pruneExpiredCacheEntries(catalogCache.customizationByProduct, now);
};

const defaultPickupTime = () => {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 30);
  next.setSeconds(0, 0);
  return next;
};

const productTilePalette = (productId: string) => {
  const hash = productId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PRODUCT_TILE_PALETTE[hash % PRODUCT_TILE_PALETTE.length];
};

const addonGroupPalette = (groupId: string) => {
  const hash = groupId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ADDON_GROUP_PALETTE[hash % ADDON_GROUP_PALETTE.length];
};

const formatPickupTime = (date: Date) => date.toLocaleString([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function PosScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const rawOrderId = params.orderId;
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
  const [categories, setCategories] = useState<SaleCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedParentCatId, setSelectedParentCatId] = useState<string | null>(null);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerProduct[]>([]);
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSearchProducts, setLoadingSearchProducts] = useState(false);
  const [loadingTopSellers, setLoadingTopSellers] = useState(false);
  const [topSellerRefreshKey, setTopSellerRefreshKey] = useState(0);
  const [customizableProductIds, setCustomizableProductIds] = useState<Set<string>>(new Set());
  const [menuLevel, setMenuLevel] = useState<'groups' | 'subgroups' | 'items' | 'addons' | 'checkout' | 'search'>('groups');
  const [searchQuery, setSearchQuery] = useState('');
  const [instorePaymentDialogVisible, setInstorePaymentDialogVisible] = useState(false);
  const [searchProducts, setSearchProducts] = useState<SaleProduct[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<SaleProduct | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editorAddonGroups, setEditorAddonGroups] = useState<AddonGroup[]>([]);
  const [editorSelectedIds, setEditorSelectedIds] = useState<Record<string, boolean>>({});
  const [editorRemovableIngredients, setEditorRemovableIngredients] = useState<RemovableIngredient[]>([]);
  const [editorRemovedIngredientIds, setEditorRemovedIngredientIds] = useState<Record<string, boolean>>({});
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'idle' | 'loading' | 'found' | 'new' | 'error'>('idle');
  const [customerLookupError, setCustomerLookupError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [smartpayProcessing, setSmartpayProcessing] = useState(false);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const [cashTenderMode, setCashTenderMode] = useState<CashTenderMode | null>(null);
  const cashTenderConfirmedRef = useRef(false);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [scheduledPickupAt, setScheduledPickupAt] = useState<Date>(defaultPickupTime);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [pickupPickerMode, setPickupPickerMode] = useState<'date' | 'time'>('date');
  const [paymentChoice, setPaymentChoice] = useState<PosPaymentChoice>('no_pay');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [posLayout, setPosLayout] = useState<PosLayoutData | null>(null);
  const [quickOrderNote, setQuickOrderNote] = useState<string | null>(null);
  const [saltOptionDialogVisible, setSaltOptionDialogVisible] = useState(false);
  const [orderNoteText, setOrderNoteText] = useState('');
  const [quickListVisible, setQuickListVisible] = useState(false);

  const goHome = () => {
    router.replace('/(drawer)/(tabs)/live-orders');
  };

  const openLayoutSettings = () => {
    router.push('/pos-layout-settings');
  };



  useEffect(() => {
    pruneCatalogCache();
    const sweepTimer = setInterval(pruneCatalogCache, POS_CACHE_SWEEP_INTERVAL_MS);
    return () => clearInterval(sweepTimer);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      pruneCatalogCache();
      if (isCacheFresh(catalogCache.categories)) {
        setCategories(catalogCache.categories.data);
        return;
      }

      const { data, error } = await supabase
        .from('sale_categories')
        .select('id, name, section, sort_order, is_active, parent_category_id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        Alert.alert('POS', error.message);
        return;
      }

      const nextCategories = (data || []) as SaleCategory[];
      catalogCache.categories = cacheEntry(nextCategories);
      setCategories(nextCategories);
    };

    void fetchCategories();
  }, []);

  const loadPreferredLayout = useCallback(async () => {
    const { data, error } = await fetchPreferredPosLayout();
    if (error) {
      console.warn('POS layout load failed', error);
      return;
    }

    setPosLayout(data?.layout ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPreferredLayout();
      isSmartpayPaired().then(setSmartpayPaired).catch(() => setSmartpayPaired(false));
    }, [loadPreferredLayout])
  );

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parent_category_id),
    [categories]
  );

  const categoryIdsForLayoutGroup = useCallback((
    layoutCategory: PosLayoutData['categories'][number] | null | undefined,
    fallbackCategoryId: string
  ) => {
    const sourceCategoryIds = layoutCategory?.sourceCategoryIds?.length
      ? layoutCategory.sourceCategoryIds
      : [fallbackCategoryId];
    const childCategoryIds = categories
      .filter((category) => sourceCategoryIds.includes(category.parent_category_id || ''))
      .map((category) => category.id);

    return Array.from(new Set([...sourceCategoryIds, ...childCategoryIds]));
  }, [categories]);

  const activeLayoutCategory = useMemo(
    () => posLayout?.categories.find((category) => category.categoryId === (selectedParentCatId || selectedCatId)) ?? null,
    [posLayout, selectedCatId, selectedParentCatId]
  );

  const childCategoriesForSelectedGroup = useMemo(() => {
    const parentId = selectedParentCatId || selectedCatId;
    if (!parentId) return [];

    const sourceCategoryIds = activeLayoutCategory?.sourceCategoryIds?.length
      ? activeLayoutCategory.sourceCategoryIds
      : [parentId];

    return categories
      .filter((category) => sourceCategoryIds.includes(category.parent_category_id || ''))
      .sort((a, b) => (
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
        || a.name.localeCompare(b.name)
      ));
  }, [activeLayoutCategory, categories, selectedCatId, selectedParentCatId]);

  const layoutTopLevelCategories = useMemo<LayoutCategoryButton[]>(() => {
    const categoriesById = new Map(topLevelCategories.map((category) => [category.id, category]));
    const usedIds = new Set<string>();
    const hiddenSourceIds = new Set(
      (posLayout?.categories || [])
        .filter((category) => category.hideSourceCategories)
        .flatMap((category) => category.sourceCategoryIds?.length ? category.sourceCategoryIds : [category.categoryId])
    );
    const ordered = (posLayout?.categories || [])
      .map((layoutCategory) => {
        if (hiddenSourceIds.has(layoutCategory.categoryId)) return null;
        const sourceCategoryIds = layoutCategory.sourceCategoryIds?.length
          ? layoutCategory.sourceCategoryIds
          : [layoutCategory.categoryId];
        const hasExistingSource = sourceCategoryIds.some((categoryId) => categoriesById.has(categoryId));
        if (!hasExistingSource) return null;
        sourceCategoryIds.forEach((categoryId) => usedIds.add(categoryId));
        return {
          id: layoutCategory.categoryId,
          name: layoutCategory.title || categoriesById.get(sourceCategoryIds[0])?.name || 'Group',
          color: layoutCategory.color || DEFAULT_POS_BUTTON_COLOR,
          showProductsOnTopLevel: Boolean(layoutCategory.showProductsOnTopLevel),
        };
      })
      .filter((category): category is LayoutCategoryButton => Boolean(category));

    return [
      ...ordered,
      ...topLevelCategories
        .filter((category) => !usedIds.has(category.id) && !hiddenSourceIds.has(category.id))
        .map((category) => ({
          id: category.id,
          name: category.name,
          color: DEFAULT_POS_BUTTON_COLOR,
          showProductsOnTopLevel: false,
        })),
    ];
  }, [posLayout, topLevelCategories]);

  const layoutProducts = useMemo(() => {
    if (!activeLayoutCategory) return products;

    const productsById = new Map(products.map((product) => [product.id, product]));
    const usedIds = new Set<string>();
    const ordered = activeLayoutCategory.products
      .map((layoutProduct) => {
        const product = productsById.get(layoutProduct.productId);
        if (!product) return null;
        usedIds.add(product.id);
        return product;
      })
      .filter((product): product is SaleProduct => Boolean(product));

    return [
      ...ordered,
      ...products.filter((product) => !usedIds.has(product.id)),
    ];
  }, [activeLayoutCategory, products]);

  const quickOrderNotes = useMemo(() => {
    const layoutNotes = posLayout?.quickOrderNotes?.filter((note) => note.trim().length > 0);
    return layoutNotes && layoutNotes.length > 0 ? layoutNotes : DEFAULT_POS_QUICK_ORDER_NOTES;
  }, [posLayout]);

  const orderOptions = useMemo(() => (
    getOrderOptions({
      order_options: quickOrderNote,
      special_instructions: orderNoteText,
    }).join(',') || null
  ), [orderNoteText, quickOrderNote]);
  const orderSpecialInstructions = useMemo(() => (
    getOrderNotes({ special_instructions: orderNoteText })
  ), [orderNoteText]);

  const productButtonColor = (productId: string) => (
    activeLayoutCategory?.products.find((product) => product.productId === productId)?.color
  );

  const getProductGroupSection = useCallback((product: Pick<SaleProduct, 'sale_category_id' | 'sub_category_id'>) => {
    const subCategorySection = categories.find((category) => category.id === product.sub_category_id)?.section;
    if (subCategorySection) return subCategorySection;
    return categories.find((category) => category.id === product.sale_category_id)?.section || null;
  }, [categories]);

  const invalidateTopSellers = () => {
    catalogCache.topSellersToday = null;
    setTopSellerRefreshKey((key) => key + 1);
  };

  useEffect(() => {
    const channel = supabase
      .channel('pos-top-sellers-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, invalidateTopSellers)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, invalidateTopSellers)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const loadTopSellersToday = async () => {
    pruneCatalogCache();
    if (isCacheFresh(catalogCache.topSellersToday)) {
      setTopSellers(catalogCache.topSellersToday.data);
      return;
    }

    setLoadingTopSellers(true);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, order_id, orders!inner(created_at, order_status)')
      .not('product_id', 'is', null)
      .gte('orders.created_at', start.toISOString())
      .lt('orders.created_at', end.toISOString());

    if (orderItemsError) {
      setLoadingTopSellers(false);
      return;
    }

    const salesByProduct = new Map<string, { quantity: number; orderIds: Set<string> }>();
    (orderItems || []).forEach((item: any) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      if (!item.product_id || order?.order_status === 'cancelled') return;
      const current = salesByProduct.get(item.product_id) || { quantity: 0, orderIds: new Set<string>() };
      current.quantity += Number(item.quantity || 1);
      if (item.order_id) current.orderIds.add(item.order_id);
      salesByProduct.set(item.product_id, current);
    });

    const rankedProductIds = Array.from(salesByProduct.entries())
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 8)
      .map(([productId]) => productId);

    if (rankedProductIds.length === 0) {
      catalogCache.topSellersToday = cacheEntry([], TOP_SELLERS_CACHE_TTL_MS);
      setTopSellers([]);
      setLoadingTopSellers(false);
      return;
    }

    const { data: productsData, error: productsError } = await supabase
      .from('sale_products')
      .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
      .in('id', rankedProductIds)
      .eq('is_active', true);

    if (productsError) {
      setLoadingTopSellers(false);
      return;
    }

    const productsById = new Map((productsData || []).map((product: any) => [product.id, product as SaleProduct]));
    const nextTopSellers = rankedProductIds
      .map((productId) => {
        const product = productsById.get(productId);
        const sales = salesByProduct.get(productId);
        if (!product || !sales) return null;
        return {
          ...product,
          total_quantity_sold: sales.quantity,
          total_orders: sales.orderIds.size,
        };
      })
      .filter((product): product is TopSellerProduct => Boolean(product));

    catalogCache.topSellersToday = cacheEntry(nextTopSellers, TOP_SELLERS_CACHE_TTL_MS);
    setTopSellers(nextTopSellers);
    setLoadingTopSellers(false);
    void loadCustomizationAvailability(nextTopSellers.map((product) => product.id));
  };

  useEffect(() => {
    if (menuLevel === 'groups') {
      void loadTopSellersToday();
    }
  }, [menuLevel, topSellerRefreshKey]);

  const loadSearchProducts = async () => {
    pruneCatalogCache();
    if (isCacheFresh(catalogCache.allProducts)) {
      setSearchProducts(catalogCache.allProducts.data);
      void loadCustomizationAvailability(catalogCache.allProducts.data.map((product) => product.id));
      return;
    }

    setLoadingSearchProducts(true);
    const { data, error } = await supabase
      .from('sale_products')
      .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    setLoadingSearchProducts(false);
    if (error) {
      Alert.alert('Search', error.message);
      return;
    }

    const nextProducts = (data || []) as SaleProduct[];
    catalogCache.allProducts = cacheEntry(nextProducts);
    setSearchProducts(nextProducts);
    void loadCustomizationAvailability(nextProducts.map((product) => product.id));
  };

  useEffect(() => {
    if (menuLevel === 'search') {
      void loadSearchProducts();
    }
  }, [menuLevel]);

  useEffect(() => {
    if (!posLayout) return;
    void loadSearchProducts();
  }, [posLayout]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchProducts.slice(0, 24);

    return searchProducts
      .filter((product) => (
        product.name.toLowerCase().includes(query)
        || product.search_term?.toLowerCase().includes(query)
      ))
      .slice(0, 24);
  }, [searchProducts, searchQuery]);

  const quickAccessProducts = useMemo(() => {
    if (!posLayout) return [];

    const catalogProducts = searchProducts.length > 0
      ? searchProducts
      : catalogCache.allProducts?.data ?? [];
    if (catalogProducts.length === 0) return [];

    const productsById = new Map(catalogProducts.map((product) => [product.id, product]));
    const seenProductIds = new Set<string>();

    return posLayout.categories
      .flatMap((category) => category.products)
      .map((layoutProduct) => {
        if (!layoutProduct.showOnQuickList) return null;
        if (seenProductIds.has(layoutProduct.productId)) return null;
        seenProductIds.add(layoutProduct.productId);
        return productsById.get(layoutProduct.productId) ?? null;
      })
      .filter((product): product is SaleProduct => Boolean(product));
  }, [posLayout, searchProducts]);

  useEffect(() => {
    if (!selectedCatId || menuLevel !== 'items') return;

    const fetchProducts = async () => {
      const categoryIds = selectedParentCatId
        ? [selectedCatId]
        : categoryIdsForLayoutGroup(activeLayoutCategory, selectedCatId);
      if (categoryIds.length === 0) {
        setProducts([]);
        return;
      }
      const cacheKey = categoryIds.sort().join(',');
      pruneCatalogCache();
      const cachedProducts = getFreshCacheEntry(catalogCache.productsByCategory, cacheKey);

      if (cachedProducts) {
        setProducts(cachedProducts.data);
        void loadCustomizationAvailability(cachedProducts.data.map((product) => product.id));
        return;
      }

      setLoadingProducts(true);
      const { data, error } = await supabase
        .from('sale_products')
        .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
        .eq('is_active', true)
        .or(`sale_category_id.in.(${categoryIds.join(',')}),sub_category_id.in.(${categoryIds.join(',')})`)
        .order('sort_order', { ascending: true });

      setLoadingProducts(false);
      if (error) {
        Alert.alert('Products', error.message);
        return;
      }
      const nextProducts = (data || []) as SaleProduct[];
      catalogCache.productsByCategory.set(cacheKey, cacheEntry(nextProducts));
      setProducts(nextProducts);
      void loadCustomizationAvailability(nextProducts.map((product) => product.id));
    };

    void fetchProducts();
  }, [activeLayoutCategory, categoryIdsForLayoutGroup, menuLevel, selectedCatId, selectedParentCatId]);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, order_item_addons(*))')
        .eq('id', orderId)
        .single();

      if (error) {
        Alert.alert('Order', error.message);
        return;
      }

      const order = data as any;
      if (order.payment_status === 'paid') {
        Alert.alert('Edit Order', 'Paid orders cannot be edited.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      const items = (order.order_items || []).map((item: any) => ({
        ...item,
        base_price: Number(item.base_price || 0),
        quantity: Number(item.quantity || 1),
        subtotal: Number(item.subtotal || 0),
        removed_ingredients: item.removed_ingredients || [],
        addons: item.order_item_addons || [],
      }));
      setEditingOrder(order as Order);
      setCartItems(items);
      setCustomerPhone(order.customer_phone || '');
      setCustomerName(order.customer_name || '');
      setQuickOrderNote(getOrderOptions(order)[0] || null);
      setOrderNoteText(getOrderNotes(order) || '');
      setPaymentChoice(
        order.payment_status !== 'paid'
          ? 'no_pay'
          : order.payment_method_detail?.toLowerCase() === 'cash'
            ? 'cash'
            : order.payment_method_detail?.toLowerCase() === 'card' ||
              order.payment_method_detail?.toLowerCase() === 'smartpay'
              ? 'card'
              : 'no_pay'
      );
      setIsPreOrder(Boolean(order.scheduled_pickup_at));
      if (order.scheduled_pickup_at) {
        const pickupAt = new Date(order.scheduled_pickup_at);
        if (Number.isFinite(pickupAt.getTime())) {
          setScheduledPickupAt(pickupAt);
        }
      }
    };

    void loadOrder();
  }, [orderId, router]);

  useEffect(() => {
    const phone = customerPhone.trim();
    if (!phone) {
      setCustomerLookupStatus('idle');
      setCustomerLookupError(null);
      return;
    }

    if (phone.length < 6) {
      setCustomerLookupStatus('idle');
      setCustomerLookupError(null);
      return;
    }

    let cancelled = false;
    setCustomerLookupStatus('loading');
    setCustomerLookupError(null);

    const timer = setTimeout(() => {
      findCustomerByPhone(phone).then((result) => {
        if (cancelled) return;

        if (result.error) {
          setCustomerLookupStatus('error');
          setCustomerLookupError(result.error);
          return;
        }

        if (result.data) {
          setCustomerLookupStatus('found');
          setCustomerName(result.data.name || '');
          return;
        }

        setCustomerLookupStatus('new');
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerPhone]);

  const buildAddonsFromSelection = (
    groups: AddonGroup[],
    selectedIds: Record<string, boolean>
  ) => {
    const addons: OrderItemAddon[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        if (!selectedIds[item.id]) continue;
        addons.push({
          id: `pos-addon-${item.id}`,
          order_item_id: '',
          addon_group_id: group.id,
          addon_group_name: group.name,
          addon_item_id: item.id,
          addon_item_name: item.name,
          addon_item_price: item.extra_price,
          section: item.section ?? null,
          created_at: new Date().toISOString(),
          is_required: group.is_required,
          display_order: item.sort_order ?? undefined,
          display_group_order: group.display_order ?? undefined,
        });
      }
    }
    return addons;
  };

  const selectedEditorAddons = useMemo(() => {
    return buildAddonsFromSelection(editorAddonGroups, editorSelectedIds);
  }, [editorAddonGroups, editorSelectedIds]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = editingOrder?.tax ?? 0;
    const total = Math.max(
      0,
      subtotal
      + tax
      + (editingOrder?.delivery_fee ?? 0)
      + (editingOrder?.service_fee ?? 0)
      - (editingOrder?.promotion_discount ?? 0)
      - (editingOrder?.coupon_discount ?? 0)
      - (editingOrder?.reward_points_value ?? 0)
    );
    return { subtotal, tax, total };
  }, [cartItems, editingOrder]);

  const selectedRemovedIngredients = useMemo(
    () => editorRemovableIngredients
      .filter((ingredient) => editorRemovedIngredientIds[ingredient.id])
      .map((ingredient) => ingredient.ingredient_name),
    [editorRemovableIngredients, editorRemovedIngredientIds]
  );

  const loadCustomizationAvailability = async (productIds: string[]) => {
    if (productIds.length === 0) {
      setCustomizableProductIds(new Set());
      return;
    }

    const uniqueProductIds = Array.from(new Set(productIds));
    const missingProductIds = uniqueProductIds.filter((productId) => {
      const fullCustomization = getFreshCacheEntry(catalogCache.customizationByProduct, productId);
      if (fullCustomization) {
        catalogCache.hasCustomizationByProduct.set(
          productId,
          cacheEntry(fullCustomization.data.groups.length > 0 || fullCustomization.data.removableIngredients.length > 0)
        );
        return false;
      }
      return !getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId);
    });

    if (missingProductIds.length === 0) {
      setCustomizableProductIds(new Set(uniqueProductIds.filter((productId) => (
        getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId)?.data
      ))));
      return;
    }

    const [addonResult, ingredientResult] = await Promise.all([
      supabase
        .from('sale_product_addon_groups')
        .select('sale_product_id')
        .in('sale_product_id', missingProductIds),
      supabase
        .from('sale_product_ingredients')
        .select('sale_product_id')
        .in('sale_product_id', missingProductIds)
        .eq('customer_can_remove', true),
    ]);

    if (addonResult.error || ingredientResult.error) {
      setCustomizableProductIds(new Set(uniqueProductIds.filter((productId) => (
        getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId)?.data
      ))));
      return;
    }

    const customizableIds = new Set([
      ...((addonResult.data || []) as Array<{ sale_product_id: string }>).map((row) => row.sale_product_id),
      ...((ingredientResult.data || []) as Array<{ sale_product_id: string }>).map((row) => row.sale_product_id),
    ]);

    missingProductIds.forEach((productId) => {
      catalogCache.hasCustomizationByProduct.set(productId, cacheEntry(customizableIds.has(productId)));
    });

    setCustomizableProductIds(new Set(uniqueProductIds.filter((productId) => (
      getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId)?.data
    ))));
  };

  const productHasCustomization = async (productId: string) => {
    const fullCustomization = getFreshCacheEntry(catalogCache.customizationByProduct, productId);
    if (fullCustomization) {
      return fullCustomization.data.groups.length > 0 || fullCustomization.data.removableIngredients.length > 0;
    }

    const cachedAvailability = getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId);
    if (cachedAvailability) {
      return cachedAvailability.data;
    }

    await loadCustomizationAvailability([productId]);
    return getFreshCacheEntry(catalogCache.hasCustomizationByProduct, productId)?.data ?? false;
  };

  const loadCustomizations = async (
    productId: string,
    selectedAddons: OrderItemAddon[],
    selectedRemovedIngredientsForItem: string[]
  ): Promise<{ groups: AddonGroup[]; removableIngredients: RemovableIngredient[] }> => {
    const applyCustomizationData = (customizations: CustomizationData) => {
      setEditorAddonGroups(customizations.groups);
      setEditorRemovableIngredients(customizations.removableIngredients);
      setEditorRemovedIngredientIds(
        customizations.removableIngredients.reduce<Record<string, boolean>>((acc, ingredient) => {
          if (selectedRemovedIngredientsForItem.includes(ingredient.ingredient_name)) {
            acc[ingredient.id] = true;
          }
          return acc;
        }, {})
      );
    };

    setEditorSelectedIds(
      selectedAddons.reduce<Record<string, boolean>>((acc, addon) => {
        acc[addon.addon_item_id] = true;
        return acc;
      }, {})
    );

    const cachedCustomizations = getFreshCacheEntry(catalogCache.customizationByProduct, productId);
    if (cachedCustomizations) {
      setLoadingAddons(false);
      applyCustomizationData(cachedCustomizations.data);
      return cachedCustomizations.data;
    }

    setLoadingAddons(true);
    const [addonResult, ingredientResult] = await Promise.all([
      supabase
        .from('sale_product_addon_groups')
        .select(`
        addon_group_id,
        display_order,
        addon_groups (
          id,
          name,
          is_required,
          multiple_choice,
          addon_items (
            id,
            addon_group_id,
            name,
            extra_price,
            section,
            sort_order,
            is_active
          )
        )
      `)
        .eq('sale_product_id', productId)
        .order('display_order', { ascending: true }),
      supabase
        .from('sale_product_ingredients')
        .select('id, products!product_id(name)')
        .eq('sale_product_id', productId)
        .eq('customer_can_remove', true),
    ]);

    setLoadingAddons(false);
    if (addonResult.error) {
      Alert.alert('Add-ons', addonResult.error.message);
      setEditorAddonGroups([]);
      return { groups: [], removableIngredients: [] };
    }
    if (ingredientResult.error) {
      Alert.alert('Ingredients', ingredientResult.error.message);
      setEditorRemovableIngredients([]);
      return { groups: [], removableIngredients: [] };
    }

    const groups = (addonResult.data || [])
      .map((row: any) => {
        const group = Array.isArray(row.addon_groups) ? row.addon_groups[0] : row.addon_groups;
        if (!group) return null;
        return {
          id: group.id,
          name: group.name,
          is_required: Boolean(group.is_required),
          multiple_choice: Boolean(group.multiple_choice),
          display_order: row.display_order ?? null,
          items: ((group.addon_items || []) as AddonItem[])
            .filter((item) => item.is_active !== false)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
        };
      })
      .filter((group): group is AddonGroup => Boolean(group));

    const removableIngredients = ((ingredientResult.data || []) as Array<{
      id: string;
      products: { name?: string } | { name?: string }[] | null;
    }>).map((row) => {
      const productRef = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.id,
        ingredient_name: productRef?.name?.trim() || 'Unknown ingredient',
      };
    });

    const customizations = { groups, removableIngredients };
    catalogCache.customizationByProduct.set(productId, cacheEntry(customizations));
    catalogCache.hasCustomizationByProduct.set(
      productId,
      cacheEntry(groups.length > 0 || removableIngredients.length > 0)
    );
    applyCustomizationData(customizations);

    return customizations;
  };

  const openCategory = (categoryId: string) => {
    const layoutCategory = posLayout?.categories.find((category) => category.categoryId === categoryId) ?? null;
    const sourceCategoryIds = layoutCategory?.sourceCategoryIds?.length
      ? layoutCategory.sourceCategoryIds
      : [categoryId];
    const hasChildCategories = categories.some((category) => (
      sourceCategoryIds.includes(category.parent_category_id || '')
    ));

    if (hasChildCategories && !layoutCategory?.showProductsOnTopLevel) {
      setSelectedParentCatId(categoryId);
      setSelectedCatId(null);
      setProducts([]);
      setCustomizableProductIds(new Set());
      setMenuLevel('subgroups');
      return;
    }

    setSelectedParentCatId(null);
    setSelectedCatId(categoryId);
    setProducts([]);
    setCustomizableProductIds(new Set());
    setMenuLevel('items');
  };

  const openSubcategory = (categoryId: string) => {
    setSelectedCatId(categoryId);
    setProducts([]);
    setCustomizableProductIds(new Set());
    setMenuLevel('items');
  };

  const openSearch = () => {
    setSearchQuery('');
    setSelectedProduct(null);
    setEditingItemId(null);
    setMenuLevel('search');
  };

  const backToGroups = () => {
    setMenuLevel('groups');
    setSelectedParentCatId(null);
    setSelectedCatId(null);
    setProducts([]);
    setCustomizableProductIds(new Set());
  };

  const backToSubgroups = () => {
    if (!selectedParentCatId) {
      backToGroups();
      return;
    }
    setMenuLevel('subgroups');
    setSelectedCatId(null);
    setProducts([]);
    setCustomizableProductIds(new Set());
  };

  const backToItems = () => {
    setMenuLevel(selectedCatId ? 'items' : selectedParentCatId ? 'subgroups' : 'groups');
    setSelectedProduct(null);
    setEditingItemId(null);
    setEditorAddonGroups([]);
    setEditorSelectedIds({});
    setEditorRemovableIngredients([]);
    setEditorRemovedIngredientIds({});
  };

  const openCheckout = () => {
    setMenuLevel('checkout');
    setSelectedProduct(null);
    setEditingItemId(null);
    setEditorAddonGroups([]);
    setEditorSelectedIds({});
    setEditorRemovableIngredients([]);
    setEditorRemovedIngredientIds({});
  };

  const buildCartItem = (
    product: SaleProduct,
    quantity: number,
    addons: OrderItemAddon[],
    comment: string,
    removedIngredients: string[]
  ): PosCartItem => ({
    id: newLocalId(),
    order_id: '',
    product_id: product.id,
    product_name: product.name,
    product_description: product.description,
    product_image_url: product.image_url,
    base_price: product.sale_price,
    quantity,
    subtotal: (product.sale_price + addonTotal(addons)) * quantity,
    section: formatKitchenSectionValue(product.section, addons, getProductGroupSection(product)),
    removed_ingredients: removedIngredients,
    comment: comment.trim() || null,
    created_at: new Date().toISOString(),
    addons,
  });

  const quickAddProduct = async (
    product: SaleProduct,
    options: { skipCustomization?: boolean; forcePlainAdd?: boolean } = {}
  ) => {
    const hasCustomizedCopy = cartItems.some((item) => (
      item.product_id === product.id && cartItemHasCustomizations(item)
    ));
    const existingPlainItem = cartItems.find((item) => (
      item.product_id === product.id
      && !cartItemHasCustomizations(item)
    ));

    if (existingPlainItem && !hasCustomizedCopy) {
      updateQuantity(existingPlainItem.id, 1);
      return;
    }

    const newItem = buildCartItem(product, 1, [], '', []);
    setCartItems((prev) => [...prev, newItem]);

    if (options.forcePlainAdd) {
      return;
    }

    if (
      (!options.skipCustomization || hasCustomizedCopy)
      && (customizableProductIds.has(product.id)
        || await productHasCustomization(product.id)
      )
    ) {
      setQuickListVisible(false);
      setSelectedProduct(product);
      setEditingItemId(newItem.id);
      setEditorAddonGroups([]);
      setEditorRemovableIngredients([]);
      setEditorRemovedIngredientIds({});
      setMenuLevel('addons');
      await loadCustomizations(product.id, [], []);
    }
  };

  const openCartItemEditor = (item: PosCartItem) => {
    setQuickListVisible(false);

    const catalogProduct = [...products, ...searchProducts, ...topSellers].find((product) => product.id === item.product_id);
    const product: SaleProduct = {
      id: item.product_id,
      name: item.product_name,
      description: item.product_description,
      section: catalogProduct?.section ?? item.section,
      search_term: null,
      sale_price: item.base_price,
      image_url: item.product_image_url,
      sale_category_id: catalogProduct?.sale_category_id ?? null,
      sub_category_id: catalogProduct?.sub_category_id ?? null,
      sort_order: null,
      is_active: true,
    };

    setSelectedProduct(product);
    setEditingItemId(item.id);
    setEditorAddonGroups([]);
    setEditorRemovableIngredients([]);
    setEditorRemovedIngredientIds({});
    setMenuLevel('addons');
    void loadCustomizations(item.product_id, item.addons || [], item.removed_ingredients || []);
  };

  const addItemToCart = (
    product: SaleProduct,
    quantity: number,
    addons: OrderItemAddon[],
    comment: string,
    removedIngredients: string[]
  ) => {
    const lineSubtotal = (product.sale_price + addonTotal(addons)) * quantity;
    const normalizedComment = comment.trim();
    const existing = cartItems.find((item) => (
      item.product_id === product.id
      && addonSelectionKey(item.addons || []) === addonSelectionKey(addons)
      && (item.comment ?? '') === normalizedComment
      && JSON.stringify(item.removed_ingredients || []) === JSON.stringify(removedIngredients)
    ));

    if (existing) {
      setCartItems((prev) => prev.map((item) => (
        item.id === existing.id
          ? { ...item, quantity: item.quantity + quantity, subtotal: item.subtotal + lineSubtotal }
          : item
      )));
      return;
    }

    const newItem = buildCartItem(product, quantity, addons, normalizedComment, removedIngredients);
    setCartItems((prev) => [...prev, newItem]);
  };

  const applyEditorSelections = (
    addons: OrderItemAddon[],
    removedIngredients: string[]
  ) => {
    if (!selectedProduct || !editingItemId) return;

    setCartItems((prev) => prev.map((item) => {
      if (item.id !== editingItemId) return item;
      return {
        ...item,
        addons,
        section: formatKitchenSectionValue(selectedProduct.section, addons, getProductGroupSection(selectedProduct)),
        removed_ingredients: removedIngredients,
        subtotal: (selectedProduct.sale_price + addonTotal(addons)) * item.quantity,
      };
    }));
  };

  const removeCartItem = (id: string) => {
    if (menuLevel === 'addons') backToItems();
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const openNoteEditor = (item: PosCartItem) => {
    setNoteItemId(item.id);
    setNoteDraft(item.comment ?? '');
  };

  const closeNoteEditor = () => {
    setNoteItemId(null);
    setNoteDraft('');
  };

  const saveNote = () => {
    if (!noteItemId) return;
    const normalizedNote = noteDraft.trim();
    setCartItems((prev) => prev.map((item) => (
      item.id === noteItemId
        ? { ...item, comment: normalizedNote || null }
        : item
    )));
    closeNoteEditor();
  };

  const openPickupPicker = (mode: 'date' | 'time') => {
    setPickupPickerMode(mode);
    setShowPickupPicker(true);
  };

  const handlePickupPickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPickupPicker(false);
    if (!date) return;
    setScheduledPickupAt(date);
  };

  const handleClearCart = () => {
    if (orderId) return;

    if (cartItems.length === 0) return;
    Alert.alert(
      'Clear cart?',
      'Remove all items from the current order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setCartItems([]);
            setQuickOrderNote(null);
            setOrderNoteText('');
            backToGroups();
          },
        },
      ]
    );
  };

  const updateQuantity = (id: string, delta: number) => {
    const currentItem = cartItems.find((item) => item.id === id);
    if (menuLevel === 'addons' && currentItem && currentItem.quantity + delta <= 0) {
      backToItems();
    }

    setCartItems((prev) => prev
      .map((item) => {
        if (item.id !== id) return item;
        const nextQuantity = item.quantity + delta;
        if (nextQuantity <= 0) return null;
        return {
          ...item,
          quantity: nextQuantity,
          subtotal: (item.base_price + addonTotal(item.addons || [])) * nextQuantity,
        };
      })
      .filter((item): item is PosCartItem => Boolean(item)));
  };

  const toggleAddon = (group: AddonGroup, item: AddonItem) => {
    setEditorSelectedIds((prev) => {
      let next: Record<string, boolean>;
      if (group.multiple_choice) {
        next = { ...prev, [item.id]: !prev[item.id] };
      } else {
        next = { ...prev };
        for (const groupItem of group.items) {
          delete next[groupItem.id];
        }
        if (!prev[item.id]) next[item.id] = true;
      }
      const nextAddons = buildAddonsFromSelection(editorAddonGroups, next);
      applyEditorSelections(nextAddons, selectedRemovedIngredients);
      return next;
    });
  };

  const toggleRemovedIngredient = (ingredientId: string) => {
    setEditorRemovedIngredientIds((prev) => {
      const next = {
        ...prev,
        [ingredientId]: !prev[ingredientId],
      };
      const nextRemovedIngredients = editorRemovableIngredients
        .filter((ingredient) => next[ingredient.id])
        .map((ingredient) => ingredient.ingredient_name);
      applyEditorSelections(selectedEditorAddons, nextRemovedIngredients);
      return next;
    });
  };

  const handleCheckout = async (paymentOverride?: PosCheckoutPaymentOverride) => {
    const phone = customerPhone.trim();
    const name = customerName.trim();
    const isEditingExistingOrder = Boolean(orderId);
    const finalPaymentChoice = paymentOverride ?? paymentChoice;

    if (!isEditingExistingOrder && !phone) {
      Alert.alert('Checkout', 'Please enter a customer phone number.');
      return;
    }

    if (finalPaymentChoice === 'cash' && !cashTenderConfirmedRef.current) {
      setCashTenderMode('pickup');
      return;
    }

    if (paymentOverride === 'smartpay') {
      if (!smartpayPaired) {
        Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
        return;
      }

      try {
        setSmartpayProcessing(true);
        await processSmartpayCardPayment(totals.total);
      } catch (error) {
        console.error('SmartPay checkout payment failed', error);
        Alert.alert('SmartPay payment failed', formatSmartpayError(error));
        setSmartpayProcessing(false);
        return;
      }
    }

    setCreatingOrder(true);
    const pickupAt = isPreOrder
      ? (scheduledPickupAt.getTime() > Date.now() ? scheduledPickupAt : defaultPickupTime())
      : null;
    let customerId = editingOrder?.user_id ?? null;
    if (phone) {
      const { data: customer, error: customerError } = await createCustomerIfNotExists(phone, name);
      if (customerError) {
        setCreatingOrder(false);
        setSmartpayProcessing(false);
        cashTenderConfirmedRef.current = false;
        Alert.alert('Customer', customerError);
        return;
      }
      customerId = customer?.id ?? null;
    }

    const paymentStatus: PaymentStatus = finalPaymentChoice === 'no_pay' ? 'pending' : 'paid';
    const existingPaymentDetail = editingOrder?.payment_method_detail ?? null;
    const shouldKeepExistingSmartpay =
      isEditingExistingOrder &&
      finalPaymentChoice === 'card' &&
      existingPaymentDetail?.toLowerCase() === 'smartpay';
    const paymentMethodDetail =
      finalPaymentChoice === 'smartpay' ? 'SmartPay' :
        shouldKeepExistingSmartpay ? existingPaymentDetail :
          finalPaymentChoice === 'card' ? 'Card' :
            finalPaymentChoice === 'cash' ? 'Cash' :
              null;

    const orderPayload = {
      user_id: customerId,
      customer_email: '',
      customer_phone: phone,
      customer_name: name || null,
      payment_method: 'store',
      order_channel: 'phone_pickup',
      payment_method_detail: paymentMethodDetail,
      order_type: 'pickup',
      payment_status: paymentStatus,
      order_status: 'confirmed',
      subtotal: totals.subtotal,
      tax: totals.tax,
      delivery_fee: 0,
      service_fee: 0,
      promotion_discount: 0,
      promotions_applied: [],
      coupon_code: null,
      coupon_discount: 0,
      total: totals.total,
      reward_points_used: null,
      reward_points_value: null,
      order_options: orderOptions,
      special_instructions: orderSpecialInstructions,
      delivery_address_id: null,
      delivery_address_line1: null,
      delivery_address_line2: null,
      delivery_city: null,
      delivery_state: null,
      delivery_postcode: null,
      delivery_country: null,
      delivery_latitude: null,
      delivery_longitude: null,
      delivery_quote_id: null,
      delivery_quote_amount: null,
      delivery_quote_currency: null,
      delivery_quote_expires_at: null,
      delivery_eta_minutes: null,
      delivery_provider_id: null,
      delivery_status: null,
      delivery_tracking_url: null,
      delivery_driver_name: null,
      delivery_driver_phone: null,
      delivery_vehicle_info: null,
      delivery_instructions: null,
      scheduled_pickup_at: pickupAt ? pickupAt.toISOString() : null,
    } as any;

    const result = orderId
      ? await updatePosOrder(orderId, cartItems, totals, {
        user_id: customerId,
        customer_phone: phone || editingOrder?.customer_phone || '',
        customer_name: name || editingOrder?.customer_name || null,
        payment_method: finalPaymentChoice === 'no_pay' ? (editingOrder?.payment_method ?? 'store') : 'store',
        order_channel: editingOrder?.order_channel ?? 'phone_pickup',
        payment_status: paymentStatus,
        payment_method_detail: paymentMethodDetail,
        order_options: orderOptions,
        special_instructions: orderSpecialInstructions,
        scheduled_pickup_at: pickupAt ? pickupAt.toISOString() : null,
      })
      : await savePosOrder(orderPayload, cartItems);

    setCreatingOrder(false);
    cashTenderConfirmedRef.current = false;
    setSmartpayProcessing(false);
    if (result.error) {
      setSmartpayProcessing(false);
      Alert.alert('Checkout', result.error);
      return;
    }
    invalidateTopSellers();
    router.back();
  };

  const handleSmartpayInstoreCheckout = async () => {
    if (orderId) {
      Alert.alert('Edit Order', 'Use Update Order when editing an existing order.');
      return;
    }

    if (cartItems.length === 0 || creatingOrder || smartpayProcessing) return;
    if (!smartpayPaired) {
      Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
      return;
    }

    try {
      setSmartpayProcessing(true);
      await processSmartpayCardPayment(totals.total);
      setCreatingOrder(true);

      const orderPayload = {
        user_id: null,
        customer_email: '',
        customer_phone: '',
        customer_name: 'INSTORE',
        payment_method: 'store',
        order_channel: 'instore',
        payment_method_detail: 'SmartPay',
        order_type: 'pickup',
        payment_status: 'paid',
        order_status: 'confirmed',
        subtotal: totals.subtotal,
        tax: totals.tax,
        delivery_fee: 0,
        service_fee: 0,
        promotion_discount: 0,
        promotions_applied: [],
        coupon_code: null,
        coupon_discount: 0,
        total: totals.total,
        reward_points_used: null,
        reward_points_value: null,
        order_options: orderOptions,
        special_instructions: orderSpecialInstructions,
        delivery_address_id: null,
        delivery_address_line1: null,
        delivery_address_line2: null,
        delivery_city: null,
        delivery_state: null,
        delivery_postcode: null,
        delivery_country: null,
        delivery_latitude: null,
        delivery_longitude: null,
        delivery_quote_id: null,
        delivery_quote_amount: null,
        delivery_quote_currency: null,
        delivery_quote_expires_at: null,
        delivery_eta_minutes: null,
        delivery_provider_id: null,
        delivery_status: null,
        delivery_tracking_url: null,
        delivery_driver_name: null,
        delivery_driver_phone: null,
        delivery_vehicle_info: null,
        delivery_instructions: null,
        scheduled_pickup_at: null,
      } as any;

      const result = await savePosOrder(orderPayload, cartItems);
      setCreatingOrder(false);

      if (result.error) {
        Alert.alert('Instore Order', result.error);
        return;
      }
      invalidateTopSellers();
      router.back();
    } catch (error) {
      console.error('SmartPay instore payment failed', error);
      Alert.alert('SmartPay payment failed', formatSmartpayError(error));
    } finally {
      setCreatingOrder(false);
      setSmartpayProcessing(false);
    }
  };

  const confirmDismissSmartpayLock = () => {
    if (!smartpayProcessing) return;

    Alert.alert(
      'Hide SmartPay screen?',
      'The payment may still be running on the terminal. Hide this screen only if you need to return to the POS.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Hide', style: 'destructive', onPress: () => setSmartpayProcessing(false) },
      ]
    );
  };

  const handleInstoreCheckout = async (payment: PosInstorePaymentChoice) => {
    if (orderId) {
      Alert.alert('Edit Order', 'Use Update Order when editing an existing order.');
      return;
    }

    if (cartItems.length === 0) return;

    if (payment === 'cash' && !cashTenderConfirmedRef.current) {
      setCashTenderMode('instore');
      return;
    }

    setCreatingOrder(true);
    const paymentStatus: PaymentStatus = payment === 'unpaid' ? 'pending' : 'paid';
    const paymentMethodDetail =
      payment === 'card' ? 'Card' :
        payment === 'cash' ? 'Cash' :
          null;

    const orderPayload = {
      user_id: null,
      customer_email: '',
      customer_phone: '',
      customer_name: 'INSTORE',
      payment_method: 'store',
      order_channel: 'instore',
      payment_method_detail: paymentMethodDetail,
      order_type: 'pickup',
      payment_status: paymentStatus,
      order_status: 'confirmed',
      subtotal: totals.subtotal,
      tax: totals.tax,
      delivery_fee: 0,
      service_fee: 0,
      promotion_discount: 0,
      promotions_applied: [],
      coupon_code: null,
      coupon_discount: 0,
      total: totals.total,
      reward_points_used: null,
      reward_points_value: null,
      order_options: orderOptions,
      special_instructions: orderSpecialInstructions,
      delivery_address_id: null,
      delivery_address_line1: null,
      delivery_address_line2: null,
      delivery_city: null,
      delivery_state: null,
      delivery_postcode: null,
      delivery_country: null,
      delivery_latitude: null,
      delivery_longitude: null,
      delivery_quote_id: null,
      delivery_quote_amount: null,
      delivery_quote_currency: null,
      delivery_quote_expires_at: null,
      delivery_eta_minutes: null,
      delivery_provider_id: null,
      delivery_status: null,
      delivery_tracking_url: null,
      delivery_driver_name: null,
      delivery_driver_phone: null,
      delivery_vehicle_info: null,
      delivery_instructions: null,
      scheduled_pickup_at: null,
    } as any;

    const result = await savePosOrder(orderPayload, cartItems);

    setCreatingOrder(false);
    cashTenderConfirmedRef.current = false;
    if (result.error) {
      Alert.alert('Instore Order', result.error);
      return;
    }
    invalidateTopSellers();
    router.back();
  };

  const openInstorePaymentPrompt = () => {
    if (orderId) {
      Alert.alert('Edit Order', 'Use Update Order when editing an existing order.');
      return;
    }

    if (cartItems.length === 0 || creatingOrder) return;

    setInstorePaymentDialogVisible(true);
  };

  const handleCashTenderConfirm = () => {
    const mode = cashTenderMode;
    if (!mode) return;

    setCashTenderMode(null);
    cashTenderConfirmedRef.current = true;

    if (mode === 'pickup') {
      void handleCheckout('cash');
      return;
    }

    void handleInstoreCheckout('cash');
  };

  const activeCategoryName = categories.find((category) => category.id === selectedCatId)?.name
    || activeLayoutCategory?.title
    || 'Menu';
  const activeParentCategoryName = activeLayoutCategory?.title
    || categories.find((category) => category.id === selectedParentCatId)?.name
    || 'Menu';
  const itemsBackAction = selectedParentCatId ? backToSubgroups : backToGroups;
  const itemsBackLabel = selectedParentCatId ? activeParentCategoryName : 'Groups';
  const quickQuantityForProduct = (productId: string) => (
    cartItems.find((item) => (
      item.product_id === productId
      && !cartItemHasCustomizations(item)
    ))?.quantity ?? 0
  );
  const isCompactLayout = width < 1000;
  const isNarrowLayout = width < 760;
  const gridColumns = isNarrowLayout ? 2 : isCompactLayout ? 3 : 4;
  const quickListColumns = isNarrowLayout ? 2 : 3;
  const addonOptionWidth = isNarrowLayout ? '48%' : isCompactLayout ? '31%' : '23%';
  const activeCartItemId = noteItemId ?? editingItemId ?? cartItems[cartItems.length - 1]?.id ?? null;
  const checkoutPrimaryLabel = orderId
    ? 'Update Order'
    : paymentChoice === 'card'
      ? 'Create Pickup Order • Card'
      : paymentChoice === 'cash'
        ? 'Create Pickup Order • Cash'
        : 'Create Pickup Order • No Pay';
  const addonSelectionCount = selectedEditorAddons.length + selectedRemovedIngredients.length;
  const addonSelectionTotal = addonTotal(selectedEditorAddons);

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title={orderId ? 'Edit Order' : 'Take Order'} titleStyle={styles.headerTitle} />
        <Appbar.Action icon="magnify" onPress={openSearch} iconColor="#fff" accessibilityLabel="Search items" />
        <Appbar.Action icon="view-grid-plus-outline" onPress={openLayoutSettings} iconColor="#fff" accessibilityLabel="POS layout settings" />
        <Appbar.Action icon="home" onPress={goHome} iconColor="#fff" accessibilityLabel="Back home" />
      </Appbar.Header>

      <View style={[styles.body, isCompactLayout ? styles.bodyCompact : null]}>
        <View style={[styles.menuPane, isCompactLayout ? styles.menuPaneCompact : null]}>
          {menuLevel === 'groups' && (
            <>
              <View style={styles.groupScreen}>
                <FlatList
                  data={layoutTopLevelCategories}
                  keyExtractor={(item) => item.id}
                  numColumns={gridColumns}
                  key={`groups-${gridColumns}`}
                  contentContainerStyle={styles.tileGrid}
                  renderItem={({ item }) => {
                    return (
                      <TouchableOpacity
                        style={[styles.groupCard, { backgroundColor: item.color }]}
                        onPress={() => openCategory(item.id)}
                      >
                        <Text style={styles.groupCardText} numberOfLines={3}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
                <View style={styles.topSellersSection}>
                  <View style={styles.topSellersHeader}>
                    <View style={styles.topSellersHeaderText}>
                      <Text style={styles.topSellersTitle}>Top sellers today</Text>
                      {loadingTopSellers && <Text style={styles.topSellersLoading}>Refreshing...</Text>}
                    </View>
                  </View>
                  {topSellers.length > 0 ? (
                    <FlatList
                      data={topSellers}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.topSellersList}
                      renderItem={({ item }) => {
                        const quickQuantity = quickQuantityForProduct(item.id);
                        return (
                          <TouchableOpacity style={styles.topSellerCard} onPress={() => void quickAddProduct(item)}>
                            {quickQuantity > 0 && (
                              <View style={styles.topSellerQuantityBadge}>
                                <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                              </View>
                            )}
                            <Text style={styles.topSellerName} numberOfLines={2}>{item.name}</Text>
                            <Text style={styles.topSellerMeta}>{item.total_quantity_sold} sold</Text>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    <Text style={styles.topSellersEmpty}>
                      {loadingTopSellers ? 'Loading top sellers...' : 'No sales yet today'}
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}

          {menuLevel === 'search' && (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={backToGroups} style={styles.backButton}>
                  Groups
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle}>Search Items</Text>
                  <Text style={styles.menuSubtitle}>{searchResults.length} results</Text>
                </View>
              </View>
              <View style={styles.searchBody}>
                <TextInput
                  label="Search menu"
                  mode="outlined"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  left={<TextInput.Icon icon="magnify" />}
                  style={styles.searchInput}
                />
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  numColumns={gridColumns}
                  key={`search-products-${gridColumns}`}
                  contentContainerStyle={styles.searchGrid}
                  ListEmptyComponent={(
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>
                        {loadingSearchProducts ? 'Loading items...' : 'No matching items'}
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => {
                    const quickQuantity = quickQuantityForProduct(item.id);
                    const tilePalette = productTilePalette(item.id);
                    return (
                      <TouchableOpacity
                        style={[styles.productCard, { backgroundColor: tilePalette.backgroundColor, borderColor: tilePalette.borderColor }]}
                        onPress={() => void quickAddProduct(item)}
                      >
                        {quickQuantity > 0 && (
                          <View style={styles.productQuantityBadge}>
                            <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                          </View>
                        )}
                        <View style={styles.productNameArea}>
                          <Text style={styles.productName} numberOfLines={3}>{item.name}</Text>
                        </View>
                        <View style={[styles.productPricePill, { backgroundColor: tilePalette.priceColor }]}>
                          <Text style={styles.productPrice}>${item.sale_price.toFixed(2)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </>
          )}

          {menuLevel === 'subgroups' && (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={backToGroups} style={styles.backButton}>
                  Groups
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle}>{activeParentCategoryName}</Text>
                  <Text style={styles.menuSubtitle}>{childCategoriesForSelectedGroup.length} sub-categories</Text>
                </View>
              </View>
              <FlatList
                data={childCategoriesForSelectedGroup}
                keyExtractor={(item) => item.id}
                numColumns={gridColumns}
                key={`subgroups-${gridColumns}`}
                contentContainerStyle={styles.tileGrid}
                ListEmptyComponent={(
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No sub-categories in this group</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.groupCard, activeLayoutCategory?.color ? { backgroundColor: activeLayoutCategory.color } : null]}
                    onPress={() => openSubcategory(item.id)}
                  >
                    <Text style={styles.groupCardText} numberOfLines={3}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          {menuLevel === 'items' && (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={itemsBackAction} style={styles.backButton}>
                  {itemsBackLabel}
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle}>{activeCategoryName}</Text>
                  <Text style={styles.menuSubtitle}>{layoutProducts.length} items</Text>
                </View>
              </View>
              <FlatList
                data={layoutProducts}
                keyExtractor={(item) => item.id}
                numColumns={gridColumns}
                key={`products-${gridColumns}`}
                contentContainerStyle={styles.tileGrid}
                ListEmptyComponent={(
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{loadingProducts ? 'Loading items...' : 'No items in this group'}</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const quickQuantity = quickQuantityForProduct(item.id);
                  const skipCustomization = Boolean(activeLayoutCategory?.showProductsOnTopLevel);
                  const customColor = productButtonColor(item.id);
                  const tilePalette = productTilePalette(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.productCard,
                        { backgroundColor: tilePalette.backgroundColor, borderColor: tilePalette.borderColor },
                        customColor ? styles.productCardCustomColor : null,
                        customColor ? { backgroundColor: customColor, borderColor: customColor } : null,
                      ]}
                      onPress={() => void quickAddProduct(item, { skipCustomization })}
                    >
                      {quickQuantity > 0 && (
                        <View style={styles.productQuantityBadge}>
                          <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                        </View>
                      )}
                      <View style={styles.productNameArea}>
                        <Text style={[styles.productName, customColor ? styles.productCardCustomText : null]} numberOfLines={3}>{item.name}</Text>
                      </View>
                      <View style={[
                        styles.productPricePill,
                        customColor ? styles.productPricePillCustom : { backgroundColor: tilePalette.priceColor },
                      ]}>
                        <Text style={[styles.productPrice, customColor ? styles.productCardCustomText : null]}>${item.sale_price.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.levelFooter}>
                <View style={styles.levelFooterActions}>
                  <Button
                    mode="outlined"
                    icon="arrow-left"
                    onPress={itemsBackAction}
                    style={styles.levelFooterButton}
                    contentStyle={styles.levelFooterButtonContent}
                    labelStyle={styles.levelFooterButtonLabel}
                  >
                    {selectedParentCatId ? `Back to ${activeParentCategoryName}` : 'Back to Groups'}
                  </Button>
                  <Button
                    mode="contained"
                    icon="lightning-bolt"
                    onPress={() => setQuickListVisible(true)}
                    style={styles.levelFooterQuickListButton}
                    contentStyle={styles.quickListButtonContent}
                    buttonColor="#0f766e"
                    disabled={quickAccessProducts.length === 0}
                  >
                    Quick List
                  </Button>
                </View>
              </View>
            </>
          )}

          {menuLevel === 'addons' && selectedProduct && (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={backToItems} style={styles.backButton}>
                  Items
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle} numberOfLines={1}>{selectedProduct.name}</Text>
                  <Text style={styles.menuSubtitle}>Customize item</Text>
                </View>
              </View>

              <View style={styles.editorBody}>
                {editorRemovableIngredients.length > 0 && (
                  <View style={styles.removableBlock}>
                    <View style={[styles.addonGroupLabel, styles.removeGroupLabel]}>
                      <Text style={[styles.addonGroupTitle, styles.removeGroupTitle]}>Remove Ingredients</Text>
                    </View>
                    <Text style={styles.groupRequirementText}>Optional removals</Text>
                    <View style={styles.optionGrid}>
                      {editorRemovableIngredients.map((ingredient) => {
                        const selected = Boolean(editorRemovedIngredientIds[ingredient.id]);
                        return (
                          <TouchableOpacity
                            key={ingredient.id}
                            style={[styles.optionButton, { width: addonOptionWidth }, selected && styles.removeButtonSelected]}
                            onPress={() => toggleRemovedIngredient(ingredient.id)}
                          >
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={2}>
                              No {ingredient.ingredient_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <FlatList
                  data={editorAddonGroups}
                  keyExtractor={(item) => item.id}
                  style={styles.addonList}
                  ListEmptyComponent={(
                    <Text style={styles.emptyAddonText}>
                      {loadingAddons ? 'Loading add-ons...' : 'No add-ons for this item'}
                    </Text>
                  )}
                  renderItem={({ item: group }) => {
                    const groupPalette = addonGroupPalette(group.id);
                    return (
                      <View
                        style={[
                          styles.addonGroup,
                          { backgroundColor: groupPalette.backgroundColor, borderColor: groupPalette.borderColor },
                        ]}
                      >
                        <View style={[styles.addonGroupLabel, { backgroundColor: groupPalette.labelColor }]}>
                          <Text style={styles.addonGroupTitle}>
                            {group.name}
                          </Text>
                        </View>
                        <Text style={styles.groupRequirementText}>
                          {group.is_required ? 'Required selection' : group.multiple_choice ? 'Optional, choose multiple' : 'Optional, choose one'}
                        </Text>
                        <View style={styles.optionGrid}>
                          {group.items.map((item) => {
                            const selected = Boolean(editorSelectedIds[item.id]);
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.optionButton, { width: addonOptionWidth }, selected && styles.optionButtonSelected]}
                                onPress={() => toggleAddon(group, item)}
                              >
                                <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={2}>
                                  {item.name}
                                </Text>
                                {item.extra_price > 0 && (
                                  <Text style={[styles.optionPrice, selected && styles.optionTextSelected]}>
                                    +${item.extra_price.toFixed(2)}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  }}
                />

                <View style={styles.addonSummaryBar}>
                  <View style={styles.addonSummaryText}>
                    <Text style={styles.addonSummaryTitle}>
                      {addonSelectionCount > 0 ? `${addonSelectionCount} selections` : 'No selections yet'}
                    </Text>
                    <Text style={styles.addonSummaryMeta}>
                      {addonSelectionTotal > 0 ? `Add-ons +$${addonSelectionTotal.toFixed(2)}` : 'Continue when the item looks right'}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    icon="arrow-right"
                    onPress={backToItems}
                    style={styles.addonSummaryButton}
                    contentStyle={styles.levelFooterButtonContent}
                  >
                    Continue
                  </Button>
                </View>

                <View style={styles.editorActions}>
                  <View style={styles.levelFooterActions}>
                    <Button
                      mode="outlined"
                      icon="arrow-left"
                      onPress={backToGroups}
                      style={styles.levelFooterButton}
                      contentStyle={styles.levelFooterButtonContent}
                      labelStyle={styles.levelFooterButtonLabel}
                    >
                      Back to Groups
                    </Button>
                    <Button
                      mode="contained"
                      icon="lightning-bolt"
                      onPress={() => setQuickListVisible(true)}
                      style={styles.levelFooterQuickListButton}
                      contentStyle={styles.quickListButtonContent}
                      buttonColor="#0f766e"
                      disabled={quickAccessProducts.length === 0}
                    >
                      Quick List
                    </Button>
                  </View>
                </View>
              </View>
            </>
          )}

          {menuLevel === 'checkout' && (
            <>
              <View style={styles.menuHeader}>
                <Button mode="outlined" icon="arrow-left" onPress={backToItems} style={styles.backButton}>
                  Order
                </Button>
                <View style={styles.menuHeaderText}>
                  <Text style={styles.menuTitle}>Checkout</Text>
                  <Text style={styles.menuSubtitle}>Customer details</Text>
                </View>
                {customerLookupStatus === 'new' && (
                  <View style={styles.newCustomerBadge}>
                    <Text style={styles.newCustomerBadgeText}>New customer</Text>
                  </View>
                )}
              </View>

              <ScrollView
                style={styles.checkoutBody}
                contentContainerStyle={styles.checkoutContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.checkoutForm}>
                  <TextInput
                    label="Phone"
                    mode="outlined"
                    value={customerPhone}
                    onChangeText={(value) => {
                      setCustomerPhone(value);
                      if (customerLookupStatus === 'found') setCustomerName('');
                    }}
                    keyboardType="phone-pad"
                    style={styles.checkoutInput}
                  />
                  <View style={styles.lookupRow}>
                    {customerLookupStatus === 'loading' && <Text style={styles.lookupText}>Looking up customer...</Text>}
                    {customerLookupStatus === 'found' && <Text style={styles.foundText}>Existing customer found</Text>}
                    {customerLookupStatus === 'new' && <Text style={styles.newText}>No customer found. A new customer will be created.</Text>}
                    {customerLookupStatus === 'error' && <Text style={styles.errorText}>{customerLookupError}</Text>}
                  </View>
                  <TextInput
                    label="Name"
                    mode="outlined"
                    value={customerName}
                    onChangeText={setCustomerName}
                    style={styles.checkoutInput}
                  />
                  <View style={styles.checkoutSummaryCard}>
                    <Text style={styles.checkoutSummaryEyebrow}>Checkout summary</Text>
                    <Text style={styles.checkoutSummaryTotal}>${totals.total.toFixed(2)}</Text>
                    <Text style={styles.checkoutSummaryMeta}>
                      {cartItems.length} items • {isPreOrder ? 'Pre-order pickup' : 'ASAP pickup'}
                    </Text>
                    <Text style={styles.checkoutSummaryMeta}>
                      Payment: {paymentChoice === 'no_pay' ? 'No Pay' : paymentChoice.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.pickupPanel}>
                    <Text style={styles.checkoutSectionTitle}>POS Pickup</Text>
                    <View style={styles.pickupModeRow}>
                      <Button
                        mode={!isPreOrder ? 'contained' : 'outlined'}
                        onPress={() => setIsPreOrder(false)}
                        style={styles.pickupModeButton}
                      >
                        ASAP
                      </Button>
                      <Button
                        mode={isPreOrder ? 'contained' : 'outlined'}
                        onPress={() => {
                          setIsPreOrder(true);
                          setScheduledPickupAt((current) => (
                            current.getTime() > Date.now() ? current : defaultPickupTime()
                          ));
                        }}
                        style={styles.pickupModeButton}
                      >
                        Pre-order
                      </Button>
                    </View>
                    {isPreOrder && (
                      <View style={styles.preOrderPanel}>
                        <Text style={styles.preOrderBadge}>PRE-ORDER</Text>
                        <Text style={styles.pickupTimeText}>{formatPickupTime(scheduledPickupAt)}</Text>
                        <View style={styles.pickupPickerButtons}>
                          <Button mode="outlined" icon="calendar" onPress={() => openPickupPicker('date')} style={styles.pickupPickerButton}>
                            Date
                          </Button>
                          <Button mode="outlined" icon="clock-outline" onPress={() => openPickupPicker('time')} style={styles.pickupPickerButton}>
                            Time
                          </Button>
                        </View>
                        {showPickupPicker && (
                          <DateTimePicker
                            value={scheduledPickupAt}
                            mode={pickupPickerMode}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            minimumDate={new Date()}
                            onChange={handlePickupPickerChange}
                          />
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.paymentPanel}>
                    <Text style={styles.checkoutSectionTitle}>Payment</Text>
                    <View style={styles.paymentModeRow}>
                      <Button
                        mode={paymentChoice === 'card' ? 'contained' : 'outlined'}
                        icon="credit-card-outline"
                        onPress={() => setPaymentChoice('card')}
                        style={styles.paymentModeButton}
                      >
                        CARD
                      </Button>
                      <Button
                        mode={paymentChoice === 'cash' ? 'contained' : 'outlined'}
                        icon="cash"
                        onPress={() => setPaymentChoice('cash')}
                        style={styles.paymentModeButton}
                      >
                        CASH
                      </Button>
                      <Button
                        mode={paymentChoice === 'no_pay' ? 'contained' : 'outlined'}
                        icon="clock-outline"
                        onPress={() => setPaymentChoice('no_pay')}
                        style={styles.paymentModeButton}
                      >
                        No Pay
                      </Button>
                    </View>
                  </View>
                  <TextInput
                    label="Order note"
                    mode="outlined"
                    value={orderNoteText}
                    onChangeText={setOrderNoteText}
                    multiline
                    style={[styles.checkoutInput, styles.checkoutNoteInput]}
                  />
                  <Button
                    mode="contained"
                    icon="check"
                    loading={creatingOrder}
                    disabled={creatingOrder || smartpayProcessing || cartItems.length === 0 || (!orderId && !customerPhone.trim())}
                    onPress={() => void handleCheckout()}
                    style={styles.placeOrderButton}
                    buttonColor="#16a34a"
                  >
                    {checkoutPrimaryLabel}
                  </Button>
                  <View style={styles.secondaryActionsPanel}>
                    <Text style={styles.secondaryActionsTitle}>Quick actions</Text>
                    <View style={styles.secondaryActionsRow}>
                      <Button
                        mode="contained-tonal"
                        icon="credit-card-wireless-outline"
                        loading={smartpayProcessing}
                        disabled={!smartpayPaired || creatingOrder || smartpayProcessing || cartItems.length === 0 || (!orderId && !customerPhone.trim())}
                        onPress={() => void handleCheckout('smartpay')}
                        style={styles.secondaryActionButton}
                      >
                        SmartPay
                      </Button>
                      {!orderId && (
                        <Button
                          mode="contained-tonal"
                          icon="cash-register"
                          loading={creatingOrder}
                          disabled={creatingOrder || cartItems.length === 0}
                          onPress={openInstorePaymentPrompt}
                          style={styles.secondaryActionButton}
                        >
                          In-store
                        </Button>
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </>
          )}

          {menuLevel !== 'groups' && menuLevel !== 'items' && menuLevel !== 'addons' && (
            <View
              pointerEvents="box-none"
              style={styles.quickListButtonWrap}
            >
              <Button
                mode="contained"
                icon="lightning-bolt"
                onPress={() => setQuickListVisible(true)}
                style={styles.quickListButton}
                contentStyle={styles.quickListButtonContent}
                buttonColor="#0f766e"
                disabled={quickAccessProducts.length === 0}
              >
                Quick List
              </Button>
            </View>
          )}

          {quickListVisible && (
            <View style={styles.quickListOverlay}>
              <View style={styles.quickListPanel}>
                <View style={styles.quickListHeader}>
                  <View>
                    <Text style={styles.quickListTitle}>Quick list</Text>
                    <Text style={styles.quickListSubtitle}>Tap items to add without leaving the cart</Text>
                  </View>
                  <IconButton icon="close" size={20} onPress={() => setQuickListVisible(false)} />
                </View>
                {quickAccessProducts.length > 0 ? (
                  <FlatList
                    data={quickAccessProducts}
                    keyExtractor={(item) => item.id}
                    numColumns={quickListColumns}
                    key={`quick-list-${quickListColumns}`}
                    contentContainerStyle={styles.quickListGrid}
                    renderItem={({ item }) => {
                      const quickQuantity = quickQuantityForProduct(item.id);
                      const tilePalette = productTilePalette(item.id);
                      return (
                        <TouchableOpacity
                          style={[
                            styles.quickListCard,
                            { backgroundColor: tilePalette.backgroundColor, borderColor: tilePalette.borderColor },
                          ]}
                          onPress={() => void quickAddProduct(item, { forcePlainAdd: true, skipCustomization: true })}
                        >
                          {quickQuantity > 0 && (
                            <View style={styles.productQuantityBadge}>
                              <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                            </View>
                          )}
                          <View style={styles.productNameArea}>
                            <Text style={styles.productName} numberOfLines={3}>{item.name}</Text>
                          </View>
                          <View style={[styles.productPricePill, { backgroundColor: tilePalette.priceColor }]}>
                            <Text style={styles.productPrice}>${item.sale_price.toFixed(2)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                  <Text style={styles.quickListEmpty}>
                    Select products in POS Layout and check `Show on quick list` to display them here.
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.cartPane, isCompactLayout ? styles.cartPaneCompact : null]}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Current Order</Text>
            <Button
              mode="outlined"
              icon="trash-can-outline"
              compact
              disabled={Boolean(orderId) || cartItems.length === 0}
              onPress={handleClearCart}
              textColor="#dc2626"
              style={styles.clearCartButton}
            >
              Clear
            </Button>
          </View>
          <TouchableOpacity
            style={[styles.quickOrderNoteButton, quickOrderNote && styles.quickOrderNoteButtonSelected]}
            onPress={() => setSaltOptionDialogVisible(true)}
          >
            <View style={styles.quickOrderNoteButtonText}>
              <Text style={[styles.quickOrderNoteTitle, quickOrderNote && styles.quickOrderNoteTitleSelected]}>
                Salt option
              </Text>
              <Text style={[styles.quickOrderNoteValue, quickOrderNote && styles.quickOrderNoteValueSelected]} numberOfLines={1}>
                {quickOrderNote || 'Not selected'}
              </Text>
            </View>
            <Text style={[styles.quickOrderNoteEdit, quickOrderNote && styles.quickOrderNoteEditSelected]}>
              Change
            </Text>
          </TouchableOpacity>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            style={styles.cartList}
            ListEmptyComponent={<Text style={styles.emptyCart}>No items yet</Text>}
            renderItem={({ item }) => {
              const showCartActions = item.id === activeCartItemId;
              return (
                <View style={styles.cartRow}>
                  <View style={styles.cartItemHeader}>
                    <View style={styles.cartItemText}>
                      <View style={styles.cartItemTopLine}>
                        <TouchableOpacity
                          style={styles.cartItemNameButton}
                          onPress={() => openCartItemEditor(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${item.product_name}`}
                        >
                          <Text style={styles.cartItemName} numberOfLines={2}>{item.product_name}</Text>
                        </TouchableOpacity>
                        <View style={styles.qtyStepper}>
                          <IconButton icon="minus" size={16} onPress={() => updateQuantity(item.id, -1)} style={styles.stepperButton} />
                          <Text style={styles.cartQuantity}>{item.quantity}</Text>
                          <IconButton icon="plus" size={16} onPress={() => updateQuantity(item.id, 1)} style={styles.stepperButton} />
                        </View>
                        <Text style={styles.cartItemPrice}>${item.subtotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.cartItemDetails}>
                        {item.addons?.map((addon) => (
                          <Text
                            key={`${item.id}-addon-${addon.addon_item_id}`}
                            style={styles.cartItemMeta}
                            numberOfLines={1}
                          >
                            + {addon.addon_item_name}
                            {addon.addon_item_price > 0 ? ` $${addon.addon_item_price.toFixed(2)}` : ''}
                          </Text>
                        ))}
                        {item.removed_ingredients?.map((ingredient) => (
                          <Text
                            key={`${item.id}-removed-${ingredient}`}
                            style={styles.cartItemRemoved}
                            numberOfLines={1}
                          >
                            No {ingredient}
                          </Text>
                        ))}
                        {item.comment && <Text style={styles.cartItemNote} numberOfLines={2}>{item.comment}</Text>}
                      </View>
                    </View>
                  </View>
                  {showCartActions && (
                    <View style={styles.cartControls}>
                      <Button
                        mode="outlined"
                        compact
                        icon="pencil"
                        onPress={() => openCartItemEditor(item)}
                        style={styles.cartActionButton}
                      >
                        Edit
                      </Button>
                      <Button
                        mode="outlined"
                        compact
                        icon={item.comment ? 'note-edit-outline' : 'note-plus-outline'}
                        onPress={() => openNoteEditor(item)}
                        style={styles.cartActionButton}
                      >
                        Note
                      </Button>
                      <Button
                        mode="outlined"
                        compact
                        icon="trash-can-outline"
                        textColor="#dc2626"
                        onPress={() => removeCartItem(item.id)}
                        style={styles.cartActionButton}
                      >
                        Remove
                      </Button>
                    </View>
                  )}
                </View>
              );
            }}
          />
          <Divider />
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total items</Text>
              <Text style={styles.totalValue}>{cartItems.length}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${totals.total.toFixed(2)}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            icon={orderId ? 'content-save' : 'cash-register'}
            disabled={cartItems.length === 0 || creatingOrder || smartpayProcessing}
            onPress={orderId ? () => void handleCheckout() : openCheckout}
            style={styles.checkoutButton}
            buttonColor="#16a34a"
          >
            {orderId ? 'Update Order' : 'Checkout'}
          </Button>
          {!orderId && (
            <View style={styles.quickActionsPanel}>
              <Text style={styles.quickActionsTitle}>Quick actions</Text>
              <View style={styles.quickPaymentRow}>
                <Button
                  mode="contained-tonal"
                  icon="check-circle-outline"
                  loading={creatingOrder}
                  disabled={creatingOrder || smartpayProcessing || cartItems.length === 0}
                  onPress={openInstorePaymentPrompt}
                  style={[styles.checkoutButton, styles.quickPaymentButton, styles.completeButton]}
                  buttonColor="#dc2626"
                  textColor="#fff"
                >
                  Complete
                </Button>
                <Button
                  mode="contained"
                  icon="credit-card-wireless-outline"
                  loading={smartpayProcessing}
                  disabled={!smartpayPaired || creatingOrder || smartpayProcessing || cartItems.length === 0}
                  onPress={() => void handleSmartpayInstoreCheckout()}
                  style={[styles.checkoutButton, styles.quickPaymentButton]}
                  buttonColor="#2563eb"
                >
                  SmartPay
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>

      <CashTenderModal
        visible={cashTenderMode !== null}
        total={totals.total}
        onCancel={() => {
          cashTenderConfirmedRef.current = false;
          setCashTenderMode(null);
        }}
        onConfirm={handleCashTenderConfirm}
      />

      <Portal>
        <Dialog
          visible={smartpayProcessing}
          dismissable
          onDismiss={confirmDismissSmartpayLock}
          style={styles.smartpayDialog}
        >
          <Dialog.Title>SmartPay payment</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Follow the prompts on the terminal. This screen will unlock when Smartpay returns the result.
            </Text>
            <Text style={styles.smartpayAmount}>${totals.total.toFixed(2)}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={confirmDismissSmartpayLock}>Hide</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={saltOptionDialogVisible}
          onDismiss={() => setSaltOptionDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Salt option</Dialog.Title>
          <Dialog.Content>
            <View style={styles.quickOrderNoteGrid}>
              {quickOrderNotes.map((note) => {
                const selected = quickOrderNote === note;
                return (
                  <TouchableOpacity
                    key={note}
                    style={[styles.quickOrderNoteChip, selected && styles.quickOrderNoteChipSelected]}
                    onPress={() => {
                      setQuickOrderNote(selected ? null : note);
                      setSaltOptionDialogVisible(false);
                    }}
                  >
                    <Text style={[styles.quickOrderNoteChipText, selected && styles.quickOrderNoteChipTextSelected]} numberOfLines={2}>
                      {note}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {quickOrderNote && (
              <Button onPress={() => {
                setQuickOrderNote(null);
                setSaltOptionDialogVisible(false);
              }}>
                Clear
              </Button>
            )}
            <Button onPress={() => setSaltOptionDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(noteItemId)} onDismiss={closeNoteEditor} style={styles.noteDialog}>
          <Dialog.Title>Item note</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Note"
              mode="outlined"
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              style={styles.noteInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeNoteEditor}>Cancel</Button>
            <Button onPress={saveNote}>Save</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={instorePaymentDialogVisible}
          onDismiss={() => setInstorePaymentDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Complete In-store Order</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Choose how this order should be recorded before it is created.
            </Text>
            <View style={styles.dialogActionStack}>
              <Button mode="contained" icon="cash" onPress={() => {
                setInstorePaymentDialogVisible(false);
                setCashTenderMode('instore');
              }}>
                Cash
              </Button>
              <Button mode="contained-tonal" icon="credit-card-outline" onPress={() => {
                setInstorePaymentDialogVisible(false);
                void handleInstoreCheckout('card');
              }}>
                Card
              </Button>
              <Button mode="outlined" icon="clock-outline" onPress={() => {
                setInstorePaymentDialogVisible(false);
                void handleInstoreCheckout('unpaid');
              }}>
                Unpaid
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInstorePaymentDialogVisible(false)}>Cancel</Button>
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
  bodyCompact: { flexDirection: 'column' },
  menuPane: { flex: 1, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
  menuPaneCompact: { minHeight: 520 },
  quickListButtonWrap: {
    position: 'absolute',
    left: 12,
    bottom: 12,
  },
  quickListButton: {
    borderRadius: 999,
    elevation: 3,
  },
  quickListButtonContent: {
    minHeight: 48,
    paddingHorizontal: 8,
  },
  quickListOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    paddingBottom: 72,
  },
  quickListPanel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  quickListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 2,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  quickListTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  quickListSubtitle: { color: '#6b7280', fontSize: 12, fontWeight: '700', marginTop: 2 },
  menuHeader: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuHeaderText: { flex: 1 },
  menuTitle: { color: '#111827', fontSize: 19, fontWeight: '800' },
  menuSubtitle: { color: '#6b7280', marginTop: 1 },
  backButton: { borderRadius: 8 },
  levelFooter: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  levelFooterActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  levelFooterButton: {
    borderRadius: 10,
    minWidth: 220,
    alignSelf: 'center',
  },
  levelFooterQuickListButton: {
    borderRadius: 10,
    minWidth: 180,
    alignSelf: 'center',
  },
  levelFooterButtonContent: {
    minHeight: 52,
    paddingHorizontal: 16,
  },
  levelFooterButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupScreen: { flex: 1 },
  tileGrid: { padding: 4, paddingBottom: 10 },
  searchBody: { flex: 1 },
  searchInput: { margin: 10, marginBottom: 0, backgroundColor: '#fff' },
  searchGrid: { padding: 4, paddingBottom: 10 },
  groupCard: {
    flex: 1,
    minHeight: 108,
    margin: 5,
    borderRadius: 8,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#243244',
  },
  groupCardText: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  topSellersSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  topSellersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  topSellersHeaderText: { flex: 1 },
  topSellersTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  topSellersLoading: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  topSellersList: { gap: 8, paddingRight: 8 },
  topSellerCard: {
    width: 118,
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 8,
    justifyContent: 'space-between',
  },
  topSellerQuantityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  topSellerName: { color: '#111827', fontSize: 13, fontWeight: '900', paddingRight: 22 },
  topSellerMeta: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  topSellersEmpty: { color: '#6b7280', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  productCard: {
    flex: 1,
    minHeight: 112,
    margin: 4,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 8,
    justifyContent: 'space-between',
  },
  productQuantityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  productQuantityText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  productNameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 6,
  },
  productName: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  productPricePill: {
    alignSelf: 'center',
    minWidth: 70,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  productPricePillCustom: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  productPrice: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  productCardCustomColor: { borderWidth: 1 },
  productCardCustomText: { color: '#fff' },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyTitle: { color: '#6b7280', fontSize: 16, fontWeight: '700' },
  editorBody: { flex: 1, padding: 10 },
  removableBlock: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 10,
  },
  addonList: { flex: 1, marginTop: 8 },
  emptyAddonText: { color: '#6b7280', textAlign: 'center', paddingVertical: 24 },
  addonGroup: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 10,
  },
  addonGroupLabel: {
    position: 'absolute',
    top: -9,
    left: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#1d4ed8',
  },
  removeGroupLabel: {
    backgroundColor: '#dc2626',
  },
  addonGroupTitle: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  removeGroupTitle: { color: '#fff' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  optionButtonSelected: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  removeButtonSelected: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
  optionText: { color: '#111827', fontSize: 13, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  optionTextSelected: { color: '#fff' },
  optionPrice: { color: '#6b7280', fontSize: 12, marginTop: 2, fontWeight: '800', textAlign: 'center' },
  groupRequirementText: { color: '#374151', fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 2 },
  editorActions: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  editorActionButton: { flex: 1, borderRadius: 8 },
  checkoutBody: { flex: 1 },
  checkoutContent: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  checkoutForm: { maxWidth: 520, width: '100%', gap: 10 },
  checkoutInput: { backgroundColor: '#fff' },
  checkoutNoteInput: { minHeight: 84 },
  checkoutSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 14,
    gap: 4,
  },
  checkoutSummaryEyebrow: { color: '#166534', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  checkoutSummaryTotal: { color: '#14532d', fontSize: 28, fontWeight: '900' },
  checkoutSummaryMeta: { color: '#166534', fontSize: 13, fontWeight: '700' },
  checkoutSectionTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  lookupRow: { minHeight: 22, justifyContent: 'center' },
  lookupText: { color: '#6b7280', fontSize: 13, fontWeight: '700' },
  foundText: { color: '#16a34a', fontSize: 13, fontWeight: '800' },
  newText: { color: '#dc2626', fontSize: 13, fontWeight: '800' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '800' },
  newCustomerBadge: {
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newCustomerBadgeText: { color: '#b91c1c', fontSize: 12, fontWeight: '900' },
  pickupPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: '#f9fafb',
  },
  pickupModeRow: { flexDirection: 'row', gap: 8 },
  pickupModeButton: { flex: 1, borderRadius: 8 },
  paymentPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: '#f9fafb',
  },
  paymentModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentModeButton: { flexGrow: 1, minWidth: 128, borderRadius: 8 },
  preOrderPanel: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    gap: 8,
  },
  preOrderBadge: {
    alignSelf: 'flex-start',
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  pickupTimeText: { color: '#111827', fontSize: 18, fontWeight: '900' },
  pickupPickerButtons: { flexDirection: 'row', gap: 8 },
  pickupPickerButton: { flex: 1, borderRadius: 8 },
  placeOrderButton: { borderRadius: 8, marginTop: 8 },
  secondaryActionsPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: '#fff',
  },
  secondaryActionsTitle: { color: '#111827', fontSize: 13, fontWeight: '900' },
  secondaryActionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryActionButton: { flexGrow: 1, borderRadius: 8 },
  cartPane: { width: 350, backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  cartPaneCompact: { width: '100%', minHeight: 320 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cartTitle: { color: '#111827', fontSize: 20, fontWeight: '800', flex: 1 },
  clearCartButton: { borderRadius: 8 },
  cartList: { flex: 1 },
  emptyCart: { color: '#6b7280', textAlign: 'center', marginTop: 30 },
  cartRow: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 8 },
  cartItemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cartItemText: { flex: 1 },
  cartItemTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartItemNameButton: { flex: 1 },
  cartItemName: { flex: 1, color: '#111827', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  cartItemPrice: { minWidth: 62, color: '#111827', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  cartItemDetails: { marginTop: 4 },
  cartItemMeta: { color: '#2563eb', fontSize: 13, marginTop: 2, fontWeight: '700' },
  cartItemRemoved: { color: '#dc2626', fontSize: 13, marginTop: 2, fontWeight: '800' },
  cartItemNote: { color: '#6b7280', fontSize: 14, marginTop: 3 },
  cartControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  stepperButton: { margin: -4 },
  cartQuantity: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '900' },
  cartActionButton: { borderRadius: 999 },
  totals: { paddingVertical: 12, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#6b7280', fontSize: 15 },
  totalValue: { color: '#111827', fontSize: 15, fontWeight: '700' },
  grandTotalLabel: { color: '#111827', fontSize: 20, fontWeight: '900' },
  grandTotalValue: { color: '#111827', fontSize: 22, fontWeight: '900' },
  quickOrderNoteButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickOrderNoteButtonSelected: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  quickOrderNoteButtonText: { flex: 1 },
  quickOrderNoteTitle: { color: '#6b7280', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  quickOrderNoteTitleSelected: { color: '#047857' },
  quickOrderNoteValue: { color: '#111827', fontSize: 14, lineHeight: 17, fontWeight: '900', marginTop: 1 },
  quickOrderNoteValueSelected: { color: '#064e3b' },
  quickOrderNoteEdit: { color: '#2563eb', fontSize: 12, fontWeight: '900' },
  quickOrderNoteEditSelected: { color: '#047857' },
  quickOrderNoteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickOrderNoteChip: {
    width: '48%',
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickOrderNoteChipSelected: {
    borderColor: '#047857',
    backgroundColor: '#047857',
  },
  quickOrderNoteChipText: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  quickOrderNoteChipTextSelected: { color: '#fff' },
  checkoutButton: { borderRadius: 8, marginTop: 10 },
  quickActionsPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  quickActionsTitle: { color: '#111827', fontSize: 13, fontWeight: '900', marginBottom: 6 },
  quickPaymentRow: { flexDirection: 'row', gap: 8 },
  quickPaymentButton: { flex: 1 },
  completeButton: { marginTop: 12 },
  smartpayDialog: { borderRadius: 8, backgroundColor: '#fff' },
  smartpayDialogText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  smartpayAmount: { marginTop: 12, color: '#111827', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  noteDialog: { backgroundColor: '#fff' },
  noteInput: { backgroundColor: '#fff', minHeight: 90 },
  dialogActionStack: { marginTop: 16, gap: 10 },
  addonSummaryBar: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addonSummaryText: { flex: 1, gap: 2 },
  addonSummaryTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  addonSummaryMeta: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  addonSummaryButton: { borderRadius: 8 },
  quickListGrid: { paddingTop: 8, paddingBottom: 8 },
  quickListCard: {
    flex: 1,
    minHeight: 112,
    margin: 4,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  quickListEmpty: { color: '#6b7280', fontSize: 15, lineHeight: 22 },
});
