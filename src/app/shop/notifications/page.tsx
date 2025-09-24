"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { FaExclamationTriangle, FaCheck, FaBell } from "react-icons/fa";
import Link from "next/link";
import { format } from "date-fns";

type LowStockNotification = {
  id: string;
  product_id: string;
  current_quantity: number;
  reorder_level: number;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category?: { name: string } | null;
    supplier?: { name: string } | null;
  };
  resolved_by?: { email: string } | null;
};

type IngredientNotification = {
  id: string;
  sale_product_id: string;
  buildable_units: number;
  warning_threshold: number | null;
  alert_threshold: number | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  sale_product: { id: string; name: string };
  missing_ingredients: Array<{
    product_id: string;
    product_name: string;
    required: number;
    available: number;
  }>;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<LowStockNotification[]>([]);
  const [ingredientNotifications, setIngredientNotifications] = useState<IngredientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');
  const [mode, setMode] = useState<'product' | 'ingredient'>('product');

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

  const fetchNotifications = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    
    const { data: notificationsData } = await supabase
      .from("low_stock_notifications")
      .select(`
        *,
        product:products(
          id, name, sku,
          category:categories(name),
          supplier:suppliers(name)
        ),
        resolved_by:profiles(email)
      `)
      .order("created_at", { ascending: false });

    setNotifications(notificationsData || []);
    setLoading(false);
  }, []);

  const fetchIngredientNotifications = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();

    const { data } = await supabase
      .from('ingredient_stock_notifications')
      .select(`*, sale_product:sale_product_id(id, name)`) 
      .order('created_at', { ascending: false });

    setIngredientNotifications((data || []) as unknown as IngredientNotification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setLoading(true);
      if (mode === 'product') {
        void fetchNotifications();
      } else {
        void fetchIngredientNotifications();
      }
    }
  }, [isAdmin, mode, fetchNotifications, fetchIngredientNotifications]);

  const resolveNotification = async (notificationId: string) => {
    const supabase = getSupabaseClient();
    await supabase
      .from("low_stock_notifications")
      .update({ 
        is_resolved: true, 
        resolved_at: new Date().toISOString(),
        resolved_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq("id", notificationId);
    
    await fetchNotifications();
  };

  const filteredNotifications = notifications.filter(notification => 
    activeTab === 'active' ? !notification.is_resolved : notification.is_resolved
  );
  const filteredIngredientNotifications = ingredientNotifications.filter(n =>
    activeTab === 'active' ? !n.is_resolved : n.is_resolved
  );

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading notifications...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view notifications.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Low Stock Notifications</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Monitor and manage stock alerts (product and ingredient)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('product')}
              className={`px-3 py-1 rounded text-sm ${mode === 'product' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}
            >
              Product Alerts
            </button>
            <button
              onClick={() => setMode('ingredient')}
              className={`px-3 py-1 rounded text-sm ${mode === 'ingredient' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}
            >
              Ingredient Alerts
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Active Alerts ({notifications.filter(n => !n.is_resolved).length})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'resolved'
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Resolved ({notifications.filter(n => n.is_resolved).length})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {mode === 'product' ? (
            filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <FaBell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {activeTab === 'active' ? 'No active alerts' : 'No resolved alerts'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {activeTab === 'active' 
                  ? 'All products are well stocked!' 
                  : 'No notifications have been resolved yet'
                }
              </p>
            </div>
            ) : (
              filteredNotifications.map((notification) => (
              <div key={notification.id} className={`bg-white dark:bg-neutral-900 rounded-lg border p-4 ${
                notification.is_resolved ? 'opacity-75' : ''
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {notification.is_resolved ? (
                        <FaCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {notification.product.name}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({notification.product.sku})
                        </span>
                        {notification.is_resolved && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Resolved
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-medium text-red-600 dark:text-red-400">
                          Current: {notification.current_quantity} units
                        </span>
                        <span>
                          Reorder Level: {notification.reorder_level} units
                        </span>
                        {notification.product.category && (
                          <span>
                            Category: {notification.product.category.name}
                          </span>
                        )}
                        {notification.product.supplier && (
                          <span>
                            Supplier: {notification.product.supplier.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        {notification.is_resolved ? (
                          <>
                            Resolved on {format(new Date(notification.resolved_at!), "MMM dd, yyyy 'at' HH:mm")}
                            {notification.resolved_by && (
                              <span> by {notification.resolved_by.email}</span>
                            )}
                          </>
                        ) : (
                          <>
                            Alert created on {format(new Date(notification.created_at), "MMM dd, yyyy 'at' HH:mm")}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!notification.is_resolved && (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/shop/products?edit=${notification.product.id}`}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Manage Product
                      </Link>
                      <button
                        onClick={() => resolveNotification(notification.id)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              </div>
              ))
            )
          ) : (
            filteredIngredientNotifications.length === 0 ? (
              <div className="text-center py-12">
                <FaBell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {activeTab === 'active' ? 'No active ingredient alerts' : 'No resolved ingredient alerts'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {activeTab === 'active' 
                    ? 'All sale products are buildable with current stock!' 
                    : 'No ingredient notifications have been resolved yet'
                  }
                </p>
              </div>
            ) : (
              filteredIngredientNotifications.map((n) => (
                <div key={n.id} className={`bg-white dark:bg-neutral-900 rounded-lg border p-4 ${n.is_resolved ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {n.is_resolved ? (
                          <FaCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {n.sale_product.name}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300">
                            Buildable: {n.buildable_units}
                          </span>
                        </div>
                        {n.missing_ingredients.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="font-medium mb-1">Missing/Low Ingredients:</div>
                            <ul className="list-disc pl-5">
                              {n.missing_ingredients.map((mi, idx) => (
                                <li key={idx}>
                                  {mi.product_name}: need {mi.required}, available {mi.available}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          Alert created on {format(new Date(n.created_at), "MMM dd, yyyy 'at' HH:mm")}
                        </div>
                      </div>
                    </div>
                    {!n.is_resolved && (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/shop/products`}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          View Inventory
                        </Link>
                        <button
                          onClick={async () => {
                            const supabase = getSupabaseClient();
                            await supabase
                              .from('ingredient_stock_notifications')
                              .update({ 
                                is_resolved: true,
                                resolved_at: new Date().toISOString(),
                                resolved_by: (await supabase.auth.getUser()).data.user?.id
                              })
                              .eq('id', n.id);
                            await fetchIngredientNotifications();
                          }}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center gap-3">
              <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {mode === 'product' 
                    ? notifications.filter(n => !n.is_resolved).length
                    : ingredientNotifications.filter(n => !n.is_resolved).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center gap-3">
              <FaCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {notifications.filter(n => n.is_resolved).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="flex items-center gap-3">
              <FaBell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {notifications.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
