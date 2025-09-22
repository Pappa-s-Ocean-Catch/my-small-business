"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { FaBox, FaTags, FaTruck, FaWarehouse, FaExclamationTriangle, FaPlus, FaChartLine, FaUtensils, FaEye } from "react-icons/fa";
import Link from "next/link";
import { LoadingPage } from "@/components/Loading";

interface ShopStats {
  totalProducts: number;
  lowStockProducts: number;
  totalCategories: number;
  totalSuppliers: number;
}

export default function ShopPage() {
  const [stats, setStats] = useState<ShopStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalCategories: 0,
    totalSuppliers: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
    };
    void checkAdmin();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = getSupabaseClient();
      
      try {
        const [
          { count: productsCount },
          { count: categoriesCount },
          { count: suppliersCount }
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase.from("categories").select("*", { count: "exact", head: true }),
          supabase.from("suppliers").select("*", { count: "exact", head: true })
        ]);

        // For low stock, we need to check products where quantity <= reorder_level
        const { data: allProducts } = await supabase
          .from("products")
          .select("id, quantity_in_stock, reorder_level");
        
        const lowStockProducts = allProducts?.filter(product => 
          product.quantity_in_stock <= product.reorder_level
        ) || [];

        setStats({
          totalProducts: productsCount || 0,
          lowStockProducts: lowStockProducts?.length || 0,
          totalCategories: categoriesCount || 0,
          totalSuppliers: suppliersCount || 0
        });
      } catch (error) {
        console.error("Error fetching shop stats:", error);
        // Set default values if there's an error
        setStats({
          totalProducts: 0,
          lowStockProducts: 0,
          totalCategories: 0,
          totalSuppliers: 0
        });
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      void fetchStats();
    }
  }, [isAdmin]);

  if (loading || isAdmin === null) {
    return <LoadingPage message="Loading shop management..." />;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view shop management.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Shop Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your inventory, products, categories, and suppliers
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProducts}</p>
              </div>
              <FaBox className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lowStockProducts}</p>
              </div>
              <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCategories}</p>
              </div>
              <FaTags className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Suppliers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSuppliers}</p>
              </div>
              <FaTruck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Link
              href="/shop/products"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaBox className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Products</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage inventory</p>
                </div>
              </div>
            </Link>

            <Link
              href="/shop/categories"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaTags className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Categories</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Organize products</p>
                </div>
              </div>
            </Link>

            <Link
              href="/shop/suppliers"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaTruck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Suppliers</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage vendors</p>
                </div>
              </div>
            </Link>

    <Link
      href="/shop/inventory"
      className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
    >
              <div className="flex items-center gap-3">
                <FaWarehouse className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Inventory Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track stock, movements, COGS & analytics</p>
                </div>
              </div>
            </Link>

            <Link
              href="/shop/menu"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaUtensils className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Menu</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sale products & categories</p>
                </div>
              </div>
            </Link>

            <Link
              href="/shop/menu-screens"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaEye className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Menu Builder</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Design in-store screens</p>
                </div>
              </div>
            </Link>

            <Link
              href="/shop/notifications"
              className="p-4 bg-white dark:bg-neutral-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FaExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Notifications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Low stock alerts</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats.lowStockProducts > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-3">
              <FaExclamationTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Low Stock Alert
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {stats.lowStockProducts} product{stats.lowStockProducts !== 1 ? 's' : ''} need{stats.lowStockProducts === 1 ? 's' : ''} restocking
                </p>
              </div>
              <Link
                href="/shop/products?filter=low-stock"
                className="ml-auto px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                View Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
