"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import { FaPlus, FaEdit, FaTrash, FaBox, FaExclamationTriangle, FaSearch, FaFileExcel, FaTh, FaThLarge, FaSave, FaTimes } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify';
import { saveAs } from "file-saver";
import Link from "next/link";
import { ImageUpload } from "@/components/ImageUpload";
import { AIImageGenerator } from "@/components/AIImageGenerator";

type Product = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  supplier_id: string | null;
  purchase_price: number;
  sale_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  warning_threshold: number;
  alert_threshold: number;
  units_per_box: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
  alternative_suppliers?: Array<{ id: string; supplier_id: string; supplier: { name: string } }>;
};

type Category = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ product: Product | null; isOpen: boolean }>({ product: null, isOpen: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [lowStockUrlMode, setLowStockUrlMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [productFormTab, setProductFormTab] = useState<'general' | 'supplier' | 'system'>('general');
  const searchParams = useSearchParams();
  const [editHandled, setEditHandled] = useState<boolean>(false);

  // Helper function to get stock status based on thresholds
  const getStockStatus = (product: Product) => {
    const totalUnits = product.total_units || product.quantity_in_stock;
    if (totalUnits <= product.alert_threshold) {
      return { status: 'critical', color: 'red', text: 'Critical' };
    } else if (totalUnits <= product.warning_threshold) {
      return { status: 'warning', color: 'yellow', text: 'Warning' };
    } else {
      return { status: 'good', color: 'green', text: 'In Stock' };
    }
  };

  // Helper function to format stock display
  const formatStockDisplay = (product: Product) => {
    const totalUnits = product.total_units || product.quantity_in_stock;
    const unitsPerBox = product.units_per_box || 1;
    const fullBoxes = product.full_boxes || 0;
    const looseUnits = product.loose_units || 0;
    
    if (unitsPerBox === 1) {
      return `${totalUnits} units`;
    }
    
    return `${fullBoxes} boxes + ${looseUnits} units = ${totalUnits} total`;
  };

  // Helper function to format stock display for table (more compact)
  const formatStockDisplayTable = (product: Product) => {
    const totalUnits = product.total_units || product.quantity_in_stock;
    const unitsPerBox = product.units_per_box || 1;
    const fullBoxes = product.full_boxes || 0;
    const looseUnits = product.loose_units || 0;
    
    if (unitsPerBox === 1) {
      return `${totalUnits}`;
    }
    
    if (fullBoxes === 0 && looseUnits === 0) {
      return '0';
    }
    
    if (fullBoxes === 0) {
      return `${looseUnits} units`;
    }
    
    if (looseUnits === 0) {
      return `${fullBoxes} boxes`;
    }
    
    return `${fullBoxes}b + ${looseUnits}u`;
  };

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category_id: "",
    supplier_id: "",
    purchase_price: "",
    sale_price: "",
    quantity_in_stock: "",
    reorder_level: "",
    warning_threshold: "",
    alert_threshold: "",
    units_per_box: "1",
    full_boxes: "0",
    loose_units: "0",
    description: "",
    image_url: "",
    is_active: true
  });

  const [alternativeSuppliers, setAlternativeSuppliers] = useState<string[]>([]);
  const [newAlternativeSupplier, setNewAlternativeSupplier] = useState("");

  // Helper functions for alternative suppliers
  const addAlternativeSupplier = () => {
    if (newAlternativeSupplier && !alternativeSuppliers.includes(newAlternativeSupplier)) {
      setAlternativeSuppliers([...alternativeSuppliers, newAlternativeSupplier]);
      setNewAlternativeSupplier("");
    }
  };

  const removeAlternativeSupplier = (supplierId: string) => {
    setAlternativeSuppliers(alternativeSuppliers.filter(id => id !== supplierId));
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || "Unknown Supplier";
  };

  useEffect(() => {
    // Load view mode preference from localStorage
    const savedViewMode = localStorage.getItem('products-view-mode') as 'card' | 'table' | null;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }

    // Initialize filters from URL params
    try {
      const urlFilter = searchParams?.get('filter');
      if (urlFilter) {
        if (urlFilter === 'low-stock') {
          // Low stock preset includes both warning and critical
          setFilterStock('warning');
          setLowStockUrlMode(true);
        } else if (urlFilter === 'critical' || urlFilter === 'warning' || urlFilter === 'good' || urlFilter === 'all') {
          setFilterStock(urlFilter);
          setLowStockUrlMode(false);
        }
      }
    } catch {}

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

  // Handle deep-link editing via ?edit=productId
  useEffect(() => {
    if (!isAdmin || loading) return;
    const editId = searchParams?.get('edit');
    if (!editId || editHandled) return;

    const product = products.find(p => p.id === editId);
    if (product) {
      startEdit(product);
      setEditHandled(true);
    }
  }, [isAdmin, loading, products, searchParams, editHandled]);

  const fetchData = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    
    const [
      { data: productsData },
      { data: categoriesData },
      { data: suppliersData }
    ] = await Promise.all([
      supabase
        .from("products")
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name),
          alternative_suppliers:product_alternative_suppliers(
            id,
            supplier_id,
            supplier:suppliers(name)
          )
        `)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("suppliers").select("id, name").order("name")
    ]);

    setProducts(productsData || []);
    setCategories(categoriesData || []);
    setSuppliers(suppliersData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchData();
    }
  }, [isAdmin, fetchData]);

  const resetForm = () => {
    setForm({
      name: "",
      sku: "",
      category_id: "",
      supplier_id: "",
      purchase_price: "",
      sale_price: "",
      quantity_in_stock: "",
      reorder_level: "",
      warning_threshold: "",
      alert_threshold: "",
      units_per_box: "1",
      full_boxes: "0",
      loose_units: "0",
      description: "",
      image_url: "",
      is_active: true
    });
    setAlternativeSuppliers([]);
    setNewAlternativeSupplier("");
    setProductFormTab('general');
  };

  const startEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      category_id: product.category_id || "",
      supplier_id: product.supplier_id || "",
      purchase_price: product.purchase_price.toString(),
      sale_price: product.sale_price.toString(),
      quantity_in_stock: product.total_units?.toString() || product.quantity_in_stock.toString(),
      reorder_level: product.reorder_level.toString(),
      warning_threshold: product.warning_threshold.toString(),
      alert_threshold: product.alert_threshold.toString(),
      units_per_box: product.units_per_box?.toString() || "1",
      full_boxes: product.full_boxes?.toString() || "0",
      loose_units: product.loose_units?.toString() || "0",
      description: product.description || "",
      image_url: product.image_url || "",
      is_active: product.is_active
    });
    
    // Load alternative suppliers
    const altSuppliers = product.alternative_suppliers?.map(alt => alt.supplier_id) || [];
    setAlternativeSuppliers(altSuppliers);
    setNewAlternativeSupplier("");
    
    setFormOpen(true);
    setProductFormTab('general');
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();

    try {
      const unitsPerBox = parseInt(form.units_per_box);
      const initialStock = parseInt(form.quantity_in_stock) || 0;

      const fullBoxes = Math.floor(initialStock / unitsPerBox);
      const looseUnits = initialStock % unitsPerBox;

      const productData = {
        name: form.name,
        sku: form.sku,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        purchase_price: parseFloat(form.purchase_price),
        sale_price: parseFloat(form.sale_price),
        quantity_in_stock: initialStock,
        reorder_level: parseInt(form.reorder_level),
        warning_threshold: parseInt(form.warning_threshold),
        alert_threshold: parseInt(form.alert_threshold),
        units_per_box: unitsPerBox,
        full_boxes: fullBoxes,
        loose_units: looseUnits,
        description: form.description || null,
        image_url: form.image_url || null,
        is_active: form.is_active
      };

      let productId: string | null = null;
      if (editing) {
        const { error: updErr } = await supabase.from("products").update(productData).eq("id", editing.id);
        if (updErr) {
          toast.error(`Failed to update product: ${updErr.message}`);
          return;
        }
        productId = editing.id;
      } else {
        const { data: newProduct, error: insErr } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        if (insErr || !newProduct) {
          toast.error(`Failed to create product: ${insErr?.message || 'Unknown error'}`);
          return;
        }
        productId = newProduct.id as string;
      }

      if (productId) {
        const { error: delAltErr } = await supabase
          .from("product_alternative_suppliers")
          .delete()
          .eq("product_id", productId);
        if (delAltErr) {
          toast.error(`Failed to update alternative suppliers: ${delAltErr.message}`);
          return;
        }

        if (alternativeSuppliers.length > 0) {
          const altSupplierData = alternativeSuppliers.map(supplierId => ({
            product_id: productId as string,
            supplier_id: supplierId
          }));
          const { error: insAltErr } = await supabase
            .from("product_alternative_suppliers")
            .insert(altSupplierData);
          if (insAltErr) {
            toast.error(`Failed to add alternative suppliers: ${insAltErr.message}`);
            return;
          }
        }
      }

      await fetchData();
      setFormOpen(false);
      setEditing(null);
      resetForm();
      toast.success(editing ? 'Product updated successfully' : 'Product created successfully');
    } catch (err) {
      toast.error('Unexpected error while saving product');
      console.error('saveProduct error', err);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteConfirm({ product, isOpen: true });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm.product) return;
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.from("products").delete().eq("id", deleteConfirm.product.id);
      if (error) {
        toast.error(`Failed to delete product: ${error.message}`);
        return;
      }
      await fetchData();
      setDeleteConfirm({ product: null, isOpen: false });
      toast.success('Product deleted successfully');
    } catch (err) {
      toast.error('Unexpected error while deleting product');
      console.error('confirmDeleteProduct error', err);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredProducts.map(product => ({
      'Product Name': product.name,
      'SKU': product.sku,
      'Category': product.category?.name || 'None',
      'Supplier': product.supplier?.name || 'None',
      'Purchase Price': product.purchase_price,
      'Sale Price': product.sale_price,
      'Quantity in Stock': product.total_units || product.quantity_in_stock,
      'Units per Box': product.units_per_box || 1,
      'Full Boxes': product.full_boxes || 0,
      'Loose Units': product.loose_units || 0,
      'Reorder Level': product.reorder_level,
      'Status': getStockStatus(product).text,
      'Active': product.is_active ? 'Yes' : 'No',
      'Description': product.description || '',
      'Created': new Date(product.created_at).toLocaleDateString(),
      'Updated': new Date(product.updated_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `products-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Products Excel downloaded');
  };

  const toggleViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('products-view-mode', mode);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || product.category_id === filterCategory;
    const stockStatus = getStockStatus(product);
    const lowStockPresetActive = lowStockUrlMode && filterStock === 'warning';
    const matchesStock = filterStock === "all" || 
                        (filterStock === "critical" && stockStatus.status === 'critical') ||
                        (filterStock === "warning" && (stockStatus.status === 'warning' || (lowStockPresetActive && stockStatus.status === 'critical'))) ||
                        (filterStock === "good" && stockStatus.status === 'good');
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading products...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view products.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your product inventory
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => toggleViewMode('card')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Card View"
              >
                <FaThLarge className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <FaTh className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaFileExcel className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={() => { resetForm(); setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaPlus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
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
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Stock</option>
                <option value="critical">Critical Alert</option>
                <option value="warning">Warning</option>
                <option value="good">In Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Display */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} variant="elevated" padding="md" hover>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link 
                      href={`/shop/products/${product.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate block hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {product.sku}</p>
                  </div>
                  {getStockStatus(product).status !== 'good' && (
                    <FaExclamationTriangle 
                      className={`w-4 h-4 flex-shrink-0 ml-2 ${
                        getStockStatus(product).status === 'critical' 
                          ? 'text-red-500' 
                          : 'text-yellow-500'
                      }`} 
                      title={getStockStatus(product).text} 
                    />
                  )}
                </div>

                {product.image_url && (
                  <div className="mb-3">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Category:</span>
                    <span className="text-gray-900 dark:text-white">{product.category?.name || "None"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Primary Supplier:</span>
                    <span className="text-gray-900 dark:text-white">{product.supplier?.name || "None"}</span>
                  </div>
                  {product.alternative_suppliers && product.alternative_suppliers.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Alt Suppliers:</span>
                      <span className="text-gray-900 dark:text-white">
                        {product.alternative_suppliers.map(alt => alt.supplier.name).join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                    <span className={`font-medium text-right ${
                      (product.total_units || product.quantity_in_stock) === 0 
                        ? "text-red-600 dark:text-red-400" 
                        : (product.total_units || product.quantity_in_stock) <= product.reorder_level 
                          ? "text-yellow-600 dark:text-yellow-400" 
                          : "text-green-600 dark:text-green-400"
                    }`}>
                      {formatStockDisplay(product)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Sale Price:</span>
                    <span className="text-gray-900 dark:text-white">${product.sale_price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(product)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <FaEdit className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                  >
                    <FaTrash className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="w-1/4 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Primary Supplier</th>
                    <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alt Suppliers</th>
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Purchase</th>
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sale</th>
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-8 h-8 object-cover rounded-lg mr-3 flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <Link 
                              href={`/shop/products/${product.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate block hover:underline"
                            >
                              {product.name}
                            </Link>
                            {product.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 truncate">{product.sku}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 truncate">{product.category?.name || 'None'}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 truncate">{product.supplier?.name || 'None'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 truncate">
                        {product.alternative_suppliers && product.alternative_suppliers.length > 0 
                          ? product.alternative_suppliers.map(alt => alt.supplier.name).join(", ")
                          : 'None'
                        }
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            (product.total_units || product.quantity_in_stock) === 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : (product.total_units || product.quantity_in_stock) <= product.reorder_level 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-green-600 dark:text-green-400'
                          }`}>
                            {formatStockDisplayTable(product)}
                          </span>
                          {(product.total_units || product.quantity_in_stock) <= product.reorder_level && (
                            <FaExclamationTriangle className="w-3 h-3 text-red-500 ml-1 flex-shrink-0" title="Low Stock" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">${product.purchase_price.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">${product.sale_price.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (product.total_units || product.quantity_in_stock) === 0 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : (product.total_units || product.quantity_in_stock) <= product.reorder_level 
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {(product.total_units || product.quantity_in_stock) === 0 
                            ? 'Out' 
                            : (product.total_units || product.quantity_in_stock) <= product.reorder_level 
                              ? 'Low' 
                              : 'In Stock'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(product)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <FaBox className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No products found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || filterCategory !== "all" || filterStock !== "all" 
                ? "Try adjusting your search or filters" 
                : "Get started by adding your first product"}
            </p>
            {!searchTerm && filterCategory === "all" && filterStock === "all" && (
              <button
                onClick={() => { resetForm(); setEditing(null); setFormOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <FaPlus className="w-4 h-4" />
                Add Product
              </button>
            )}
          </div>
        )}

        {/* Product Form Modal */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? "Edit Product" : "Add Product"}
          size="lg"
          bodyClassName="p-6"
          footer={
            <>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <FaTimes className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                {editing ? <FaSave className="w-4 h-4" /> : <FaPlus className="w-4 h-4" />}
                {editing ? "Update Product" : "Create Product"}
              </button>
            </>
          }
        >
          <form id="product-form" onSubmit={saveProduct} className="grid gap-4">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-neutral-700 -mt-2">
              <nav className="flex gap-6">
                <button type="button" onClick={() => setProductFormTab('general')} className={`py-2 text-sm font-medium ${productFormTab==='general' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>General</button>
                <button type="button" onClick={() => setProductFormTab('supplier')} className={`py-2 text-sm font-medium ${productFormTab==='supplier' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>Supplier</button>
                <button type="button" onClick={() => setProductFormTab('system')} className={`py-2 text-sm font-medium ${productFormTab==='system' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>System</button>
              </nav>
            </div>
            {productFormTab === 'general' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Product Name *</span>
                    <input
                      type="text"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">SKU/Code *</span>
                    <input
                      type="text"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.sku}
                      onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Category</span>
                    <select
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.category_id}
                      onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Purchase Price *</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.purchase_price}
                      onChange={(e) => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Sale Price *</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.sale_price}
                      onChange={(e) => setForm(f => ({ ...f, sale_price: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Units per Box *</span>
                    <input
                      type="number"
                      min="1"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.units_per_box}
                      onChange={(e) => setForm(f => ({ ...f, units_per_box: e.target.value }))}
                      placeholder="How many units in one box/case"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Set to 1 for individual items, or the number of units per box/case
                    </span>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Initial Stock (Units)</span>
                    <input
                      type="number"
                      min="0"
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.quantity_in_stock}
                      onChange={(e) => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                      placeholder="Total units to start with"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Will be automatically converted to boxes + loose units
                    </span>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                  <textarea
                    className="min-h-24 rounded-lg border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Product description..."
                    rows={3}
                  />
                </label>

                {/* AI Image Generator */}
                <AIImageGenerator
                  onImageGenerated={(url) => setForm(f => ({ ...f, image_url: url || "" }))}
                  currentImageUrl={form.image_url}
                  productName={form.name}
                  description={form.description}
                  category={categories.find(cat => cat.id === form.category_id)?.name || ''}
                  className="w-full"
                />
                
                {/* Traditional Image Upload */}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-3">
                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Or upload your own image:</div>
                  <ImageUpload
                    currentImageUrl={form.image_url}
                    onImageChange={(url) => setForm(f => ({ ...f, image_url: url || "" }))}
                    type="product"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                    Active product
                  </label>
                </div>
              </>
            )}

            {productFormTab === 'supplier' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Primary Supplier</span>
                    <select
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.supplier_id}
                      onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    >
                      <option value="">Select Primary Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Alternative Suppliers Section */}
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Alternative Suppliers</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Optional backup suppliers</span>
                  </div>
                  {alternativeSuppliers.length > 0 && (
                    <div className="space-y-2">
                      {alternativeSuppliers.map(supplierId => (
                        <div key={supplierId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {getSupplierName(supplierId)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAlternativeSupplier(supplierId)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <select
                      className="flex-1 h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={newAlternativeSupplier}
                      onChange={(e) => setNewAlternativeSupplier(e.target.value)}
                    >
                      <option value="">Select Alternative Supplier</option>
                      {suppliers
                        .filter(s => s.id !== form.supplier_id && !alternativeSuppliers.includes(s.id))
                        .map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={addAlternativeSupplier}
                      disabled={!newAlternativeSupplier}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}

            {productFormTab === 'system' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Reorder Level *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.reorder_level}
                      onChange={(e) => setForm(f => ({ ...f, reorder_level: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Warning Threshold *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.warning_threshold}
                      onChange={(e) => setForm(f => ({ ...f, warning_threshold: e.target.value }))}
                      placeholder="Stock level for warning alert"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Alert Threshold *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.alert_threshold}
                      onChange={(e) => setForm(f => ({ ...f, alert_threshold: e.target.value }))}
                      placeholder="Stock level for critical alert"
                    />
                  </label>
                </div>
              </>
            )}
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ product: null, isOpen: false })}
          onConfirm={confirmDeleteProduct}
          title="Delete Product"
          message={`Are you sure you want to delete "${deleteConfirm.product?.name}"? This action cannot be undone and will remove all associated stock movements and notifications.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </AdminGuard>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading products...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
