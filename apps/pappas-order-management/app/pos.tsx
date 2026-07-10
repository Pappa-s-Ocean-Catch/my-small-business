import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Text, View, useWindowDimensions } from 'react-native';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Appbar } from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderItemAddon, PaymentStatus } from '@my-small-business/types';
import { savePosOrder, updatePosOrder } from '../lib/orders';
import { createCustomerIfNotExists, findCustomerByPhone } from '../lib/customers';
import {
  calculateDeliveryFees,
  createStripeCheckoutSession,
  type DeliveryAddressDraft,
  type DeliveryQuoteResult,
} from '../lib/delivery';
import {
  DEFAULT_POS_BUTTON_COLOR,
  DEFAULT_POS_QUICK_ORDER_NOTES,
  fetchPreferredPosLayout,
  PosLayoutData,
} from '../lib/pos-layouts';
import { formatKitchenSectionValue, getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';
import { PosCartPane } from '../components/pos/PosCartPane';
import { PosDialogs } from '../components/pos/PosDialogs';
import { PosMenuPane } from '../components/pos/PosMenuPane';
import { usePendingOnlinePaymentsStore } from '../stores/pendingOnlinePaymentsStore';
import { styles } from './pos.styles';
import type {
  AddonGroup,
  AddonItem,
  CacheEntry,
  CashTenderMode,
  CustomizationData,
  LayoutCategoryButton,
  PosCartItem,
  PosCheckoutPaymentOverride,
  PosInstorePaymentChoice,
  PosPaymentChoice,
  RemovableIngredient,
  SaleCategory,
  SaleProduct,
  TopSellerProduct,
} from './pos.types';

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

const formatDeliveryAddress = (address: DeliveryAddressDraft) => (
  [
    address.address_line1,
    address.address_line2,
    [address.city, address.state, address.postcode].filter(Boolean).join(' '),
  ]
    .filter((part) => Boolean(part && part.trim().length > 0))
    .join(', ')
);

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
  const upsertPendingOnlinePaymentSession = usePendingOnlinePaymentsStore((state) => state.upsertSession);

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

  const buildCheckoutLineItems = useCallback(() => (
    cartItems.map((item) => ({
      name: item.product_name,
      description: item.comment || undefined,
      quantity: item.quantity,
      price: Number((item.subtotal / Math.max(item.quantity, 1)).toFixed(2)),
    }))
  ), [cartItems]);

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

  const resetPosForNextOrder = useCallback(() => {
    setCartItems([]);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerLookupStatus('idle');
    setCustomerLookupError(null);
    setIsPreOrder(false);
    setScheduledPickupAt(defaultPickupTime());
    setPaymentChoice('no_pay');
    setQuickOrderNote(null);
    setOrderNoteText('');
    setSelectedProduct(null);
    setEditingItemId(null);
    setEditorAddonGroups([]);
    setEditorSelectedIds({});
    setEditorRemovableIngredients([]);
    setEditorRemovedIngredientIds({});
    setSearchQuery('');
    setMenuLevel('groups');
    setSelectedParentCatId(null);
    setSelectedCatId(null);
    setProducts([]);
    setCustomizableProductIds(new Set());
  }, []);

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
      delivery_partner_name: null,
      delivery_quote_expires_at: null,
      delivery_eta_minutes: null,
      delivery_provider_id: null,
      delivery_status: null,
      delivery_tracking_url: null,
      delivery_driver_name: null,
      delivery_driver_phone: null,
      delivery_driver_pin: null,
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
        delivery_partner_name: null,
        delivery_quote_expires_at: null,
        delivery_eta_minutes: null,
        delivery_provider_id: null,
        delivery_status: null,
        delivery_tracking_url: null,
        delivery_driver_name: null,
        delivery_driver_phone: null,
        delivery_driver_pin: null,
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
      delivery_partner_name: null,
      delivery_quote_expires_at: null,
      delivery_eta_minutes: null,
      delivery_provider_id: null,
      delivery_status: null,
      delivery_tracking_url: null,
      delivery_driver_name: null,
      delivery_driver_phone: null,
      delivery_driver_pin: null,
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

  const handleDeliveryCheckout = useCallback(async (
    input: { address: DeliveryAddressDraft; quote: DeliveryQuoteResult }
  ): Promise<void> => {
    if (orderId) {
      Alert.alert('Edit Order', 'Delivery checkout is only available for new POS orders right now.');
      return;
    }

    const phone = customerPhone.trim();
    const name = customerName.trim();
    if (!phone) {
      Alert.alert('Delivery', 'Please enter a customer phone number.');
      return;
    }
    if (!name) {
      Alert.alert('Delivery', 'Please enter a customer name.');
      return;
    }

    setCreatingOrder(true);

    try {
      const { data: customer, error: customerError } = await createCustomerIfNotExists(phone, name);
      if (customerError) {
        Alert.alert('Customer', customerError);
        return;
      }

      const feeSummary = await calculateDeliveryFees({
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: input.quote.fee,
      });

      const orderPayload = {
        user_id: customer?.id ?? null,
        customer_email: customer?.email || '',
        customer_phone: phone,
        customer_name: name,
        payment_method: 'online',
        order_channel: 'phone_delivery',
        payment_method_detail: null,
        order_type: 'delivery',
        payment_status: 'pending',
        order_status: 'pending_online_payment',
        subtotal: totals.subtotal,
        tax: totals.tax,
        delivery_fee: input.quote.fee,
        service_fee: feeSummary.serviceFee,
        promotion_discount: 0,
        promotions_applied: [],
        coupon_code: null,
        coupon_discount: 0,
        total: feeSummary.totalAmount,
        reward_points_used: null,
        reward_points_value: null,
        order_options: orderOptions,
        special_instructions: orderSpecialInstructions,
        delivery_address_id: null,
        delivery_address_line1: input.address.address_line1,
        delivery_address_line2: input.address.address_line2 || null,
        delivery_city: input.address.city,
        delivery_state: input.address.state,
        delivery_postcode: input.address.postcode,
        delivery_country: input.address.country || 'AU',
        delivery_latitude: input.address.latitude ?? null,
        delivery_longitude: input.address.longitude ?? null,
        delivery_quote_id: input.quote.quote_id,
        delivery_quote_amount: input.quote.fee,
        delivery_quote_currency: input.quote.currency,
        delivery_partner_name: input.quote.provider_name,
        delivery_quote_expires_at: input.quote.expires_at,
        delivery_eta_minutes: input.quote.estimated_duration_minutes,
        delivery_provider_id: null,
        delivery_status: 'pending',
        delivery_tracking_url: null,
        delivery_driver_name: null,
        delivery_driver_phone: null,
        delivery_driver_pin: null,
        delivery_vehicle_info: null,
        delivery_instructions: input.address.delivery_instructions || null,
        scheduled_pickup_at: null,
      } as any;

      const saveResult = await savePosOrder(orderPayload, cartItems);
      if (saveResult.error || !saveResult.data) {
        Alert.alert('Delivery', saveResult.error || 'Failed to create delivery order');
        return;
      }

      const checkoutSession = await createStripeCheckoutSession({
        orderId: saveResult.data.id,
        customerEmail: customer?.email || undefined,
        customerName: name,
        customerPhone: phone,
        items: buildCheckoutLineItems(),
        subtotal: totals.subtotal,
        tax: totals.tax,
        deliveryFee: input.quote.fee,
        orderType: 'delivery',
      });

      const finalTotalAmount = Number((feeSummary.orderBaseAmount + input.quote.fee + checkoutSession.serviceFee).toFixed(2));

      if (
        checkoutSession.serviceFee !== feeSummary.serviceFee
        || finalTotalAmount !== feeSummary.totalAmount
      ) {
        const { error: syncOrderFeeError } = await supabase
          .from('orders')
          .update({
            service_fee: checkoutSession.serviceFee,
            total: finalTotalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', saveResult.data.id);

        if (syncOrderFeeError) {
          console.warn('Failed to sync Stripe-calculated delivery fee back to POS order', syncOrderFeeError);
        }
      }

      invalidateTopSellers();
      upsertPendingOnlinePaymentSession({
        orderId: saveResult.data.id,
        orderNumber: saveResult.data.order_number,
        customerName: name,
        customerPhone: phone,
        paymentUrl: checkoutSession.url,
        deliveryAddress: formatDeliveryAddress(input.address),
        deliveryEtaMinutes: input.quote.estimated_duration_minutes,
        serviceFee: checkoutSession.serviceFee,
        deliveryFee: input.quote.fee,
        totalAmount: finalTotalAmount,
        isTestPayment: Boolean(checkoutSession.isTestPhoneCheckout),
        itemSummaries: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          productName: item.product_name,
          subtotal: item.subtotal,
          comment: item.comment,
          removedIngredients: item.removed_ingredients || [],
          addons: (item.addons || []).map((addon) => ({
            id: addon.id,
            name: addon.addon_item_name,
            price: Number(addon.addon_item_price || 0),
          })),
        })),
      });
      resetPosForNextOrder();
    } catch (error) {
      console.error('Delivery checkout failed', error);
      Alert.alert('Delivery', error instanceof Error ? error.message : 'Failed to request online delivery');
    } finally {
      setCreatingOrder(false);
    }
  }, [
    orderId,
    customerPhone,
    customerName,
    totals.subtotal,
    totals.tax,
    orderOptions,
    orderSpecialInstructions,
    cartItems,
    buildCheckoutLineItems,
    resetPosForNextOrder,
    upsertPendingOnlinePaymentSession,
  ]);

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

  const handleChooseInstorePayment = (choice: PosInstorePaymentChoice) => {
    setInstorePaymentDialogVisible(false);

    if (choice === 'cash') {
      setCashTenderMode('instore');
      return;
    }

    void handleInstoreCheckout(choice);
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
    : 'Create Pickup Order • Unpaid';
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
          <PosMenuPane
            menuLevel={menuLevel}
            gridColumns={gridColumns}
            quickListColumns={quickListColumns}
            addonOptionWidth={addonOptionWidth}
            layoutTopLevelCategories={layoutTopLevelCategories}
            topSellers={topSellers}
            loadingTopSellers={loadingTopSellers}
            quickQuantityForProduct={quickQuantityForProduct}
            openCategory={openCategory}
            quickAddProduct={quickAddProduct}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            loadingSearchProducts={loadingSearchProducts}
            backToGroups={backToGroups}
            activeParentCategoryName={activeParentCategoryName}
            childCategoriesForSelectedGroup={childCategoriesForSelectedGroup}
            activeLayoutCategory={activeLayoutCategory ? {
              color: activeLayoutCategory.color,
              title: activeLayoutCategory.title,
              showProductsOnTopLevel: activeLayoutCategory.showProductsOnTopLevel,
            } : null}
            openSubcategory={openSubcategory}
            activeCategoryName={activeCategoryName}
            layoutProducts={layoutProducts}
            loadingProducts={loadingProducts}
            itemsBackAction={itemsBackAction}
            itemsBackLabel={itemsBackLabel}
            selectedParentCatId={selectedParentCatId}
            setQuickListVisible={setQuickListVisible}
            quickAccessProducts={quickAccessProducts}
            productButtonColor={productButtonColor}
            productTilePalette={productTilePalette}
            selectedProduct={selectedProduct}
            backToItems={backToItems}
            editorRemovableIngredients={editorRemovableIngredients}
            editorRemovedIngredientIds={editorRemovedIngredientIds}
            toggleRemovedIngredient={toggleRemovedIngredient}
            editorAddonGroups={editorAddonGroups}
            loadingAddons={loadingAddons}
            editorSelectedIds={editorSelectedIds}
            toggleAddon={toggleAddon}
            addonGroupPalette={addonGroupPalette}
            addonSelectionCount={addonSelectionCount}
            addonSelectionTotal={addonSelectionTotal}
            openCheckout={openCheckout}
            customerLookupStatus={customerLookupStatus}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerLookupError={customerLookupError}
            totals={totals}
            cartItemsCount={cartItems.length}
            isPreOrder={isPreOrder}
            setIsPreOrder={setIsPreOrder}
            scheduledPickupAt={scheduledPickupAt}
            setScheduledPickupAt={setScheduledPickupAt}
            defaultPickupTime={defaultPickupTime}
            formatPickupTime={formatPickupTime}
            openPickupPicker={openPickupPicker}
            showPickupPicker={showPickupPicker}
            pickupPickerMode={pickupPickerMode}
            handlePickupPickerChange={handlePickupPickerChange}
            orderNoteText={orderNoteText}
            setOrderNoteText={setOrderNoteText}
            creatingOrder={creatingOrder}
            smartpayProcessing={smartpayProcessing}
            orderId={orderId}
            checkoutPrimaryLabel={checkoutPrimaryLabel}
            handleCheckout={handleCheckout}
            smartpayPaired={smartpayPaired}
            handleInstoreCheckout={handleInstoreCheckout}
            handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
            handleDeliveryCheckout={handleDeliveryCheckout}
            quickListVisible={quickListVisible}
          />
        </View>

        <PosCartPane
          isCompactLayout={isCompactLayout}
          orderId={orderId}
          cartItems={cartItems}
          quickOrderNote={quickOrderNote}
          setSaltOptionDialogVisible={setSaltOptionDialogVisible}
          activeCartItemId={activeCartItemId}
          openCartItemEditor={openCartItemEditor}
          updateQuantity={updateQuantity}
          openNoteEditor={openNoteEditor}
          removeCartItem={removeCartItem}
          totals={totals}
          creatingOrder={creatingOrder}
          smartpayProcessing={smartpayProcessing}
          handleClearCart={handleClearCart}
          openCheckout={openCheckout}
          handleCheckout={() => handleCheckout()}
          smartpayPaired={smartpayPaired}
          handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
        />
      </View>

      <PosDialogs
        cashTenderMode={cashTenderMode}
        total={totals.total}
        onCancelCashTender={() => {
          cashTenderConfirmedRef.current = false;
          setCashTenderMode(null);
        }}
        onConfirmCashTender={handleCashTenderConfirm}
        smartpayProcessing={smartpayProcessing}
        confirmDismissSmartpayLock={confirmDismissSmartpayLock}
        saltOptionDialogVisible={saltOptionDialogVisible}
        setSaltOptionDialogVisible={setSaltOptionDialogVisible}
        quickOrderNotes={quickOrderNotes}
        quickOrderNote={quickOrderNote}
        setQuickOrderNote={setQuickOrderNote}
        noteItemId={noteItemId}
        closeNoteEditor={closeNoteEditor}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        saveNote={saveNote}
        instorePaymentDialogVisible={instorePaymentDialogVisible}
        setInstorePaymentDialogVisible={setInstorePaymentDialogVisible}
        onChooseInstorePayment={handleChooseInstorePayment}
      />

    </View>
  );
}
