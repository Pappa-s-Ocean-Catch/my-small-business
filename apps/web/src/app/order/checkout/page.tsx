"use client";

import { useState, useEffect, useRef } from "react";

import { LiveOrderTracker } from "@/components/LiveOrderTracker";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { OrderHeader } from "@/components/OrderHeader";
import { createOrder, type OrderInput } from "@/app/actions/orders";
import type { Order, OrderItem } from "@my-small-business/types/order";
import { signUpCustomer } from "@/app/actions/customer-auth";
import { completePhoneCustomerProfile } from "@/app/actions/customer-phone-auth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { getActivePromotions } from "@/app/actions/promotions";
import {
  getUserRewardPoints,
  useRewardPoints as useRewardPointsAction,
  getRewardPointsSettings,
} from "@/app/actions/reward-points";
import {
  FaShoppingCart,
  FaArrowLeft,
  FaLock,
  FaCheckCircle,
} from "react-icons/fa";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { LoadingSpinner } from "@/components/Loading";
import {
  computeCartPromotionTotals,
  type PromotionWithProducts,
} from "@/lib/promotions";
import posthog from "posthog-js";

import { OrderTypeDisplay } from "./components/OrderTypeDisplay";
import { PaymentMethodSelector } from "./components/PaymentMethodSelector";
import { CustomerAuthSection } from "./components/CustomerAuthSection";
import { AuthenticatedCustomerInfo } from "./components/AuthenticatedCustomerInfo";
import { SpecialInstructions } from "./components/SpecialInstructions";
import { OrderSummary } from "./components/OrderSummary";
import { RewardPointsSection } from "./components/RewardPointsSection";
import { SecurePaymentMessage } from "./components/SecurePaymentMessage";
import { DuplicateOrderModal } from "./components/DuplicateOrderModal";
import { DuplicateOrderWarning } from "./components/DuplicateOrderWarning";

type PaymentMethod = "online" | "store";

/** Set NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN=true in .env.local to show mobile OTP login (after webhook is ready). */
const phoneLoginEnabled =
  typeof process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === "string" &&
  (process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === "1");

function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("04") && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith("+614") && phone.replace(/\D/g, "").length === 11) {
    return `+${phone.replace(/\D/g, "")}`;
  }
  return phone.trim();
}

function buildFallbackOrderEmail(phone: string): string {
  const normalizedDigits = phone.replace(/\D/g, "");
  return `phone-${normalizedDigits}@no-email.local`;
}

function mapPhoneAuthError(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("unsupported phone provider")) {
    return "Phone login is not enabled in Supabase yet. Please configure Phone Auth provider in Supabase Auth settings (or enable the SMS hook provider) and try again.";
  }

  if (
    normalized.includes("sms") &&
    (normalized.includes("not configured") || normalized.includes("provider"))
  ) {
    return "SMS provider is not fully configured. Please check Supabase Phone Auth provider settings and your SMS hook endpoint configuration.";
  }

  if (normalized.includes("invalid phone")) {
    return "Invalid mobile number format. Please use an Australian mobile number like +614XXXXXXXX.";
  }

  return errorMessage;
}

// Utility to compare two arrays of items for equality (ignoring order)
function areItemsEqual(
  cartItems: Array<{ product_id?: string; id?: string; quantity: number }>,
  orderItems: Array<{ product_id?: string; id?: string; quantity: number }>,
) {
  if (cartItems.length !== orderItems.length) return false;
  // Compare by product_id, quantity, and add-ons (if needed)
  const normalize = (
    items: Array<{ product_id?: string; id?: string; quantity: number }>,
  ) =>
    items
      .map((item: { product_id?: string; id?: string; quantity: number }) => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity,
        // Optionally add more fields for stricter match
      }))
      .sort((a, b) => (a.product_id ?? "").localeCompare(b.product_id ?? ""));
  const a = normalize(cartItems);
  const b = normalize(orderItems);
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function CheckoutPage() {
  // Cancel flow: check for canceled payment and delete pending order
  // Toast state for cancel/fail
  const [cancelToast, setCancelToast] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const canceled = url.searchParams.get("canceled");
    let orderId = url.searchParams.get("orderId");
    // Try to get orderId from localStorage if not in URL
    if (!orderId) {
      const stored = window.localStorage.getItem("checkout:lastOrderId");
      orderId = stored ? stored : null;
    }
    if (canceled === "true" && orderId) {
      // Call API to delete order if status is pending_online_payment
      fetch(`/api/orders/${orderId}`, { method: "DELETE" })
        .then(async (res) => {
          window.localStorage.removeItem("checkout:lastOrderId");
          posthog.capture('checkout_cancelled', { order_id: orderId });
          setCancelToast(true);
          setTimeout(() => {
            setCancelToast(false);
            window.location.href = "/order/summary";
          }, 2000);
        })
        .catch(() => {
          setCancelToast(true);
          setTimeout(() => {
            setCancelToast(false);
            window.location.href = "/order/summary";
          }, 2000);
        });
    }
  }, []);
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
          .from("orders")
          .select("*, order_items(*, order_item_addons(*))")
          .eq("user_id", userId)
          .in("order_status", ["pending", "confirmed", "preparing", "ready"])
          .neq("order_status", "pending_online_payment")
          .gte("created_at", since)
          .order("created_at", { ascending: false });
        if (!error && Array.isArray(data)) {
          // Map embedded order_items to items array for comparison
          const mapped: Order[] = data.map((row: any) => {
            const items: OrderItem[] = (row.order_items || []).map(
              (item: any) => ({
                ...item,
                base_price: Number(item.base_price),
                subtotal: Number(item.subtotal),
                removed_ingredients: item.removed_ingredients || [],
                addons: (item.order_item_addons || undefined) ?? undefined,
              }),
            );
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Anonymous checkout fields (for pay online)
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Customer login/signup fields (for pay at store)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [requiresProfileCompletion, setRequiresProfileCompletion] =
    useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
  } | null>(null);
  const [isLoggedInNonCustomer, setIsLoggedInNonCustomer] = useState(false);

  // Order type and delivery state (from summary page)
  const [orderType, setOrderType] = useState<"pickup" | "delivery" | null>(
    null,
  );
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<any>(null);
  const [deliveryAddressEditable, setDeliveryAddressEditable] = useState(false);
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string | null>(
    null,
  );

  // Reward points state
  const [userRewardPoints, setUserRewardPoints] = useState<{
    current_balance: number;
  } | null>(null);
  const [rewardPointsSettings, setRewardPointsSettings] = useState({
    dollars_per_point: 0.001,
    enabled: true,
  });
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [rewardPointsToUse, setRewardPointsToUse] = useState(0);
  const [loadingRewardPoints, setLoadingRewardPoints] = useState(false);

  const cartSubtotal = getTotal();
  const tax = 0; // Placeholder
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { flags: flagsFromHook, isLoading: featureFlagsLoading } =
    useFeatureFlag();
  const featureFlagsLoaded = !featureFlagsLoading;
  const featureFlags = flagsFromHook
    ? {
      enable_online_payment: flagsFromHook.enable_online_payment,
      enable_instore_payment: flagsFromHook.enable_instore_payment,
    }
    : { enable_online_payment: false, enable_instore_payment: false };

  const [activePromotions, setActivePromotions] = useState<
    PromotionWithProducts[]
  >([]);

  useEffect(() => {
    if (otpResendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpResendCountdown((previous) =>
        previous > 0 ? previous - 1 : 0,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpResendCountdown]);

  // Restore last used phone number from localStorage so customers don't need
  // to re-enter it every visit, even if their profile phone is empty.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (customerPhone) return;
    try {
      const stored = window.localStorage.getItem("checkout:lastCustomerPhone");
      if (stored) {
        setCustomerPhone(stored);
      }
    } catch (err) {
      console.error(
        "[Checkout] Failed to read stored phone from localStorage:",
        err,
      );
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

  const promotionsAppliedRef = useRef(false);
  useEffect(() => {
    if (!promotionsAppliedRef.current && promotionsApplied.length > 0) {
      promotionsAppliedRef.current = true;
      posthog.capture('promotion_applied', {
        promotion_ids: promotionsApplied.map((p) => p.id),
        promotion_titles: promotionsApplied.map((p) => p.title),
        total_discount: promotionDiscount,
      });
    }
  }, [promotionsApplied, promotionDiscount]);

  const rawRewardPointsDiscount =
    useRewardPoints && rewardPointsToUse > 0
      ? rewardPointsToUse * rewardPointsSettings.dollars_per_point
      : 0;

  // Reward points should never exceed the (items + tax + delivery) amount.
  const rewardPointsDiscount = Math.min(
    rawRewardPointsDiscount,
    Math.max(0, subtotal + tax + deliveryFee),
  );

  // Eligible amount for earning points: food subtotal (after promotions) minus any part paid with points
  const eligibleAmountForPoints = Math.max(0, subtotal - rewardPointsDiscount);
  const estimatedPointsEarned = rewardPointsSettings.enabled
    ? Math.floor(
      eligibleAmountForPoints *
      (rewardPointsSettings as { points_per_dollar?: number })
        .points_per_dollar!,
    )
    : 0;
  const estimatedPointsValue =
    estimatedPointsEarned * rewardPointsSettings.dollars_per_point;

  const total =
    subtotal + tax + deliveryFee + serviceFee - rewardPointsDiscount;

  // Keep service fee derived from current payable amount (online only)
  useEffect(() => {
    if (paymentMethod !== "online") {
      setServiceFee(0);
      return;
    }

    const baseAmount = Math.max(
      0,
      subtotal + tax + deliveryFee - rewardPointsDiscount,
    );
    const calculatedServiceFee = baseAmount * 0.0175 + 0.3; // Stripe fees
    setServiceFee(calculatedServiceFee);
  }, [paymentMethod, subtotal, tax, deliveryFee, rewardPointsDiscount]);

  // Load order type and delivery info from sessionStorage
  useEffect(() => {
    const storedOrderType = sessionStorage.getItem("orderType") as
      | "pickup"
      | "delivery"
      | null;
    const storedDeliveryAddress = sessionStorage.getItem("deliveryAddress");
    const storedDeliveryQuote = sessionStorage.getItem("deliveryQuote");
    const storedScheduledPickupAt = sessionStorage.getItem("scheduledPickupAt");

    if (storedOrderType) {
      setOrderType(storedOrderType);
    }

    if (storedDeliveryAddress) {
      try {
        setDeliveryAddress(JSON.parse(storedDeliveryAddress));
      } catch (e) {
        console.error("Error parsing delivery address:", e);
      }
    }

    if (storedDeliveryQuote) {
      try {
        const quote = JSON.parse(storedDeliveryQuote);
        setDeliveryQuote(quote);
        setDeliveryFee(quote.fee || 0);
      } catch (e) {
        console.error("Error parsing delivery quote:", e);
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
        console.error("Error loading reward points:", error);
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
  const maxDollarDiscount =
    maxPointsToUse * rewardPointsSettings.dollars_per_point;
  const maxPointsForOrder = Math.min(
    maxPointsToUse,
    Math.floor(Math.max(0, total) / rewardPointsSettings.dollars_per_point),
  );

  // Auto-suggest using reward points if available
  useEffect(() => {
    if (
      userRewardPoints &&
      userRewardPoints.current_balance > 0 &&
      !useRewardPoints &&
      rewardPointsSettings.enabled
    ) {
      // Suggest using points if balance is significant
      const suggestedDiscount = Math.min(maxDollarDiscount, total * 0.5); // Suggest up to 50% of order
      if (suggestedDiscount >= 1) {
        // Only suggest if discount is at least $1
        setUseRewardPoints(true);
        setRewardPointsToUse(
          Math.min(
            maxPointsToUse,
            Math.floor(
              suggestedDiscount / rewardPointsSettings.dollars_per_point,
            ),
          ),
        );
      }
    }
  }, [userRewardPoints, total, rewardPointsSettings.enabled]);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();

        // First check if there's a session to avoid AuthSessionMissingError
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          return;
        }

        if (!session?.user) {
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          // If it's a session missing error, that's fine - user is not logged in
          if (
            userError.message?.includes("session") ||
            userError.message?.includes("AuthSessionMissing")
          ) {
            return;
          }
          console.error("[Checkout] Error getting user:", userError);
          return;
        }

        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, email, full_name, phone, role_slug")
            .eq("id", user.id)
            .single();

          if (profileError) {
            console.error("[Checkout] Error getting profile:", profileError);
            return;
          }

          if (profile) {
            // For "Pay at Store", only customer role is allowed
            // For "Pay Online", any logged-in user can use their info
            if (profile.role_slug === "customer") {
              setIsAuthenticated(true);
              setCurrentUser({
                id: profile.id,
                email: profile.email || "",
                full_name: profile.full_name || undefined,
                phone: profile.phone || undefined,
              });

              // Identify user in PostHog
              posthog.identify(profile.id, {
                email: profile.email,
                name: profile.full_name,
                phone: profile.phone,
                role: profile.role_slug,
              });
            } else {
              // User is logged in but not a customer
              setIsLoggedInNonCustomer(true);
              setCurrentUser({
                id: profile.id,
                email: profile.email || "",
                full_name: profile.full_name || undefined,
                phone: profile.phone || undefined,
              });

              // Identify user in PostHog
              posthog.identify(profile.id, {
                email: profile.email,
                name: profile.full_name,
                phone: profile.phone,
                role: profile.role_slug,
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
        console.error("[Checkout] Unexpected error checking auth:", error);
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
    posthog.capture("payment_method_selected", { payment_method: method });
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate inputs
      if (!loginEmail || !loginPassword) {
        throw new Error("Please enter both email and password");
      }

      const supabase = getSupabaseClient();

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        });

      if (signInError) {
        console.error("[Checkout] Login error:", signInError.message);

        // Provide user-friendly error messages
        let errorMessage = signInError.message;
        if (
          signInError.message.includes("Invalid login credentials") ||
          signInError.message.includes("invalid_credentials") ||
          signInError.status === 400
        ) {
          errorMessage =
            "Invalid email or password. Please check your credentials and try again.";
        } else if (
          signInError.message.includes("Email not confirmed") ||
          signInError.message.includes("email_not_confirmed")
        ) {
          errorMessage =
            "Please check your email and click the confirmation link before signing in.";
        } else if (signInError.message.includes("Too many requests")) {
          errorMessage =
            "Too many login attempts. Please wait a moment and try again.";
        }

        throw new Error(errorMessage);
      }

      // Get user profile (use the user from signInData if available, otherwise fetch)
      const user = signInData?.user;
      let finalUser = user;

      if (!finalUser) {
        const {
          data: { user: fetchedUser },
          error: getUserError,
        } = await supabase.auth.getUser();
        if (getUserError || !fetchedUser) {
          console.error("[Checkout] Error fetching user:", getUserError);
          throw new Error(
            "Login successful but failed to retrieve user information. Please try again.",
          );
        }
        finalUser = fetchedUser;
      }

      if (finalUser) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, role_slug")
          .eq("id", finalUser.id)
          .single();

        if (profileError) {
          console.error("[Checkout] Error fetching profile:", profileError);
          throw new Error("Failed to retrieve user profile. Please try again.");
        }

        if (profile) {
          if (profile.role_slug === "customer") {
            setIsAuthenticated(true);
            setCurrentUser({
              id: profile.id,
              email: profile.email || "",
              full_name: profile.full_name || undefined,
              phone: profile.phone || undefined,
            });
            setCustomerEmail(profile.email || "");
            setCustomerPhone(profile.phone || "");
            setCustomerName(profile.full_name || "");

            // Identify user in PostHog
            posthog.identify(profile.id, {
              email: profile.email,
              name: profile.full_name,
              phone: profile.phone,
              role: profile.role_slug,
            });
          } else {
            // User is logged in but not a customer - they can't use Pay at Store
            // But we don't throw an error, just don't set isAuthenticated
            throw new Error(
              'This account is not a customer account. Please create a customer account or use "Pay Online" instead.',
            );
          }
        } else {
          throw new Error("User profile not found. Please contact support.");
        }
      } else {
        throw new Error(
          "Login successful but user information not available. Please try again.",
        );
      }
    } catch (err) {
      console.error("[Checkout] Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(signupEmail)) {
        throw new Error("Please enter a valid email address");
      }

      const result = await signUpCustomer(
        signupEmail.trim().toLowerCase(),
        signupPassword,
        signupFullName?.trim() || undefined,
        signupPhone?.trim() || undefined,
      );

      if (!result.success) {
        console.error("[Checkout] Signup failed:", result.error);

        // Provide user-friendly error messages
        let errorMessage = result.error || "Signup failed";
        if (
          result.error?.includes("already exists") ||
          result.error?.includes("already registered")
        ) {
          errorMessage =
            "An account with this email already exists. Please sign in instead.";
        } else if (result.error?.includes("invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (result.error?.includes("password")) {
          errorMessage =
            "Password does not meet requirements. Please use a stronger password.";
        }

        throw new Error(errorMessage);
      }

      if (!result.userId) {
        throw new Error(
          "Account creation may have failed. No user ID returned. Please try again.",
        );
      }

      // Wait a moment for the account to be fully set up in Supabase
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Auto-login after signup
      const supabase = getSupabaseClient();
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
        });

      if (signInError) {
        console.error("[Checkout] Auto-login failed:", signInError.message);

        // Provide helpful message based on error
        let errorMessage = "Account created but login failed. ";
        if (signInError.status === 400) {
          if (signInError.message.includes("Invalid login credentials")) {
            errorMessage =
              "Account may have been created but login failed. Please try logging in manually with the email and password you just used. If this continues, the account may not have been created successfully.";
          } else {
            errorMessage +=
              "Please try logging in manually with the credentials you just used.";
          }
        } else {
          errorMessage += signInError.message;
        }
        throw new Error(errorMessage);
      }

      setIsAuthenticated(true);
      setCurrentUser({
        id: result.userId || "",
        email: signupEmail,
        full_name: signupFullName || undefined,
        phone: signupPhone || undefined,
      });
      setCustomerEmail(signupEmail);
      setCustomerPhone(signupPhone || "");
      setCustomerName(signupFullName || "");

      // Identify user in PostHog
      posthog.identify(result.userId, {
        email: signupEmail,
        name: signupFullName,
        phone: signupPhone,
        role: "customer",
      });
    } catch (err) {
      console.error("[Checkout] Signup error:", err);
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setError(null);

    if (otpSent && otpResendCountdown > 0) {
      setError(
        `Please wait ${otpResendCountdown} seconds before requesting a new code.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPhone = normalizeAuPhone(loginPhone);
      if (!normalizedPhone.startsWith("+614")) {
        throw new Error(
          "Please enter a valid Australian mobile number (e.g. +61 4XX XXX XXX).",
        );
      }

      const supabase = getSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          shouldCreateUser: true,
          data: {
            phone: normalizedPhone,
          },
        },
      });

      if (otpError) {
        console.error("[Checkout] Phone OTP send failed:", {
          message: otpError.message,
          status: otpError.status,
          name: otpError.name,
        });
        throw new Error(mapPhoneAuthError(otpError.message));
      }

      setLoginPhone(normalizedPhone);
      setOtpSent(true);
      setOtpResendCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const normalizedPhone = normalizeAuPhone(loginPhone);
      if (!otpCode || otpCode.length < 6) {
        throw new Error("Please enter the 6-digit verification code.");
      }

      const supabase = getSupabaseClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode,
        type: "sms",
      });

      if (verifyError) {
        console.error("[Checkout] Phone OTP verify failed:", {
          message: verifyError.message,
          status: verifyError.status,
          name: verifyError.name,
        });
        throw new Error(mapPhoneAuthError(verifyError.message));
      }

      const user = data.user;
      if (!user) {
        throw new Error("Verification succeeded but no user session was found.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role_slug")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error(
          "Phone verified, but profile could not be loaded. Please try again.",
        );
      }

      const profilePhone = profile.phone || normalizedPhone;
      setCurrentUser({
        id: profile.id,
        email: profile.email || "",
        full_name: profile.full_name || undefined,
        phone: profilePhone,
      });
      setCustomerPhone(profilePhone);
      setCustomerName(profile.full_name || "");
      setCustomerEmail(profile.email || "");

      const isNewProfile = !profile.full_name;
      if (isNewProfile) {
        setRequiresProfileCompletion(true);
        setProfileFullName(profile.full_name || "");
        setProfileEmail(profile.email || "");
        setIsAuthenticated(false);
      } else {
        setRequiresProfileCompletion(false);
        setIsAuthenticated(true);
      }

      setOtpCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePhoneProfile = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (!currentUser?.id) {
        throw new Error("Missing authenticated user.");
      }
      if (!profileFullName.trim()) {
        throw new Error("Please enter your full name.");
      }

      const result = await completePhoneCustomerProfile({
        userId: currentUser.id,
        fullName: profileFullName.trim(),
        email: profileEmail.trim() || undefined,
        phone: loginPhone || customerPhone,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile.");
      }

      const finalPhone = normalizeAuPhone(loginPhone || customerPhone);
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              email: profileEmail.trim() || prev.email,
              full_name: profileFullName.trim(),
              phone: finalPhone,
            }
          : prev,
      );
      setCustomerName(profileFullName.trim());
      setCustomerPhone(finalPhone);
      setCustomerEmail(profileEmail.trim());
      setRequiresProfileCompletion(false);
      setIsAuthenticated(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Duplicate order check (unless user already confirmed)
    if (!allowSubmitRef.current && liveOrders.length > 0) {
      const possibleDuplicate = liveOrders.find(
        (order) =>
          Math.abs(order.total - total) < 0.01 &&
          areItemsEqual(items, order.items || []),
      );
      if (possibleDuplicate) {
        setDuplicateOrder(possibleDuplicate);
        setShowDuplicateModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    let errorMessage = null;
    try {
      // Validate required contact fields
      if (!customerPhone) {
        errorMessage =
          "Please enter your phone number so we can contact you about your order.";
        throw new Error(errorMessage);
      }

      if (!paymentMethod) {
        errorMessage = "Please select a payment method";
        throw new Error(errorMessage);
      }

      // For pay at store, require authentication
      if (paymentMethod === "store" && !isAuthenticated) {
        errorMessage = "Please sign in or create an account to pay at store";
        throw new Error(errorMessage);
      }

      // Validate delivery order requirements
      if (orderType === "delivery") {
        if (!deliveryAddress) {
          errorMessage = "Delivery address is required";
          throw new Error(errorMessage);
        }
        if (!deliveryQuote) {
          errorMessage = "Delivery quote is required";
          throw new Error(errorMessage);
        }
        // Delivery orders can only use online payment
        if (paymentMethod !== "online") {
          errorMessage = "Delivery orders must be paid online";
          throw new Error(errorMessage);
        }
      }

      // Prepare order input
      const orderInput: OrderInput = {
        customer_email: customerEmail || buildFallbackOrderEmail(customerPhone),
        customer_phone: customerPhone,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
        order_type: orderType || "pickup",
        user_id: currentUser?.id,
        special_instructions: specialInstructions || undefined,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.name,
          product_description: item.description,
          product_image_url: item.image_url,
          base_price: item.base_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          removed_ingredients: item.removed_ingredients || [],
          comment: item.comment || null,
          addons: item.addon_groups.flatMap((group) =>
            group.selected_items.map((addonItem) => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price,
            })),
          ),
        })),
        subtotal,
        promotion_discount: promotionDiscount,
        promotions_applied: promotionsApplied,
        tax,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total,
      };

      // Add reward points if being used
      if (useRewardPoints && rewardPointsToUse > 0 && currentUser?.id) {
        orderInput.reward_points_used = rewardPointsToUse;
        orderInput.reward_points_value = rewardPointsDiscount;
        // Note: Points will be deducted when order is created via useRewardPoints action
      }

      // Add scheduled pickup time for pickup orders (optional when store open, set when pre-order or custom time)
      if (orderType === "pickup" && scheduledPickupAt) {
        orderInput.scheduled_pickup_at = scheduledPickupAt;
      }

      // Add delivery fields if order type is delivery
      if (orderType === "delivery" && deliveryAddress && deliveryQuote) {
        orderInput.delivery_address = {
          address_line1: deliveryAddress.address_line1,
          address_line2: deliveryAddress.address_line2,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postcode: deliveryAddress.postcode,
          country: deliveryAddress.country || "AU",
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        };
        orderInput.delivery_quote_id = deliveryQuote.quote_id;
        orderInput.delivery_quote_amount = deliveryQuote.fee;
        orderInput.delivery_quote_currency = deliveryQuote.currency;
        orderInput.delivery_quote_expires_at = deliveryQuote.expires_at;
        orderInput.delivery_eta_minutes =
          deliveryQuote.estimated_duration_minutes;
      }

      // Persist latest phone locally so it's pre-filled next time on this device.
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "checkout:lastCustomerPhone",
            customerPhone,
          );
        } catch (storageErr) {
          console.error(
            "[Checkout] Failed to persist phone in localStorage:",
            storageErr,
          );
        }
      }

      posthog.capture("checkout_started", {
        item_count: items.length,
        subtotal,
        total,
        payment_method: paymentMethod,
        order_type: orderType || "pickup",
      });

      // Create order first (for both payment methods)
      const result = await createOrder(orderInput);

      if (result.error) {
        errorMessage = result.error;
        throw new Error(result.error);
      }

      if (!result.data) {
        errorMessage = "Failed to create order";
        throw new Error("Failed to create order");
      }

      // If the user is authenticated, persist updated phone to their profile
      if (
        isAuthenticated &&
        currentUser?.id &&
        customerPhone &&
        customerPhone !== (currentUser.phone ?? "")
      ) {
        try {
          const supabase = getSupabaseClient();
          const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ phone: customerPhone })
            .eq("id", currentUser.id);
          if (profileUpdateError) {
            console.error(
              "[Checkout] Failed to update profile phone:",
              profileUpdateError,
            );
          }
        } catch (profileErr) {
          console.error(
            "[Checkout] Unexpected error updating profile phone:",
            profileErr,
          );
        }
      }

      // Deduct reward points if they were used
      if (useRewardPoints && rewardPointsToUse > 0 && currentUser?.id) {
        const pointsResult = await useRewardPointsAction(
          currentUser.id,
          result.data.id,
          rewardPointsToUse,
        );
        if (!pointsResult.success) {
          console.error(
            "[Checkout] Failed to deduct reward points:",
            pointsResult.error,
          );
          // Don't fail the order if points deduction fails, but log it
          // The order will still proceed, but points won't be deducted
        }
      }

      // For pay online, redirect to Stripe Checkout
      if (paymentMethod === "online") {
        // Prepare line items (display only; Stripe session amount is computed server-side)
        const lineItems = items.map((item) => ({
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          price:
            item.base_price +
            item.addon_groups.reduce(
              (sum, group) =>
                sum +
                group.selected_items.reduce(
                  (itemSum, addonItem) => itemSum + addonItem.extra_price,
                  0,
                ),
              0,
            ) /
            item.quantity,
        }));

        // Store orderId in localStorage for cancel flow
        if (typeof window !== "undefined") {
          window.localStorage.setItem("checkout:lastOrderId", result.data.id);
        }

        // Create Stripe Checkout Session
        setIsRedirecting(true);
        const checkoutResponse = await fetch(
          "/api/payments/create-checkout-session",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
              currency: "aud",
            }),
          },
        );

        const checkoutData = await checkoutResponse.json();
        if (!checkoutResponse.ok || !checkoutData.url) {
          setIsRedirecting(false);
          errorMessage = checkoutData.error || "Failed to create checkout session";
          throw new Error(errorMessage);
        }

        // Redirect to Stripe Checkout
        window.location.href = checkoutData.url;
        return; // Don't proceed further - Stripe will redirect back
      }

      // For pay at store, show success immediately and send order placed email
      posthog.capture("order_placed", {
        order_id: result.data.id,
        order_number: result.data.order_number,
        payment_method: paymentMethod,
        order_type: orderType || "pickup",
        total,
        item_count: items.length,
      });
      // Only send order placed email for in-store payments
      if (paymentMethod === "store") {
        fetch("/api/orders/status-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: result.data.id, status: "placed" }),
        });
      }
      setSuccess(true);
      setOrderNumber(result.data.order_number);

      // Clear cart
      await clearCart();

      // Redirect to success page after 3 seconds
      setTimeout(() => {
        router.push(`/order/confirmation?order=${result.data!.order_number}`);
      }, 3000);
    } catch (err) {
      // Always log error for troubleshooting and monitoring
      const monitoringTag = '[MONITORING][Checkout] Order submission error';
      if (err instanceof Error) {
        // Log with error stack if available
        console.error(monitoringTag, err.message, err.stack || '', {
          errorMessage,
          customerEmail,
          customerPhone,
          paymentMethod,
          orderType,
          userId: currentUser?.id,
          isAuthenticated,
          itemsCount: items.length,
          total,
        });
      } else {
        console.error(monitoringTag, err, {
          errorMessage,
          customerEmail,
          customerPhone,
          paymentMethod,
          orderType,
          userId: currentUser?.id,
          isAuthenticated,
          itemsCount: items.length,
          total,
        });
      }
      posthog.capture('checkout_error', {
        error_message: err instanceof Error ? err.message : errorMessage || 'Unknown error',
        payment_method: paymentMethod,
        order_type: orderType,
        total,
      });
      // Always show error to user
      setError(
        err instanceof Error
          ? err.message || errorMessage || "Failed to submit order"
          : errorMessage || "Failed to submit order"
      );
      setIsRedirecting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && orderNumber) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Icon
            icon={FaCheckCircle}
            className="w-20 h-20 text-green-600 mx-auto mb-4"
          />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Order Placed Successfully!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your order number is:{" "}
            <span className="font-semibold text-blue-600">{orderNumber}</span>
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
          <Icon
            icon={FaShoppingCart}
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
          />
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
      {cancelToast && (
        <div style={{
          position: "fixed",
          top: 20,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
        }}>
          <div style={{
            background: "#ef4444",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 8,
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            Your payment was cancelled or failed. You can continue shopping.
          </div>
        </div>
      )}
      <OrderHeader />
      <LiveOrderTracker userId={userId} />

      {/* Duplicate Order Modal */}
      <DuplicateOrderModal
        showDuplicateModal={showDuplicateModal}
        duplicateOrder={duplicateOrder}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicateOrder(null);
        }}
        onConfirm={() => {
          allowSubmitRef.current = true;
          setShowDuplicateModal(false);
          setDuplicateOrder(null);
          // Re-trigger submit
          document
            .querySelector("form")
            ?.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true }),
            );
        }}
      />

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
          <OrderTypeDisplay
            orderType={orderType}
            deliveryAddress={deliveryAddress}
            deliveryQuote={deliveryQuote}
          />

          {/* Require login/signup for all payment methods */}
          <CustomerAuthSection
            phoneLoginEnabled={phoneLoginEnabled}
            isAuthenticated={isAuthenticated}
            requiresProfileCompletion={requiresProfileCompletion}
            profileFullName={profileFullName}
            setProfileFullName={setProfileFullName}
            profileEmail={profileEmail}
            setProfileEmail={setProfileEmail}
            handleCompletePhoneProfile={handleCompletePhoneProfile}
            loginPhone={loginPhone}
            setLoginPhone={setLoginPhone}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            otpSent={otpSent}
            otpResendCountdown={otpResendCountdown}
            handleSendPhoneOtp={handleSendPhoneOtp}
            handleVerifyPhoneOtp={handleVerifyPhoneOtp}
            loginEmail={loginEmail}
            setLoginEmail={setLoginEmail}
            loginPassword={loginPassword}
            setLoginPassword={setLoginPassword}
            handleCustomerLogin={handleCustomerLogin}
            isSubmitting={isSubmitting}
            error={error}
            setError={setError}
            signupFullName={signupFullName}
            setSignupFullName={setSignupFullName}
            signupEmail={signupEmail}
            setSignupEmail={setSignupEmail}
            signupPhone={signupPhone}
            setSignupPhone={setSignupPhone}
            signupPassword={signupPassword}
            setSignupPassword={setSignupPassword}
            signupConfirmPassword={signupConfirmPassword}
            setSignupConfirmPassword={setSignupConfirmPassword}
            handleCustomerSignup={handleCustomerSignup}
          />
          {/* Authenticated Info Block for Pay at Store and Pay Online */}
          <AuthenticatedCustomerInfo
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
          />
          {isAuthenticated && (
            <>
              {/* Payment Method Selection */}
              <PaymentMethodSelector
                paymentMethod={paymentMethod}
                featureFlagsLoaded={featureFlagsLoaded}
                featureFlags={featureFlags}
                orderType={orderType}
                onSelect={handlePaymentMethodSelect}
              />
            </>
          )}
          {/* Special Instructions */}
          <SpecialInstructions
            paymentMethod={paymentMethod}
            specialInstructions={specialInstructions}
            setSpecialInstructions={setSpecialInstructions}
          />
          {/* Order Summary */}
          <OrderSummary
            paymentMethod={paymentMethod}
            cartSubtotal={cartSubtotal}
            promotionDiscount={promotionDiscount}
            subtotal={subtotal}
            rewardPointsDiscount={rewardPointsDiscount}
            tax={tax}
            deliveryFee={deliveryFee}
            serviceFee={serviceFee}
            total={total}
            rewardPointsSettings={rewardPointsSettings}
            estimatedPointsEarned={estimatedPointsEarned}
            estimatedPointsValue={estimatedPointsValue}
            isAuthenticated={isAuthenticated}
            itemCount={items.length}
          />
          {/* Reward Points Section */}
          <RewardPointsSection
            paymentMethod={paymentMethod}
            isAuthenticated={isAuthenticated}
            userRewardPoints={userRewardPoints}
            rewardPointsSettings={rewardPointsSettings}
            useRewardPoints={useRewardPoints}
            setUseRewardPoints={setUseRewardPoints}
            rewardPointsToUse={rewardPointsToUse}
            setRewardPointsToUse={setRewardPointsToUse}
            maxPointsToUse={maxPointsToUse}
            maxPointsForOrder={maxPointsForOrder}
          />
          {/* Trust Messaging */}
          <SecurePaymentMessage paymentMethod={paymentMethod} />

          {/* Duplicate Order Warning */}
          <DuplicateOrderWarning
            possibleDuplicate={possibleDuplicate}
            duplicateConfirmed={duplicateConfirmed}
            setDuplicateConfirmed={setDuplicateConfirmed}
          />

          {/* Submit Button (only show if no duplicate or user confirmed) */}
          {paymentMethod &&
            (paymentMethod === "online" || isAuthenticated) &&
            (!possibleDuplicate || duplicateConfirmed) && (
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isRedirecting ||
                  !customerPhone ||
                  (!isAuthenticated &&
                    paymentMethod === "online" &&
                    !customerEmail)
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
                    {paymentMethod === "online"
                      ? "Proceed to Secure Payment"
                      : "Place Order"}
                  </>
                )}
              </button>
            )}
        </form>
      </div>
    </div>
  );
}
