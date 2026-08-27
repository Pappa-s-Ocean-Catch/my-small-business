import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Appbar } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderItemAddon, PaymentStatus } from '@my-small-business/types';
import { savePosOrder, updatePaymentStatus, updatePosOrder } from '../lib/orders';
import { createCustomerIfNotExists, findCustomerByPhone, type Customer } from '../lib/customers';
import { recordCouponRedemption, type Coupon } from '../lib/coupons';
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
import { formatKitchenSectionValue, getOrderNotes, getOrderOptions, isScheduledPreOrder } from '../utils/orderUtils';
import { formatSmartpayError, isSmartpayPaired, processSmartpayCardPayment } from '../lib/smartpay';
import { applyRewardPointsToOrder, fetchRewardPointsSettings, type RewardPointsSettings } from '../lib/reward-points';
import {
  computePosFreeItemPromotion,
  getFreeItemDisplayName,
  isPromotionActiveNow,
  type PosPromotion,
} from '../lib/pos-promotions';
import {
  buildMarketplacePosOrderDraft,
  type MarketplaceImportMetadata,
} from '../lib/marketplace-pos-order';
import { PosCartPane } from '../components/pos/PosCartPane';
import { PosDialogs } from '../components/pos/PosDialogs';
import { PosMenuPane } from '../components/pos/PosMenuPane';
import type { PosCheckoutTab } from '../components/pos/PosCheckoutPanel';
import { usePendingOnlinePaymentsStore } from '../stores/pendingOnlinePaymentsStore';
import { useMarketplacePosDraftStore } from '../stores/marketplacePosDraftStore';
import { styles } from '../components/pos/pos.styles';
import { isCompactPhoneWidth } from '../lib/responsive';
import { LIVE_ORDERS_QUERY_KEY } from '../hooks/useLiveOrdersQuery';
import { posCatalogCacheStore } from '../stores/posCatalogCacheStore';
import { useInstoreCustomerReceiptPrint } from '../providers/instoreCustomerReceiptPrintContext';
import {
  createOrReusePendingInstoreOrder,
  getPendingInstoreOrderLockMessage,
  getPendingInstorePaymentPlan,
  getPendingInstoreRewardPoints,
  getSmartpayDisplayOrderNumber,
  settlePendingInstorePayment,
} from '../lib/instore-smartpay-checkout';
import type {
  AddonGroup,
  AddonItem,
  CashTenderMode,
  CustomizationData,
  LayoutCategoryButton,
  PosCartItem,
  PosCheckoutPaymentOverride,
  PosInstorePaymentChoice,
  PosPaymentChoice,
  PosThirdPartySource,
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

const formatOrderTime = (date: Date) => date.toLocaleString([], {
  year: 'numeric',
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

type PosDiscountConfig =
  | { kind: 'none' }
  | { kind: 'percent'; percent: number }
  | { kind: 'fixed'; amount: number }
  | { kind: 'coupon'; code: string; couponId: string; amount: number; title?: string };

const EMPTY_DISCOUNT: PosDiscountConfig = { kind: 'none' };
const DEFAULT_REWARD_POINTS_SETTINGS: RewardPointsSettings = {
  points_per_dollar: 10,
  dollars_per_point: 0.001,
  enabled: true,
};

const normalizeMoney = (value: number) => Number(value.toFixed(2));

const clampDiscountAmount = (amount: number, subtotal: number) => (
  normalizeMoney(Math.max(0, Math.min(subtotal, amount)))
);

const getDiscountAmount = (discount: PosDiscountConfig, subtotal: number) => {
  if (subtotal <= 0) return 0;
  if (discount.kind === 'percent') {
    return clampDiscountAmount(subtotal * (Math.max(0, discount.percent) / 100), subtotal);
  }
  if (discount.kind === 'fixed' || discount.kind === 'coupon') {
    return clampDiscountAmount(discount.amount, subtotal);
  }
  return 0;
};

const getDiscountLabel = (discount: PosDiscountConfig) => {
  if (discount.kind === 'percent') return `${discount.percent}% off`;
  if (discount.kind === 'fixed') return `$${discount.amount.toFixed(2)} off`;
  if (discount.kind === 'coupon') return `Coupon ${discount.code}`;
  return 'No discount';
};

const getDiscountPromotionsApplied = (discount: PosDiscountConfig, amount: number) => {
  if (discount.kind === 'none' || amount <= 0) return [];
  if (discount.kind === 'percent') {
    return [{
      source: 'pos',
      kind: 'percent',
      percent: discount.percent,
      amount,
      label: `${discount.percent}% off`,
    }];
  }
  if (discount.kind === 'coupon') {
    return [{
      source: 'coupon',
      kind: 'coupon',
      code: discount.code,
      coupon_id: discount.couponId,
      amount,
      label: `Coupon ${discount.code}`,
    }];
  }

  return [{
    source: 'pos',
    kind: 'fixed',
    value: discount.amount,
    amount,
    label: `$${discount.amount.toFixed(2)} off`,
  }];
};

const getDiscountConfigFromOrder = (order: Order | null): PosDiscountConfig => {
  if (!order) return EMPTY_DISCOUNT;
  if (order.coupon_code) {
    return {
      kind: 'coupon',
      code: order.coupon_code,
      couponId: '',
      amount: Number(order.coupon_discount ?? 0),
    };
  }
  const promotions = Array.isArray(order.promotions_applied) ? order.promotions_applied : [];
  const firstPromotion = promotions[0] as Record<string, unknown> | undefined;

  if (firstPromotion?.kind === 'percent') {
    const percent = Number(firstPromotion.percent ?? 0);
    if (percent > 0) return { kind: 'percent', percent };
  }

  if (firstPromotion?.kind === 'fixed') {
    const value = Number(firstPromotion.value ?? firstPromotion.amount ?? 0);
    if (value > 0) return { kind: 'fixed', amount: value };
  }

  if ((order.promotion_discount ?? 0) > 0) {
    return { kind: 'fixed', amount: Number(order.promotion_discount) };
  }

  return EMPTY_DISCOUNT;
};

export default function PosScreen() {
  const { printInstoreCustomerReceipt, printInstoreInstantTicket } = useInstoreCustomerReceiptPrint();
  const queryClient = useQueryClient();
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
  const [menuLevel, setMenuLevel] = useState<'groups' | 'subgroups' | 'items' | 'addons' | 'checkout' | 'search' | 'quick-list'>('groups');
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'idle' | 'loading' | 'found' | 'new' | 'error'>('idle');
  const [customerLookupError, setCustomerLookupError] = useState<string | null>(null);
  const [rewardPointsSettings, setRewardPointsSettings] = useState<RewardPointsSettings>(DEFAULT_REWARD_POINTS_SETTINGS);
  const [rewardPointsToUse, setRewardPointsToUse] = useState(0);
  const [rewardPointsValue, setRewardPointsValue] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [smartpayPreparing, setSmartpayPreparing] = useState(false);
  const [smartpayProcessing, setSmartpayProcessing] = useState(false);
  const [smartpayDialogMinimized, setSmartpayDialogMinimized] = useState(false);
  const [pendingInstoreSmartpayOrder, setPendingInstoreSmartpayOrder] = useState<Order | null>(null);
  const [smartpayApprovedOrderId, setSmartpayApprovedOrderId] = useState<string | null>(null);
  const [smartpayPaired, setSmartpayPaired] = useState(false);
  const [cashTenderMode, setCashTenderMode] = useState<CashTenderMode | null>(null);
  const cashTenderConfirmedRef = useRef(false);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [scheduledPickupAt, setScheduledPickupAt] = useState<Date>(defaultPickupTime);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [pickupPickerMode, setPickupPickerMode] = useState<'date' | 'time'>('date');
  const [thirdPartySource, setThirdPartySource] = useState<PosThirdPartySource>('Uber Eats');
  const [thirdPartyCustomerName, setThirdPartyCustomerName] = useState('');
  const [thirdPartyExternalOrderId, setThirdPartyExternalOrderId] = useState('');
  const [thirdPartyOrderAt, setThirdPartyOrderAt] = useState<Date>(new Date());
  const [marketplaceImportMetadata, setMarketplaceImportMetadata] = useState<MarketplaceImportMetadata | null>(null);
  const [showThirdPartyOrderAtPicker, setShowThirdPartyOrderAtPicker] = useState(false);
  const [thirdPartyOrderAtPickerMode, setThirdPartyOrderAtPickerMode] = useState<'date' | 'time'>('date');
  const [initialCheckoutTab, setInitialCheckoutTab] = useState<PosCheckoutTab>('pickup');
  const [paymentChoice, setPaymentChoice] = useState<PosPaymentChoice>('no_pay');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [posLayout, setPosLayout] = useState<PosLayoutData | null>(null);
  const [quickOrderNote, setQuickOrderNote] = useState<string | null>(null);
  const [saltOptionDialogVisible, setSaltOptionDialogVisible] = useState(false);
  const [discountDialogVisible, setDiscountDialogVisible] = useState(false);
  const [orderNoteText, setOrderNoteText] = useState('');
  const [discountConfig, setDiscountConfig] = useState<PosDiscountConfig>(EMPTY_DISCOUNT);
  const [quickListReturnLevel, setQuickListReturnLevel] = useState<'groups' | 'subgroups' | 'items' | 'addons' | 'checkout' | 'search'>('groups');
  const [activePromotions, setActivePromotions] = useState<PosPromotion[]>([]);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [selectedFreeItemId, setSelectedFreeItemId] = useState<string | null>(null);
  const [freeItemDialogVisible, setFreeItemDialogVisible] = useState(false);
  const [eligibleFreeItemProducts, setEligibleFreeItemProducts] = useState<SaleProduct[]>([]);
  const upsertPendingOnlinePaymentSession = usePendingOnlinePaymentsStore((state) => state.upsertSession);
  const marketplaceDraft = useMarketplacePosDraftStore((state) => state.draft);
  const clearMarketplaceDraft = useMarketplacePosDraftStore((state) => state.clearDraft);
  const [phoneViewTab, setPhoneViewTab] = useState<'menu' | 'cart'>('menu');

  const goHome = () => {

    router.replace('/(drawer)/(tabs)/live-orders');
  };

  const preventPendingCartEdit = useCallback(() => {
    const lockMessage = getPendingInstoreOrderLockMessage(pendingInstoreSmartpayOrder);
    if (!lockMessage) return false;
    Alert.alert(
      'Order already saved',
      lockMessage,
    );
    return true;
  }, [pendingInstoreSmartpayOrder]);

  const preventPendingIndependentCheckout = useCallback(() => {
    const lockMessage = getPendingInstoreOrderLockMessage(pendingInstoreSmartpayOrder);
    if (!lockMessage) return false;
    Alert.alert('Settle pending order', lockMessage);
    return true;
  }, [pendingInstoreSmartpayOrder]);

  const setQuickListVisible = (visible: boolean) => {
    if (visible) {
      if (menuLevel !== 'quick-list') setQuickListReturnLevel(menuLevel);
      setMenuLevel('quick-list');
      return;
    }
    setMenuLevel(quickListReturnLevel);
  };

  const openLayoutSettings = () => {
    router.push('/pos-layout-settings');
  };



  useEffect(() => {
    void fetchRewardPointsSettings().then(setRewardPointsSettings);
  }, []);

  useEffect(() => {
    const loadPromotions = async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*, promotion_products(sale_product_id)')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.warn('POS promotions load failed', error);
        setPromotionsLoaded(true);
        return;
      }

      const nextPromotions: PosPromotion[] = (data || [])
        .map((row: any) => ({
          ...row,
          discount_value: Number(row.discount_value ?? 0),
          min_product_price: row.min_product_price != null ? Number(row.min_product_price) : null,
          min_cart_subtotal: row.min_cart_subtotal != null ? Number(row.min_cart_subtotal) : null,
          priority: Number(row.priority ?? 0),
          product_ids: (row.promotion_products || []).map((pp: any) => String(pp.sale_product_id)),
        }))
        .filter((promotion: PosPromotion) => isPromotionActiveNow(promotion));

      setActivePromotions(nextPromotions);
      setPromotionsLoaded(true);
    };

    void loadPromotions();
  }, []);

  useEffect(() => {
    posCatalogCacheStore.getState().pruneExpired();
    const sweepTimer = setInterval(() => posCatalogCacheStore.getState().pruneExpired(), POS_CACHE_SWEEP_INTERVAL_MS);
    return () => clearInterval(sweepTimer);
  }, []);

  useEffect(() => {
    if (cartItems.length === 0) {
      setMarketplaceImportMetadata(null);
    }
  }, [cartItems.length]);

  useEffect(() => {
    const fetchCategories = async () => {
      const cachedCategories = posCatalogCacheStore.getState().getCategories();
      if (cachedCategories) {
        setCategories(cachedCategories);
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
      posCatalogCacheStore.getState().setCategories(nextCategories);
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
    posCatalogCacheStore.getState().clearTopSellers();
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
    const cachedTopSellers = posCatalogCacheStore.getState().getTopSellers();
    if (cachedTopSellers) {
      setTopSellers(cachedTopSellers);
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
      posCatalogCacheStore.getState().setTopSellers([]);
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

    posCatalogCacheStore.getState().setTopSellers(nextTopSellers);
    setTopSellers(nextTopSellers);
    setLoadingTopSellers(false);
    void loadCustomizationAvailability(nextTopSellers.map((product) => product.id));
  };

  useEffect(() => {
    if (menuLevel === 'groups') {
      void loadTopSellersToday();
    }
  }, [menuLevel, topSellerRefreshKey]);

  const loadSearchProducts = useCallback(async () => {
    const cachedProducts = posCatalogCacheStore.getState().getAllProducts();
    if (cachedProducts) {
      setSearchProducts(cachedProducts);
      void loadCustomizationAvailability(cachedProducts.map((product) => product.id));
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
    posCatalogCacheStore.getState().setAllProducts(nextProducts);
    setSearchProducts(nextProducts);
    void loadCustomizationAvailability(nextProducts.map((product) => product.id));
  }, []);

  useEffect(() => {
    if (menuLevel === 'search') {
      void loadSearchProducts();
    }
  }, [loadSearchProducts, menuLevel]);

  useEffect(() => {
    if (!posLayout) return;
    void loadSearchProducts();
  }, [loadSearchProducts, posLayout]);

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
      : posCatalogCacheStore.getState().getAllProducts() ?? [];
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
      const cachedProducts = posCatalogCacheStore.getState().getProductsByCategory(cacheKey);

      if (cachedProducts) {
        setProducts(cachedProducts);
        void loadCustomizationAvailability(cachedProducts.map((product) => product.id));
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
      posCatalogCacheStore.getState().setProductsByCategory(cacheKey, nextProducts);
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
        override_price: item.override_price == null ? null : Number(item.override_price),
        quantity: Number(item.quantity || 1),
        subtotal: Number(item.subtotal || 0),
        removed_ingredients: item.removed_ingredients || [],
        addons: item.order_item_addons || [],
      }));
      setEditingOrder(order as Order);
      setCartItems(items);
      setCustomerPhone(order.customer_phone || '');
      setCustomerName(order.customer_name || '');
      setRewardPointsToUse(Number(order.reward_points_used ?? 0));
      setRewardPointsValue(Number(order.reward_points_value ?? 0));
      setQuickOrderNote(getOrderOptions(order)[0] || null);
      setOrderNoteText(getOrderNotes(order) || '');
      setDiscountConfig(getDiscountConfigFromOrder(order as Order));
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
      setIsPreOrder(isScheduledPreOrder(order, Date.now(), 0));
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
    if (orderId || !marketplaceDraft) return;

    let cancelled = false;

    const importMarketplaceDraft = async () => {
      try {
        const draft = await buildMarketplacePosOrderDraft(marketplaceDraft.orderDetail);
        if (cancelled) return;

        if (draft.cartItems.length === 0) {
          Alert.alert('Marketplace', `None of the ${draft.metadata.source} items matched the POS catalog.`);
          clearMarketplaceDraft();
          return;
        }

        setCartItems(draft.cartItems);
        setCustomerPhone('');
        setCustomerName(draft.customerName);
        setSelectedCustomer(null);
        setCustomerLookupStatus('idle');
        setCustomerLookupError(null);
        setRewardPointsToUse(0);
        setRewardPointsValue(0);
        setQuickOrderNote(null);
        setDiscountConfig(
          draft.discountAmount > 0
            ? { kind: 'fixed', amount: draft.discountAmount }
            : EMPTY_DISCOUNT
        );
        setThirdPartySource(draft.metadata.source);
        setThirdPartyCustomerName(draft.customerName);
        setThirdPartyExternalOrderId(draft.metadata.externalOrderNumber);
        setThirdPartyOrderAt(draft.requestedAt);
        setMarketplaceImportMetadata(draft.metadata);
        setInitialCheckoutTab('third_party');
        setMenuLevel('checkout');
        setOrderNoteText([
          draft.unmatchedProducts.length > 0
            ? `Unmatched items: ${draft.unmatchedProducts.join(', ')}`
            : '',
          draft.unmatchedOptions.length > 0
            ? `Check modifiers: ${draft.unmatchedOptions.join(', ')}`
            : '',
        ].filter(Boolean).join('\n'));
        clearMarketplaceDraft();

        if (draft.unmatchedProducts.length > 0 || draft.unmatchedOptions.length > 0) {
          Alert.alert(
            'Review imported order',
            [
              draft.unmatchedProducts.length > 0
                ? `Items not added: ${draft.unmatchedProducts.join(', ')}`
                : '',
              draft.unmatchedOptions.length > 0
                ? `Modifiers to review: ${draft.unmatchedOptions.join(', ')}`
                : '',
            ].filter(Boolean).join('\n')
          );
        }
      } catch (error) {
        if (cancelled) return;
        Alert.alert(
          'Marketplace',
          error instanceof Error ? error.message : 'Could not build this marketplace order.'
        );
        clearMarketplaceDraft();
      }
    };

    void importMarketplaceDraft();

    return () => {
      cancelled = true;
    };
  }, [
    clearMarketplaceDraft,
    marketplaceDraft,
    orderId,
  ]);

  useEffect(() => {
    const phone = customerPhone.trim();
    if (!phone) {
      setSelectedCustomer(null);
      setCustomerLookupStatus('idle');
      setCustomerLookupError(null);
      return;
    }

    if (phone.length < 6) {
      setSelectedCustomer(null);
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
          setSelectedCustomer(null);
          setCustomerLookupStatus('error');
          setCustomerLookupError(result.error);
          return;
        }

        if (result.data) {
          setSelectedCustomer(result.data);
          setCustomerLookupStatus('found');
          setCustomerName(result.data.name || '');
          return;
        }

        setSelectedCustomer(null);
        setCustomerLookupStatus('new');
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerPhone]);

  const handleCustomerPhoneChange = useCallback((value: string) => {
    setCustomerPhone(value);
    setSelectedCustomer(null);
    setRewardPointsToUse(0);
    setRewardPointsValue(0);
    if (customerLookupStatus === 'found') {
      setCustomerName('');
    }
  }, [customerLookupStatus]);

  const handleCustomerNameChange = useCallback((value: string) => {
    setCustomerName(value);
  }, []);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerPhone(customer.phone ?? '');
    setCustomerName(customer.name ?? '');
    setRewardPointsToUse(0);
    setRewardPointsValue(0);
    setCustomerLookupError(null);
    setCustomerLookupStatus('found');
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerPhone('');
    setCustomerName('');
    setRewardPointsToUse(0);
    setRewardPointsValue(0);
    setCustomerLookupError(null);
    setCustomerLookupStatus('idle');
  }, []);

  const handleResetToDefaultInstore = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerPhone('');
    setCustomerName('INSTORE');
    setRewardPointsToUse(0);
    setRewardPointsValue(0);
    setCustomerLookupError(null);
    setCustomerLookupStatus('idle');
  }, []);

  useEffect(() => {
    if (menuLevel !== 'checkout' && initialCheckoutTab !== 'pickup') {
      setInitialCheckoutTab('pickup');
    }
  }, [initialCheckoutTab, menuLevel]);

  const applyRewardPointsForSavedOrder = useCallback(async (

    orderIdToApply: string,
    customerUserId?: string | null,
    pointsToApply = rewardPointsToUse,
  ) => {
    if (!orderIdToApply || !customerUserId || pointsToApply <= 0) return;

    const result = await applyRewardPointsToOrder({
      userId: customerUserId,
      orderId: orderIdToApply,
      pointsToUse: pointsToApply,
    });

    if (!result.success) {
      console.warn('Failed to apply reward points to POS order', result.error);
      Alert.alert('Reward points', result.error || 'Failed to apply reward points. The order was still created.');
    }
  }, [rewardPointsToUse]);

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

  const discountAmount = useMemo(
    () => getDiscountAmount(discountConfig, cartItems.reduce((sum, item) => sum + item.subtotal, 0)),
    [cartItems, discountConfig]
  );
  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.subtotal, 0),
    [cartItems]
  );
  const isMarketplaceManualImport = marketplaceImportMetadata !== null;
  const freeItemPromoTotals = useMemo(
    () => computePosFreeItemPromotion({
      promotions: isMarketplaceManualImport ? [] : activePromotions,
      items: cartItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        base_price: Number(item.base_price || 0),
        quantity: item.quantity,
        subtotal: Number(item.subtotal || 0),
      })),
      cartSubtotal,
      selectedFreeItemId,
    }),
    [activePromotions, cartItems, cartSubtotal, isMarketplaceManualImport, selectedFreeItemId]
  );
  const freeItemPromotion = freeItemPromoTotals.freeItemPromotion;
  const unlockedFreeItemPromotion = freeItemPromoTotals.unlockedFreeItemPromotion;
  const freeItemSelectionRequired = freeItemPromoTotals.freeItemSelectionRequired;
  const freeItemDiscountAmount = freeItemPromoTotals.discountAmount;
  const freeItemAppliedPromotion = freeItemPromoTotals.appliedPromotion;
  const freeItemPromotionTitle = unlockedFreeItemPromotion?.title ?? freeItemPromotion?.promotion.title ?? null;
  const selectedFreeItemName = freeItemPromotion ? getFreeItemDisplayName(freeItemPromotion.promotion, freeItemPromotion.item.product_name) : null;

  const discountLabel = useMemo(
    () => getDiscountLabel(discountConfig),
    [discountConfig]
  );
  const activeDiscountPercent = discountConfig.kind === 'percent'
    ? discountConfig.percent
    : null;
  const rewardPointsBalance = Number(selectedCustomer?.rewardPoints ?? 0);
  const rewardPointsDollarValue = Number((rewardPointsBalance * rewardPointsSettings.dollars_per_point).toFixed(2));

  const maxRewardPointsForOrder = useMemo(() => {
    const currentBalance = Number(selectedCustomer?.rewardPoints ?? 0);
    const dollarsPerPoint = rewardPointsSettings.dollars_per_point;
    if (!rewardPointsSettings.enabled || !selectedCustomer || currentBalance <= 0 || dollarsPerPoint <= 0) return 0;

    const eligibleOrderAmount = Math.max(
      0,
      cartSubtotal
      + (editingOrder?.tax ?? 0)
      + (editingOrder?.delivery_fee ?? 0)
      + (editingOrder?.service_fee ?? 0)
      - discountAmount
      - freeItemDiscountAmount
      - (editingOrder?.coupon_discount ?? 0)
    );

    return Math.min(currentBalance, Math.floor(eligibleOrderAmount / dollarsPerPoint));
  }, [cartSubtotal, discountAmount, editingOrder, freeItemDiscountAmount, rewardPointsSettings, selectedCustomer]);

  const handleToggleRewardPoints = useCallback(() => {
    if (preventPendingCartEdit()) return;
    if (!rewardPointsSettings.enabled || !selectedCustomer) return;
    if (rewardPointsToUse > 0) {
      setRewardPointsToUse(0);
      setRewardPointsValue(0);
      return;
    }

    const nextPoints = maxRewardPointsForOrder;
    setRewardPointsToUse(nextPoints);
    setRewardPointsValue(Number((nextPoints * rewardPointsSettings.dollars_per_point).toFixed(2)));
  }, [maxRewardPointsForOrder, preventPendingCartEdit, rewardPointsSettings, rewardPointsToUse, selectedCustomer]);


  useEffect(() => {
    if (!rewardPointsSettings.enabled || maxRewardPointsForOrder <= 0) {
      setRewardPointsToUse(0);
      setRewardPointsValue(0);
      return;
    }

    setRewardPointsToUse((current) => {
      const next = Math.min(current, maxRewardPointsForOrder);
      setRewardPointsValue(Number((next * rewardPointsSettings.dollars_per_point).toFixed(2)));
      return next;
    });
  }, [maxRewardPointsForOrder, rewardPointsSettings]);

  const promotionsApplied = useMemo(
    () => {
      const manualPromotions = getDiscountPromotionsApplied(discountConfig, discountAmount);
      return freeItemAppliedPromotion ? [...manualPromotions, freeItemAppliedPromotion] : manualPromotions;
    },
    [discountAmount, discountConfig, freeItemAppliedPromotion]
  );

  const totals = useMemo(() => {
    const subtotal = cartSubtotal;
    const tax = editingOrder?.tax ?? 0;
    const total = Math.max(
      0,
      subtotal
      + tax
      + (editingOrder?.delivery_fee ?? 0)
      + (editingOrder?.service_fee ?? 0)
      - discountAmount
      - freeItemDiscountAmount
      - (editingOrder?.coupon_discount ?? 0)
      - rewardPointsValue
    );
    return { subtotal, tax, discount: discountAmount + freeItemDiscountAmount, total };
  }, [cartSubtotal, discountAmount, editingOrder, freeItemDiscountAmount, rewardPointsValue]);

  const buildCheckoutLineItems = useCallback(() => (
    cartItems.map((item) => ({
      name: selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id
        ? getFreeItemDisplayName(freeItemPromotion.promotion, item.product_name)
        : item.product_name,
      description: item.comment || undefined,
      quantity: item.quantity,
      price: Number((item.subtotal / Math.max(item.quantity, 1)).toFixed(2)),
    }))
  ), [cartItems, freeItemPromotion, selectedFreeItemId]);

  useEffect(() => {
    const eligibleIds = Array.from(new Set(unlockedFreeItemPromotion?.product_ids || []));
    if (eligibleIds.length === 0) {
      setEligibleFreeItemProducts([]);
      return;
    }

    const loadEligibleProducts = async () => {
      const { data, error } = await supabase
        .from('sale_products')
        .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
        .in('id', eligibleIds)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.warn('POS eligible free items load failed', error);
        setEligibleFreeItemProducts([]);
        return;
      }

      setEligibleFreeItemProducts((data || []) as SaleProduct[]);
    };

    void loadEligibleProducts();
  }, [unlockedFreeItemPromotion]);

  useEffect(() => {
    if (!promotionsLoaded || !selectedFreeItemId) return;
    if (pendingInstoreSmartpayOrder) return;
    if (freeItemPromotion) return;

    const stillExists = cartItems.some((item) => item.id === selectedFreeItemId);
    if (!stillExists) {
      setSelectedFreeItemId(null);
      return;
    }

    setCartItems((current) => current.filter((item) => item.id !== selectedFreeItemId));
    setSelectedFreeItemId(null);
    Alert.alert('Free item removed', 'This order no longer qualifies for the free-item promotion.');
  }, [cartItems, freeItemPromotion, pendingInstoreSmartpayOrder, promotionsLoaded, selectedFreeItemId]);

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
      const fullCustomization = posCatalogCacheStore.getState().getCustomization(productId);
      if (fullCustomization) {
        posCatalogCacheStore.getState().setCustomizationAvailability(
          productId,
          fullCustomization.groups.length > 0 || fullCustomization.removableIngredients.length > 0
        );
        return false;
      }
      return posCatalogCacheStore.getState().getCustomizationAvailability(productId) === null;
    });

    if (missingProductIds.length === 0) {
      setCustomizableProductIds(new Set(uniqueProductIds.filter((productId) => (
        posCatalogCacheStore.getState().getCustomizationAvailability(productId)
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
        posCatalogCacheStore.getState().getCustomizationAvailability(productId)
      ))));
      return;
    }

    const customizableIds = new Set([
      ...((addonResult.data || []) as Array<{ sale_product_id: string }>).map((row) => row.sale_product_id),
      ...((ingredientResult.data || []) as Array<{ sale_product_id: string }>).map((row) => row.sale_product_id),
    ]);

    missingProductIds.forEach((productId) => {
      posCatalogCacheStore.getState().setCustomizationAvailability(productId, customizableIds.has(productId));
    });

    setCustomizableProductIds(new Set(uniqueProductIds.filter((productId) => (
      posCatalogCacheStore.getState().getCustomizationAvailability(productId)
    ))));
  };

  const productHasCustomization = async (productId: string) => {
    const fullCustomization = posCatalogCacheStore.getState().getCustomization(productId);
    if (fullCustomization) {
      return fullCustomization.groups.length > 0 || fullCustomization.removableIngredients.length > 0;
    }

    const cachedAvailability = posCatalogCacheStore.getState().getCustomizationAvailability(productId);
    if (cachedAvailability !== null) {
      return cachedAvailability;
    }

    await loadCustomizationAvailability([productId]);
    return posCatalogCacheStore.getState().getCustomizationAvailability(productId) ?? false;
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

    const cachedCustomizations = posCatalogCacheStore.getState().getCustomization(productId);
    if (cachedCustomizations) {
      setLoadingAddons(false);
      applyCustomizationData(cachedCustomizations);
      return cachedCustomizations;
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
        .select('id, customer_can_remove, products!product_id(name)')
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
      customer_can_remove: boolean;
      products: { name?: string } | { name?: string }[] | null;
    }>).map((row) => {
      const productRef = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.id,
        ingredient_name: productRef?.name?.trim() || 'Unknown ingredient',
        customer_can_remove: row.customer_can_remove,
      };
    });

    const customizations = { groups, removableIngredients };
    posCatalogCacheStore.getState().setCustomization(productId, customizations);
    posCatalogCacheStore.getState().setCustomizationAvailability(
      productId,
      groups.length > 0 || removableIngredients.length > 0
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
    if (isPhoneLayout) {
      setPhoneViewTab('cart');
    }
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
    removedIngredients: string[],
    overridePrice: number | null = null
  ): PosCartItem => ({
    id: newLocalId(),
    order_id: '',
    product_id: product.id,
    product_name: product.name,
    product_description: product.description,
    product_image_url: product.image_url,
    base_price: product.sale_price,
    override_price: overridePrice,
    quantity,
    subtotal: overridePrice ?? (product.sale_price + addonTotal(addons)) * quantity,
    section: formatKitchenSectionValue(product.section, addons, getProductGroupSection(product)),
    removed_ingredients: removedIngredients,
    comment: comment.trim() || null,
    created_at: new Date().toISOString(),
    addons,
  });

  const getPosCartItemDisplayName = useCallback((item: PosCartItem) => (
    selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id
      ? getFreeItemDisplayName(freeItemPromotion.promotion, item.product_name)
      : item.product_name
  ), [freeItemPromotion, selectedFreeItemId]);

  const handleSelectFreeItem = useCallback((product: SaleProduct) => {
    if (preventPendingCartEdit()) return;
    if (selectedFreeItemId) {
      setCartItems((current) => current.filter((item) => item.id !== selectedFreeItemId));
      setSelectedFreeItemId(null);
    }

    const newItem = buildCartItem(product, 1, [], '', []);
    setCartItems((current) => [...current, newItem]);
    setSelectedFreeItemId(newItem.id);
    setFreeItemDialogVisible(false);
  }, [buildCartItem, preventPendingCartEdit, selectedFreeItemId]);

  const quickAddProduct = async (
    product: SaleProduct,
    options: { skipCustomization?: boolean; forcePlainAdd?: boolean } = {}
  ) => {
    if (preventPendingCartEdit()) return;
    const hasCustomizedCopy = cartItems.some((item) => (
      item.product_id === product.id && cartItemHasCustomizations(item)
    ));
    const existingPlainItem = cartItems.find((item) => (
      item.product_id === product.id
      && item.id !== selectedFreeItemId
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
    if (preventPendingCartEdit()) return;
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
    if (preventPendingCartEdit()) return;
    const lineSubtotal = (product.sale_price + addonTotal(addons)) * quantity;
    const normalizedComment = comment.trim();
    const existing = cartItems.find((item) => (
      item.product_id === product.id
      && item.id !== selectedFreeItemId
      && addonSelectionKey(item.addons || []) === addonSelectionKey(addons)
      && (item.comment ?? '') === normalizedComment
      && JSON.stringify(item.removed_ingredients || []) === JSON.stringify(removedIngredients)
    ));

    if (existing) {
      setCartItems((prev) => prev.map((item) => (
        item.id === existing.id
          ? { ...item, quantity: item.quantity + quantity, override_price: null, subtotal: item.subtotal + lineSubtotal }
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
    if (preventPendingCartEdit()) return;
    if (!selectedProduct || !editingItemId) return;

    setCartItems((prev) => prev.map((item) => {
      if (item.id !== editingItemId) return item;
      return {
        ...item,
        addons,
        section: formatKitchenSectionValue(selectedProduct.section, addons, getProductGroupSection(selectedProduct)),
        removed_ingredients: removedIngredients,
        override_price: null,
        subtotal: (selectedProduct.sale_price + addonTotal(addons)) * item.quantity,
      };
    }));
  };

  const removeCartItem = (id: string) => {
    if (preventPendingCartEdit()) return;
    if (menuLevel === 'addons') backToItems();
    if (selectedFreeItemId === id) {
      setSelectedFreeItemId(null);
    }
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const openNoteEditor = (item: PosCartItem) => {
    if (preventPendingCartEdit()) return;
    setNoteItemId(item.id);
    setNoteDraft(item.comment ?? '');
  };

  const closeNoteEditor = () => {
    setNoteItemId(null);
    setNoteDraft('');
  };

  const saveNote = () => {
    if (preventPendingCartEdit()) return;
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

  const openThirdPartyOrderAtPicker = (mode: 'date' | 'time') => {
    setThirdPartyOrderAtPickerMode(mode);
    setShowThirdPartyOrderAtPicker(true);
  };

  const handleThirdPartyOrderAtPickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowThirdPartyOrderAtPicker(false);
    if (!date) return;
    setThirdPartyOrderAt(date);
  };

  const handleClearCart = () => {
    if (orderId) return;
    if (preventPendingCartEdit()) return;

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
            setSelectedFreeItemId(null);
            setQuickOrderNote(null);
            setOrderNoteText('');
            setDiscountConfig(EMPTY_DISCOUNT);
            setRewardPointsToUse(0);
            setRewardPointsValue(0);
            setMarketplaceImportMetadata(null);
            backToGroups();
          },
        },
      ]
    );
  };

  const resetPosForNextOrder = useCallback(() => {
    setPhoneViewTab('menu');
    setCartItems([]);

    setCustomerPhone('');
    setCustomerName('');
    setSelectedCustomer(null);
    setRewardPointsToUse(0);
    setRewardPointsValue(0);
    setMarketplaceImportMetadata(null);
    setCustomerLookupStatus('idle');
    setCustomerLookupError(null);
    setSelectedFreeItemId(null);
    setIsPreOrder(false);
    setScheduledPickupAt(defaultPickupTime());
    setPaymentChoice('no_pay');
    setQuickOrderNote(null);
    setOrderNoteText('');
    setDiscountConfig(EMPTY_DISCOUNT);
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

  const handleThirdPartySourceChange = (value: PosThirdPartySource) => {
    if (value === thirdPartySource) return;
    setThirdPartySource(value);
    setMarketplaceImportMetadata(null);
  };

  const handleThirdPartyExternalOrderIdChange = (value: string) => {
    if (value === thirdPartyExternalOrderId) return;
    setThirdPartyExternalOrderId(value);
    setMarketplaceImportMetadata(null);
  };

  const updateQuantity = (id: string, delta: number) => {
    if (preventPendingCartEdit()) return;
    const currentItem = cartItems.find((item) => item.id === id);
    if (menuLevel === 'addons' && currentItem && currentItem.quantity + delta <= 0) {
      backToItems();
    }

    const shouldClearSelectedFreeItem = selectedFreeItemId === id && (currentItem?.quantity ?? 0) + delta <= 0;
    if (shouldClearSelectedFreeItem) {
      setSelectedFreeItemId(null);
    }

    setCartItems((prev) => prev
      .map((item) => {
        if (item.id !== id) return item;
        const nextQuantity = item.quantity + delta;
        if (nextQuantity <= 0) {
          return null;
        }
        return {
          ...item,
          quantity: nextQuantity,
          override_price: null,
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
    if (preventPendingIndependentCheckout()) return;
    if (freeItemSelectionRequired) {
      setFreeItemDialogVisible(true);
      Alert.alert('Free item available', 'Please choose the free promotion item before checkout.');
      return;
    }

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
        setSmartpayDialogMinimized(false);
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
    try {
    const pickupAt = isPreOrder
      ? (scheduledPickupAt.getTime() > Date.now() ? scheduledPickupAt : defaultPickupTime())
      : null;
    let customerId = editingOrder?.user_id ?? null;
    if (phone) {
      const { data: customer, error: customerError } = await createCustomerIfNotExists(phone, name);
      if (customerError) {
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
      promotion_discount: discountAmount + freeItemDiscountAmount,
      promotions_applied: promotionsApplied,
      coupon_code: discountConfig.kind === 'coupon' ? discountConfig.code : null,
      coupon_discount: discountConfig.kind === 'coupon' ? discountAmount : 0,
      total: totals.total,
      reward_points_used: rewardPointsToUse || null,
      reward_points_value: rewardPointsValue || null,
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
      ? await updatePosOrder(orderId, cartItems.map((item) => ({
        ...item,
        product_name: getPosCartItemDisplayName(item),
      })), totals, {
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
        promotion_discount: discountAmount + freeItemDiscountAmount,
        promotions_applied: promotionsApplied,
        coupon_code: discountConfig.kind === 'coupon' ? discountConfig.code : null,
        coupon_discount: discountConfig.kind === 'coupon' ? discountAmount : 0,
        reward_points_used: rewardPointsToUse || null,
        reward_points_value: rewardPointsValue || null,
      })
      : await savePosOrder(orderPayload, cartItems.map((item) => ({
        ...item,
        product_name: getPosCartItemDisplayName(item),
      })));

    if (result.error) {
      Alert.alert('Checkout', result.error);
      return;
    }
    if (result.data?.id) {
      if (discountConfig.kind === 'coupon' && discountConfig.couponId) {
        await recordCouponRedemption({
          couponId: discountConfig.couponId,
          orderId: result.data.id,
          userId: customerId || null,
        });
      }
      await applyRewardPointsForSavedOrder(result.data.id, customerId);
    }
    invalidateTopSellers();
    if (isEditingExistingOrder) {
      await queryClient.refetchQueries({ queryKey: LIVE_ORDERS_QUERY_KEY });
    }
    router.back();
    } catch (error) {
      console.error('Checkout failed', error);
      Alert.alert('Checkout', error instanceof Error ? error.message : 'Failed to complete checkout.');
    } finally {
      setCreatingOrder(false);
      setSmartpayProcessing(false);
      cashTenderConfirmedRef.current = false;
    }
  };

  const handleSmartpayInstoreCheckout = async () => {
    if (freeItemSelectionRequired) {
      setFreeItemDialogVisible(true);
      Alert.alert('Free item available', 'Please choose the free promotion item before checkout.');
      return;
    }

    if (orderId) {
      Alert.alert('Edit Order', 'Use Update Order when editing an existing order.');
      return;
    }

    if (cartItems.length === 0 || creatingOrder || smartpayProcessing) return;
    if (!smartpayPaired) {
      Alert.alert('SmartPay not paired', 'Pair this POS register with Smartpay before taking SmartPay payments.');
      return;
    }

    let terminalApproved = Boolean(
      pendingInstoreSmartpayOrder
      && smartpayApprovedOrderId === pendingInstoreSmartpayOrder.id
    );
    let pendingOrderForAttempt = pendingInstoreSmartpayOrder;

    setSmartpayPreparing(true);
    try {
      setCreatingOrder(true);
      let pendingOrder = pendingOrderForAttempt;

      if (!pendingOrder) {
        const phone = customerPhone.trim();
        const name = customerName.trim();
        let customerId: string | null = null;
        let customerEmail = '';

        if (phone) {
          const { data: customer, error: customerError } = await createCustomerIfNotExists(phone, name);
          if (customerError) {
            Alert.alert('Customer', customerError);
            return;
          }
          customerId = customer?.id ?? null;
          customerEmail = customer?.email ?? '';
        }

        const orderPayload = {
          user_id: customerId,
          customer_email: customerEmail,
          customer_phone: phone,
          customer_name: name || 'INSTORE',
          payment_method: 'store',
          order_channel: 'instore',
          payment_method_detail: 'SmartPay',
          order_type: 'pickup',
          payment_status: 'pending',
          order_status: 'pending_online_payment',
          subtotal: totals.subtotal,
          tax: totals.tax,
          delivery_fee: 0,
          service_fee: 0,
          promotion_discount: discountAmount + freeItemDiscountAmount,
          promotions_applied: promotionsApplied,
          coupon_code: discountConfig.kind === 'coupon' ? discountConfig.code : null,
          coupon_discount: discountConfig.kind === 'coupon' ? discountAmount : 0,
          total: totals.total,
          reward_points_used: rewardPointsToUse || null,
          reward_points_value: rewardPointsValue || null,
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

        const pendingResult = await createOrReusePendingInstoreOrder({ savePosOrder }, {
          existingOrder: null,
          orderPayload,
          items: cartItems.map((item) => ({
            ...item,
            product_name: getPosCartItemDisplayName(item),
          })),
        });
        pendingOrder = pendingResult.order;
        pendingOrderForAttempt = pendingOrder;
        setPendingInstoreSmartpayOrder(pendingOrder);
        setSmartpayApprovedOrderId(null);
      }

      const paymentPlan = getPendingInstorePaymentPlan(
        pendingOrder,
        smartpayApprovedOrderId,
        'smartpay',
      );
      setCreatingOrder(false);
      setSmartpayPreparing(false);
      setSmartpayDialogMinimized(false);
      setSmartpayProcessing(true);
      if (paymentPlan.shouldStartTerminal) {
        await processSmartpayCardPayment(pendingOrder.total);
        terminalApproved = true;
        setSmartpayApprovedOrderId(pendingOrder.id);
      }

      const settledOrder = await settlePendingInstorePayment(
        { updatePaymentStatus },
        pendingOrder.id,
        paymentPlan.detail,
      );
      const completedOrder = { ...pendingOrder, ...settledOrder, items: pendingOrder.items };

      await printInstoreInstantTicket(completedOrder);
      await applyRewardPointsForSavedOrder(
        completedOrder.id,
        completedOrder.user_id,
        getPendingInstoreRewardPoints(completedOrder),
      );
      await printInstoreCustomerReceipt(completedOrder);
      setPendingInstoreSmartpayOrder(null);
      setSmartpayApprovedOrderId(null);
      invalidateTopSellers();
      router.back();
    } catch (error) {
      console.error('SmartPay instore payment failed', error);
      Alert.alert(
        terminalApproved ? 'SmartPay approved — save pending' : 'SmartPay payment failed',
        terminalApproved
          ? `The terminal approved this payment, but the order could not be settled. Retry SmartPay to reconcile Order #${getSmartpayDisplayOrderNumber(pendingOrderForAttempt)} without charging again.\n\n${formatSmartpayError(error)}`
          : formatSmartpayError(error),
      );
    } finally {
      setCreatingOrder(false);
      setSmartpayPreparing(false);
      setSmartpayProcessing(false);
      setSmartpayDialogMinimized(false);
    }
  };

  const confirmDismissSmartpayLock = () => {
    if (!smartpayProcessing) return;

    Alert.alert(
      'Minimize SmartPay payment?',
      'Payment polling will continue in the background. Use the payment button in the header to reopen this screen.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Minimize', onPress: () => setSmartpayDialogMinimized(true) },
      ]
    );
  };

  const handleInstoreCheckout = async (payment: PosInstorePaymentChoice) => {
    if (freeItemSelectionRequired) {
      setFreeItemDialogVisible(true);
      Alert.alert('Free item available', 'Please choose the free promotion item before checkout.');
      return;
    }

    if (orderId) {
      Alert.alert('Edit Order', 'Use Update Order when editing an existing order.');
      return;
    }

    if (cartItems.length === 0) return;

    let pendingPaymentPlan: ReturnType<typeof getPendingInstorePaymentPlan> | null = null;
    if (pendingInstoreSmartpayOrder) {
      try {
        pendingPaymentPlan = getPendingInstorePaymentPlan(
          pendingInstoreSmartpayOrder,
          smartpayApprovedOrderId,
          payment,
        );
      } catch (error) {
        Alert.alert(
          smartpayApprovedOrderId === pendingInstoreSmartpayOrder.id
            ? 'SmartPay payment already approved'
            : 'Order already saved',
          error instanceof Error ? error.message : 'This pending order cannot use that payment option.',
        );
        return;
      }
    }

    if (payment === 'cash' && !cashTenderConfirmedRef.current) {
      setCashTenderMode('instore');
      return;
    }

    if (pendingInstoreSmartpayOrder && pendingPaymentPlan) {
      setCreatingOrder(true);
      try {
        const settledOrder = await settlePendingInstorePayment(
          { updatePaymentStatus },
          pendingInstoreSmartpayOrder.id,
          pendingPaymentPlan.detail,
        );
        const completedOrder = {
          ...pendingInstoreSmartpayOrder,
          ...settledOrder,
          items: pendingInstoreSmartpayOrder.items,
        };

        cashTenderConfirmedRef.current = false;
        await applyRewardPointsForSavedOrder(
          completedOrder.id,
          completedOrder.user_id,
          getPendingInstoreRewardPoints(completedOrder),
        );
        await printInstoreCustomerReceipt(completedOrder);
        setPendingInstoreSmartpayOrder(null);
        setSmartpayApprovedOrderId(null);
        invalidateTopSellers();
        router.back();
      } catch (error) {
        Alert.alert('Instore Order', error instanceof Error ? error.message : 'Failed to settle in-store payment.');
      } finally {
        setCreatingOrder(false);
      }
      return;
    }

    setCreatingOrder(true);
    try {
    const phone = customerPhone.trim();
    const name = customerName.trim();
    let customerId: string | null = null;
    let customerEmail = '';

    if (phone) {
      const { data: customer, error: customerError } = await createCustomerIfNotExists(phone, name);
      if (customerError) {
        Alert.alert('Customer', customerError);
        return;
      }
      customerId = customer?.id ?? null;
      customerEmail = customer?.email ?? '';
    }

    const paymentStatus: PaymentStatus = payment === 'unpaid' ? 'pending' : 'paid';
    const paymentMethodDetail =
      payment === 'card' ? 'Card' :
        payment === 'cash' ? 'Cash' :
          null;

    const orderPayload = {
      user_id: customerId,
      customer_email: customerEmail,
      customer_phone: phone,
      customer_name: name || 'INSTORE',
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
      promotion_discount: discountAmount + freeItemDiscountAmount,
      promotions_applied: promotionsApplied,
      coupon_code: discountConfig.kind === 'coupon' ? discountConfig.code : null,
      coupon_discount: discountConfig.kind === 'coupon' ? discountAmount : 0,
      total: totals.total,
      reward_points_used: rewardPointsToUse || null,
      reward_points_value: rewardPointsValue || null,
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

    const result = await savePosOrder(orderPayload, cartItems.map((item) => ({
      ...item,
      product_name: getPosCartItemDisplayName(item),
    })));

    if (result.error || !result.data?.id) {
      Alert.alert('Instore Order', result.error || 'Failed to create in-store order.');
      return;
    }

    if (discountConfig.kind === 'coupon' && discountConfig.couponId) {
      await recordCouponRedemption({
        couponId: discountConfig.couponId,
        orderId: result.data.id,
        userId: customerId || null,
      });
    }

    try {
      if (paymentStatus === 'paid') {
        await printInstoreInstantTicket(result.data);
      }
      await applyRewardPointsForSavedOrder(result.data.id, customerId);
      if (paymentStatus === 'paid') {
        await printInstoreCustomerReceipt(result.data);
      }
    } catch (error) {
      console.error('Instore checkout post-save work failed', error);
      Alert.alert(
        'Instore Order',
        `Order #${result.data.order_number} was created, but post-save receipt work could not be completed.`,
      );
    }
    invalidateTopSellers();
    resetPosForNextOrder();
    router.back();
    } catch (error) {
      console.error('Instore checkout failed', error);
      Alert.alert('Instore Order', error instanceof Error ? error.message : 'Failed to create in-store order.');
    } finally {
      setCreatingOrder(false);
      cashTenderConfirmedRef.current = false;
    }
  };

  const handleThirdPartyCheckout = async () => {
    if (preventPendingIndependentCheckout()) return;
    if (freeItemSelectionRequired) {
      setFreeItemDialogVisible(true);
      Alert.alert('Free item available', 'Please choose the free promotion item before checkout.');
      return;
    }

    if (orderId) {
      Alert.alert('Edit Order', 'Third-party checkout is only available for new POS orders right now.');
      return;
    }

    if (cartItems.length === 0) return;

    const externalOrderNumber = thirdPartyExternalOrderId.trim();
    const marketplaceCustomerName = thirdPartyCustomerName.trim();
    if (!externalOrderNumber) {
      Alert.alert('Third-party order', 'Please enter the external order ID.');
      return;
    }

    setCreatingOrder(true);

    try {
      const importedMarketplaceOrder = marketplaceImportMetadata
        && marketplaceImportMetadata.source === thirdPartySource
        && marketplaceImportMetadata.externalOrderNumber === externalOrderNumber
        ? marketplaceImportMetadata
        : null;
      const orderPayload = {
        created_at: importedMarketplaceOrder ? thirdPartyOrderAt.toISOString() : undefined,
        user_id: null,
        customer_email: '',
        customer_phone: externalOrderNumber,
        customer_name: marketplaceCustomerName || thirdPartySource,
        payment_method: 'store',
        order_channel: 'third_party',
        payment_method_detail: thirdPartySource,
        order_type: 'pickup',
        payment_status: 'paid',
        order_status: importedMarketplaceOrder?.orderStatus ?? 'confirmed',
        subtotal: totals.subtotal,
        tax: totals.tax,
        delivery_fee: 0,
        service_fee: 0,
        promotion_discount: discountAmount + freeItemDiscountAmount,
        promotions_applied: promotionsApplied,
        coupon_code: null,
        coupon_discount: 0,
        total: totals.total,
        marketplace_gross_sales: importedMarketplaceOrder?.grossSales ?? (importedMarketplaceOrder ? totals.total : null),
        marketplace_gross_payout: importedMarketplaceOrder?.grossPayout ?? null,
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
        delivery_partner_name: thirdPartySource,
        external_order_number: externalOrderNumber,
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

      const result = await savePosOrder(orderPayload, cartItems.map((item) => ({
        ...item,
        product_name: getPosCartItemDisplayName(item),
      })));

      if (result.error) {
        Alert.alert('Third-party order', result.error);
        return;
      }

      setThirdPartyExternalOrderId('');
      setThirdPartyCustomerName('');
      setMarketplaceImportMetadata(null);
      invalidateTopSellers();
      router.back();
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDeliveryCheckout = useCallback(async (
    input: { address: DeliveryAddressDraft; quote: DeliveryQuoteResult }
  ): Promise<void> => {
    if (preventPendingIndependentCheckout()) return;
    if (freeItemSelectionRequired) {
      setFreeItemDialogVisible(true);
      Alert.alert('Free item available', 'Please choose the free promotion item before checkout.');
      return;
    }

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
        subtotal: Math.max(0, totals.subtotal - discountAmount - freeItemDiscountAmount - rewardPointsValue),
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
        promotion_discount: discountAmount + freeItemDiscountAmount,
        promotions_applied: promotionsApplied,
        coupon_code: null,
        coupon_discount: 0,
        total: feeSummary.totalAmount,
        reward_points_used: rewardPointsToUse || null,
        reward_points_value: rewardPointsValue || null,
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

      const saveResult = await savePosOrder(orderPayload, cartItems.map((item) => ({
        ...item,
        product_name: getPosCartItemDisplayName(item),
      })));
      if (saveResult.error || !saveResult.data) {
        Alert.alert('Delivery', saveResult.error || 'Failed to create delivery order');
        return;
      }

      await applyRewardPointsForSavedOrder(saveResult.data.id, customer?.id ?? null);

      const checkoutSession = await createStripeCheckoutSession({
        orderId: saveResult.data.id,
        customerEmail: customer?.email || undefined,
        customerName: name,
        customerPhone: phone,
        items: buildCheckoutLineItems(),
        subtotal: Math.max(0, totals.subtotal - discountAmount - freeItemDiscountAmount - rewardPointsValue),
        promotionDiscount: discountAmount + freeItemDiscountAmount,
        rewardPointsDiscount: rewardPointsValue,
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
        paymentUrl: checkoutSession.shortUrl || checkoutSession.url,
        deliveryAddress: formatDeliveryAddress(input.address),
        deliveryEtaMinutes: input.quote.estimated_duration_minutes,
        serviceFee: checkoutSession.serviceFee,
        deliveryFee: input.quote.fee,
        totalAmount: finalTotalAmount,
        isTestPayment: Boolean(checkoutSession.isTestPhoneCheckout),
        itemSummaries: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          productName: getPosCartItemDisplayName(item),
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
    freeItemSelectionRequired,
    totals.subtotal,
    totals.tax,
    orderOptions,
    orderSpecialInstructions,
    cartItems,
    buildCheckoutLineItems,
    discountAmount,
    freeItemDiscountAmount,
    getPosCartItemDisplayName,
    preventPendingIndependentCheckout,
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
  const isPhoneLayout = isCompactPhoneWidth(width);
  const isNarrowLayout = width < 760;
  const gridColumns = isNarrowLayout ? 2 : isCompactLayout ? 3 : 4;
  const quickListColumns = isNarrowLayout ? 2 : 3;
  const addonOptionWidth = isNarrowLayout ? '48%' : isCompactLayout ? '31%' : '23%';
  const activeCartItemId = noteItemId ?? editingItemId ?? cartItems[cartItems.length - 1]?.id ?? null;
  const checkoutPrimaryLabel = orderId
    ? 'Update Order'
    : 'Create Pickup Order • Unpaid';
  const applyPresetDiscount = (percent: number) => {
    const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
    if (normalized <= 0) {
      setDiscountConfig(EMPTY_DISCOUNT);
      return;
    }
    if (discountConfig.kind === 'percent' && discountConfig.percent === normalized) {
      setDiscountConfig(EMPTY_DISCOUNT);
      return;
    }
    setDiscountConfig({ kind: 'percent', percent: normalized });
  };
  const applyCustomPercentDiscount = (percent: number) => {
    const normalized = Number(percent);
    if (!Number.isFinite(normalized) || normalized <= 0) return;
    applyPresetDiscount(normalized);
  };
  const applyCustomFixedDiscount = (amount: number) => {
    const normalized = normalizeMoney(Number(amount) || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return;
    setDiscountConfig({ kind: 'fixed', amount: normalized });
  };
  const addonSelectionCount = selectedEditorAddons.length + selectedRemovedIngredients.length;
  const addonSelectionTotal = addonTotal(selectedEditorAddons);

  return (

    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title={orderId ? 'Edit Order' : 'Take Order'} titleStyle={styles.headerTitle} />
        {smartpayProcessing && smartpayDialogMinimized ? (
          <Appbar.Action
            icon="credit-card-wireless-outline"
            onPress={() => setSmartpayDialogMinimized(false)}
            iconColor="#fff"
            accessibilityLabel="Resume SmartPay payment"
          />
        ) : null}
        <Appbar.Action icon="magnify" onPress={openSearch} iconColor="#fff" accessibilityLabel="Search items" />
        <Appbar.Action icon="view-grid-plus-outline" onPress={openLayoutSettings} iconColor="#fff" accessibilityLabel="POS layout settings" />
        <Appbar.Action icon="home" onPress={goHome} iconColor="#fff" accessibilityLabel="Back home" />
      </Appbar.Header>

      {isPhoneLayout && (
        <View style={styles.phoneNavContainer}>
          <View style={styles.phoneNavTabs}>
            <TouchableOpacity
              style={[styles.phoneNavTab, phoneViewTab === 'menu' && menuLevel !== 'checkout' && styles.phoneNavTabActive]}
              onPress={() => {
                if (menuLevel === 'checkout') setMenuLevel('groups');
                setPhoneViewTab('menu');
              }}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: phoneViewTab === 'menu' && menuLevel !== 'checkout' }}
            >
              <Text style={[styles.phoneNavTabText, phoneViewTab === 'menu' && menuLevel !== 'checkout' && styles.phoneNavTabTextActive]}>
                🍔 Menu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.phoneNavTab, (phoneViewTab === 'cart' || menuLevel === 'checkout') && styles.phoneNavTabActive]}
              onPress={() => setPhoneViewTab('cart')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: phoneViewTab === 'cart' || menuLevel === 'checkout' }}
            >
              <Text style={[styles.phoneNavTabText, (phoneViewTab === 'cart' || menuLevel === 'checkout') && styles.phoneNavTabTextActive]}>
                🛒 Cart
              </Text>
              {cartItems.length > 0 && (
                <View style={styles.phoneCartBadge}>
                  <Text style={styles.phoneCartBadgeText}>{cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View
        style={[
          styles.body,
          isCompactLayout ? styles.bodyCompact : null,
          isPhoneLayout ? styles.bodyPhone : null,
        ]}
      >
        {isPhoneLayout ? (
          phoneViewTab === 'cart' || menuLevel === 'checkout' ? (
            menuLevel === 'checkout' ? (
              <View style={[styles.menuPane, styles.menuPaneCompact]}>
                <PosMenuPane
                  isPhoneLayout={isPhoneLayout}
                  onOpenCart={() => setPhoneViewTab('cart')}
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
                  onChangeCustomerPhone={handleCustomerPhoneChange}
                  customerName={customerName}
                  onChangeCustomerName={handleCustomerNameChange}
                  customerLookupError={customerLookupError}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={handleSelectCustomer}
                  onClearCustomer={handleClearCustomer}
                  onResetToDefaultInstore={handleResetToDefaultInstore}
                  rewardPointsEnabled={rewardPointsSettings.enabled}
                  rewardPointsBalance={rewardPointsBalance}
                  rewardPointsDollarValue={rewardPointsDollarValue}
                  rewardPointsApplied={rewardPointsToUse > 0}
                  appliedRewardPointsValue={rewardPointsValue}
                  onToggleRewardPoints={handleToggleRewardPoints}
                  totals={totals}
                  freeItemPromotionTitle={freeItemPromotionTitle}
                  freeItemSelectionRequired={freeItemSelectionRequired}
                  selectedFreeItemName={selectedFreeItemName}
                  onOpenFreeItemDialog={() => setFreeItemDialogVisible(true)}
                  discountLabel={discountLabel}
                  discountAmount={discountAmount}
                  activeDiscountPercent={activeDiscountPercent}
                  selectDiscountPreset={applyPresetDiscount}
                  openDiscountDialog={() => setDiscountDialogVisible(true)}
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
                  thirdPartyOrderAt={thirdPartyOrderAt}
                  formatOrderTime={formatOrderTime}
                  openThirdPartyOrderAtPicker={openThirdPartyOrderAtPicker}
                  showThirdPartyOrderAtPicker={showThirdPartyOrderAtPicker}
                  thirdPartyOrderAtPickerMode={thirdPartyOrderAtPickerMode}
                  handleThirdPartyOrderAtPickerChange={handleThirdPartyOrderAtPickerChange}
                  orderNoteText={orderNoteText}
                  setOrderNoteText={setOrderNoteText}
                  creatingOrder={creatingOrder}
                  smartpayPreparing={smartpayPreparing}
                  smartpayProcessing={smartpayProcessing}
                  orderId={orderId}
                  checkoutPrimaryLabel={checkoutPrimaryLabel}
                  handleCheckout={handleCheckout}
                  smartpayPaired={smartpayPaired}
                  handleInstoreCheckout={handleInstoreCheckout}
                  handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
                  handleDeliveryCheckout={handleDeliveryCheckout}
                  thirdPartySource={thirdPartySource}
                  setThirdPartySource={handleThirdPartySourceChange}
                  thirdPartyCustomerName={thirdPartyCustomerName}
                  setThirdPartyCustomerName={setThirdPartyCustomerName}
                  thirdPartyExternalOrderId={thirdPartyExternalOrderId}
                  setThirdPartyExternalOrderId={handleThirdPartyExternalOrderIdChange}
                  handleThirdPartyCheckout={handleThirdPartyCheckout}
                  initialCheckoutTab={initialCheckoutTab}
                />
              </View>
            ) : (
              <PosCartPane
                isCompactLayout={isCompactLayout}
                isPhoneLayout={isPhoneLayout}
                onBackToMenu={() => setPhoneViewTab('menu')}
                orderId={orderId}
                editingOrderNumber={editingOrder?.order_number}
                cartItems={cartItems}
                quickOrderNote={quickOrderNote}
                setSaltOptionDialogVisible={setSaltOptionDialogVisible}
                activeCartItemId={activeCartItemId}
                openCartItemEditor={openCartItemEditor}
                updateQuantity={updateQuantity}
                openNoteEditor={openNoteEditor}
                removeCartItem={removeCartItem}
                totals={totals}
                freeItemPromotionTitle={freeItemPromotionTitle}
                freeItemSelectionRequired={freeItemSelectionRequired}
                selectedFreeItemName={selectedFreeItemName}
                onOpenFreeItemDialog={() => setFreeItemDialogVisible(true)}
                getCartItemDisplayName={getPosCartItemDisplayName}
                isFreePromotionItem={(item) => selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id}
                creatingOrder={creatingOrder}
                smartpayPreparing={smartpayPreparing}
                smartpayProcessing={smartpayProcessing}
                handleClearCart={handleClearCart}
                openCheckout={openCheckout}
                openInstorePaymentPrompt={openInstorePaymentPrompt}
                handleCheckout={() => handleCheckout()}
                smartpayPaired={smartpayPaired}
                handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
              />
            )
          ) : (
            <View style={[styles.menuPane, styles.menuPaneCompact]}>
              <PosMenuPane
                isPhoneLayout={isPhoneLayout}
                onOpenCart={() => setPhoneViewTab('cart')}
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
                onChangeCustomerPhone={handleCustomerPhoneChange}
                customerName={customerName}
                onChangeCustomerName={handleCustomerNameChange}
                customerLookupError={customerLookupError}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={handleSelectCustomer}
                onClearCustomer={handleClearCustomer}
                onResetToDefaultInstore={handleResetToDefaultInstore}
                rewardPointsEnabled={rewardPointsSettings.enabled}
                rewardPointsBalance={rewardPointsBalance}
                rewardPointsDollarValue={rewardPointsDollarValue}
                rewardPointsApplied={rewardPointsToUse > 0}
                appliedRewardPointsValue={rewardPointsValue}
                onToggleRewardPoints={handleToggleRewardPoints}
                totals={totals}
                freeItemPromotionTitle={freeItemPromotionTitle}
                freeItemSelectionRequired={freeItemSelectionRequired}
                selectedFreeItemName={selectedFreeItemName}
                onOpenFreeItemDialog={() => setFreeItemDialogVisible(true)}
                discountLabel={discountLabel}
                discountAmount={discountAmount}
                activeDiscountPercent={activeDiscountPercent}
                selectDiscountPreset={applyPresetDiscount}
                openDiscountDialog={() => setDiscountDialogVisible(true)}
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
                thirdPartyOrderAt={thirdPartyOrderAt}
                formatOrderTime={formatOrderTime}
                openThirdPartyOrderAtPicker={openThirdPartyOrderAtPicker}
                showThirdPartyOrderAtPicker={showThirdPartyOrderAtPicker}
                thirdPartyOrderAtPickerMode={thirdPartyOrderAtPickerMode}
                handleThirdPartyOrderAtPickerChange={handleThirdPartyOrderAtPickerChange}
                orderNoteText={orderNoteText}
                setOrderNoteText={setOrderNoteText}
                creatingOrder={creatingOrder}
                smartpayPreparing={smartpayPreparing}
                smartpayProcessing={smartpayProcessing}
                orderId={orderId}
                checkoutPrimaryLabel={checkoutPrimaryLabel}
                handleCheckout={handleCheckout}
                smartpayPaired={smartpayPaired}
                handleInstoreCheckout={handleInstoreCheckout}
                handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
                handleDeliveryCheckout={handleDeliveryCheckout}
                thirdPartySource={thirdPartySource}
                setThirdPartySource={handleThirdPartySourceChange}
                thirdPartyCustomerName={thirdPartyCustomerName}
                setThirdPartyCustomerName={setThirdPartyCustomerName}
                thirdPartyExternalOrderId={thirdPartyExternalOrderId}
                setThirdPartyExternalOrderId={handleThirdPartyExternalOrderIdChange}
                handleThirdPartyCheckout={handleThirdPartyCheckout}
                initialCheckoutTab={initialCheckoutTab}
              />
            </View>
          )
        ) : (
          <>
            <View style={[styles.menuPane, isCompactLayout ? styles.menuPaneCompact : null]}>
              <PosMenuPane
                isPhoneLayout={isPhoneLayout}
                onOpenCart={() => setPhoneViewTab('cart')}
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
                onChangeCustomerPhone={handleCustomerPhoneChange}
                customerName={customerName}
                onChangeCustomerName={handleCustomerNameChange}
                customerLookupError={customerLookupError}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={handleSelectCustomer}
                onClearCustomer={handleClearCustomer}
                onResetToDefaultInstore={handleResetToDefaultInstore}
                rewardPointsEnabled={rewardPointsSettings.enabled}
                rewardPointsBalance={rewardPointsBalance}
                rewardPointsDollarValue={rewardPointsDollarValue}
                rewardPointsApplied={rewardPointsToUse > 0}
                appliedRewardPointsValue={rewardPointsValue}
                onToggleRewardPoints={handleToggleRewardPoints}
                totals={totals}
                freeItemPromotionTitle={freeItemPromotionTitle}
                freeItemSelectionRequired={freeItemSelectionRequired}
                selectedFreeItemName={selectedFreeItemName}
                onOpenFreeItemDialog={() => setFreeItemDialogVisible(true)}
                discountLabel={discountLabel}
                discountAmount={discountAmount}
                activeDiscountPercent={activeDiscountPercent}
                selectDiscountPreset={applyPresetDiscount}
                openDiscountDialog={() => setDiscountDialogVisible(true)}
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
                thirdPartyOrderAt={thirdPartyOrderAt}
                formatOrderTime={formatOrderTime}
                openThirdPartyOrderAtPicker={openThirdPartyOrderAtPicker}
                showThirdPartyOrderAtPicker={showThirdPartyOrderAtPicker}
                thirdPartyOrderAtPickerMode={thirdPartyOrderAtPickerMode}
                handleThirdPartyOrderAtPickerChange={handleThirdPartyOrderAtPickerChange}
                orderNoteText={orderNoteText}
                setOrderNoteText={setOrderNoteText}
                creatingOrder={creatingOrder}
                smartpayPreparing={smartpayPreparing}
                smartpayProcessing={smartpayProcessing}
                orderId={orderId}
                checkoutPrimaryLabel={checkoutPrimaryLabel}
                handleCheckout={handleCheckout}
                smartpayPaired={smartpayPaired}
                handleInstoreCheckout={handleInstoreCheckout}
                handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
                handleDeliveryCheckout={handleDeliveryCheckout}
                thirdPartySource={thirdPartySource}
                setThirdPartySource={handleThirdPartySourceChange}
                thirdPartyCustomerName={thirdPartyCustomerName}
                setThirdPartyCustomerName={setThirdPartyCustomerName}
                thirdPartyExternalOrderId={thirdPartyExternalOrderId}
                setThirdPartyExternalOrderId={handleThirdPartyExternalOrderIdChange}
                handleThirdPartyCheckout={handleThirdPartyCheckout}
                initialCheckoutTab={initialCheckoutTab}
              />
            </View>

            <PosCartPane
              isCompactLayout={isCompactLayout}
              isPhoneLayout={isPhoneLayout}
              onBackToMenu={() => setPhoneViewTab('menu')}
              orderId={orderId}
              editingOrderNumber={editingOrder?.order_number}
              cartItems={cartItems}
              quickOrderNote={quickOrderNote}
              setSaltOptionDialogVisible={setSaltOptionDialogVisible}
              activeCartItemId={activeCartItemId}
              openCartItemEditor={openCartItemEditor}
              updateQuantity={updateQuantity}
              openNoteEditor={openNoteEditor}
              removeCartItem={removeCartItem}
              totals={totals}
              freeItemPromotionTitle={freeItemPromotionTitle}
              freeItemSelectionRequired={freeItemSelectionRequired}
              selectedFreeItemName={selectedFreeItemName}
              onOpenFreeItemDialog={() => setFreeItemDialogVisible(true)}
              getCartItemDisplayName={getPosCartItemDisplayName}
              isFreePromotionItem={(item) => selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id}
              creatingOrder={creatingOrder}
              smartpayPreparing={smartpayPreparing}
              smartpayProcessing={smartpayProcessing}
              handleClearCart={handleClearCart}
              openCheckout={openCheckout}
              openInstorePaymentPrompt={openInstorePaymentPrompt}
              handleCheckout={() => handleCheckout()}
              smartpayPaired={smartpayPaired}
              handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
            />
          </>
        )}
      </View>


        <PosDialogs
          cashTenderMode={cashTenderMode}
          total={pendingInstoreSmartpayOrder?.total ?? totals.total}
        onCancelCashTender={() => {
          cashTenderConfirmedRef.current = false;
          setCashTenderMode(null);
        }}
        onConfirmCashTender={handleCashTenderConfirm}
        smartpayProcessing={smartpayProcessing}
        smartpayOrderNumber={getSmartpayDisplayOrderNumber(pendingInstoreSmartpayOrder)}
        smartpayDialogMinimized={smartpayDialogMinimized}
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
        freeItemDialogVisible={freeItemDialogVisible}
        setFreeItemDialogVisible={setFreeItemDialogVisible}
        eligibleFreeItemProducts={eligibleFreeItemProducts}
        onSelectFreeItem={handleSelectFreeItem}
        discountDialogVisible={discountDialogVisible}
        setDiscountDialogVisible={setDiscountDialogVisible}
        discountLabel={discountLabel}
        discountAmount={discountAmount}
        cartSubtotal={totals.subtotal}
        selectedCustomer={selectedCustomer ? { id: selectedCustomer.id, email: selectedCustomer.email } : null}
        onApplyPresetDiscount={applyPresetDiscount}
        onApplyCustomPercentDiscount={applyCustomPercentDiscount}
        onApplyCustomFixedDiscount={applyCustomFixedDiscount}
        onApplyCouponDiscount={(coupon, amount, autoCustomer) => {
          setDiscountConfig({
            kind: 'coupon',
            code: coupon.code,
            couponId: coupon.id,
            amount,
            title: coupon.title,
          });

          if (autoCustomer) {
            setSelectedCustomer(autoCustomer);
            if (autoCustomer.phone) setCustomerPhone(autoCustomer.phone);
            if (autoCustomer.name) setCustomerName(autoCustomer.name);
            setCustomerLookupStatus('found');
          }
        }}
        onClearDiscount={() => setDiscountConfig(EMPTY_DISCOUNT)}
      />

    </View>
  );
}
