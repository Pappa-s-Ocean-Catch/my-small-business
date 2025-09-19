"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FaPlus, FaEdit, FaTrash, FaBox, FaExclamationTriangle, FaSearch, FaFilter, FaFileExcel, FaTh, FaThLarge } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify';
import { saveAs } from "file-saver";
import Link from "next/link";

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
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};

type Category = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

export default function ProductsPage() {
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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Helper function to get stock status based on thresholds
  const getStockStatus = (product: Product) => {
    if (product.quantity_in_stock <= product.alert_threshold) {
      return { status: 'critical', color: 'red', text: 'Critical' };
    } else if (product.quantity_in_stock <= product.warning_threshold) {
      return { status: 'warning', color: 'yellow', text: 'Warning' };
    } else {
      return { status: 'good', color: 'green', text: 'In Stock' };
    }
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
    description: "",
    is_active: true
  });

  useEffect(() => {
    // Load view mode preference from localStorage
    const savedViewMode = localStorage.getItem('products-view-mode') as 'card' | 'table' | null;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }

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
      { data: categoriesData },
      { data: suppliersData }
    ] = await Promise.all([
      supabase
        .from("products")
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name)
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
      description: "",
      is_active: true
    });
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
      quantity_in_stock: product.quantity_in_stock.toString(),
      reorder_level: product.reorder_level.toString(),
      warning_threshold: product.warning_threshold.toString(),
      alert_threshold: product.alert_threshold.toString(),
      description: product.description || "",
      is_active: product.is_active
    });
    setFormOpen(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();

    const productData = {
      name: form.name,
      sku: form.sku,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      purchase_price: parseFloat(form.purchase_price),
      sale_price: parseFloat(form.sale_price),
      quantity_in_stock: parseInt(form.quantity_in_stock),
      reorder_level: parseInt(form.reorder_level),
      warning_threshold: parseInt(form.warning_threshold),
      alert_threshold: parseInt(form.alert_threshold),
      description: form.description || null,
      is_active: form.is_active
    };

    if (editing) {
      await supabase.from("products").update(productData).eq("id", editing.id);
    } else {
      await supabase.from("products").insert(productData);
    }

    await fetchData();
    setFormOpen(false);
    setEditing(null);
    resetForm();
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteConfirm({ product, isOpen: true });
  };

  const confirmDeleteProduct = async () => {
    if (deleteConfirm.product) {
      const supabase = getSupabaseClient();
      await supabase.from("products").delete().eq("id", deleteConfirm.product.id);
      await fetchData();
      setDeleteConfirm({ product: null, isOpen: false });
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
      'Quantity in Stock': product.quantity_in_stock,
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
    const matchesStock = filterStock === "all" || 
                        (filterStock === "critical" && stockStatus.status === 'critical') ||
                        (filterStock === "warning" && stockStatus.status === 'warning') ||
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
      <div className="p-6 max-w-7xl mx-auto">
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
              <div key={product.id} className="bg-white dark:bg-neutral-900 rounded-lg border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h3>
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
                    <span className="text-gray-600 dark:text-gray-400">Supplier:</span>
                    <span className="text-gray-900 dark:text-white">{product.supplier?.name || "None"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Stock:</span>
                    <span className={`font-medium ${
                      product.quantity_in_stock === 0 
                        ? "text-red-600 dark:text-red-400" 
                        : product.quantity_in_stock <= product.reorder_level 
                          ? "text-yellow-600 dark:text-yellow-400" 
                          : "text-green-600 dark:text-green-400"
                    }`}>
                      {product.quantity_in_stock}
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
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Purchase Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sale Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image_url && (
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded-lg mr-3"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{product.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{product.sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{product.category?.name || 'None'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{product.supplier?.name || 'None'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            product.quantity_in_stock === 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : product.quantity_in_stock <= product.reorder_level 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-green-600 dark:text-green-400'
                          }`}>
                            {product.quantity_in_stock}
                          </span>
                          {product.quantity_in_stock <= product.reorder_level && (
                            <FaExclamationTriangle className="w-4 h-4 text-red-500 ml-2" title="Low Stock" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${product.purchase_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${product.sale_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(product)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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
        {formOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setFormOpen(false)}>
            <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Product" : "Add Product"}</h2>
              
              <form onSubmit={saveProduct} className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Product Name *</span>
                    <input
                      type="text"
                      required
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">SKU/Code *</span>
                    <input
                      type="text"
                      required
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.sku}
                      onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Category</span>
                    <select
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.category_id}
                      onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Supplier</span>
                    <select
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.supplier_id}
                      onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
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
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
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
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.sale_price}
                      onChange={(e) => setForm(f => ({ ...f, sale_price: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Quantity in Stock *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.quantity_in_stock}
                      onChange={(e) => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Reorder Level *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.reorder_level}
                      onChange={(e) => setForm(f => ({ ...f, reorder_level: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Warning Threshold *</span>
                    <input
                      type="number"
                      required
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
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
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      value={form.alert_threshold}
                      onChange={(e) => setForm(f => ({ ...f, alert_threshold: e.target.value }))}
                      placeholder="Stock level for critical alert"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                  <textarea
                    className="min-h-24 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Product description..."
                    rows={3}
                  />
                </label>

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

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="h-10 px-4 rounded-xl border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {editing ? "Update" : "Create"} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
