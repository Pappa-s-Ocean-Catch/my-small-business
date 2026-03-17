'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { CartItem } from '@/contexts/CartContext';
import { OrderHeader } from '@/components/OrderHeader';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { OrderTypeSelector, type OrderType } from '@/components/OrderTypeSelector';
import { DeliveryAddressForm, type DeliveryAddressInput } from '@/components/DeliveryAddressForm';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getActivePromotions } from '@/app/actions/promotions';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { FaShoppingCart, FaArrowLeft, FaCheck, FaDollarSign, FaEdit, FaComment, FaTruck, FaClock, FaSpinner, FaTrash, FaMinus, FaPlus } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { computeCartPromotionTotals, type PromotionWithProducts } from '@/lib/promotions';
import type { StoreHours } from '@my-small-business/types';
import { buildDefaultStoreHours, getPickupTimeSlots, isStoreOpenNow, type PickupDayOption } from '@/lib/store-hours';

type StoreHoursForOrderResult = {
  storeHours: StoreHours;
  isOpenNow: boolean;
  pickupDayOptions: PickupDayOption[];
};

export default function OrderSummaryPage() {
  const { items, getTotal, clearCart, isLoading, updateItem, removeItem, updateQuantity } = useCart();
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
  const [deliveryQuote, setDeliveryQuote] = useState<{
    quote_id: string;
    fee: number;
    currency: string;
    expires_at: string;
    estimated_duration_minutes: number;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Pickup time: when store is open user can choose "asap" or "scheduled"; when closed, must choose scheduled (pre-order)
  const [storeHoursLoading, setStoreHoursLoading] = useState(false);
  const [storeHoursResult, setStoreHoursResult] = useState<StoreHoursForOrderResult | null>(null);
  const [pickupOption, setPickupOption] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string | null>(null);
  const [selectedPickupDate, setSelectedPickupDate] = useState<string | null>(null);

  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);

  useEffect(() => {
    const loadPromotions = async () => {
      const res = await getActivePromotions();
      if (res.data) setActivePromotions(res.data);
    };
    void loadPromotions();
  }, []);

  const cartSubtotal = getTotal();
  const promoTotals = computeCartPromotionTotals({
    promotions: activePromotions,
    items: items.map((i) => ({
      product_id: i.product_id,
      base_price: i.base_price,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
    cartSubtotal,
  });

  const subtotal = promoTotals.subtotalAfterPromotions;
  const promotionDiscount = promoTotals.totalDiscount;
  const deliveryFee = deliveryQuote?.fee || 0;
  const serviceFee = 0;
  const tax = 0;
  const total = subtotal + deliveryFee + serviceFee + tax;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalExGst = total / 1.1;
  const gstAmount = total - subtotalExGst;

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    void checkAuth();
  }, []);

  // Get delivery quote when address is provided
  useEffect(() => {
    if (orderType === 'delivery' && deliveryAddress && !deliveryQuote) {
      getDeliveryQuote();
    }
  }, [orderType, deliveryAddress]);

  // Load store hours when pickup is selected (for open/closed and pickup time slots)
  useEffect(() => {
    if (orderType !== 'pickup') return;
    let cancelled = false;
    setStoreHoursLoading(true);
    const loadStoreHours = async () => {
      try {
        const supabase = getSupabaseClient();

        const [{ data: storeHoursRow }, { data: defaultsRow }] = await Promise.all([
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

        const storeHoursValue = storeHoursRow?.value as StoreHours | undefined;
        const defaults = (defaultsRow?.value as { store_open_time?: string; store_close_time?: string } | undefined) ?? {};

        const storeHours: StoreHours =
          storeHoursValue && typeof storeHoursValue === 'object'
            ? storeHoursValue
            : buildDefaultStoreHours(defaults.store_open_time ?? '10:00', defaults.store_close_time ?? '21:00');

        const isOpenNow = isStoreOpenNow(storeHours);

        // When store is open: allow scheduled pickup for today + tomorrow.
        // When store is closed: pre-order only for the next day.
        const now = new Date();
        const fromDate = new Date(now);
        let numDays = 2;
        if (!isOpenNow) {
          fromDate.setDate(fromDate.getDate() + 1);
          numDays = 1;
        }

        const pickupDayOptions = getPickupTimeSlots(storeHours, fromDate, {
          numDays,
          intervalMinutes: 15,
        });

        if (!cancelled) {
          const result: StoreHoursForOrderResult = { storeHours, isOpenNow, pickupDayOptions };
          setStoreHoursResult(result);
          if (!result.isOpenNow) {
            setPickupOption('scheduled');
            const firstOption = result.pickupDayOptions[0]?.slots[0]?.value ?? null;
            setScheduledPickupAt(firstOption);
            setSelectedPickupDate(result.pickupDayOptions[0]?.date ?? null);
          } else {
            setScheduledPickupAt(null);
            setSelectedPickupDate(null);
          }
        }
      } catch (error) {
        console.error('Error loading store hours for order:', error);
      } finally {
        if (!cancelled) setStoreHoursLoading(false);
      }
    };

    void loadStoreHours();

    return () => { cancelled = true; };
  }, [orderType]);

  const getDeliveryQuote = async () => {
    if (!deliveryAddress) return;

    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const response = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_address: {
            address_line1: process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || '123 Main Street',
            city: process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
            state: process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
            postcode: process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
            country: 'AU',
          },
          dropoff_address: deliveryAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get delivery quote');
      }

      setDeliveryQuote(data.data);
    } catch (error) {
      console.error('Error getting delivery quote:', error);
      setQuoteError(error instanceof Error ? error.message : 'Failed to get delivery quote');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleOrderTypeSelect = (type: OrderType) => {
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
  };

  const handleProceedToCheckout = () => {
    // Store order type and delivery info in sessionStorage to pass to checkout
    if (orderType === 'delivery' && deliveryAddress && deliveryQuote) {
      sessionStorage.setItem('orderType', 'delivery');
      sessionStorage.setItem('deliveryAddress', JSON.stringify(deliveryAddress));
      sessionStorage.setItem('deliveryQuote', JSON.stringify(deliveryQuote));
      sessionStorage.removeItem('scheduledPickupAt');
    } else if (orderType === 'pickup') {
      sessionStorage.setItem('orderType', 'pickup');
      sessionStorage.removeItem('deliveryAddress');
      sessionStorage.removeItem('deliveryQuote');
      if (pickupOption === 'scheduled' && scheduledPickupAt) {
        sessionStorage.setItem('scheduledPickupAt', scheduledPickupAt);
      } else {
        sessionStorage.removeItem('scheduledPickupAt');
      }
    }

    router.push('/order/checkout');
  };

  const pickupRequiresTime = storeHoursResult && !storeHoursResult.isOpenNow;
  const canProceedPickup = orderType !== 'pickup' || !pickupRequiresTime || !!scheduledPickupAt;

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
      {/* Navigation Header */}
      <OrderHeader />

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

            {/* Delivery Address Form */}
            {orderType === 'delivery' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Icon icon={FaTruck} className="w-5 h-5 text-green-600" />
                  Delivery Address
                </h2>
                <DeliveryAddressForm
                  onAddressSelect={handleAddressSelect}
                  allowSave={isAuthenticated}
                  isAuthenticated={isAuthenticated}
                />

                {/* Delivery Quote Display */}
                {loadingQuote && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-3">
                    <Icon icon={FaSpinner} className="w-5 h-5 text-blue-600 animate-spin" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">Getting delivery quote...</span>
                  </div>
                )}

                {quoteError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{quoteError}</p>
                    <button
                      onClick={getDeliveryQuote}
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Try again
                    </button>
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
                          Estimated delivery time
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          ${deliveryQuote.fee.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {deliveryQuote.currency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                      <Icon icon={FaClock} className="w-4 h-4 text-green-600" />
                      <span>Estimated delivery: {deliveryQuote.estimated_duration_minutes} minutes</span>
                    </div>
                    <button
                      onClick={() => {
                        setDeliveryQuote(null);
                        getDeliveryQuote();
                      }}
                      className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
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
            {orderType === 'pickup' && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Icon icon={FaCheck} className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Pickup Order
                  </h2>
                </div>
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
                        Store is open now. You can pick up as soon as ready or choose a time.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                        Store is currently closed. This is a pre-order – please choose when you’d like to pick up.
                      </p>
                    )}
                    <div className="space-y-3 mb-4">
                      {storeHoursResult.isOpenNow && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="pickupOption"
                            className="w-4 h-4 text-blue-600"
                            checked={pickupOption === 'asap'}
                            onChange={() => {
                              setPickupOption('asap');
                              setScheduledPickupAt(null);
                              setSelectedPickupDate(null);
                            }}
                          />
                          <span className="text-sm text-gray-900 dark:text-white">As soon as ready</span>
                        </label>
                      )}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="pickupOption"
                          className="w-4 h-4 text-blue-600"
                          checked={pickupOption === 'scheduled'}
                          onChange={() => {
                            setPickupOption('scheduled');
                              const firstDay = storeHoursResult.pickupDayOptions[0];
                              const first = firstDay?.slots[0]?.value ?? null;
                              setSelectedPickupDate(firstDay?.date ?? selectedPickupDate);
                              setScheduledPickupAt(first ?? scheduledPickupAt);
                          }}
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {storeHoursResult.isOpenNow ? 'Choose a pickup time' : 'Pickup date & time (required)'}
                        </span>
                      </label>
                    </div>
                    {pickupOption === 'scheduled' && storeHoursResult.pickupDayOptions.length > 0 && (
                      <div className="grid gap-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pickup date &amp; time
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                          {/* Date picker (select) */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Date</span>
                            <select
                              className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                              value={selectedPickupDate ?? storeHoursResult.pickupDayOptions[0]?.date ?? ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setSelectedPickupDate(newDate);
                                const day = storeHoursResult.pickupDayOptions.find((d) => d.date === newDate);
                                const firstSlot = day?.slots[0];
                                if (firstSlot) {
                                  setScheduledPickupAt(firstSlot.value);
                                }
                              }}
                            >
                              {storeHoursResult.pickupDayOptions.map((day) => (
                                <option key={day.date} value={day.date}>
                                  {day.dateLabel}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Time picker (select) */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Time</span>
                            {(() => {
                              const currentDate =
                                selectedPickupDate ?? storeHoursResult.pickupDayOptions[0]?.date ?? null;
                              const day =
                                storeHoursResult.pickupDayOptions.find((d) => d.date === currentDate) ??
                                storeHoursResult.pickupDayOptions[0];
                              const slots = day?.slots ?? [];
                              const currentValue =
                                scheduledPickupAt && slots.some((s) => s.value === scheduledPickupAt)
                                  ? scheduledPickupAt
                                  : slots[0]?.value ?? '';
                              if (!scheduledPickupAt && slots[0]) {
                                // Ensure we always have a value when there are slots
                                setScheduledPickupAt(slots[0].value);
                              }
                              return (
                                <select
                                  className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                                  value={currentValue}
                                  onChange={(e) => setScheduledPickupAt(e.target.value)}
                                >
                                  {slots.map((slot) => (
                                    <option key={slot.value} value={slot.value}>
                                      {slot.label}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setOrderType(null)}
                      className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Change to delivery order
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
                            {item.name}
                          </h3>
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
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          ${item.subtotal.toFixed(2)}
                        </span>
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

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                {promotionDiscount > 0.009 && (
                  <div className="flex justify-between text-green-700 dark:text-green-300">
                    <span>Promotions</span>
                    <span>-${promotionDiscount.toFixed(2)}</span>
                  </div>
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
                    Estimated {deliveryQuote.estimated_duration_minutes} min delivery
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
                      (orderType === 'pickup' && !canProceedPickup)
                    }
                    className="block w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon icon={FaDollarSign} className="w-4 h-4" />
                    {orderType === 'delivery' && (!deliveryAddress || !deliveryQuote)
                      ? 'Complete Delivery Info'
                      : orderType === 'pickup' && !canProceedPickup
                        ? 'Select Pickup Time'
                        : 'Checkout'}
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
          onAddToCart={() => {}}
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
    </div>
  );
}
