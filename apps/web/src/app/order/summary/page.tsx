'use client';

import { useState, useEffect, useRef } from 'react';
import { getSessionOrderType, getSessionSchedule, setSessionOrderType } from '@/lib/order-schedule-session';
import { OrderScheduleSelector } from './components/OrderScheduleSelector';
import { LiveOrderTracker } from '@/components/LiveOrderTracker';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { CartItem } from '@/contexts/CartContext';

import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { OrderTypeSelector, type OrderType } from '@/components/OrderTypeSelector';
import { DeliveryAddressForm, type DeliveryAddressInput } from '@/components/DeliveryAddressForm';
import { getPickupTimeForDelivery } from '@my-small-business/shipday/scheduling';
import type { DeliveryQuote } from '@my-small-business/shipday';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getActivePromotions } from '@/app/actions/promotions';
import { FaShoppingCart, FaArrowLeft, FaCheck, FaDollarSign, FaEdit, FaComment, FaTruck, FaClock, FaSpinner, FaTrash, FaMinus, FaPlus, FaMapMarkerAlt, FaGift, FaTimes } from 'react-icons/fa';

import { Icon } from '@/components/Icon';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  computeCartPromotionTotals,
  getFreeItemDisplayName,
  getPromotionDisplayTitle,
  isFreeItemPromotion,
  pickUnlockedFreeItemPromotion,
  type PromotionWithProducts,
} from '@/lib/promotions';
import type { StoreHours } from '@my-small-business/types';
import { buildDefaultStoreHours, getDeliveryTimeSlots, getPickupTimeSlots, isStoreOpenNow, type PickupDayOption } from '@/lib/store-hours';

type StoreHoursForOrderResult = {
  storeHours: StoreHours;
  isOpenNow: boolean;
  scheduleDayOptions: PickupDayOption[];
};

type EligibleFreeItemProduct = {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  section: string | null;
};

export default function OrderSummaryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);
      } catch {
        setUserId(null);
      }
    })();
  }, []);
  const { items, getTotal, clearCart, isLoading, updateItem, removeItem, updateQuantity, addItem } = useCart();
  const router = useRouter();
  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<CartItem | null>(null);

  const { flags } = useFeatureFlag();

  // Order type and delivery state
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const enableDelivery = flags?.enable_online_delivery ?? false;
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressInput | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChangingAddress, setIsChangingAddress] = useState(false);

  // Pickup time: when store is open user can choose "asap" or "scheduled"; when closed, must choose scheduled (pre-order)
  const [storeHoursError, setStoreHoursError] = useState<string | null>(null);
  const [storeHoursLoading, setStoreHoursLoading] = useState(false);
  const [storeHoursResult, setStoreHoursResult] = useState<StoreHoursForOrderResult | null>(null);
  const [pickupOption, setPickupOption] = useState<'asap' | 'scheduled'>('asap');
  const [pickupTime, setScheduledPickupAt] = useState<string | null>(null);
  const [scheduledDeliveryAt, setScheduledDeliveryAt] = useState<string | null>(null);
  const scheduledPickupAt = orderType === 'delivery' ? getPickupTimeForDelivery(scheduledDeliveryAt) : pickupTime;
  const [selectedPickupDate, setSelectedPickupDate] = useState<string | null>(null);

  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);
  const [selectedFreeItemId, setSelectedFreeItemId] = useState<string | null>(null);
  const [eligibleFreeItemProducts, setEligibleFreeItemProducts] = useState<EligibleFreeItemProduct[]>([]);
  const [freeItemPickerOpen, setFreeItemPickerOpen] = useState(false);
  const [showFreeItemReminder, setShowFreeItemReminder] = useState(false);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);

  useEffect(() => {
    const loadPromotions = async () => {
      const res = await getActivePromotions();
      if (res.data) setActivePromotions(res.data);
      setPromotionsLoaded(true);
    };
    void loadPromotions();
  }, []);

  const cartSubtotal = getTotal();
  const promoTotals = computeCartPromotionTotals({
    promotions: activePromotions,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      name: i.name,
      base_price: i.base_price,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
    cartSubtotal,
    selectedFreeItemId,
  });

  const subtotal = promoTotals.subtotalAfterPromotions;
  const promotionDiscount = promoTotals.totalDiscount;
  const promotionsApplied = promoTotals.applied;
  const freeItemPromotion = promoTotals.freeItemPromotion;
  const unlockedFreeItemPromotion = promoTotals.unlockedFreeItemPromotion;
  const freeItemSelectionRequired = promoTotals.freeItemSelectionRequired;
  const deliveryFee = deliveryQuote?.fee || 0;
  const serviceFee = 0;
  const tax = 0;
  const total = subtotal + deliveryFee + serviceFee + tax;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalExGst = total / 1.1;
  const gstAmount = total - subtotalExGst;

  useEffect(() => {
    const eligibleIds = Array.from(new Set(unlockedFreeItemPromotion?.product_ids || []));

    if (eligibleIds.length === 0) {
      setEligibleFreeItemProducts([]);
      return;
    }

    const loadEligibleProducts = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('sale_products')
          .select('id, name, description, sale_price, image_url, section')
          .in('id', eligibleIds)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) {
          console.error('Failed to load eligible free-item products', error);
          setEligibleFreeItemProducts([]);
          return;
        }

        setEligibleFreeItemProducts((data || []) as EligibleFreeItemProduct[]);
      } catch (error) {
        console.error('Failed to load eligible free-item products', error);
        setEligibleFreeItemProducts([]);
      }
    };

    void loadEligibleProducts();
  }, [unlockedFreeItemPromotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem('checkout:selectedFreeItemId');
    if (stored) {
      setSelectedFreeItemId(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedFreeItemId) {
      window.sessionStorage.setItem('checkout:selectedFreeItemId', selectedFreeItemId);
    } else {
      window.sessionStorage.removeItem('checkout:selectedFreeItemId');
    }
  }, [selectedFreeItemId]);

  useEffect(() => {
    if (!selectedFreeItemId) return;
    const stillExists = items.some((item) => item.id === selectedFreeItemId);
    if (!stillExists) {
      setSelectedFreeItemId(null);
    }
  }, [items, selectedFreeItemId]);

  useEffect(() => {
    if (!promotionsLoaded || !selectedFreeItemId) return;
    if (freeItemPromotion) return;

    const stillExists = items.some((item) => item.id === selectedFreeItemId);
    if (!stillExists) {
      setSelectedFreeItemId(null);
      return;
    }

    removeItem(selectedFreeItemId);
    setSelectedFreeItemId(null);
    toast.info('Free item removed because the cart no longer qualifies for that promotion.');
  }, [freeItemPromotion, items, promotionsLoaded, removeItem, selectedFreeItemId]);

  const eligibleFreeItemPromotions = activePromotions.filter((promotion) => isFreeItemPromotion(promotion));
  const highlightedFreeItemPromotion = freeItemPromotion?.promotion
    || unlockedFreeItemPromotion
    || pickUnlockedFreeItemPromotion(eligibleFreeItemPromotions, cartSubtotal)
    || null;
  const getCartItemDisplayName = (item: CartItem) => {
    if (selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id) {
      return getFreeItemDisplayName(freeItemPromotion.promotion, item.name);
    }
    return item.name;
  };

  const handleAddFreeItem = (product: EligibleFreeItemProduct) => {
    if (selectedFreeItemId) {
      removeItem(selectedFreeItemId);
      setSelectedFreeItemId(null);
    }

    const cartItemId = addItem({
      product_id: product.id,
      name: product.name,
      description: product.description,
      base_price: product.sale_price,
      image_url: product.image_url,
      quantity: 1,
      section: product.section,
      addon_groups: [],
      removed_ingredients: [],
      comment: null,
    });
    setSelectedFreeItemId(cartItemId);

    setFreeItemPickerOpen(false);
    toast.success(`${product.name} added to cart as your free-item selection.`);
  };

  // Load order type and delivery info from sessionStorage
  useEffect(() => {
    const savedType = getSessionOrderType(sessionStorage);
    if (savedType) {
      setOrderType(savedType);
    } else {
      // Default to pickup if not set
      setOrderType('pickup');
    }

    if (savedType === 'delivery') {
      const savedAddress = sessionStorage.getItem('deliveryAddress') || sessionStorage.getItem('delivery_address');
      const savedQuote = sessionStorage.getItem('deliveryQuote') || sessionStorage.getItem('delivery_quote');
      
      if (savedAddress) {
        try {
          setDeliveryAddress(JSON.parse(savedAddress));
        } catch (e) {
          console.error('Failed to parse delivery address', e);
        }
      }
      
      if (savedQuote) {
        try {
          setDeliveryQuote(JSON.parse(savedQuote));
        } catch (e) {
          console.error('Failed to parse delivery quote', e);
        }
      }
    }
  }, []);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    void checkAuth();
  }, []);


  // Quotes must follow the currently selected schedule; ignore stale responses.
  useEffect(() => {
    quoteAbortRef.current?.abort();
    setDeliveryQuote(null);
    setLoadingQuote(false);
    setQuoteError(null);
    sessionStorage.removeItem('delivery_quote');
    if (orderType !== 'delivery' || !deliveryAddress || !storeHoursResult || storeHoursLoading) return;
    if ((!storeHoursResult.isOpenNow || pickupOption === 'scheduled') && (!scheduledPickupAt || !scheduledDeliveryAt)) return;
    void getDeliveryQuote();
    return () => quoteAbortRef.current?.abort();
  }, [orderType, deliveryAddress, storeHoursResult, storeHoursLoading, pickupOption, scheduledPickupAt, scheduledDeliveryAt]);

  // Load store hours when pickup is selected (for open/closed and pickup time slots)
  useEffect(() => {
    if (!orderType) return;
    let cancelled = false;
    setStoreHoursLoading(true);
    setStoreHoursError(null);
    const loadStoreHours = async () => {
      try {
        const supabase = getSupabaseClient();

        const [{ data: storeHoursRow, error: hoursError }, { data: defaultsRow, error: defaultsError }] = await Promise.all([
          supabase
            .from('settings')
            .select('value')
            .eq('key', 'store_hours')
            .maybeSingle(),
          supabase
            .from('settings')
            .select('value')
            .eq('key', 'defaults')
            .maybeSingle(),
        ]);

        if (hoursError || defaultsError) throw new Error('Unable to load store hours. Please reload and try again.');
        const storeHoursValue = storeHoursRow?.value as StoreHours | undefined;
        const defaults = (defaultsRow?.value as { store_open_time?: string; store_close_time?: string } | undefined) ?? {};

        const storeHours: StoreHours =
          storeHoursValue && typeof storeHoursValue === 'object'
            ? storeHoursValue
            : buildDefaultStoreHours(defaults.store_open_time ?? '10:00', defaults.store_close_time ?? '21:00');

        const isOpenNow = isStoreOpenNow(storeHours);

        const fromDate = new Date();
        const numDays = 7;
        const getSlots = orderType === 'delivery' ? getDeliveryTimeSlots : getPickupTimeSlots;
        const scheduleDayOptions = getSlots(storeHours, fromDate, {
          numDays,
          intervalMinutes: 15,
        }).map(day => ({ ...day, slots: day.slots.filter(slot => new Date(slot.value).getTime() > fromDate.getTime() + (orderType === 'delivery' ? 15 : 10) * 60000) }))
          .filter(day => day.slots.length > 0);

        if (!cancelled) {
          const result: StoreHoursForOrderResult = { storeHours, isOpenNow, scheduleDayOptions };
          setStoreHoursResult(result);
          const saved = getSessionSchedule(sessionStorage, orderType);
          const savedTime = orderType === 'delivery' ? saved.deliveryAt : saved.pickupAt;
          const savedDay = result.scheduleDayOptions.find(day => day.slots.some(slot => slot.value === savedTime));
          const pickupAt = savedDay ? saved.pickupAt : null;
          setPickupOption(!result.isOpenNow || saved.option === 'scheduled' ? 'scheduled' : 'asap');
          setScheduledPickupAt(pickupAt);
          setScheduledDeliveryAt(savedDay ? saved.deliveryAt : null);
          setSelectedPickupDate(savedDay?.date ?? result.scheduleDayOptions[0]?.date ?? null);
        }
      } catch (error) {
        console.error('Error loading store hours for order:', error);
        if (!cancelled) { setStoreHoursResult(null); setStoreHoursError('Unable to load store hours. Please reload and try again.'); }
      } finally {
        if (!cancelled) setStoreHoursLoading(false);
      }
    };

    void loadStoreHours();

    return () => { cancelled = true; };
  }, [orderType]);

  const getDeliveryQuote = async () => {
    if (!deliveryAddress || !storeHoursResult || storeHoursLoading) return;
    if ((!storeHoursResult.isOpenNow || pickupOption === 'scheduled') && (!scheduledPickupAt || !scheduledDeliveryAt)) return;

    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;
    const signal = controller.signal;
    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || '') + '/api/delivery/quote', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_address: {
            address_line1: process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || 'Shop 2/87 Unitt Street',
            city: process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
            state: process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
            postcode: process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
            country: 'AU',
            latitude: parseFloat(process.env.NEXT_PUBLIC_STORE_LATITUDE || '-37.678'),
            longitude: parseFloat(process.env.NEXT_PUBLIC_STORE_LONGITUDE || '144.579'),
          },
          dropoff_address: deliveryAddress,
          scheduled_pickup_at: pickupOption === 'scheduled' ? scheduledPickupAt : null,
          scheduled_delivery_at: pickupOption === 'scheduled' ? scheduledDeliveryAt : null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get delivery quote');
      }

      if (signal?.aborted) return;
      setDeliveryQuote(data.data);
      sessionStorage.setItem('delivery_quote', JSON.stringify(data.data));
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error getting delivery quote:', error);
      setQuoteError(error instanceof Error ? error.message : 'Failed to get delivery quote');
    } finally {
      if (!signal?.aborted) setLoadingQuote(false);
    }
  };


  const handleOrderTypeSelect = (type: OrderType) => {
    setSessionOrderType(sessionStorage, type);
    setOrderType(type);
    if (type === 'pickup') {
      setDeliveryAddress(null);
      setDeliveryQuote(null);
      setQuoteError(null);
    }
  };

  const handleAddressSelect = (address: DeliveryAddressInput) => {
    setDeliveryAddress(address);
    setDeliveryQuote(null); // Reset quote to get new one
    setQuoteError(null);
    setIsChangingAddress(false);
    sessionStorage.setItem('delivery_address', JSON.stringify(address));
    sessionStorage.setItem('deliveryAddress', JSON.stringify(address));
    sessionStorage.removeItem('delivery_quote');
  };

  const handleProceedToCheckout = () => {
    if (freeItemSelectionRequired) {
      setShowFreeItemReminder(true);
      return;
    }

    // Store order type and delivery info in sessionStorage to pass to checkout
    if (orderType === 'delivery' && deliveryAddress && deliveryQuote) {
      setSessionOrderType(sessionStorage, 'delivery');
      sessionStorage.setItem('deliveryAddress', JSON.stringify(deliveryAddress));
      sessionStorage.setItem('deliveryQuote', JSON.stringify(deliveryQuote));
      sessionStorage.setItem('pickupOption', pickupOption);
      if (pickupOption === 'scheduled' && scheduledPickupAt && scheduledDeliveryAt) {
        sessionStorage.setItem('scheduledPickupAt', scheduledPickupAt);
        sessionStorage.setItem('scheduledDeliveryAt', scheduledDeliveryAt);
      } else {
        sessionStorage.removeItem('scheduledPickupAt');
        sessionStorage.removeItem('scheduledDeliveryAt');
      }
    } else if (orderType === 'pickup') {
      setSessionOrderType(sessionStorage, 'pickup');
      sessionStorage.removeItem('scheduledDeliveryAt');
      sessionStorage.removeItem('deliveryAddress');
      sessionStorage.removeItem('deliveryQuote');
      sessionStorage.setItem('pickupOption', pickupOption);
      if (pickupOption === 'scheduled' && scheduledPickupAt) {
        sessionStorage.setItem('scheduledPickupAt', scheduledPickupAt);
      } else {
        sessionStorage.removeItem('scheduledPickupAt');
      }
    }

    router.push('/order/checkout');
  };


  const pickupRequiresTime = storeHoursResult && (!storeHoursResult.isOpenNow || pickupOption === 'scheduled');
  const canProceedPickup = !!storeHoursResult && !storeHoursLoading && (!pickupRequiresTime || (!!scheduledPickupAt && new Date(scheduledPickupAt).getTime() > Date.now() && (orderType !== 'delivery' || !!scheduledDeliveryAt)));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading cart...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Icon icon={FaShoppingCart} className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add some items to your cart to continue
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      {/* Live Order Tracker at the very top */}
      <LiveOrderTracker userId={userId} />



      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            href="/order"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <Icon icon={FaArrowLeft} className="w-4 h-4" />
            Back to Menu
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Icon icon={FaShoppingCart} className="text-blue-600" />
            Order Summary
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Order Type Selection */}
            {!orderType && (
              <div id="order-type-selector">
                <OrderTypeSelector
                  onSelect={handleOrderTypeSelect}
                  selectedType={orderType}
                  enableDelivery={enableDelivery}
                />
              </div>
            )}

            {/* Delivery Address Section */}
            {orderType === 'delivery' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon icon={FaTruck} className="w-5 h-5 text-green-600" />
                    Delivery Address
                  </h2>
                  {deliveryAddress && !isChangingAddress && (
                    <button
                      onClick={() => setIsChangingAddress(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Change
                    </button>
                  )}
                </div>

                {(!deliveryAddress || isChangingAddress) ? (
                  <div className="animate-in fade-in duration-300">
                    <DeliveryAddressForm
                      onAddressSelect={handleAddressSelect}
                      allowSave={isAuthenticated}
                      isAuthenticated={isAuthenticated}
                      initialAddress={deliveryAddress}
                    />
                    {deliveryAddress && (
                      <button
                        onClick={() => setIsChangingAddress(false)}
                        className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-neutral-900/50 rounded-xl border border-gray-100 dark:border-neutral-700 flex items-start gap-3">
                    <Icon icon={FaMapMarkerAlt} className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{deliveryAddress.address_line1}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.postcode}
                      </p>
                    </div>
                  </div>
                )}

                {loadingQuote && <p className="mt-4 text-sm" role="status">Checking delivery availability for your selected time…</p>}
                {quoteError && (
                  <div className="mt-4 text-sm text-red-600" role="alert">
                    <p>{quoteError}</p>
                    <button onClick={() => void getDeliveryQuote()} className="mt-2 underline">Retry delivery quote</button>
                  </div>
                )}
                {deliveryQuote && !loadingQuote && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Icon icon={FaTruck} className="w-4 h-4 text-green-600" />
                          Delivery Quote
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Usual delivery time: {deliveryQuote.estimated_duration_minutes} mins or earlier
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          ${deliveryQuote.fee.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 uppercase">
                          {deliveryQuote.distance_km} km
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void getDeliveryQuote()}
                      className="mt-3 text-xs text-green-600 dark:text-green-400 hover:underline"
                    >
                      Refresh quote
                    </button>
                  </div>
                )}

                {/* Change order type */}
                <button
                  onClick={() => {
                    setOrderType(null);
                    setDeliveryAddress(null);
                    setDeliveryQuote(null);
                    setQuoteError(null);
                  }}
                  className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Change to pickup order
                </button>
              </div>
            )}


            {/* Pickup: store hours and pickup time */}
            {orderType && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Icon icon={FaCheck} className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {orderType === 'delivery' ? 'Delivery schedule' : 'Pickup Order'}
                  </h2>
                </div>
                {storeHoursError && <p role="alert" className="text-sm text-red-600">{storeHoursError}</p>}
                {storeHoursLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-2">
                    <Icon icon={FaSpinner} className="w-4 h-4 animate-spin" />
                    Loading store hours…
                  </div>
                )}
                {!storeHoursLoading && storeHoursResult && (
                  <>
                    {storeHoursResult.isOpenNow ? (
                      <p className="text-sm text-green-600 dark:text-green-400 mb-4">
                        Store is open now. Order as soon as ready or choose a time.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                        Store is currently closed. Please choose a future {orderType === 'delivery' ? 'delivery time' : 'pickup time'} to pre-order.
                      </p>
                    )}
                    <OrderScheduleSelector
                      orderType={orderType}
                      isOpen={storeHoursResult.isOpenNow}
                      option={pickupOption}
                      days={storeHoursResult.scheduleDayOptions}
                      selectedDate={selectedPickupDate}
                      selectedTime={orderType === 'delivery' ? scheduledDeliveryAt : scheduledPickupAt}
                      onOptionChange={option => {
                        setPickupOption(option);
                        setScheduledPickupAt(null);
                        setScheduledDeliveryAt(null);
                        setSelectedPickupDate(option === 'scheduled' ? storeHoursResult.scheduleDayOptions[0]?.date ?? null : null);
                      }}
                      onDateChange={date => {
                        setSelectedPickupDate(date);
                        setScheduledPickupAt(null);
                        setScheduledDeliveryAt(null);
                      }}
                      onTimeChange={time => {
                        if (orderType === 'delivery') setScheduledDeliveryAt(time);
                        else setScheduledPickupAt(time);
                      }}
                    />
                    <button
                      onClick={() => setOrderType(null)}
                      className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Change order type
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700 last:border-0 last:pb-0"
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {getCartItemDisplayName(item)}
                          </h3>
                          {selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id && (
                            <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <Icon icon={FaGift} className="w-3 h-3" />
                              Free
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Icon icon={FaMinus} className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-medium text-gray-900 dark:text-white w-6 text-center tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Icon icon={FaPlus} className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => setItemToEdit(item)}
                              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                              aria-label="Edit item"
                            >
                              <Icon icon={FaEdit} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setItemToRemove(item.id)}
                              className="p-1.5 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              aria-label="Remove item"
                            >
                              <Icon icon={FaTrash} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          {selectedFreeItemId === item.id && freeItemPromotion?.item.id === item.id ? (
                            <>
                              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">Free</div>
                              <div className="text-xs text-gray-500 line-through dark:text-gray-400">${item.subtotal.toFixed(2)}</div>
                            </>
                          ) : (
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                              ${item.subtotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add-ons */}
                      {item.addon_groups.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.addon_groups.map(group => (
                            group.selected_items.length > 0 && (
                              <div key={group.id} className="text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {group.name}:
                                </span>{' '}
                                <span className="text-gray-600 dark:text-gray-400">
                                  {group.selected_items.map(addon => addon.name).join(', ')}
                                </span>
                                {group.selected_items.some(addon => addon.extra_price > 0) && (
                                  <span className="text-gray-500 dark:text-gray-500 ml-2">
                                    (+${group.selected_items.reduce((sum, addon) => sum + addon.extra_price, 0).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {item.removed_ingredients.length > 0 && (
                        <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                          <span className="font-medium">Removed:</span> {item.removed_ingredients.join(', ')}
                        </div>
                      )}

                      {/* Comment */}
                      {editingCommentItemId === item.id ? (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Special Instructions
                          </label>
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={2}
                            maxLength={500}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                            placeholder="Add special instructions..."
                            autoFocus
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => {
                                updateItem(item.id, { comment: commentText.trim() || null });
                                setEditingCommentItemId(null);
                                setCommentText('');
                              }}
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingCommentItemId(null);
                                setCommentText('');
                              }}
                              className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {item.comment ? (
                            <div className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-neutral-700 rounded-lg">
                              <Icon icon={FaComment} className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.comment}</p>
                              <button
                                onClick={() => {
                                  setEditingCommentItemId(item.id);
                                  setCommentText(item.comment || '');
                                }}
                                className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-neutral-600 transition-colors"
                                aria-label="Edit comment"
                              >
                                <Icon icon={FaEdit} className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCommentItemId(item.id);
                                setCommentText('');
                              }}
                              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2"
                            >
                              <Icon icon={FaComment} className="w-4 h-4" />
                              Add special instructions
                            </button>
                          )}
                        </div>
                      )}

                      {/* Price Breakdown */}
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        ${item.base_price.toFixed(2)} × {item.quantity}
                        {item.addon_groups.reduce((sum, group) =>
                          sum + group.selected_items.reduce((itemSum, addon) => itemSum + addon.extra_price, 0), 0
                        ) > 0 && (
                            <span>
                              {' '}+ ${item.addon_groups.reduce((sum, group) =>
                                sum + group.selected_items.reduce((itemSum, addon) => itemSum + addon.extra_price, 0), 0
                              ).toFixed(2)} (add-ons)
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Order Summary
              </h2>

              {highlightedFreeItemPromotion && (
                <div className={`mb-6 rounded-2xl border p-5 ${freeItemSelectionRequired ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${freeItemSelectionRequired ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                      <Icon icon={FaGift} className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${freeItemSelectionRequired ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
                        Congratulations, you&apos;ve unlocked{' '}
                        <Link href="/promotions" className="underline decoration-current underline-offset-2">
                          {getPromotionDisplayTitle(highlightedFreeItemPromotion)}
                        </Link>
                        .
                      </p>
                      {freeItemPromotion ? (
                        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                          Selected: <span className="text-emerald-700 dark:text-emerald-300">{freeItemPromotion.item.name}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {eligibleFreeItemProducts.length > 0 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setFreeItemPickerOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Icon icon={FaGift} className="w-4 h-4" />
                        {freeItemPromotion ? 'Change free item' : 'Select free item'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                {promotionDiscount > 0.009 && (
                  <>
                    <div className="flex justify-between text-green-700 dark:text-green-300">
                      <span>Promotions</span>
                      <span>-${promotionDiscount.toFixed(2)}</span>
                    </div>
                    {promotionsApplied.length > 0 && (
                      <div className="rounded-lg border border-green-100 bg-green-50/70 px-3 py-2 text-sm dark:border-green-900/50 dark:bg-green-900/10">
                        <div className="space-y-1">
                          {promotionsApplied.map((promotion, index) => (
                            <div key={`${promotion.title}-${index}`} className="flex justify-between gap-3 text-green-800 dark:text-green-300">
                              <span>
                                {promotion.kind === 'free_item' ? 'Discount' : promotion.title}
                              </span>
                              <span>-${promotion.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${subtotalExGst.toFixed(2)}</span>
                </div>
                {orderType === 'delivery' && deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-2">
                      <Icon icon={FaTruck} className="w-4 h-4" />
                      Delivery Fee
                    </span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {orderType === 'delivery' && deliveryQuote && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 pl-6">
                    Usually {deliveryQuote.estimated_duration_minutes} min or earlier
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Service Fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>GST (10%)</span>
                  <span>${gstAmount.toFixed(2)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {!orderType ? (
                  <>
                    <button
                      type="button"
                      onClick={() => document.getElementById('order-type-selector')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="block w-full border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Icon icon={FaShoppingCart} className="w-4 h-4" />
                      Choose order type
                    </button>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      Pickup or delivery to continue
                    </p>
                  </>
                ) : (
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={
                      (orderType === 'delivery' && (!deliveryAddress || !deliveryQuote)) ||
                      !canProceedPickup
                    }
                    className="block w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon icon={FaDollarSign} className="w-4 h-4" />
                    {orderType === 'delivery' && (!deliveryAddress || !deliveryQuote)
                      ? 'Complete Delivery Info'
                      : !canProceedPickup
                        ? (orderType === 'delivery' ? 'Select Delivery Time' : 'Select Pickup Time')
                        : 'Continue Checkout'}
                  </button>
                )}
                <Link
                  href="/order"
                  className="block w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors text-sm"
                >
                  Continue Shopping
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
                <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <Icon icon={FaCheck} className="w-4 h-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Secure Checkout</p>
                    <p className="text-xs">We use Stripe for payments. We never see or store your card details—payment is secure and encrypted by Stripe.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {itemToEdit && (
        <ItemCustomizationModal
          isOpen={!!itemToEdit}
          onClose={() => setItemToEdit(null)}
          product={{
            id: itemToEdit.product_id,
            name: itemToEdit.name,
            description: itemToEdit.description,
            sale_price: itemToEdit.base_price,
            image_url: itemToEdit.image_url,
          }}
          onAddToCart={() => { }}
          existingCartItem={itemToEdit}
          onUpdateCartItem={(cartItemId, addonGroups, comment, removedIngredients, quantity) => {
            updateItem(cartItemId, {
              addon_groups: addonGroups,
              comment: comment || null,
              removed_ingredients: removedIngredients,
              quantity,
            });
            setItemToEdit(null);
            toast.success('Cart item updated successfully');
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={itemToRemove !== null}
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove) {
            removeItem(itemToRemove);
            setItemToRemove(null);
          }
        }}
        title="Remove Item"
        message={`Are you sure you want to remove "${items.find((i) => i.id === itemToRemove)?.name ?? 'this item'}" from your cart?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="warning"
      />

      <ConfirmationDialog
        isOpen={showFreeItemReminder}
        onClose={() => setShowFreeItemReminder(false)}
        onConfirm={() => {
          setShowFreeItemReminder(false);
          setFreeItemPickerOpen(true);
        }}
        title="Free Item Available"
        message="You’ve unlocked a free item with this order. Do you want to pick it now before continuing to checkout?"
        confirmText="Select free item"
        cancelText="Continue anyway"
        variant="info"
      />

      {freeItemPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-neutral-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add free item</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Choose an eligible item and we&apos;ll add it to your cart.</p>
              </div>
              <button
                type="button"
                onClick={() => setFreeItemPickerOpen(false)}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                aria-label="Close free item picker"
              >
                <Icon icon={FaTimes} className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {eligibleFreeItemProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddFreeItem(product)}
                    className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:border-emerald-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-emerald-700"
                  >
                    <div className="flex gap-4 p-4">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-20 w-20 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Icon icon={FaGift} className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{product.name}</div>
                            {product.section ? (
                              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">{product.section}</div>
                            ) : null}
                          </div>
                          <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            ${product.sale_price.toFixed(2)}
                          </div>
                        </div>
                        {product.description ? (
                          <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Add this item and we&apos;ll mark it as your free selection.</p>
                        )}
                        <div className="mt-3 text-sm font-medium text-emerald-700 transition group-hover:translate-x-1 dark:text-emerald-300">
                          Add to cart as free item →
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
