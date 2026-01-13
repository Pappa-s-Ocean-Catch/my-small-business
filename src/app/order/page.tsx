'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { CartSidebar } from '@/components/CartSidebar';
import { OrderHeader } from '@/components/OrderHeader';
import { getFeatureFlags } from '@/app/actions/feature-flags';
import { getTopSellingProducts, getFeaturedProducts } from '@/app/actions/top-sellers';
import { FaUtensils, FaSearch, FaTag, FaFire, FaStar } from 'react-icons/fa';
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
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [customizingProduct, setCustomizingProduct] = useState<MenuProduct | null>(null);

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
    loadMenuData();
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

  const filteredProducts = useMemo(() => {
    let filtered: MenuProduct[] = [];

    // Determine which product list to use based on filter type
    if (filterType === 'top-sellers') {
      filtered = topSellers;
    } else if (filterType === 'featured') {
      filtered = featuredProducts;
    } else if (filterType === 'category' && selectedCategoryId) {
      // Filter by category
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category) {
        const subCategoryIds = categories
          .filter(c => c.parent_category_id === category.id)
          .map(c => c.id);
        
        filtered = products.filter(product => 
          product.sale_category_id === selectedCategoryId ||
          (product.sub_category_id && subCategoryIds.includes(product.sub_category_id))
        );
      } else {
        filtered = products;
      }
    } else {
      // All products
      filtered = products;
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [products, topSellers, featuredProducts, selectedCategoryId, searchTerm, categories, filterType]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FaUtensils className="text-blue-600" />
            Order Online
          </h1>

          {/* Search */}
          <div className="relative mb-4">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setFilterType('all');
                setSelectedCategoryId(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filterType === 'all' && selectedCategoryId === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-600'
              }`}
            >
              <FaUtensils className="w-3 h-3" />
              All Items
            </button>
            <button
              onClick={() => {
                setFilterType('top-sellers');
                setSelectedCategoryId(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filterType === 'top-sellers'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-600'
              }`}
            >
              <FaFire className="w-3 h-3" />
              Top Sellers
            </button>
            <button
              onClick={() => {
                setFilterType('featured');
                setSelectedCategoryId(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filterType === 'featured'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-600'
              }`}
            >
              <FaStar className="w-3 h-3" />
              Featured
            </button>
            {categoryHierarchy.map(category => (
              <button
                key={category.id}
                onClick={() => {
                  setFilterType('category');
                  setSelectedCategoryId(category.id);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'category' && selectedCategoryId === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-600'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <FaUtensils className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => {
              const isTopSeller = topSellers.some(p => p.id === product.id);
              const isFeatured = featuredProducts.some(p => p.id === product.id);
              
              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow relative"
                >
                  {/* Badges */}
                  {(isTopSeller || isFeatured) && (
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      {isTopSeller && (
                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                          <FaFire className="w-2 h-2" />
                          Top Seller
                        </span>
                      )}
                      {isFeatured && (
                        <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                          <FaStar className="w-2 h-2" />
                          Featured
                        </span>
                      )}
                    </div>
                  )}
                  
                  {product.image_url && (
                    <div className="aspect-video bg-gray-200 dark:bg-neutral-700 relative">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${product.sale_price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleQuickAdd(product)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
