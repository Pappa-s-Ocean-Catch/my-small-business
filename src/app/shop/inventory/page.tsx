"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { FaWarehouse, FaArrowUp, FaArrowDown, FaHistory, FaSearch, FaFilter, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify';
import { saveAs } from "file-saver";
import { format } from "date-fns";

type Product = {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
  reorder_level: number;
  warning_threshold: number;
  alert_threshold: number;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};

type DatabaseProduct = {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
  reorder_level: number;
  warning_threshold?: number;
  alert_threshold?: number;
  category?: { name: string }[] | null;
  supplier?: { name: string }[] | null;
};

type StockMovement = {
  id: string;
  product_id: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  product: Product;
  created_by?: { email: string } | null;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'movements'>('current');
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [adjustmentModal, setAdjustmentModal] = useState<{ product: Product | null; isOpen: boolean }>({ product: null, isOpen: false });
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity: "",
    reason: "",
    notes: ""
  });

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

  const fetchData = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    
    const [
      { data: productsData },
      { data: movementsData }
    ] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id, name, sku, quantity_in_stock, reorder_level,
          category:categories(name),
          supplier:suppliers(name)
        `)
        .order("name"),
      supabase
        .from("stock_movements")
        .select(`
          *,
          product:products(id, name, sku),
          created_by:profiles(email)
        `)
        .order("created_at", { ascending: false })
        .limit(100)
    ]);

    // Transform the data to match the expected types
    const transformedProducts = productsData?.map((product: DatabaseProduct) => ({
      ...product,
      category: product.category?.[0] || null,
      supplier: product.supplier?.[0] || null,
      warning_threshold: product.warning_threshold || 10,
      alert_threshold: product.alert_threshold || 5
    })) || [];

    setProducts(transformedProducts);
    setStockMovements(movementsData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchData();
    }
  }, [isAdmin, fetchData]);

  const handleStockAdjustment = (product: Product) => {
    setAdjustmentModal({ product, isOpen: true });
    setAdjustmentForm({
      quantity: product.quantity_in_stock.toString(),
      reason: "Manual Adjustment",
      notes: ""
    });
  };

  const saveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentModal.product) return;

    const supabase = getSupabaseClient();
    const newQuantity = parseInt(adjustmentForm.quantity);
    const currentQuantity = adjustmentModal.product.quantity_in_stock;

    // Update the product quantity
    await supabase
      .from("products")
      .update({ quantity_in_stock: newQuantity })
      .eq("id", adjustmentModal.product.id);

    // The trigger will automatically create a stock movement record
    await fetchData();
    setAdjustmentModal({ product: null, isOpen: false });
    setAdjustmentForm({ quantity: "", reason: "", notes: "" });
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredMovements = stockMovements.filter(movement => {
    const matchesSearch = movement.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || movement.movement_type === filterType;
    return matchesSearch && matchesType;
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return <FaArrowUp className="w-4 h-4 text-green-600" />;
      case 'out': return <FaArrowDown className="w-4 h-4 text-red-600" />;
      case 'adjustment': return <FaHistory className="w-4 h-4 text-blue-600" />;
      default: return <FaHistory className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'in': return 'text-green-600 dark:text-green-400';
      case 'out': return 'text-red-600 dark:text-red-400';
      case 'adjustment': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const exportCurrentStockToExcel = () => {
    const exportData = filteredProducts.map(product => ({
      'Product Name': product.name,
      'SKU': product.sku,
      'Category': product.category?.name || 'None',
      'Supplier': product.supplier?.name || 'None',
      'Current Stock': product.quantity_in_stock,
      'Reorder Level': product.reorder_level,
      'Status': product.quantity_in_stock === 0 
        ? 'Out of Stock' 
        : product.quantity_in_stock <= product.reorder_level 
          ? 'Low Stock' 
          : 'In Stock',
      'Stock Difference': product.quantity_in_stock - product.reorder_level
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Current Stock");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `current-stock-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Current stock Excel downloaded');
  };

  const exportStockMovementsToExcel = () => {
    const exportData = filteredMovements.map(movement => ({
      'Date': format(new Date(movement.created_at), 'yyyy-MM-dd HH:mm'),
      'Product Name': movement.product.name,
      'SKU': movement.product.sku,
      'Movement Type': movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1),
      'Quantity Change': movement.quantity_change,
      'Previous Quantity': movement.previous_quantity,
      'New Quantity': movement.new_quantity,
      'Reason': movement.reason || '',
      'Reference': movement.reference || '',
      'Notes': movement.notes || '',
      'Created By': movement.created_by?.email || 'System'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movements");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `stock-movements-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Stock movements Excel downloaded');
  };

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading inventory...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view inventory.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track stock levels and movements
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'current' ? (
              <button
                onClick={exportCurrentStockToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Current Stock
              </button>
            ) : (
              <button
                onClick={exportStockMovementsToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Movements
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'current'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Current Stock
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'movements'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Stock Movements
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 p-4 bg-white dark:bg-neutral-900 rounded-lg border">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'current' ? 'products' : 'movements'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            {activeTab === 'movements' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
                <option value="adjustment">Adjustments</option>
              </select>
            )}
          </div>
        </div>

        {/* Current Stock Tab */}
        {activeTab === 'current' && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reorder Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.sku}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.category?.name || "None"}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.quantity_in_stock}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.reorder_level}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.quantity_in_stock === 0 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : product.quantity_in_stock <= product.reorder_level 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {product.quantity_in_stock === 0 
                              ? 'Out of Stock'
                              : product.quantity_in_stock <= product.reorder_level 
                                ? 'Low Stock'
                                : 'In Stock'
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleStockAdjustment(product)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Movements Tab */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            {filteredMovements.length === 0 ? (
              <div className="text-center py-12">
                <FaHistory className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No movements found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Stock movements will appear here as you manage your inventory
                </p>
              </div>
            ) : (
              filteredMovements.map((movement) => (
                <div key={movement.id} className="bg-white dark:bg-neutral-900 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getMovementIcon(movement.movement_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {movement.product.name}
                          </h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({movement.product.sku})
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className={`font-medium ${getMovementColor(movement.movement_type)}`}>
                            {movement.movement_type === 'in' ? '+' : ''}{movement.quantity_change} units
                          </span>
                          <span>
                            {movement.previous_quantity} → {movement.new_quantity}
                          </span>
                          <span>
                            {format(new Date(movement.created_at), "MMM dd, yyyy 'at' HH:mm")}
                          </span>
                        </div>
                        {movement.reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Reason: {movement.reason}
                          </p>
                        )}
                        {movement.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 italic">
                            {movement.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {movement.created_by?.email || 'System'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {adjustmentModal.isOpen && adjustmentModal.product && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setAdjustmentModal({ product: null, isOpen: false })}>
            <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">Adjust Stock</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Adjusting stock for: <strong>{adjustmentModal.product.name}</strong>
              </p>
              
              <form onSubmit={saveStockAdjustment} className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">New Quantity *</span>
                  <input
                    type="number"
                    required
                    className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    value={adjustmentForm.quantity}
                    onChange={(e) => setAdjustmentForm(f => ({ ...f, quantity: e.target.value }))}
                    min="0"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Reason *</span>
                  <input
                    type="text"
                    required
                    className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g., Manual Adjustment, Stock Count, etc."
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Notes</span>
                  <textarea
                    className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                    value={adjustmentForm.notes}
                    onChange={(e) => setAdjustmentForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Additional notes about this adjustment..."
                    rows={3}
                  />
                </label>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setAdjustmentModal({ product: null, isOpen: false })}
                    className="h-10 px-4 rounded-xl border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Update Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
