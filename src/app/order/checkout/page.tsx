'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { OrderHeader } from '@/components/OrderHeader';
import { createOrder, type OrderInput } from '@/app/actions/orders';
import { signUpCustomer } from '@/app/actions/customer-auth';
import { getSupabaseClient } from '@/lib/supabase/client';
import { FaShoppingCart, FaArrowLeft, FaCreditCard, FaStore, FaUser, FaLock, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/Loading';
type PaymentMethod = 'online' | 'store';

export default function CheckoutPage() {
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

  const subtotal = getTotal();
  const tax = 0; // Placeholder
  const deliveryFee = 0; // Placeholder
  const [serviceFee, setServiceFee] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const total = subtotal + tax + deliveryFee + serviceFee;

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 [Checkout] Starting auth check...');
        const supabase = getSupabaseClient();
        
        // First check if there's a session to avoid AuthSessionMissingError
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.log('⚠️ [Checkout] No session found (this is OK for anonymous checkout):', sessionError.message);
          return;
        }
        
        if (!session?.user) {
          console.log('ℹ️ [Checkout] No user session - anonymous checkout allowed');
          return;
        }
        
        console.log('✅ [Checkout] Session found, user ID:', session.user.id, 'Email:', session.user.email);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          // If it's a session missing error, that's fine - user is not logged in
          if (userError.message?.includes('session') || userError.message?.includes('AuthSessionMissing')) {
            console.log('⚠️ [Checkout] Session missing error (OK for anonymous):', userError.message);
            return;
          }
          console.error('❌ [Checkout] Error getting user:', userError);
          return;
        }
        
        if (user) {
          console.log('👤 [Checkout] User found:', { id: user.id, email: user.email });
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, phone, role_slug')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('❌ [Checkout] Error getting profile:', profileError);
            return;
          }
          
          if (profile) {
            console.log('📋 [Checkout] Profile found:', { 
              id: profile.id, 
              email: profile.email, 
              role: profile.role_slug,
              hasPhone: !!profile.phone,
              hasName: !!profile.full_name
            });
            
            // For "Pay at Store", only customer role is allowed
            // For "Pay Online", any logged-in user can use their info
            if (profile.role_slug === 'customer') {
              console.log('✅ [Checkout] User is a CUSTOMER - authenticated for Pay at Store');
              setIsAuthenticated(true);
              setCurrentUser({
                id: profile.id,
                email: profile.email || '',
                full_name: profile.full_name || undefined,
                phone: profile.phone || undefined
              });
            } else {
              console.log('⚠️ [Checkout] User is NOT a customer (role:', profile.role_slug, ') - can only use Pay Online');
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
              console.log('📧 [Checkout] Pre-filled email:', profile.email);
            }
            if (profile.phone) {
              setCustomerPhone(profile.phone);
              console.log('📱 [Checkout] Pre-filled phone:', profile.phone);
            }
            if (profile.full_name) {
              setCustomerName(profile.full_name);
              console.log('👤 [Checkout] Pre-filled name:', profile.full_name);
            }
          } else {
            console.log('⚠️ [Checkout] No profile found for user');
          }
        } else {
          console.log('ℹ️ [Checkout] No user found - anonymous checkout');
        }
      } catch (error) {
        console.error('❌ [Checkout] Unexpected error checking auth:', error);
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

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <FaShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
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
            <FaArrowLeft className="w-4 h-4" />
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    // Reset service fee when switching payment methods
    setServiceFee(0);
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 [Checkout] Login attempt for:', loginEmail);
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate inputs
      if (!loginEmail || !loginPassword) {
        throw new Error('Please enter both email and password');
      }

      const supabase = getSupabaseClient();
      console.log('🔄 [Checkout] Calling signInWithPassword...');
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword
      });

      if (signInError) {
        console.error('❌ [Checkout] Login error:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name
        });
        
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

      if (signInData?.user) {
        console.log('✅ [Checkout] Login successful, user:', { 
          id: signInData.user.id, 
          email: signInData.user.email,
          emailConfirmed: signInData.user.email_confirmed_at ? 'Yes' : 'No'
        });
      }

      console.log('✅ [Checkout] Login successful, fetching user profile...');

      // Get user profile (use the user from signInData if available, otherwise fetch)
      const user = signInData?.user;
      let finalUser = user;
      
      if (!finalUser) {
        console.log('🔄 [Checkout] User not in signInData, fetching...');
        const { data: { user: fetchedUser }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError || !fetchedUser) {
          console.error('❌ [Checkout] Error fetching user:', getUserError);
          throw new Error('Login successful but failed to retrieve user information. Please try again.');
        }
        finalUser = fetchedUser;
      }
      
      if (finalUser) {
        console.log('👤 [Checkout] User retrieved:', { id: finalUser.id, email: finalUser.email });
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone, role_slug')
          .eq('id', finalUser.id)
          .single();
        
        if (profileError) {
          console.error('❌ [Checkout] Error fetching profile:', profileError);
          throw new Error('Failed to retrieve user profile. Please try again.');
        }

        if (profile) {
          console.log('📋 [Checkout] Profile retrieved:', { 
            id: profile.id, 
            email: profile.email, 
            role: profile.role_slug 
          });
          
          if (profile.role_slug === 'customer') {
            console.log('✅ [Checkout] User is a CUSTOMER - authentication successful');
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
            console.log('⚠️ [Checkout] User is NOT a customer (role:', profile.role_slug, ')');
            // User is logged in but not a customer - they can't use Pay at Store
            // But we don't throw an error, just don't set isAuthenticated
            throw new Error('This account is not a customer account. Please create a customer account or use "Pay Online" instead.');
          }
        } else {
          console.log('⚠️ [Checkout] No profile found for user');
          throw new Error('User profile not found. Please contact support.');
        }
      } else {
        console.log('⚠️ [Checkout] No user found after login');
        throw new Error('Login successful but user information not available. Please try again.');
      }
    } catch (err) {
      console.error('❌ [Checkout] Login failed:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 [Checkout] ========== SIGNUP STARTED ==========');
    console.log('📝 [Checkout] Signup attempt for:', signupEmail);
    console.log('📝 [Checkout] Signup data:', {
      email: signupEmail,
      hasPassword: !!signupPassword,
      passwordLength: signupPassword.length,
      hasFullName: !!signupFullName,
      hasPhone: !!signupPhone
    });
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      console.error('❌ [Checkout] Passwords do not match');
      setError('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      console.error('❌ [Checkout] Password too short:', signupPassword.length);
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(signupEmail)) {
        console.error('❌ [Checkout] Invalid email format:', signupEmail);
        throw new Error('Please enter a valid email address');
      }

      console.log('🔄 [Checkout] Calling signUpCustomer server action...');
      const result = await signUpCustomer(
        signupEmail.trim().toLowerCase(),
        signupPassword,
        signupFullName?.trim() || undefined,
        signupPhone?.trim() || undefined
      );

      console.log('📋 [Checkout] signUpCustomer result:', {
        success: result.success,
        hasError: !!result.error,
        error: result.error,
        hasUserId: !!result.userId,
        userId: result.userId
      });

      if (!result.success) {
        console.error('❌ [Checkout] Signup failed:', result.error);
        
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
        console.error('❌ [Checkout] Signup succeeded but no userId returned');
        throw new Error('Account creation may have failed. No user ID returned. Please try again.');
      }

      console.log('✅ [Checkout] Customer account created, user ID:', result.userId);

      // Wait a moment for the account to be fully set up in Supabase
      console.log('⏳ [Checkout] Waiting for account to be fully set up...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Auto-login after signup
      const supabase = getSupabaseClient();
      console.log('🔄 [Checkout] Auto-logging in after signup...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword
      });

      if (signInError) {
        console.error('❌ [Checkout] Auto-login failed:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name
        });
        
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

      if (signInData?.user) {
        console.log('✅ [Checkout] Auto-login successful, user:', {
          id: signInData.user.id,
          email: signInData.user.email
        });
      }

      console.log('✅ [Checkout] Auto-login successful, setting authenticated state');
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
      console.error('❌ [Checkout] Signup error:', err);
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!customerEmail || !customerPhone) {
        throw new Error('Email and phone number are required');
      }

      if (!paymentMethod) {
        throw new Error('Please select a payment method');
      }

      // For pay at store, require authentication
      if (paymentMethod === 'store' && !isAuthenticated) {
        throw new Error('Please sign in or create an account to pay at store');
      }

      // Prepare order input
      const orderInput: OrderInput = {
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
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
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total
      };

      // Create order first (for both payment methods)
      const result = await createOrder(orderInput);

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.data) {
        throw new Error('Failed to create order');
      }

      // For pay online, redirect to Stripe Checkout
      if (paymentMethod === 'online') {
        // Calculate service fee
        const baseAmount = subtotal + tax + deliveryFee;
        const calculatedServiceFee = baseAmount * 0.0175 + 0.3; // Stripe fees
        setServiceFee(calculatedServiceFee);

        // Prepare line items for Stripe
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
            tax,
            deliveryFee,
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
          <FaCheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <OrderHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/order/summary"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <FaArrowLeft className="w-4 h-4" />
          Back to Summary
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Checkout
        </h1>

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Payment Method Selection */}
          {!paymentMethod && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Select Payment Method
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handlePaymentMethodSelect('online')}
                  className="p-6 border-2 border-gray-200 dark:border-neutral-700 rounded-lg hover:border-blue-600 dark:hover:border-blue-500 transition-colors text-left"
                >
                  <FaCreditCard className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Pay Online
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pay securely online. No account required, but we recommend creating one for faster checkout.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentMethodSelect('store')}
                  className="p-6 border-2 border-gray-200 dark:border-neutral-700 rounded-lg hover:border-blue-600 dark:hover:border-blue-500 transition-colors text-left"
                >
                  <FaStore className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Pay at Store
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pay when you pick up your order. Requires a customer account.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Pay Online Form */}
          {paymentMethod === 'online' && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaCreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Pay Online
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {isAuthenticated ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <FaCheckCircle className="w-4 h-4" />
                    You're signed in as {currentUser?.email}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-blue-600">
                    <FaUser className="w-4 h-4" />
                    No account required, but creating one makes checkout faster next time!
                  </span>
                )}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    disabled={isAuthenticated}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    disabled={isAuthenticated}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800"
                    placeholder="+61 4XX XXX XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={isAuthenticated}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-neutral-800"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Trust Messaging */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FaLock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                        Secure Payment Processing
                      </h4>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        We do not store your card information. All payments are securely processed by Stripe, 
                        a trusted third-party payment provider used by millions of businesses worldwide. 
                        Your payment details are encrypted and never touch our servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pay at Store - Login/Signup */}
          {paymentMethod === 'store' && !isAuthenticated && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaStore className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Customer Account Required
                </h2>
              </div>

              {/* Error Message for Login/Signup - Display prominently */}
              {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 animate-in fade-in">
                  <FaExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      Error
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    {error.includes('Invalid email or password') && (
                      <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                        <p className="font-medium mb-1">Possible reasons:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>The email or password you entered is incorrect</li>
                          <li>The account may not have been created successfully during signup</li>
                          <li>You may need to try creating a new account again</li>
                          <li>The account might be inactive - try signing up again</li>
                        </ul>
                        <p className="mt-2 font-medium">Try creating a new account if you just signed up.</p>
                      </div>
                    )}
                    {error.includes('already exists') && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('login');
                            setError(null);
                            setLoginEmail(signupEmail);
                          }}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline font-medium"
                        >
                          Click here to sign in instead →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isLoggedInNonCustomer ? (
                <div className="mb-6">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                      You are currently logged in as a non-customer account ({currentUser?.email}).
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      To use "Pay at Store", you need to sign out and create a customer account, or use "Pay Online" instead.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const supabase = getSupabaseClient();
                        await supabase.auth.signOut();
                        setIsLoggedInNonCustomer(false);
                        setCurrentUser(null);
                        setCustomerEmail('');
                        setCustomerPhone('');
                        setCustomerName('');
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-900 dark:text-white rounded-lg transition-colors text-sm"
                    >
                      Sign Out
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('online');
                        setError(null);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      Use Pay Online Instead
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Please sign in with a customer account or create a new customer account to pay at store.
                  </p>

                  {/* Auth Mode Toggle */}
                  <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setError(null); // Clear error when switching modes
                      }}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
                        authMode === 'login'
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
                        setError(null); // Clear error when switching modes
                      }}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition ${
                        authMode === 'signup'
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
                </>
              )}
            </div>
          )}

          {/* Pay at Store - Authenticated */}
          {paymentMethod === 'store' && isAuthenticated && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaStore className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Pay at Store
                </h2>
              </div>
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <FaCheckCircle className="w-5 h-5" />
                <span>Signed in as {currentUser?.email}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You'll pay for your order when you pick it up at the store.
              </p>
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
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
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
              </div>
            </div>
          )}

          {/* Error Message - Display prominently */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 animate-in fade-in">
              <FaExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  Error
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                {error.includes('Invalid email or password') && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                    <p className="font-medium mb-1">Possible reasons:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>The email or password you entered is incorrect</li>
                      <li>The account may not have been created successfully</li>
                      <li>You may need to create a new account</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          {paymentMethod && (paymentMethod === 'online' || isAuthenticated) && (
            <button
              type="submit"
              disabled={isSubmitting || isRedirecting || !customerEmail || !customerPhone}
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
                  <FaLock className="w-5 h-5" />
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
