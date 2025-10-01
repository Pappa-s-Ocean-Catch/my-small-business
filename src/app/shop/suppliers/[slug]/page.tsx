"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import Card from "@/components/Card";
import { FaTruck, FaPhone, FaEnvelope, FaMapMarkerAlt, FaGlobe, FaBox, FaArrowLeft, FaTag, FaFilter, FaEye, FaDollarSign, FaWarehouse, FaLayerGroup, FaTh, FaList } from "react-icons/fa";
import Link from "next/link";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  image_url: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  purchase_price: number;
  sale_price: number;
  quantity_in_stock: number;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  supplier_type: 'primary' | 'alternative';
  category?: { name: string } | null;
};

export default function SupplierDetailsPage() {
  const params = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'primary' | 'alternative'>('all');
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

  const fetchSupplierData = useCallback(async () => {
    if (!params.slug) return;
    
    const supabase = getSupabaseClient();
    
    // Get supplier by ID (assuming slug is the supplier ID)
    const { data: supplierData, error: supplierError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", params.slug)
      .single();

    if (supplierError || !supplierData) {
      console.error("Error fetching supplier:", supplierError);
      setLoading(false);
      return;
    }

    setSupplier(supplierData);

    // Get all products where this supplier is either primary or alternative
    const { data: primaryProducts } = await supabase
      .from("products")
      .select(`
        *,
        category:categories(name)
      `)
      .eq("supplier_id", params.slug);

    const { data: alternativeProducts } = await supabase
      .from("product_alternative_suppliers")
      .select(`
        product:products(
          *,
          category:categories(name)
        )
      `)
      .eq("supplier_id", params.slug);

    // Combine and format products
    const primaryProductsList = (primaryProducts || []).map(product => ({
      ...product,
      supplier_type: 'primary' as const
    }));

    const alternativeProductsList = (alternativeProducts || [])
      .map(item => item.product)
      .filter(Boolean)
      .map(product => ({
        ...product,
        supplier_type: 'alternative' as const
      }));

    const allProducts = [...primaryProductsList, ...alternativeProductsList];
    setProducts(allProducts);
    setFilteredProducts(allProducts);
    setLoading(false);
  }, [params.slug]);

  useEffect(() => {
    if (isAdmin) {
      void fetchSupplierData();
    }
  }, [isAdmin, fetchSupplierData]);

  // Filter products based on selected filter
  useEffect(() => {
    if (filterType === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => product.supplier_type === filterType));
    }
  }, [products, filterType]);

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading supplier details...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view supplier details.
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center text-red-600">
        Supplier not found.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/shop/suppliers"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Suppliers
          </Link>
        </div>

        {/* Supplier Info */}
        <Card variant="elevated" padding="lg" className="mb-6">
          <div className="flex items-start gap-4">
            {supplier.image_url ? (
              <img 
                src={supplier.image_url} 
                alt={`${supplier.name} logo`}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
              />
            ) : (
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <FaTruck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {supplier.name}
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {supplier.contact_person && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <FaPhone className="w-3 h-3" />
                      <span>{supplier.contact_person}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <FaPhone className="w-3 h-3" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <FaEnvelope className="w-3 h-3" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {supplier.website && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <FaGlobe className="w-3 h-3" />
                      <a 
                        href={supplier.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {supplier.website}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <FaMapMarkerAlt className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{supplier.address}</span>
                    </div>
                  )}
                </div>
              </div>
              {supplier.notes && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    &ldquo;{supplier.notes}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Products Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Products from {supplier.name}
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
                    onClick={() => setFilterType('primary')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === 'primary'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Primary
                  </button>
                  <button
                    onClick={() => setFilterType('alternative')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === 'alternative'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Alternative
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
                  ? 'This supplier doesn\'t have any products associated with it yet.'
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
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      product.supplier_type === 'primary'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      <FaTag className="w-3 h-3" />
                      {product.supplier_type === 'primary' ? 'Primary' : 'Alternative'}
                    </span>
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
                    
                    {product.category && (
                      <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FaLayerGroup className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Category</span>
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white text-xs">
                          {product.category.name}
                        </p>
                      </div>
                    )}
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
                        Type
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
                        Category
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
                            product.supplier_type === 'primary'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            <FaTag className="w-3 h-3" />
                            {product.supplier_type === 'primary' ? 'Primary' : 'Alternative'}
                          </span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.category?.name || '-'}
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
