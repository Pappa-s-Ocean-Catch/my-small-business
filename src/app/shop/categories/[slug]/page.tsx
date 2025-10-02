"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import Card from "@/components/Card";
import { FaTags, FaBox, FaArrowLeft, FaEye, FaDollarSign, FaWarehouse, FaLayerGroup, FaTh, FaList, FaTruck } from "react-icons/fa";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  purchase_price: number;
  sale_price: number;
  quantity_in_stock: number;
  unit_type: 'item' | 'kg' | 'litre' | 'piece';
  is_active: boolean;
  description: string | null;
  supplier?: { name: string } | null;
  supplier_type?: 'primary' | 'alternative';
};

export default function CategoryDetailsPage() {
  const params = useParams();
  const categoryId = params.slug as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        return;
      }

      const ensureResult = await ensureProfile(user.id, user.email);
      if (!ensureResult.ok) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role_slug")
        .eq("id", user.id)
        .single();

      if (profile && profile.role_slug === "admin") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    void checkAdmin();
  }, []);

  const fetchCategoryData = useCallback(async () => {
    if (!categoryId || !isAdmin) return;

    setLoading(true);
    const supabase = getSupabaseClient();

    // Fetch category details
    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", categoryId)
      .single();

    if (categoryError || !categoryData) {
      console.error("Error fetching category:", categoryError);
      setCategory(null);
      setProducts([]);
      setLoading(false);
      return;
    }
    setCategory(categoryData);

    // Fetch products in this category
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(`
        id, name, sku, image_url, purchase_price, sale_price, quantity_in_stock, unit_type, is_active, description,
        supplier:suppliers(name)
      `)
      .eq("category_id", categoryId)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      setProducts([]);
      setLoading(false);
      return;
    }

    const productsList: Product[] = (productsData || []).map(product => ({
      ...product,
      supplier: product.supplier && product.supplier.length > 0 ? { name: product.supplier[0].name } : null,
      supplier_type: 'primary' as const
    }));

    setProducts(productsList);
    setFilteredProducts(productsList);
    setLoading(false);
  }, [categoryId, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void fetchCategoryData();
    }
  }, [isAdmin, fetchCategoryData]);

  // Filter products based on selected filter
  useEffect(() => {
    if (filterType === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => 
        filterType === 'active' ? product.is_active : !product.is_active
      ));
    }
  }, [products, filterType]);

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading category details...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view category details.
      </div>
    );
  }

  if (!category) {
    return (
      <div className="p-6 text-center text-red-600">
        Category not found.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/shop/categories"
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Categories
          </Link>
        </div>

        {/* Category Details */}
        <Card variant="elevated" padding="lg" className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <FaTags className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Category Details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <FaTags className="w-4 h-4" />
              <span>Products: {products.length}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <FaBox className="w-4 h-4" />
              <span>Active Products: {products.filter(p => p.is_active).length}</span>
            </div>
          </div>

          {category.description && (
            <div className="border-t border-gray-200 dark:border-neutral-700 pt-4 mt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
              <p className="text-gray-600 dark:text-gray-400 italic">
                &ldquo;{category.description}&rdquo;
              </p>
            </div>
          )}
        </Card>

        {/* Products Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Products in {category.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredProducts.length} of {products.length} product{products.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">View:</span>
                <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                      viewMode === 'cards'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <FaTh className="w-3 h-3" />
                    Cards
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                      viewMode === 'table'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <FaList className="w-3 h-3" />
                    Table
                  </button>
                </div>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
                <div className="flex bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === 'all'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('active')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === 'active'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setFilterType('inactive')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === 'inactive'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <Card variant="elevated" padding="lg" className="text-center">
              <FaBox className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {products.length === 0 ? 'No products found' : 'No products match the filter'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {products.length === 0 
                  ? 'This category doesn\'t have any products yet.'
                  : 'Try changing the filter to see more products.'
                }
              </p>
            </Card>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <Card key={product.id} variant="elevated" padding="lg" hover className="group">
                  {/* Product Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <FaBox className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                          SKU: {product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {product.supplier && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                          <FaTruck className="w-3 h-3" />
                          {product.supplier.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Product Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FaDollarSign className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Purchase</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${product.purchase_price.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FaDollarSign className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Sale</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${product.sale_price.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FaWarehouse className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Stock</span>
                      </div>
                      <p className={`font-semibold ${
                        product.quantity_in_stock > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {product.quantity_in_stock} units
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FaLayerGroup className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Category</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-xs">
                        {category.name}
                      </p>
                    </div>
                  </div>

                  {/* Product Description */}
                  {product.description && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-3 border-t border-gray-200 dark:border-neutral-700">
                    <Link
                      href={`/shop/products/${product.id}`}
                      className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group-hover:underline"
                    >
                      <FaEye className="w-3 h-3" />
                      View Product Details
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Table View */
            <Card variant="elevated" padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Purchase Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sale Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-700">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-neutral-700 mr-3"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                                <FaBox className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                SKU: {product.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            product.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.supplier?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ${product.purchase_price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ${product.sale_price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${
                            product.quantity_in_stock > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {product.quantity_in_stock} units
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/shop/products/${product.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                          >
                            <FaEye className="w-3 h-3" />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
