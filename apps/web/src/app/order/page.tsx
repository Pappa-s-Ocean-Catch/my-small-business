'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { CartSidebar } from '@/components/CartSidebar';
import { OrderHeader } from '@/components/OrderHeader';
import { getFeatureFlags } from '@/app/actions/feature-flags';
import { getTopSellingProducts, getFeaturedProducts } from '@/app/actions/top-sellers';
import { FaUtensils, FaSearch, FaFire, FaStar } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import type { CartAddonGroup } from '@/contexts/CartContext';

interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
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
  const router = useRouter();
  const { addItem, isLoading: cartLoading } = useCart();
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [topSellers, setTopSellers] = useState<MenuProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [customizingProduct, setCustomizingProduct] = useState<MenuProduct | null>(null);

  const hasLoadedRef = useRef(false);

  // Check feature flag
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const flags = await getFeatureFlags();
        if (!flags.enable_pickup_order) {
          // Redirect to home if pickup orders are disabled
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking feature flag:', error);
      }
    };
    void checkFeatureFlag();
  }, [router]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const [productsResult, categoriesResult, topSellersResult, featuredResult] = await Promise.all([
        supabase
          .from('sale_products')
          .select('id, name, description, sale_price, image_url, sale_category_id, sub_category_id')
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

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);

      // Convert top sellers to MenuProduct format
      if (topSellersResult.data) {
        setTopSellers(topSellersResult.data.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          sale_price: p.sale_price,
          image_url: p.image_url,
          sale_category_id: p.sale_category_id,
          sub_category_id: p.sub_category_id
        })));
      }

      // Convert featured products to MenuProduct format
      if (featuredResult.data) {
        setFeaturedProducts(featuredResult.data.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          sale_price: p.sale_price,
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

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categoryHierarchy.find(c => c.id === selectedCategoryId) || null;
  }, [categoryHierarchy, selectedCategoryId]);

  const selectedCategoryProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    return productsByMainCategoryId.get(selectedCategoryId) || [];
  }, [productsByMainCategoryId, selectedCategoryId]);

  const handleSelectCategory = useCallback((categoryId: string | null) => {
    setSelectedCategoryId(categoryId);

    if (categoryId) {
      // Scroll into view for a smoother browse experience
      const el = document.getElementById(`cat-${categoryId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleAddToCart = (customizations: CartAddonGroup[], comment?: string | null) => {
    if (!customizingProduct) return;

    addItem({
      product_id: customizingProduct.id,
      name: customizingProduct.name,
      description: customizingProduct.description,
      base_price: customizingProduct.sale_price,
      image_url: customizingProduct.image_url,
      quantity: 1,
      addon_groups: customizations,
      comment: comment || null
    });

    setCustomizingProduct(null);
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

    return (
      <div
        key={product.id}
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow relative"
      >
        {/* Badges */}
        {(isTopSeller || isFeatured) && (
          <div className="absolute top-2 left-2 flex gap-1 z-10">
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
          </div>
        )}

        <Link href={`/order/product/${product.id}`} aria-label={`View details for ${product.name}`}>
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
          </div>
        </Link>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
              <Link href={`/order/product/${product.id}`} className="hover:underline">
                {product.name}
              </Link>
            </h3>
            <span className="text-base font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
              ${product.sale_price.toFixed(2)}
            </span>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => handleQuickAdd(product)}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Add
            </button>
            <Link
              href={`/order/product/${product.id}`}
              className="px-4 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
            >
              Details
            </Link>
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
            {loading ? 'Loading menu...' : 'Loading cart...'}
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
      {/* Navigation Header */}
      <OrderHeader />

      {/* Page Header */}
      <div className="bg-white dark:bg-neutral-800 shadow-sm border-b border-gray-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon={FaUtensils} className="text-blue-600" />
                Order Online
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Browse the menu, add items to your cart, then checkout when you’re ready.
              </p>
            </div>
            <Link
              href="/order/summary"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              Go to cart
            </Link>
          </div>

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
            <button
              onClick={() => handleSelectCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${selectedCategoryId === null
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
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${selectedCategoryId === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-700'
                  }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
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
                  Clear category
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
                {(selectedCategoryId ? searchResults.filter(p => selectedCategoryProducts.some(sp => sp.id === p.id)) : searchResults)
                  .map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Featured section */}
            {featuredProducts.length > 0 && selectedCategoryId === null && (
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
            {topSellers.length > 0 && selectedCategoryId === null && (
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
            {selectedCategoryId ? (
              <section id={`cat-${selectedCategoryId}`}>
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedCategory?.name || 'Category'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedCategoryProducts.length} item{selectedCategoryProducts.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectCategory(null)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Show all
                  </button>
                </div>

                {selectedCategoryProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Icon icon={FaUtensils} className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No items found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {selectedCategoryProducts.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section>
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Browse by category</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Pick a category above, or scroll to explore everything.
                    </p>
                  </div>
                </div>

                <div className="space-y-10">
                  {categoryHierarchy.map(category => {
                    const items = productsByMainCategoryId.get(category.id) || [];
                    if (items.length === 0) return null;

                    return (
                      <div key={category.id} id={`cat-${category.id}`}>
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
                            View
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {items.slice(0, 8).map(product => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
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
      <CartSidebar />
    </div>
  );
}
