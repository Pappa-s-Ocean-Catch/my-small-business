'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Card from '@/components/Card';
import { Loading } from '@/components/Loading';
import { FaArrowLeft, FaBox, FaWarehouse, FaChartLine, FaHistory, FaShoppingCart, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';

interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category_id: string;
  category_name: string;
  supplier_id: string;
  supplier_name: string;
  cost_price: number;
  selling_price: number;
  units_per_box: number;
  reorder_level: number;
  quantity_in_stock: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
  created_at: string;
  updated_at: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity_change: number;
  boxes_added: number;
  units_added: number;
  reason: string;
  reference: string;
  notes: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
}

interface PurchaseAnalytics {
  total_purchases: number;
  total_quantity: number;
  average_order_size: number;
  last_purchase_date: string;
  purchase_frequency_days: number;
  monthly_trends: Array<{
    month: string;
    quantity: number;
    orders: number;
  }>;
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [analytics, setAnalytics] = useState<PurchaseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const productId = params.id as string;

  useEffect(() => {
    if (user && !authLoading) {
      void fetchProductDetails();
    }
  }, [user, authLoading, productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          suppliers(name)
        `)
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      const product: Product = {
        ...productData,
        category_name: productData.categories?.name || 'Uncategorized',
        supplier_name: productData.suppliers?.name || 'Unknown Supplier',
        total_units: productData.total_units || productData.quantity_in_stock
      };

      setProduct(product);

      // Fetch stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          created_by:profiles(full_name)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (movementsError) throw movementsError;

      const movements: StockMovement[] = movementsData.map(movement => ({
        ...movement,
        created_by_name: movement.created_by?.full_name || 'Unknown User'
      }));

      setMovements(movements);

      // Fetch purchase analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .rpc('get_product_purchase_analytics', { p_product_id: productId });

      if (analyticsError) {
        console.warn('Analytics not available:', analyticsError);
        setAnalytics(null);
      } else {
        setAnalytics(analyticsData);
      }

    } catch (err) {
      console.error('Error fetching product details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'received': return <FaBox className="w-4 h-4 text-green-600" />;
      case 'consume': return <FaShoppingCart className="w-4 h-4 text-red-600" />;
      case 'adjustment': return <FaWarehouse className="w-4 h-4 text-blue-600" />;
      default: return <FaHistory className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'received': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'consume': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'adjustment': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const formatStockDisplay = (product: Product) => {
    if (product.units_per_box === 1) {
      return `${product.total_units} units`;
    }
    
    const fullBoxes = product.full_boxes || 0;
    const looseUnits = product.loose_units || 0;
    
    if (fullBoxes === 0 && looseUnits === 0) {
      return '0 units';
    }
    
    if (fullBoxes === 0) {
      return `${looseUnits} loose units`;
    }
    
    if (looseUnits === 0) {
      return `${fullBoxes} boxes`;
    }
    
    return `${fullBoxes} boxes + ${looseUnits} loose units = ${product.total_units} total`;
  };

  const getStockStatus = (product: Product) => {
    if (product.total_units === 0) {
      return { status: 'Out of Stock', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <FaExclamationTriangle className="w-4 h-4" /> };
    } else if (product.total_units <= product.reorder_level) {
      return { status: 'Low Stock', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', icon: <FaExclamationTriangle className="w-4 h-4" /> };
    } else {
      return { status: 'In Stock', color: 'text-green-600 bg-green-50 dark:bg-green-900/20', icon: <FaWarehouse className="w-4 h-4" /> };
    }
  };

  if (authLoading || loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Error</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
            >
              <FaArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h1>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
            >
              <FaArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(product);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <FaArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">SKU: {product.sku}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Product Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.sku}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.category_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.supplier_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost Price</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">${product.cost_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Selling Price</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">${product.selling_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Units per Box</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.units_per_box}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reorder Level</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.reorder_level}</p>
                  </div>
                </div>
                {product.description && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.description}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Stock Movements History */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Stock Movements</h2>
                {movements.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No stock movements recorded</p>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-neutral-700">
                        <div className="flex items-center space-x-3">
                          {getMovementIcon(movement.movement_type)}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {movement.movement_type}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {movement.reason || 'No reason provided'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${movement.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(movement.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stock Status */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Stock</h2>
                <div className="text-center">
                  <div className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${stockStatus.color} mb-4`}>
                    {stockStatus.icon}
                    <span className="ml-2">{stockStatus.status}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {formatStockDisplay(product)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Reorder at: {product.reorder_level} units
                  </p>
                </div>
              </div>
            </Card>

            {/* Purchase Analytics */}
            {analytics && (
              <Card>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Purchase Analytics</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Purchases</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{analytics.total_purchases}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Quantity</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{analytics.total_quantity} units</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Average Order Size</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{analytics.average_order_size.toFixed(1)} units</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Purchase</label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {analytics.last_purchase_date ? new Date(analytics.last_purchase_date).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Frequency</label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {analytics.purchase_frequency_days ? `Every ${analytics.purchase_frequency_days} days` : 'No pattern'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push(`/shop/inventory/enhanced?product=${product.id}`)}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <FaWarehouse className="w-4 h-4 mr-2" />
                    Manage Stock
                  </button>
                  <button
                    onClick={() => router.push(`/shop/products?edit=${product.id}`)}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-600 dark:hover:bg-neutral-700"
                  >
                    <FaBox className="w-4 h-4 mr-2" />
                    Edit Product
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
