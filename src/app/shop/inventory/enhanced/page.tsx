"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { FaWarehouse, FaArrowUp, FaArrowDown, FaHistory, FaSearch, FaFilter, FaFileExcel, FaChartLine, FaShoppingCart, FaBoxOpen, FaDollarSign } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify';
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

type Product = {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
  reorder_level: number;
  warning_threshold: number;
  alert_threshold: number;
  purchase_price: number;
  sale_price: number;
  units_per_box: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
  category: { name: string } | null;
  supplier: { name: string } | null;
  created_at: string;
  updated_at: string;
};

type DatabaseProduct = {
  id: string;
  name: string;
  sku: string;
  quantity_in_stock: number;
  reorder_level: number;
  warning_threshold?: number;
  alert_threshold?: number;
  purchase_price: number;
  sale_price: number;
  units_per_box: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
  category: { name: string }[] | null;
  supplier: { name: string }[] | null;
  created_at: string;
  updated_at: string;
};

type InventoryMovement = {
  id: string;
  product_id: string;
  movement_type: 'purchase' | 'consumption' | 'adjustment' | 'return' | 'transfer';
  quantity_change: number;
  unit_cost: number | null;
  total_cost: number | null;
  previous_quantity: number;
  new_quantity: number;
  boxes_added: number;
  units_added: number;
  previous_boxes: number;
  previous_loose_units: number;
  new_boxes: number;
  new_loose_units: number;
  reason: string | null;
  reference: string | null;
  notes: string | null;
  movement_date: string;
  created_by: { email: string } | null;
  created_at: string;
  product: {
    name: string;
    sku: string;
  };
};

type FinancialSummary = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity_in_stock: number;
  purchase_price: number;
  sale_price: number;
  average_cost: number;
  inventory_value: number;
  total_purchased_quantity: number;
  total_purchase_cost: number;
  total_consumed_quantity: number;
  total_cogs: number;
  profit_per_unit: number;
  potential_revenue: number;
};

type MovementSummary = {
  movement_date: string;
  movement_type: string;
  total_quantity_change: number;
  total_cost: number;
  movement_count: number;
};

export default function EnhancedInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'movements' | 'financial' | 'charts'>('current');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary[]>([]);
  const [movementSummary, setMovementSummary] = useState<MovementSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [movementModal, setMovementModal] = useState<{ isOpen: boolean; product: Product | null; type: 'purchase' | 'consumption' | 'adjustment' | null }>({ isOpen: false, product: null, type: null });
  const [endOfDayModal, setEndOfDayModal] = useState<{ isOpen: boolean; product: Product | null }>({ isOpen: false, product: null });
  const [movementForm, setMovementForm] = useState({
    quantity: "",
    boxes: "",
    units: "",
    unit_cost: "",
    reason: "",
    reference: "",
    notes: ""
  });
  const [endOfDayForm, setEndOfDayForm] = useState({
    boxes: "",
    units: "",
    reason: "End of day adjustment",
    notes: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      
      // Fetch products with categories and suppliers
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name)
        `)
        .eq("is_active", true)
        .order("name");

      if (productsError) {
        console.error("Error fetching products:", productsError);
      } else if (productsData) {
        setProducts(productsData.map((p: DatabaseProduct) => ({
          ...p,
          category: Array.isArray(p.category) ? p.category[0] : p.category,
          supplier: Array.isArray(p.supplier) ? p.supplier[0] : p.supplier,
          warning_threshold: p.warning_threshold || 10,
          alert_threshold: p.alert_threshold || 5
        })));
      }

      // Fetch inventory movements
      const { data: movementsData, error: movementsError } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          product:products(name, sku)
        `)
        .order("movement_date", { ascending: false });

      if (movementsError) {
        console.error("Error fetching movements:", movementsError);
        setMovements([]);
      } else if (movementsData) {
        // Fetch user emails separately to avoid relationship issues
        const userIds = [...new Set(movementsData.map(m => m.created_by).filter(Boolean))];
        let userEmails: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", userIds);
          
          if (profilesData) {
            userEmails = profilesData.reduce((acc, profile) => {
              acc[profile.id] = profile.email;
              return acc;
            }, {} as Record<string, string>);
          }
        }

        setMovements(movementsData.map(m => ({
          ...m,
          product: Array.isArray(m.product) ? m.product[0] : m.product,
          created_by: m.created_by ? { email: userEmails[m.created_by] || 'Unknown User' } : null
        })));
      }

      // Fetch financial summary
      const { data: financialData, error: financialError } = await supabase
        .from("inventory_financial_summary")
        .select("*")
        .order("product_name");

      if (financialError) {
        console.error("Error fetching financial summary:", financialError);
        setFinancialSummary([]);
      } else if (financialData) {
        setFinancialSummary(financialData);
      }

      // Fetch movement summary for charts
      const { data: summaryData, error: summaryError } = await supabase
        .from("inventory_movement_summary")
        .select("*")
        .order("movement_date", { ascending: true });

      if (summaryError) {
        console.error("Error fetching movement summary:", summaryError);
        setMovementSummary([]);
      } else if (summaryData) {
        setMovementSummary(summaryData);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const ensureResult = await ensureProfile(user.id, user.email);
      if (!ensureResult.ok) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Now fetch the profile to check the role
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
      
      setLoading(false);
    };

    void checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchData();
    }
  }, [isAdmin, fetchData]);

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModal.product || !movementModal.type) return;

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      const product = movementModal.product;
      const unitsPerBox = product.units_per_box || 1;
      
      let boxesToAdd = 0;
      let unitsToAdd = 0;
      let totalQuantityChange = 0;
      
      if (movementModal.type === 'purchase') {
        // For purchases, use boxes and units inputs
        boxesToAdd = parseInt(movementForm.boxes) || 0;
        unitsToAdd = parseInt(movementForm.units) || 0;
        totalQuantityChange = (boxesToAdd * unitsPerBox) + unitsToAdd;
      } else {
        // For consumption/adjustment, use the quantity field (legacy support)
        const quantity = parseInt(movementForm.quantity);
        if (movementModal.type === 'consumption') {
          totalQuantityChange = -quantity; // Negative for consumption
        } else {
          totalQuantityChange = quantity; // Positive/negative for adjustment
        }
        
        // Convert to boxes and units for recording
        const absQuantity = Math.abs(totalQuantityChange);
        boxesToAdd = Math.floor(absQuantity / unitsPerBox);
        unitsToAdd = absQuantity % unitsPerBox;
        
        if (totalQuantityChange < 0) {
          boxesToAdd = -boxesToAdd;
          unitsToAdd = -unitsToAdd;
        }
      }
      
      const unitCost = movementForm.unit_cost ? parseFloat(movementForm.unit_cost) : null;
      
      // Use the new box-based inventory function
      const { data, error } = await supabase.rpc('update_inventory_with_boxes', {
        p_product_id: product.id,
        p_boxes_to_add: boxesToAdd,
        p_units_to_add: unitsToAdd,
        p_movement_type: movementModal.type,
        p_reason: movementForm.reason || null,
        p_reference: movementForm.reference || null,
        p_notes: movementForm.notes || null,
        p_created_by: user?.id || null
      });

      if (error) {
        console.error("Error creating movement:", error);
        alert("Error creating movement: " + error.message);
        return;
      }

      // Reset form and close modal
      setMovementForm({ quantity: "", boxes: "", units: "", unit_cost: "", reason: "", reference: "", notes: "" });
      setMovementModal({ isOpen: false, product: null, type: null });
      
      // Refresh data
      await fetchData();
      
    } catch (error) {
      console.error("Error:", error);
      alert("Error creating movement");
    }
  };

  const handleEndOfDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endOfDayModal.product) return;

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      const product = endOfDayModal.product;
      const newBoxes = parseInt(endOfDayForm.boxes) || 0;
      const newUnits = parseInt(endOfDayForm.units) || 0;
      
      // Validate loose units don't exceed units per box
      if (newUnits >= product.units_per_box) {
        alert(`Loose units cannot be ${newUnits} or more. Maximum is ${product.units_per_box - 1} for this product.`);
        return;
      }
      
      // Use the end-of-day adjustment function
      const { data, error } = await supabase.rpc('adjust_inventory_end_of_day', {
        p_product_id: product.id,
        p_new_boxes: newBoxes,
        p_new_loose_units: newUnits,
        p_reason: endOfDayForm.reason,
        p_notes: endOfDayForm.notes || null,
        p_created_by: user?.id || null
      });

      if (error) {
        console.error("Error adjusting inventory:", error);
        alert("Error adjusting inventory: " + error.message);
        return;
      }

      // Reset form and close modal
      setEndOfDayForm({ boxes: "", units: "", reason: "End of day adjustment", notes: "" });
      setEndOfDayModal({ isOpen: false, product: null });
      
      // Refresh data
      await fetchData();
      
      alert("Inventory adjusted successfully!");
      
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while adjusting inventory.");
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <FaShoppingCart className="w-4 h-4 text-green-600" />;
      case 'consumption': return <FaBoxOpen className="w-4 h-4 text-red-600" />;
      case 'adjustment': return <FaHistory className="w-4 h-4 text-blue-600" />;
      default: return <FaHistory className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'text-green-600 dark:text-green-400';
      case 'consumption': return 'text-red-600 dark:text-red-400';
      case 'adjustment': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || movement.movement_type === filterType;
    const matchesDateFrom = !filterDateFrom || new Date(movement.movement_date) >= new Date(filterDateFrom);
    const matchesDateTo = !filterDateTo || new Date(movement.movement_date) <= new Date(filterDateTo);
    
    return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
  });

  const exportCurrentStockToExcel = () => {
    const exportData = filteredProducts.map(product => ({
      'Product Name': product.name,
      'SKU': product.sku,
      'Category': product.category?.name || 'None',
      'Supplier': product.supplier?.name || 'None',
      'Current Stock': product.quantity_in_stock,
      'Reorder Level': product.reorder_level,
      'Purchase Price': product.purchase_price,
      'Sale Price': product.sale_price,
      'Status': product.quantity_in_stock === 0 
        ? 'Out of Stock' 
        : product.quantity_in_stock <= product.reorder_level 
          ? 'Low Stock' 
          : 'In Stock'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Current Stock");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `current-stock-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Enhanced current stock Excel downloaded');
  };

  const exportMovementsToExcel = () => {
    const exportData = filteredMovements.map(movement => ({
      'Date': format(new Date(movement.movement_date), 'yyyy-MM-dd HH:mm'),
      'Product Name': movement.product.name,
      'SKU': movement.product.sku,
      'Movement Type': movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1),
      'Quantity Change': movement.quantity_change,
      'Unit Cost': movement.unit_cost || '',
      'Total Cost': movement.total_cost || '',
      'Previous Quantity': movement.previous_quantity,
      'New Quantity': movement.new_quantity,
      'Reason': movement.reason || '',
      'Reference': movement.reference || '',
      'Notes': movement.notes || '',
      'Created By': movement.created_by?.email || 'System'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Movements");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `inventory-movements-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Enhanced movements Excel downloaded');
  };

  const exportFinancialToExcel = () => {
    const exportData = financialSummary.map(item => ({
      'Product Name': item.product_name,
      'SKU': item.sku,
      'Current Stock': item.quantity_in_stock,
      'Average Cost': item.average_cost,
      'Sale Price': item.sale_price,
      'Inventory Value': item.inventory_value,
      'Total Purchased': item.total_purchased_quantity,
      'Total Purchase Cost': item.total_purchase_cost,
      'Total Consumed': item.total_consumed_quantity,
      'Total COGS': item.total_cogs,
      'Profit Per Unit': item.profit_per_unit,
      'Potential Revenue': item.potential_revenue
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Summary");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `financial-summary-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Enhanced financial Excel downloaded');
  };

  // Chart data preparation
  const chartData = movementSummary.map(item => ({
    date: format(new Date(item.movement_date), 'MMM dd'),
    purchase: item.movement_type === 'purchase' ? item.total_quantity_change : 0,
    consumption: item.movement_type === 'consumption' ? Math.abs(item.total_quantity_change) : 0,
    cost: item.total_cost || 0
  }));

  const pieData = [
    { name: 'Purchase', value: movementSummary.filter(m => m.movement_type === 'purchase').reduce((sum, m) => sum + m.total_quantity_change, 0), color: '#10b981' },
    { name: 'Consumption', value: Math.abs(movementSummary.filter(m => m.movement_type === 'consumption').reduce((sum, m) => sum + m.total_quantity_change, 0)), color: '#ef4444' },
    { name: 'Adjustment', value: movementSummary.filter(m => m.movement_type === 'adjustment').reduce((sum, m) => sum + Math.abs(m.total_quantity_change), 0), color: '#3b82f6' }
  ];

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading enhanced inventory...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        Access restricted. Admin privileges required.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enhanced Inventory Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track movements, COGS, and financial performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'current' && (
              <button
                onClick={exportCurrentStockToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Stock
              </button>
            )}
            {activeTab === 'movements' && (
              <button
                onClick={exportMovementsToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Movements
              </button>
            )}
            {activeTab === 'financial' && (
              <button
                onClick={exportFinancialToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Financial
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
              <FaWarehouse className="w-4 h-4 inline mr-2" />
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
              <FaHistory className="w-4 h-4 inline mr-2" />
              Movements
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'financial'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FaDollarSign className="w-4 h-4 inline mr-2" />
              Financial
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'charts'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FaChartLine className="w-4 h-4 inline mr-2" />
              Charts
            </button>
          </div>
        </div>


        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Debug Info:</strong> Products: {products.length}, Movements: {movements.length}, 
            Filtered Products: {filteredProducts.length}, Filtered Movements: {filteredMovements.length}
            {searchTerm && <span> | Search: &ldquo;{searchTerm}&rdquo;</span>}
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
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            {activeTab === 'movements' && (
              <>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Types</option>
                  <option value="purchase">Purchase</option>
                  <option value="consumption">Consumption</option>
                  <option value="adjustment">Adjustment</option>
                </select>
                <input
                  type="date"
                  placeholder="From Date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                />
              </>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'current' && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <FaWarehouse className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {products.length === 0 ? 'No products found' : 'No products match your search'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {products.length === 0 
                    ? 'Add some products to get started with inventory management.' 
                    : 'Try adjusting your search terms or filters.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white dark:bg-neutral-900 rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.quantity_in_stock === 0 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : product.quantity_in_stock <= product.reorder_level 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {product.quantity_in_stock === 0 
                      ? 'Out of Stock' 
                      : product.quantity_in_stock <= product.reorder_level 
                        ? 'Low Stock' 
                        : 'In Stock'}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p><span className="font-medium">SKU:</span> {product.sku}</p>
                  <p><span className="font-medium">Stock:</span> {product.quantity_in_stock}</p>
                  <p><span className="font-medium">Reorder Level:</span> {product.reorder_level}</p>
                  <p><span className="font-medium">Purchase Price:</span> ${product.purchase_price}</p>
                  <p><span className="font-medium">Sale Price:</span> ${product.sale_price}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setMovementModal({ isOpen: true, product, type: 'purchase' })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <FaArrowUp className="w-3 h-3" />
                    Purchase
                  </button>
                  <button
                    onClick={() => setMovementModal({ isOpen: true, product, type: 'consumption' })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <FaArrowDown className="w-3 h-3" />
                    Consume
                  </button>
                </div>
                {product.units_per_box > 1 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setEndOfDayModal({ isOpen: true, product })}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <FaHistory className="w-3 h-3" />
                      End of Day Adjustment
                    </button>
                  </div>
                )}
              </div>
            ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'movements' && (
          <div>
            {filteredMovements.length === 0 ? (
              <div className="text-center py-12">
                <FaHistory className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {movements.length === 0 ? 'No inventory movements found' : 'No movements match your search'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {movements.length === 0 
                    ? 'Start by recording some purchases or consumption to track inventory movements.' 
                    : 'Try adjusting your search terms or date filters.'}
                </p>
                {movements.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Go to the &ldquo;Current Stock&rdquo; tab to record your first inventory movement.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-neutral-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Cost</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cost</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                      {filteredMovements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {format(new Date(movement.movement_date), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <div className="font-medium">{movement.product.name}</div>
                          <div className="text-gray-500 dark:text-gray-400">{movement.product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getMovementIcon(movement.movement_type)}
                          <span className={`text-sm font-medium ${getMovementColor(movement.movement_type)}`}>
                            {movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className={movement.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {movement.unit_cost ? `$${movement.unit_cost.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {movement.total_cost ? `$${movement.total_cost.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {movement.previous_quantity} → {movement.new_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {movement.reason || '-'}
                      </td>
                    </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sale Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inventory Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total COGS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Profit/Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Potential Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {financialSummary.map((item) => (
                    <tr key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-gray-500 dark:text-gray-400">{item.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {item.quantity_in_stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${item.average_cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${item.sale_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${item.inventory_value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${item.total_cogs.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className={item.profit_per_unit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          ${item.profit_per_unit.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${item.potential_revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-6">
            {/* Movement Trends Chart */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory Movement Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="purchase" stroke="#10b981" strokeWidth={2} name="Purchase" />
                  <Line type="monotone" dataKey="consumption" stroke="#ef4444" strokeWidth={2} name="Consumption" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Movement Distribution Pie Chart */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Movement Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Movement Modal */}
        {movementModal.isOpen && movementModal.product && movementModal.type && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {movementModal.type === 'purchase' ? 'Record Purchase' : 
                 movementModal.type === 'consumption' ? 'Record Consumption' : 'Adjust Stock'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Product: {movementModal.product.name}
                <br />
                Current Stock: {movementModal.product.units_per_box > 1 
                  ? `${movementModal.product.full_boxes || 0} boxes + ${movementModal.product.loose_units || 0} units = ${movementModal.product.total_units || movementModal.product.quantity_in_stock} total`
                  : `${movementModal.product.total_units || movementModal.product.quantity_in_stock} units`
                }
                <br />
                Units per Box: {movementModal.product.units_per_box || 1}
              </p>
              
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                {movementModal.type === 'purchase' && movementModal.product.units_per_box > 1 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Boxes Purchased
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={movementForm.boxes}
                          onChange={(e) => setMovementForm({ ...movementForm, boxes: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Loose Units
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={movementModal.product.units_per_box - 1}
                          value={movementForm.units}
                          onChange={(e) => setMovementForm({ ...movementForm, units: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total: {((parseInt(movementForm.boxes) || 0) * movementModal.product.units_per_box) + (parseInt(movementForm.units) || 0)} units
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Quantity {movementModal.type === 'purchase' ? 'Purchased' : movementModal.type === 'consumption' ? 'Consumed' : 'Change'}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Cost (optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={movementForm.unit_cost}
                    onChange={(e) => setMovementForm({ ...movementForm, unit_cost: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reference (PO/Invoice #)
                  </label>
                  <input
                    type="text"
                    value={movementForm.reference}
                    onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setMovementModal({ isOpen: false, product: null, type: null })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Record Movement
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* End of Day Adjustment Modal */}
        {endOfDayModal.isOpen && endOfDayModal.product && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                End of Day Inventory Adjustment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Product: {endOfDayModal.product.name}
                <br />
                Current Stock: {endOfDayModal.product.full_boxes || 0} boxes + {endOfDayModal.product.loose_units || 0} units = {endOfDayModal.product.total_units || endOfDayModal.product.quantity_in_stock} total
                <br />
                Units per Box: {endOfDayModal.product.units_per_box || 1}
              </p>
              
              <form onSubmit={handleEndOfDaySubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Remaining Boxes
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={endOfDayForm.boxes}
                      onChange={(e) => setEndOfDayForm({ ...endOfDayForm, boxes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Remaining Loose Units
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max={endOfDayModal.product.units_per_box - 1}
                      value={endOfDayForm.units}
                      onChange={(e) => setEndOfDayForm({ ...endOfDayForm, units: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  New Total: {((parseInt(endOfDayForm.boxes) || 0) * endOfDayModal.product.units_per_box) + (parseInt(endOfDayForm.units) || 0)} units
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={endOfDayForm.reason}
                    onChange={(e) => setEndOfDayForm({ ...endOfDayForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={endOfDayForm.notes}
                    onChange={(e) => setEndOfDayForm({ ...endOfDayForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                    placeholder="Any additional notes about the adjustment..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEndOfDayModal({ isOpen: false, product: null })}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adjust Inventory
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
