'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LiveOrderTracker } from '@/components/LiveOrderTracker';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { CartSidebar } from '@/components/CartSidebar';
import { OrderHeader } from '@/components/OrderHeader';
import { getTopSellingProducts, getFeaturedProducts } from '@/app/actions/top-sellers';
import { getActivePromotions } from '@/app/actions/promotions';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { FaUtensils, FaSearch, FaFire, FaStar, FaClock, FaChevronLeft, FaChevronRight, FaFilter } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import type { CartAddonGroup } from '@/contexts/CartContext';
import { pickBestProductPromotion, promotionLabel, type PromotionWithProducts } from '@/lib/promotions';
import type { StoreHours } from '@my-small-business/types';
import { buildDefaultStoreHours, isStoreOpenNow } from '@/lib/store-hours';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';

const LikeDislikeWidget = dynamic(() => import('@/components/LikeDislikeWidget').then(m => m.LikeDislikeWidget), { ssr: false });
const ReviewWidget = dynamic(() => import('@/components/ReviewWidget').then(m => m.ReviewWidget), { ssr: false });

interface MenuProduct {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  sale_price: number;
  bundle_original_total?: number | null;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
}

interface MenuCategory {
  id: string;
  name: string;
  parent_category_id: string | null;
  sort_order: number;
}

type FilterType = 'all' | 'category' | 'top-sellers' | 'featured';

export default function OrderPage() {
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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { addItem, isLoading: cartLoading } = useCart();
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [topSellers, setTopSellers] = useState<MenuProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [lazyLoading, setLazyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customizingProduct, setCustomizingProduct] = useState<MenuProduct | null>(null);

  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);

  // Store hours for today (Melbourne) – for messaging on menu
  const [storeHours, setStoreHours] = useState<StoreHours | null>(null);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);
  const [todayHoursLabel, setTodayHoursLabel] = useState<string | null>(null);

  const { onlineOrderEnabled, isLoading: flagLoading } = useFeatureFlag();

  const topCartPromo = useMemo(() => {
    const carts = activePromotions.filter((p) => p.applies_to === 'cart');
    if (carts.length === 0) return null;
    return [...carts].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  }, [activePromotions]);

  const hasLoadedRef = useRef(false);

  // Redirect to home when online order is disabled
  useEffect(() => {
    if (flagLoading) return;
    if (onlineOrderEnabled === false) {
      router.push('/');
    }
  }, [flagLoading, onlineOrderEnabled, router]);


  // Optimized: Load menu, promotions, and store hours in parallel
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    (async () => {
      setLoading(true);
      try {
        // 1. Load featured products first
        const featuredRes = await getFeaturedProducts();
        if (featuredRes.data) setFeaturedProducts(featuredRes.data);
        setLoading(false); // Show page after featured loaded
        // 2. Start lazy loading the rest
        setLazyLoading(true);
        const supabase = getSupabaseClient();
        // Categories
        const categoriesResult = await supabase
          .from('sale_categories')
          .select('id, name, parent_category_id, sort_order')
          .eq('is_active', true)
          .order('sort_order');
        if (categoriesResult.data) setCategories(categoriesResult.data);
        // Top sellers
        const topSellersRes = await getTopSellingProducts(20);
        if (topSellersRes.data) setTopSellers(topSellersRes.data);
        // Promotions
        const promoRes = await getActivePromotions();
        if (promoRes.data) setActivePromotions(promoRes.data);
        // Store hours
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
        const hours: StoreHours =
          storeHoursValue && typeof storeHoursValue === 'object'
            ? storeHoursValue
            : buildDefaultStoreHours(defaults.store_open_time ?? '10:00', defaults.store_close_time ?? '21:00');
        setStoreHours(hours);
        // Set today label
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-AU', {
          timeZone: 'Australia/Melbourne',
          weekday: 'long',
        });
        const parts = formatter.formatToParts(now);
        const weekdayPart = parts.find((p) => p.type === 'weekday');
        const weekdayLabel = weekdayPart?.value ?? 'Today';
        const weekdayShortFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Australia/Melbourne',
          weekday: 'short',
        });
        const weekdayShortParts = weekdayShortFormatter.formatToParts(now);
        const short = weekdayShortParts.find((p) => p.type === 'weekday')?.value.toLowerCase() ?? 'sun';
        const dayIndexMap: Record<string, number> = {
          sun: 0,
          mon: 1,
          tue: 2,
          wed: 3,
          thu: 4,
          fri: 5,
          sat: 6,
        };
        const dayIndex = dayIndexMap[short] ?? 0;
        const todaysHours = hours[String(dayIndex)] ?? null;
        setTodayLabel(weekdayLabel);
        if (todaysHours) {
          const formatTime = (t: string) => {
            const [hStr, mStr] = t.split(':');
            const h = Number(hStr ?? 0);
            const m = Number(mStr ?? 0);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            return d.toLocaleTimeString('en-AU', {
              timeZone: 'Australia/Melbourne',
              hour: 'numeric',
              minute: '2-digit',
            });
          };
          setTodayHoursLabel(`${formatTime(todaysHours.open)} – ${formatTime(todaysHours.close)} (Melbourne time)`);
        } else {
          setTodayHoursLabel('Closed today');
        }
        setIsStoreOpen(isStoreOpenNow(hours));
        // 3. Lazy load all products (not featured)
        const productsResult = await supabase
          .from('sale_products')
          .select('id, slug, name, description, sale_price, image_url, sale_category_id, sub_category_id')
          .eq('is_active', true)
          .order('name');
        if (productsResult.data) setProducts(productsResult.data);
        setLazyLoading(false);
      } catch (err) {
        setError('Failed to load menu');
        console.error('Error loading menu:', err);
        setLoading(false);
        setLazyLoading(false);
      }
    })();
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const [productsResult, categoriesResult, topSellersResult, featuredResult] = await Promise.all([
        supabase
          .from('sale_products')
          .select('id, slug, name, description, sale_price, image_url, sale_category_id, sub_category_id')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('sale_categories')
          .select('id, name, parent_category_id, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
        getTopSellingProducts(20),
        getFeaturedProducts()
      ]);

      if (productsResult.error) {
        setError(productsResult.error.message);
        return;
      }

      if (categoriesResult.error) {
        setError(categoriesResult.error.message);
        return;
      }

      // If any items are bundles/packs, show "pack pricing" (sale price + strikethrough separate total).
      const rawProducts = (productsResult.data || []) as MenuProduct[];
      const productIds = rawProducts.map((p) => p.id);

      const bundleOriginalTotals = new Map<string, number>();
      if (productIds.length > 0) {
        const { data: includeRows, error: includeError } = await supabase
          .from('sale_product_includes')
          .select('parent_sale_product_id, quantity, included:sale_products!included_sale_product_id(sale_price)')
          .in('parent_sale_product_id', productIds);

        // If RLS prevents access, just skip pack pricing (normal prices still render).
        if (!includeError && includeRows) {
          for (const row of includeRows as any[]) {
            const parentId = String(row.parent_sale_product_id);
            const qty = Math.max(1, Number(row.quantity || 1));
            const joined = Array.isArray(row.included) ? row.included?.[0] : row.included;
            const price = typeof joined?.sale_price === 'number' ? joined.sale_price : 0;
            if (!price) continue;
            bundleOriginalTotals.set(parentId, (bundleOriginalTotals.get(parentId) || 0) + qty * price);
          }
        }
      }

      setProducts(
        rawProducts.map((p) => ({
          ...p,
          bundle_original_total: bundleOriginalTotals.get(p.id) ?? null,
        }))
      );
      setCategories(categoriesResult.data || []);

      // Convert top sellers to MenuProduct format
      if (topSellersResult.data) {
        setTopSellers(topSellersResult.data.map(p => ({
          id: p.id,
          slug: p.slug ?? null,
          name: p.name,
          description: p.description,
          sale_price: p.sale_price,
          bundle_original_total: bundleOriginalTotals.get(p.id) ?? null,
          image_url: p.image_url,
          sale_category_id: p.sale_category_id,
          sub_category_id: p.sub_category_id
        })));
      }

      // Convert featured products to MenuProduct format
      if (featuredResult.data) {
        setFeaturedProducts(featuredResult.data.map(p => ({
          id: p.id,
          slug: p.slug ?? null,
          name: p.name,
          description: p.description,
          sale_price: p.sale_price,
          bundle_original_total: bundleOriginalTotals.get(p.id) ?? null,
          image_url: p.image_url,
          sale_category_id: p.sale_category_id,
          sub_category_id: p.sub_category_id
        })));
      }
    } catch (err) {
      setError('Failed to load menu');
      console.error('Error loading menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const categoryHierarchy = useMemo(() => {
    const mainCategories = categories.filter(cat => !cat.parent_category_id);
    const subCategories = categories.filter(cat => cat.parent_category_id);

    return mainCategories.map(mainCat => ({
      ...mainCat,
      sub_categories: subCategories.filter(subCat => subCat.parent_category_id === mainCat.id)
    }));
  }, [categories]);

  const topSellerIds = useMemo(() => new Set(topSellers.map(p => p.id)), [topSellers]);
  const featuredIds = useMemo(() => new Set(featuredProducts.map(p => p.id)), [featuredProducts]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(q) ||
      product.description?.toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const productsByMainCategoryId = useMemo(() => {
    const map = new Map<string, MenuProduct[]>();

    for (const mainCategory of categoryHierarchy) {
      const subCategoryIds = new Set(mainCategory.sub_categories.map(s => s.id));

      const items = products.filter(product =>
        product.sale_category_id === mainCategory.id ||
        (product.sub_category_id && subCategoryIds.has(product.sub_category_id))
      );

      map.set(mainCategory.id, items);
    }

    return map;
  }, [categoryHierarchy, products]);

  const handleSelectCategory = useCallback((categoryId: string | null) => {
    // Chips are scroll-only (no filtering). We keep state purely for UI highlight.
    setSelectedCategoryId(categoryId);

    // If the user is searching and taps a category, switch back to browse mode first.
    const hasSearch = !!searchTerm.trim();
    if (hasSearch) {
      setSearchTerm('');
    }

    const scroll = () => {
      if (categoryId) {
        const el = document.getElementById(`cat-${categoryId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    // Defer scroll to allow UI to switch out of search mode.
    if (hasSearch) {
      window.setTimeout(scroll, 0);
    } else {
      scroll();
    }
  }, [searchTerm]);

  const handleAddToCart = (customizations: CartAddonGroup[], comment?: string | null, removedIngredients?: string[], quantity?: number) => {
    if (!customizingProduct) return;

    const qty = Math.max(1, Math.min(99, quantity ?? 1));
    addItem({
      product_id: customizingProduct.id,
      name: customizingProduct.name,
      description: customizingProduct.description,
      base_price: customizingProduct.sale_price,
      image_url: customizingProduct.image_url,
      quantity: qty,
      addon_groups: customizations,
      removed_ingredients: removedIngredients || [],
      comment: comment || null
    });

    posthog.capture('add_to_cart', {
      product_id: customizingProduct.id,
      product_name: customizingProduct.name,
      price: customizingProduct.sale_price,
      quantity: qty,
      source: 'order_menu',
    });
    setCustomizingProduct(null);
    toast.success('Added to cart');
  };

  const handleQuickAdd = (product: MenuProduct) => {
    // Check if product has add-ons by trying to load them
    // For now, we'll always show customization modal
    // In a real app, you might want to check first
    setCustomizingProduct(product);
  };

  const ProductCard = ({ product }: { product: MenuProduct }) => {
    const isTopSeller = topSellerIds.has(product.id);
    const isFeatured = featuredIds.has(product.id);
    const slug = product.slug?.trim();
    const href = `/order/product/${slug ? slug : product.id}`;

    const bundleOriginalTotal = typeof product.bundle_original_total === 'number' ? product.bundle_original_total : 0;
    const bundleSavings = bundleOriginalTotal > product.sale_price ? bundleOriginalTotal - product.sale_price : 0;

    const { promo: productPromo, discountPerUnit } = pickBestProductPromotion(activePromotions, {
      id: product.id,
      sale_price: product.sale_price,
    });
    const discountedPrice = Math.max(0, product.sale_price - discountPerUnit);

    return (
      <div
        key={product.id}
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow relative cursor-pointer"
        role="link"
        tabIndex={0}
        onClick={() => {
          if (window.__justClosedReviewPopup) return;
          router.push(href);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (window.__justClosedReviewPopup) return;
            e.preventDefault();
            router.push(href);
          }
        }}
        aria-label={`View details for ${product.name}`}
        style={{ position: 'relative' }}
      >
        {/* Badges */}
        {(isTopSeller || isFeatured || discountPerUnit > 0.009) && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10">
            {isTopSeller && (
              <span className="px-2 py-1 bg-orange-500/90 text-white text-xs font-semibold rounded-full flex items-center gap-1 backdrop-blur">
                <Icon icon={FaFire} className="w-2 h-2" />
                Popular
              </span>
            )}
            {isFeatured && (
              <span className="px-2 py-1 bg-yellow-500/90 text-white text-xs font-semibold rounded-full flex items-center gap-1 backdrop-blur">
                <Icon icon={FaStar} className="w-2 h-2" />
                Featured
              </span>
            )}
            {discountPerUnit > 0.009 && productPromo && (
              <span className="px-2 py-1 bg-green-600/90 text-white text-xs font-semibold rounded-full backdrop-blur">
                {promotionLabel(productPromo)}
              </span>
            )}
          </div>
        )}

        <div className="aspect-[16/10] bg-gray-200 dark:bg-neutral-700 relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
              <Icon icon={FaUtensils} className="w-10 h-10" />
            </div>
          )}
          {/* Like/Dislike and Review widgets overlayed on image */}
          <LikeDislikeWidget productId={product.id} />
          <ReviewWidget productId={product.id} debug />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
              {product.name}
            </h3>
            <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
              <div className="flex items-baseline gap-2">
                {discountPerUnit > 0.009 ? (
                  <>
                    <span className="text-base font-bold text-green-700 dark:text-green-300">
                      ${discountedPrice.toFixed(2)}
                    </span>
                    <span className="text-sm font-semibold text-red-500 line-through">
                      ${product.sale_price.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-green-600 dark:text-green-400">
                    ${product.sale_price.toFixed(2)}
                  </span>
                )}
                {bundleSavings > 0.009 && (
                  <span className="text-sm font-semibold text-red-500 line-through">
                    ${bundleOriginalTotal.toFixed(2)}
                  </span>
                )}
              </div>
              {bundleSavings > 0.009 && (
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  Save ${bundleSavings.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAdd(product);
              }}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading || cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {loading ? 'Loading featured products...' : 'Loading cart...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadMenuData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 pb-24">
      {/* Live Order Tracker at the very top */}
      <LiveOrderTracker userId={userId} />

      {/* Navigation Header */}
      <OrderHeader />

      {/* Page Header */}
      <div className="bg-white dark:bg-neutral-800 shadow-sm border-b border-gray-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Browse the menu, add items to your cart, then checkout when you’re ready.
              </p>
              {todayLabel && todayHoursLabel && (
                <div className="mt-1 flex items-start gap-2 text-xs sm:text-sm">
                  <Icon icon={FaClock} className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{todayLabel}</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">hours:</span>{' '}
                      <span className="font-medium">{todayHoursLabel}</span>
                    </p>
                    {isStoreOpen === false && (
                      <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                        Online ordering is closed right now. You can still build your cart and place a
                        <span className="font-semibold"> pre-order</span> at checkout.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/order/summary"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              Go to cart
            </Link>
          </div>

          {topCartPromo && (
            <div className="mt-3 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-900 dark:text-green-100">
              <div className="font-semibold">{topCartPromo.title}</div>
              <div className="opacity-90">
                {topCartPromo.cart_scope === 'subtotal_min' && typeof topCartPromo.min_cart_subtotal === 'number'
                  ? `Spend $${topCartPromo.min_cart_subtotal.toFixed(2)}+ and get ${promotionLabel(topCartPromo)} (excludes delivery fee).`
                  : `${promotionLabel(topCartPromo)} (excludes delivery fee).`}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mt-4">
            <Icon icon={FaSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search dishes, burgers, sides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Category navigation */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-gray-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center">
          {/* Category nav: Arrow buttons for horizontal scroll (all screens) */}
          <div className="flex items-center w-full relative">
            <button
              className=" p-2 mr-2 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700"
              onClick={() => {
                if (categoryNavRef.current) {
                  categoryNavRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                }
              }}
              aria-label="Scroll categories left"
              type="button"
            >
              <FaChevronLeft />
            </button>
            <div
              ref={categoryNavRef}
              className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide"
              style={{ scrollBehavior: 'smooth' }}
            >
              <button
                onClick={() => handleSelectCategory(null)}
                className={`cursor-pointer px-4 py-2 rounded-full text-sm font-semibold transition-colors ${selectedCategoryId === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
              >
                All
              </button>
              {categoryHierarchy.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category.id)}
                  className={`cursor-pointer px-4 py-2 rounded-full text-sm font-semibold transition-colors ${selectedCategoryId === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <button
              className=" cursor-pointer p-2 ml-2 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700"
              onClick={() => {
                if (categoryNavRef.current) {
                  categoryNavRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                }
              }}
              aria-label="Scroll categories right"
              type="button"
            >
              <FaChevronRight />
            </button>
          </div>
          {/* Mobile: No modal/filter, use same nav as desktop */}
        </div>
        {/* Mobile Category Modal removed: unified nav */}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        {/* Search results */}
        {searchTerm.trim() ? (
          <section>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Search results</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchResults.length} item{searchResults.length === 1 ? '' : 's'} matching “{searchTerm.trim()}”
                </p>
              </div>
              {selectedCategoryId !== null && (
                <button
                  onClick={() => handleSelectCategory(null)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Back to top
                </button>
              )}
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Icon icon={FaUtensils} className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {searchResults.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Featured section */}
            {featuredProducts.length > 0 && (
              <section>
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Icon icon={FaStar} className="text-yellow-500" />
                      Featured picks
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Customer favorites and seasonal highlights.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {featuredProducts.slice(0, 12).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}

            {/* Top sellers section */}
            {topSellers.length > 0 && (
              <section>
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Icon icon={FaFire} className="text-orange-500" />
                      Popular right now
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The most ordered items recently.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {topSellers.slice(0, 12).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}

            {/* Category browse */}
            <section>
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Browse by category</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pick a category above, or scroll to explore everything.
                  </p>
                </div>
                {selectedCategoryId !== null && (
                  <button
                    onClick={() => handleSelectCategory(null)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Back to top
                  </button>
                )}
              </div>

              <div className="space-y-10">
                {categoryHierarchy.map(category => {
                  const items = productsByMainCategoryId.get(category.id) || [];
                  if (items.length === 0) return null;

                  return (
                    <div
                      key={category.id}
                      id={`cat-${category.id}`}
                      className={selectedCategoryId === category.id ? 'scroll-mt-28' : 'scroll-mt-28'}
                    >
                      <div className="flex items-end justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{category.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {items.length} item{items.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSelectCategory(category.id)}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Jump
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {items.map(product => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Item Customization Modal */}
      {customizingProduct && (
        <ItemCustomizationModal
          isOpen={!!customizingProduct}
          onClose={() => setCustomizingProduct(null)}
          product={customizingProduct}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart Sidebar */}
      <CartSidebar hideFloatBubble={!!customizingProduct} />
      <LiveOrderTracker userId={userId} />
    </div>
  );
}
