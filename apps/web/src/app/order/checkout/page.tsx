'use client';

import { useState, useEffect, useRef } from 'react';
// Utility to compare two arrays of items for equality (ignoring order)
function areItemsEqual(
  cartItems: Array<{ product_id?: string; id?: string; quantity: number }>,
  orderItems: Array<{ product_id?: string; id?: string; quantity: number }>
) {
  if (cartItems.length !== orderItems.length) return false;
  // Compare by product_id, quantity, and add-ons (if needed)
  const normalize = (items: Array<{ product_id?: string; id?: string; quantity: number }>) =>
    items
      .map((item: { product_id?: string; id?: string; quantity: number }) => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity,
        // Optionally add more fields for stricter match
      }))
      .sort((a, b) => (a.product_id ?? '').localeCompare(b.product_id ?? ''));
  const a = normalize(cartItems);
  const b = normalize(orderItems);
  return JSON.stringify(a) === JSON.stringify(b);
}

import { LiveOrderTracker } from '@/components/LiveOrderTracker';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { OrderHeader } from '@/components/OrderHeader';
import { createOrder, type OrderInput } from '@/app/actions/orders';
import type { Order, OrderItem } from '@my-small-business/types/order';
import { signUpCustomer } from '@/app/actions/customer-auth';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getActivePromotions } from '@/app/actions/promotions';
import { getUserRewardPoints, useRewardPoints as useRewardPointsAction, getRewardPointsSettings } from '@/app/actions/reward-points';
import { FaShoppingCart, FaArrowLeft, FaCreditCard, FaStore, FaUser, FaLock, FaCheckCircle, FaExclamationCircle, FaGift, FaChevronDown, FaChevronUp, FaExclamationTriangle } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/Loading';
import { computeCartPromotionTotals, type PromotionWithProducts } from '@/lib/promotions';
import posthog from 'posthog-js';
type PaymentMethod = 'online' | 'store';

export default function CheckoutPage() {
  // Duplicate order detection state
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOrder, setDuplicateOrder] = useState<Order | null>(null);
  const allowSubmitRef = useRef(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
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
  // Fetch live orders for duplicate detection
  useEffect(() => {
    if (!userId) return;
    const fetchLiveOrders = async () => {
      try {
        const supabase = getSupabaseClient();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*, order_item_addons(*))')
          .eq('user_id', userId)
          .in('order_status', ['pending', 'confirmed', 'preparing', 'ready'])
          .gte('created_at', since)
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          // Map embedded order_items to items array for comparison
          const mapped: Order[] = data.map((row: any) => {
            const items: OrderItem[] = (row.order_items || []).map((item: any) => ({
              ...item,
              base_price: Number(item.base_price),
              subtotal: Number(item.subtotal),
              removed_ingredients: (item.removed_ingredients || []),
              addons: (item.order_item_addons || undefined) ?? undefined,
            }));
            return { ...row, items } as Order;
          });
          setLiveOrders(mapped);
        }
      } catch (err) {
        // Ignore fetch errors for duplicate check
      }
    };
    fetchLiveOrders();
  }, [userId]);
  const { items, getTotal, clearCart, isLoading: cartLoading } = useCart();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Anonymous checkout fields (for pay online)
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Customer login/signup fields (for pay at store)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; full_name?: string; phone?: string } | null>(null);
  const [isLoggedInNonCustomer, setIsLoggedInNonCustomer] = useState(false);

  // Order type and delivery state (from summary page)
  const [orderType, setOrderType] = useState<'pickup' | 'delivery' | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<any>(null);
  const [deliveryAddressEditable, setDeliveryAddressEditable] = useState(false);
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string | null>(null);

  // Reward points state
  const [userRewardPoints, setUserRewardPoints] = useState<{ current_balance: number } | null>(null);
  const [rewardPointsSettings, setRewardPointsSettings] = useState({ dollars_per_point: 0.001, enabled: true });
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [rewardPointsToUse, setRewardPointsToUse] = useState(0);
  const [loadingRewardPoints, setLoadingRewardPoints] = useState(false);
  const [showRewardPointsSection, setShowRewardPointsSection] = useState(false);

  const cartSubtotal = getTotal();
  const tax = 0; // Placeholder
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { flags: flagsFromHook, isLoading: featureFlagsLoading } = useFeatureFlag();
  const featureFlagsLoaded = !featureFlagsLoading;
  const featureFlags = flagsFromHook
    ? { enable_online_payment: flagsFromHook.enable_online_payment, enable_instore_payment: flagsFromHook.enable_instore_payment }
    : { enable_online_payment: false, enable_instore_payment: false };

  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);

  // Restore last used phone number from localStorage so customers don't need
  // to re-enter it every visit, even if their profile phone is empty.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (customerPhone) return;
    try {
      const stored = window.localStorage.getItem('checkout:lastCustomerPhone');
      if (stored) {
        setCustomerPhone(stored);
      }
    } catch (err) {
      console.error('[Checkout] Failed to read stored phone from localStorage:', err);
    }
  }, [customerPhone]);

  useEffect(() => {
    const loadPromotions = async () => {
      const res = await getActivePromotions();
      if (res.data) setActivePromotions(res.data);
    };
    void loadPromotions();
  }, []);

  // Calculate promotions + reward points discount
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
  const promotionsApplied = promoTotals.applied;

  const rawRewardPointsDiscount = useRewardPoints && rewardPointsToUse > 0
    ? rewardPointsToUse * rewardPointsSettings.dollars_per_point
    : 0;

  // Reward points should never exceed the (items + tax + delivery) amount.
  const rewardPointsDiscount = Math.min(rawRewardPointsDiscount, Math.max(0, subtotal + tax + deliveryFee));

  // Eligible amount for earning points: food subtotal (after promotions) minus any part paid with points
  const eligibleAmountForPoints = Math.max(0, subtotal - rewardPointsDiscount);
  const estimatedPointsEarned = rewardPointsSettings.enabled
    ? Math.floor(eligibleAmountForPoints * (rewardPointsSettings as { points_per_dollar?: number }).points_per_dollar!)
    : 0;
  const estimatedPointsValue = estimatedPointsEarned * rewardPointsSettings.dollars_per_point;

  const total = subtotal + tax + deliveryFee + serviceFee - rewardPointsDiscount;

  // Keep service fee derived from current payable amount (online only)
  useEffect(() => {
    if (paymentMethod !== 'online') {
      setServiceFee(0);
      return;
    }

    const baseAmount = Math.max(0, subtotal + tax + deliveryFee - rewardPointsDiscount);
    const calculatedServiceFee = baseAmount * 0.0175 + 0.3; // Stripe fees
    setServiceFee(calculatedServiceFee);
  }, [paymentMethod, subtotal, tax, deliveryFee, rewardPointsDiscount]);

  // Load order type and delivery info from sessionStorage
  useEffect(() => {
    const storedOrderType = sessionStorage.getItem('orderType') as 'pickup' | 'delivery' | null;
    const storedDeliveryAddress = sessionStorage.getItem('deliveryAddress');
    const storedDeliveryQuote = sessionStorage.getItem('deliveryQuote');
    const storedScheduledPickupAt = sessionStorage.getItem('scheduledPickupAt');

    if (storedOrderType) {
      setOrderType(storedOrderType);
    }

    if (storedDeliveryAddress) {
      try {
        setDeliveryAddress(JSON.parse(storedDeliveryAddress));
      } catch (e) {
        console.error('Error parsing delivery address:', e);
      }
    }

    if (storedDeliveryQuote) {
      try {
        const quote = JSON.parse(storedDeliveryQuote);
        setDeliveryQuote(quote);
        setDeliveryFee(quote.fee || 0);
      } catch (e) {
        console.error('Error parsing delivery quote:', e);
      }
    }

    if (storedScheduledPickupAt) {
      setScheduledPickupAt(storedScheduledPickupAt);
    }
  }, []);

  // Load reward points if user is authenticated
  useEffect(() => {
    const loadRewardPoints = async () => {
      if (!isAuthenticated || !currentUser) return;

      try {
        setLoadingRewardPoints(true);
        const [pointsResult, settingsResult] = await Promise.all([
          getUserRewardPoints(),
          getRewardPointsSettings(),
        ]);

        if (pointsResult.data) {
          setUserRewardPoints(pointsResult.data);
        }

        if (settingsResult) {
          setRewardPointsSettings(settingsResult);
        }
      } catch (error) {
        console.error('Error loading reward points:', error);
      } finally {
        setLoadingRewardPoints(false);
      }
    };

    if (isAuthenticated && currentUser) {
      void loadRewardPoints();
    }
  }, [isAuthenticated, currentUser]);

  // Calculate max points that can be used
  const maxPointsToUse = userRewardPoints?.current_balance || 0;
  const maxDollarDiscount = maxPointsToUse * rewardPointsSettings.dollars_per_point;
  const maxPointsForOrder = Math.min(maxPointsToUse, Math.floor(Math.max(0, total) / rewardPointsSettings.dollars_per_point));

  // Auto-suggest using reward points if available
  useEffect(() => {
    if (userRewardPoints && userRewardPoints.current_balance > 0 && !useRewardPoints && rewardPointsSettings.enabled) {
      // Suggest using points if balance is significant
      const suggestedDiscount = Math.min(maxDollarDiscount, total * 0.5); // Suggest up to 50% of order
      if (suggestedDiscount >= 1) { // Only suggest if discount is at least $1
        setUseRewardPoints(true);
        setRewardPointsToUse(Math.min(maxPointsToUse, Math.floor(suggestedDiscount / rewardPointsSettings.dollars_per_point)));
      }
    }
  }, [userRewardPoints, total, rewardPointsSettings.enabled]);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();

        // First check if there's a session to avoid AuthSessionMissingError
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          return;
        }

        if (!session?.user) {
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          // If it's a session missing error, that's fine - user is not logged in
          if (userError.message?.includes('session') || userError.message?.includes('AuthSessionMissing')) {
            return;
          }
          console.error('[Checkout] Error getting user:', userError);
          return;
        }

        if (user) {

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, phone, role_slug')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('[Checkout] Error getting profile:', profileError);
            return;
          }

          if (profile) {


            // For "Pay at Store", only customer role is allowed
            // For "Pay Online", any logged-in user can use their info
            if (profile.role_slug === 'customer') {
              setIsAuthenticated(true);
              setCurrentUser({
                id: profile.id,
                email: profile.email || '',
                full_name: profile.full_name || undefined,
                phone: profile.phone || undefined
              });
            } else {
              // User is logged in but not a customer
              setIsLoggedInNonCustomer(true);
              setCurrentUser({
                id: profile.id,
                email: profile.email || '',
                full_name: profile.full_name || undefined,
                phone: profile.phone || undefined
              });
            }

            // Pre-fill customer info for any logged-in user (for Pay Online)
            if (profile.email) {
              setCustomerEmail(profile.email);
            }
            if (profile.phone) {
              setCustomerPhone(profile.phone);
            }
            if (profile.full_name) {
              setCustomerName(profile.full_name);
            }
          }
        }
      } catch (error) {
        console.error('[Checkout] Unexpected error checking auth:', error);
      }
    };
    checkAuth();
  }, []);

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading cart...</p>
        </div>
      </div>
    );
  }

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    // Reset service fee when switching payment methods
    setServiceFee(0);
    posthog.capture('payment_method_selected', { payment_method: method });
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate inputs
      if (!loginEmail || !loginPassword) {
        throw new Error('Please enter both email and password');
      }

      const supabase = getSupabaseClient();

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword
      });

      if (signInError) {
        console.error('[Checkout] Login error:', signInError.message);

        // Provide user-friendly error messages
        let errorMessage = signInError.message;
        if (signInError.message.includes('Invalid login credentials') ||
          signInError.message.includes('invalid_credentials') ||
          signInError.status === 400) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (signInError.message.includes('Email not confirmed') ||
          signInError.message.includes('email_not_confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        } else if (signInError.message.includes('Too many requests')) {
          errorMessage = 'Too many login attempts. Please wait a moment and try again.';
        }

        throw new Error(errorMessage);
      }

      // Get user profile (use the user from signInData if available, otherwise fetch)
      const user = signInData?.user;
      let finalUser = user;

      if (!finalUser) {
        const { data: { user: fetchedUser }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError || !fetchedUser) {
          console.error('[Checkout] Error fetching user:', getUserError);
          throw new Error('Login successful but failed to retrieve user information. Please try again.');
        }
        finalUser = fetchedUser;
      }

      if (finalUser) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone, role_slug')
          .eq('id', finalUser.id)
          .single();

        if (profileError) {
          console.error('[Checkout] Error fetching profile:', profileError);
          throw new Error('Failed to retrieve user profile. Please try again.');
        }

        if (profile) {
          if (profile.role_slug === 'customer') {
            setIsAuthenticated(true);
            setCurrentUser({
              id: profile.id,
              email: profile.email || '',
              full_name: profile.full_name || undefined,
              phone: profile.phone || undefined
            });
            setCustomerEmail(profile.email || '');
            setCustomerPhone(profile.phone || '');
            setCustomerName(profile.full_name || '');
          } else {
            // User is logged in but not a customer - they can't use Pay at Store
            // But we don't throw an error, just don't set isAuthenticated
            throw new Error('This account is not a customer account. Please create a customer account or use "Pay Online" instead.');
          }
        } else {
          throw new Error('User profile not found. Please contact support.');
        }
      } else {
        throw new Error('Login successful but user information not available. Please try again.');
      }
    } catch (err) {
      console.error('[Checkout] Login failed:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(signupEmail)) {
        throw new Error('Please enter a valid email address');
      }

      const result = await signUpCustomer(
        signupEmail.trim().toLowerCase(),
        signupPassword,
        signupFullName?.trim() || undefined,
        signupPhone?.trim() || undefined
      );

      if (!result.success) {
        console.error('[Checkout] Signup failed:', result.error);

        // Provide user-friendly error messages
        let errorMessage = result.error || 'Signup failed';
        if (result.error?.includes('already exists') || result.error?.includes('already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (result.error?.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (result.error?.includes('password')) {
          errorMessage = 'Password does not meet requirements. Please use a stronger password.';
        }

        throw new Error(errorMessage);
      }

      if (!result.userId) {
        throw new Error('Account creation may have failed. No user ID returned. Please try again.');
      }

      // Wait a moment for the account to be fully set up in Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Auto-login after signup
      const supabase = getSupabaseClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword
      });

      if (signInError) {
        console.error('[Checkout] Auto-login failed:', signInError.message);

        // Provide helpful message based on error
        let errorMessage = 'Account created but login failed. ';
        if (signInError.status === 400) {
          if (signInError.message.includes('Invalid login credentials')) {
            errorMessage = 'Account may have been created but login failed. Please try logging in manually with the email and password you just used. If this continues, the account may not have been created successfully.';
          } else {
            errorMessage += 'Please try logging in manually with the credentials you just used.';
          }
        } else {
          errorMessage += signInError.message;
        }
        throw new Error(errorMessage);
      }

      setIsAuthenticated(true);
      setCurrentUser({
        id: result.userId || '',
        email: signupEmail,
        full_name: signupFullName || undefined,
        phone: signupPhone || undefined
      });
      setCustomerEmail(signupEmail);
      setCustomerPhone(signupPhone || '');
      setCustomerName(signupFullName || '');
    } catch (err) {
      console.error('[Checkout] Signup error:', err);
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Duplicate order check (unless user already confirmed)
    if (!allowSubmitRef.current && liveOrders.length > 0) {
      const possibleDuplicate = liveOrders.find((order) =>
        Math.abs(order.total - total) < 0.01 &&
        areItemsEqual(items, order.items || [])
      );
      if (possibleDuplicate) {
        setDuplicateOrder(possibleDuplicate);
        setShowDuplicateModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Validate required contact fields
      if (!customerEmail || !customerPhone) {
        throw new Error('Please enter your email and phone number so we can contact you about your order.');
      }

      if (!paymentMethod) {
        throw new Error('Please select a payment method');
      }

      // For pay at store, require authentication
      if (paymentMethod === 'store' && !isAuthenticated) {
        throw new Error('Please sign in or create an account to pay at store');
      }

      // Validate delivery order requirements
      if (orderType === 'delivery') {
        if (!deliveryAddress) {
          throw new Error('Delivery address is required');
        }
        if (!deliveryQuote) {
          throw new Error('Delivery quote is required');
        }
        // Delivery orders can only use online payment
        if (paymentMethod !== 'online') {
          throw new Error('Delivery orders must be paid online');
        }
      }

      // Prepare order input
      const orderInput: OrderInput = {
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
        order_type: orderType || 'pickup',
        user_id: currentUser?.id,
        special_instructions: specialInstructions || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          product_description: item.description,
          product_image_url: item.image_url,
          base_price: item.base_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          removed_ingredients: item.removed_ingredients || [],
          comment: item.comment || null,
          addons: item.addon_groups.flatMap(group =>
            group.selected_items.map(addonItem => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price
            }))
          )
        })),
        subtotal,
        promotion_discount: promotionDiscount,
        promotions_applied: promotionsApplied,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total
      };

      // Add reward points if being used
      if (useRewardPoints && rewardPointsToUse > 0 && currentUser?.id) {
        orderInput.reward_points_used = rewardPointsToUse;
        orderInput.reward_points_value = rewardPointsDiscount;
        // Note: Points will be deducted when order is created via useRewardPoints action
      }

      // Add scheduled pickup time for pickup orders (optional when store open, set when pre-order or custom time)
      if (orderType === 'pickup' && scheduledPickupAt) {
        orderInput.scheduled_pickup_at = scheduledPickupAt;
      }

      // Add delivery fields if order type is delivery
      if (orderType === 'delivery' && deliveryAddress && deliveryQuote) {
        orderInput.delivery_address = {
          address_line1: deliveryAddress.address_line1,
          address_line2: deliveryAddress.address_line2,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postcode: deliveryAddress.postcode,
          country: deliveryAddress.country || 'AU',
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        };
        orderInput.delivery_quote_id = deliveryQuote.quote_id;
        orderInput.delivery_quote_amount = deliveryQuote.fee;
        orderInput.delivery_quote_currency = deliveryQuote.currency;
        orderInput.delivery_quote_expires_at = deliveryQuote.expires_at;
        orderInput.delivery_eta_minutes = deliveryQuote.estimated_duration_minutes;
      }

      // Persist latest phone locally so it's pre-filled next time on this device.
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('checkout:lastCustomerPhone', customerPhone);
        } catch (storageErr) {
          console.error('[Checkout] Failed to persist phone in localStorage:', storageErr);
        }
      }

      posthog.capture('checkout_started', {
        item_count: items.length,
        subtotal,
        total,
        payment_method: paymentMethod,
        order_type: orderType || 'pickup',
      });

      // Create order first (for both payment methods)
      const result = await createOrder(orderInput);

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.data) {
        throw new Error('Failed to create order');
      }

      // If the user is authenticated, persist updated phone to their profile
      if (isAuthenticated && currentUser?.id && customerPhone && customerPhone !== (currentUser.phone ?? '')) {
        try {
          const supabase = getSupabaseClient();
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ phone: customerPhone })
            .eq('id', currentUser.id);
          if (profileUpdateError) {
            console.error('[Checkout] Failed to update profile phone:', profileUpdateError);
          }
        } catch (profileErr) {
          console.error('[Checkout] Unexpected error updating profile phone:', profileErr);
        }
      }

      // Deduct reward points if they were used
      if (useRewardPoints && rewardPointsToUse > 0 && currentUser?.id) {
        const pointsResult = await useRewardPointsAction(
          currentUser.id,
          result.data.id,
          rewardPointsToUse
        );
        if (!pointsResult.success) {
          console.error('[Checkout] Failed to deduct reward points:', pointsResult.error);
          // Don't fail the order if points deduction fails, but log it
          // The order will still proceed, but points won't be deducted
        }
      }

      // For pay online, redirect to Stripe Checkout
      if (paymentMethod === 'online') {
        // Prepare line items (display only; Stripe session amount is computed server-side)
        const lineItems = items.map(item => ({
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          price: item.base_price + (item.addon_groups.reduce((sum, group) =>
            sum + group.selected_items.reduce((itemSum, addonItem) => itemSum + addonItem.extra_price, 0), 0
          ) / item.quantity)
        }));

        // Create Stripe Checkout Session
        setIsRedirecting(true);
        const checkoutResponse = await fetch('/api/payments/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: result.data.id,
            customerEmail: customerEmail,
            customerName: customerName || undefined,
            customerPhone: customerPhone,
            items: lineItems,
            subtotal,
            promotionDiscount,
            tax,
            deliveryFee,
            rewardPointsDiscount: rewardPointsDiscount,
            currency: 'aud'
          })
        });

        const checkoutData = await checkoutResponse.json();
        if (!checkoutResponse.ok || !checkoutData.url) {
          setIsRedirecting(false);
          throw new Error(checkoutData.error || 'Failed to create checkout session');
        }

        // Redirect to Stripe Checkout
        window.location.href = checkoutData.url;
        return; // Don't proceed further - Stripe will redirect back
      }

      // For pay at store, show success immediately
      posthog.capture('order_placed', {
        order_id: result.data.id,
        order_number: result.data.order_number,
        payment_method: paymentMethod,
        order_type: orderType || 'pickup',
        total,
        item_count: items.length,
      });
      setSuccess(true);
      setOrderNumber(result.data.order_number);

      // Clear cart
      await clearCart();

      // Redirect to success page after 3 seconds
      setTimeout(() => {
        router.push(`/order/confirmation?order=${result.data!.order_number}`);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
      setIsRedirecting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && orderNumber) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Icon icon={FaCheckCircle} className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Order Placed Successfully!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your order number is: <span className="font-semibold text-blue-600">{orderNumber}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Redirecting to order confirmation...
          </p>
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

  // Pre-check for possible duplicate order (before submit)
  const possibleDuplicate =
    !duplicateConfirmed && liveOrders.length > 0 && items.length > 0
      ? liveOrders.find((order) => {
        const totalMatch = Math.abs(order.total - total) < 0.01;
        const itemsMatch = areItemsEqual(items, order.items || []);
        return totalMatch && itemsMatch;
      })
      : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <OrderHeader />
      <LiveOrderTracker userId={userId} />

      {/* Duplicate Order Modal */}
      {showDuplicateModal && duplicateOrder && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-md w-full p-6 border border-amber-400 dark:border-amber-700 animate-in fade-in">
            <div className="flex items-center gap-3 mb-4">
              <Icon icon={FaExclamationTriangle} className="w-6 h-6 text-amber-500" />
              <h2 className="text-lg font-bold text-amber-700 dark:text-amber-300">Possible Duplicate Order</h2>
            </div>
            <p className="mb-3 text-gray-700 dark:text-gray-200">
              You already have a live order with the same items and total price. Placing another order may result in duplicate orders.
            </p>
            <div className="mb-4 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Order #{duplicateOrder.order_number}</span>
                <span className="text-xs text-gray-500">{new Date(duplicateOrder.created_at).toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Status: <span className="font-semibold">{duplicateOrder.order_status}</span> &bull; Total: <span className="font-semibold">${duplicateOrder.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateOrder(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700"
                onClick={() => {
                  allowSubmitRef.current = true;
                  setShowDuplicateModal(false);
                  setDuplicateOrder(null);
                  // Re-trigger submit
                  document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }}
              >
                Place Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/order/summary"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <Icon icon={FaArrowLeft} className="w-4 h-4" />
          Back to Summary
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Checkout
        </h1>

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Order Type Display */}
          {orderType && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {orderType === 'delivery' ? 'Online Delivery' : 'Pickup Order'}
                  </h3>
                  {orderType === 'delivery' && deliveryAddress && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {deliveryAddress.address_line1}, {deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.postcode}
                    </p>
                  )}
                  {orderType === 'delivery' && deliveryQuote && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Delivery Fee: ${deliveryQuote.fee.toFixed(2)} • Est. {deliveryQuote.estimated_duration_minutes} min
                    </p>
                  )}
                </div>
                <Link
                  href="/order/summary"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Change
                </Link>
              </div>
            </div>
          )}

          {/* Payment Method Selection – hidden until feature flags load (no flash of wrong options) */}
          {!paymentMethod && !featureFlagsLoaded && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Select Payment Method
              </h2>
              <div className="flex items-center gap-3 py-8 justify-center text-gray-600 dark:text-gray-400">
                <LoadingSpinner size="md" />
                <span className="text-sm">Loading payment options…</span>
              </div>
            </div>
          )}
          {!paymentMethod && featureFlagsLoaded && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Select Payment Method
              </h2>
              {orderType === 'delivery' ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Delivery orders must be paid online for security and tracking purposes.
                  </p>
                </div>
              ) : null}
              <div className={`grid gap-4 ${orderType === 'delivery' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                <button
                  type="button"
                  disabled={!featureFlags.enable_online_payment}
                  onClick={() => featureFlags.enable_online_payment && handlePaymentMethodSelect('online')}
                  className={`p-6 border-2 rounded-lg transition-colors text-left ${!featureFlags.enable_online_payment
                    ? 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 opacity-75 cursor-not-allowed'
                    : 'border-gray-200 dark:border-neutral-700 hover:border-blue-600 dark:hover:border-blue-500'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon icon={FaCreditCard} className={`w-8 h-8 ${!featureFlags.enable_online_payment ? 'text-gray-400 dark:text-gray-500' : 'text-blue-600'}`} />
                    {!featureFlags.enable_online_payment && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                        Currently unavailable
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Pay Online
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pay securely online. All payment will be handled by secured payment gateway.
                  </p>
                </button>
                {orderType !== 'delivery' && (
                  <button
                    type="button"
                    disabled={!featureFlags.enable_instore_payment}
                    onClick={() => featureFlags.enable_instore_payment && handlePaymentMethodSelect('store')}
                    className={`p-6 border-2 rounded-lg transition-colors text-left ${!featureFlags.enable_instore_payment
                      ? 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 opacity-75 cursor-not-allowed'
                      : 'border-gray-200 dark:border-neutral-700 hover:border-green-600 dark:hover:border-green-500'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon={FaStore} className={`w-8 h-8 ${!featureFlags.enable_instore_payment ? 'text-gray-400 dark:text-gray-500' : 'text-green-600'}`} />
                      {!featureFlags.enable_instore_payment && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                          Currently unavailable
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Pay at Store
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Pay when you pick up your order at our store.
                    </p>
                  </button>
                )}
                {orderType === 'delivery' && (
                  <div className="p-6 border-2 border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 rounded-lg opacity-75 cursor-not-allowed">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon icon={FaStore} className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                        Not available for delivery
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Pay at Store
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Pay when you pick up your order. Only available for pickup orders.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Require login/signup for all payment methods */}
          {paymentMethod && !isAuthenticated && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon icon={paymentMethod === 'online' ? FaCreditCard : FaStore} className={`w-6 h-6 ${paymentMethod === 'online' ? 'text-blue-600' : 'text-green-600'}`} />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {paymentMethod === 'online' ? 'Pay Online' : 'Pay at Store'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Please sign in with a customer account or create a new customer account to continue.
              </p>
              {/* Auth Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${authMode === 'login'
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${authMode === 'signup'
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  Create Account
                </button>
              </div>
              {/* Login Form */}
              {authMode === 'login' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="Enter your password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCustomerLogin}
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <LoadingSpinner size="sm" />}
                    Sign In
                  </button>
                </div>)}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 animate-in fade-in mt-2">
                  <div className="font-semibold mb-1">Login failed</div>
                  <div>{error}</div>
                  <div className="mt-2">
                    <span className="block mb-1">If you had an account on our previous website, it will not work here. Please create a new account to continue.</span>
                    <span className="block">If you forgot your password, you can <button type="button" className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" onClick={() => {
                      // Open Supabase reset password or custom reset flow
                      window.open('/login', '_blank');
                    }}>reset your password</button>.</span>
                  </div>
                </div>
              )}
              {/* Signup Form */}
              {authMode === 'signup' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="+61 4XX XXX XXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      placeholder="Confirm your password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCustomerSignup}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <LoadingSpinner size="sm" />}
                    Create Account
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Authenticated Info Block for Pay at Store and Pay Online */}
          {(paymentMethod === 'store' || paymentMethod === 'online') && isAuthenticated && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon icon={paymentMethod === 'online' ? FaCreditCard : FaStore} className={`w-6 h-6 ${paymentMethod === 'online' ? 'text-blue-600' : 'text-green-600'}`} />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {paymentMethod === 'online' ? 'Pay Online' : 'Pay at Store'}
                </h2>
              </div>
              <div className={`flex items-center gap-2 mb-4 ${paymentMethod === 'online' ? 'text-blue-600' : 'text-green-600'}`}>
                <Icon icon={FaCheckCircle} className="w-5 h-5" />
                <span>Signed in as {currentUser?.email}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {paymentMethod === 'online'
                  ? "You'll pay securely online for your order."
                  : "You'll pay for your order when you pick it up at the store."}
              </p>
              <div className="mt-1 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-100 mb-2">
                  Please confirm a contact phone number so the store can reach you about your order.
                </p>
                <label className="block text-xs font-medium text-gray-800 dark:text-gray-200 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                  placeholder="+61 4XX XXX XXX"
                />
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {paymentMethod && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Special Instructions (Optional)
              </h2>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                placeholder="Any special instructions for your order..."
              />
            </div>
          )}

          {/* Order Summary */}
          {paymentMethod && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Order Summary
              </h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Items</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {promotionDiscount > 0.009 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Promotions</span>
                    <span>-${promotionDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {rewardPointsDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span className="flex items-center gap-2">
                      <Icon icon={FaGift} className="w-4 h-4" />
                      Reward Points Discount
                    </span>
                    <span>-${rewardPointsDiscount.toFixed(2)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Service Fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
                {rewardPointsSettings.enabled && estimatedPointsEarned > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <Icon icon={FaGift} className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {isAuthenticated
                          ? `You will earn approximately ${estimatedPointsEarned.toLocaleString()} points for this order.`
                          : `Sign in or create an account to earn approximately ${estimatedPointsEarned.toLocaleString()} points for this order.`}
                      </p>
                      <p className="mt-1">
                        This is worth about ${estimatedPointsValue.toFixed(2)} off a future order.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reward Points Section - Compact & Collapsible */}
          {paymentMethod && isAuthenticated && userRewardPoints && userRewardPoints.current_balance > 0 && rewardPointsSettings.enabled && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRewardPointsSection(!showRewardPointsSection)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon icon={FaGift} className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Use Reward Points
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({userRewardPoints.current_balance.toLocaleString()} pts = ${(userRewardPoints.current_balance * rewardPointsSettings.dollars_per_point).toFixed(2)})
                  </span>
                </div>
                {showRewardPointsSection ? (
                  <Icon icon={FaChevronUp} className="w-4 h-4 text-gray-400" />
                ) : (
                  <Icon icon={FaChevronDown} className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {showRewardPointsSection && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-neutral-700 pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useRewardPoints}
                        onChange={(e) => {
                          setUseRewardPoints(e.target.checked);
                          if (!e.target.checked) {
                            setRewardPointsToUse(0);
                          } else {
                            setRewardPointsToUse(Math.min(maxPointsToUse, maxPointsForOrder));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Apply points discount
                      </span>
                    </label>
                  </div>

                  {useRewardPoints && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={maxPointsToUse}
                          step="1"
                          value={rewardPointsToUse}
                          onChange={(e) => {
                            const value = Math.min(Math.max(0, parseInt(e.target.value) || 0), maxPointsToUse);
                            setRewardPointsToUse(value);
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          onClick={() => setRewardPointsToUse(maxPointsToUse)}
                          className="px-3 py-2 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          Use All
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Discount: ${(rewardPointsToUse * rewardPointsSettings.dollars_per_point).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trust Messaging - show before proceeding to secure payment */}
          {paymentMethod === 'online' && (
            <div className="bg-slate-900 border border-blue-600 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <Icon icon={FaLock} className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-blue-100 mb-1">
                    Secure Payment Processing
                  </h4>
                  <p className="text-sm text-blue-200">
                    We do not store your card information. All payments are securely processed by Stripe,
                    a trusted third-party payment provider used by millions of businesses worldwide.
                    Your payment details are encrypted and never touch our servers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Order Warning (pre-submit, requires confirmation) */}
          {possibleDuplicate && !duplicateConfirmed && (
            <div className="mb-4 p-4 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3 animate-in fade-in">
              <Icon icon={FaExclamationTriangle} className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Possible Duplicate Order</div>
                <div className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  You already have a live order with the same items and total price (
                  Order <Link href={`/order/confirmation?order=${possibleDuplicate.order_number}`} className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">#{possibleDuplicate.order_number}</Link>,
                  placed {new Date(possibleDuplicate.created_at).toLocaleString()}
                  ).<br />
                  Placing another order may result in duplicate orders.
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700"
                    onClick={() => setDuplicateConfirmed(true)}
                  >
                    Yes, I want to place order
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 border border-gray-300"
                    onClick={() => window.location.href = '/order'}
                  >
                    No, I will change it
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button (only show if no duplicate or user confirmed) */}
          {paymentMethod && (paymentMethod === 'online' || isAuthenticated) && (!possibleDuplicate || duplicateConfirmed) && (
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isRedirecting ||
                !customerPhone ||
                (!isAuthenticated && paymentMethod === 'online' && !customerEmail)
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRedirecting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Redirecting to Secure Payment...
                </>
              ) : isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Processing Order...
                </>
              ) : (
                <>
                  <Icon icon={FaLock} className="w-5 h-5" />
                  {paymentMethod === 'online' ? 'Proceed to Secure Payment' : 'Place Order'}
                </>
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
