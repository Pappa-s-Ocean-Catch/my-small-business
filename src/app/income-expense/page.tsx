"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { FaPlus, FaEdit, FaTrash, FaFileAlt, FaChevronLeft, FaChevronRight, FaFilter, FaFileImport } from "react-icons/fa";
import Link from "next/link";
import { toast } from "react-toastify";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { TransactionModal } from "@/components/TransactionModal";
import { CategoryModal } from "@/components/CategoryModal";

type Transaction = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  payment_method: 'cash' | 'bank' | 'card';
  description: string | null;
  reference_number: string | null;
  document_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type TransactionCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

export default function IncomeExpensePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; type: 'transaction' | 'category' }>({ 
    isOpen: false, 
    id: '', 
    type: 'transaction' 
  });

  // Date range state
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end };
  });

  // Filter states
  const [filters, setFilters] = useState({
    type: 'all' as 'all' | 'income' | 'expense',
    category: 'all',
    payment_method: 'all' as 'all' | 'cash' | 'bank' | 'card'
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role_slug")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(profile.role_slug === "admin");
    };
    void checkAdmin();
  }, []);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseClient();
    
    try {
      // Fetch transactions
      let query = supabase
        .from("transactions")
        .select("*")
        .gte("date", dateRange.start.toISOString().split('T')[0])
        .lte("date", dateRange.end.toISOString().split('T')[0])
        .order("date", { ascending: false });

      // Apply filters
      if (filters.type !== 'all') {
        query = query.eq("type", filters.type);
      }
      if (filters.category !== 'all') {
        query = query.eq("category", filters.category);
      }
      if (filters.payment_method !== 'all') {
        query = query.eq("payment_method", filters.payment_method);
      }

      const { data: transactionsData, error: transactionsError } = await query;

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
        toast.error("Failed to load transactions");
        return;
      }

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("is_active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (categoriesError) {
        console.error("Error fetching categories:", categoriesError);
        toast.error("Failed to load categories");
        return;
      }

      setTransactions(transactionsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [dateRange, filters]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const goPrevWeek = () => {
    const newStart = subWeeks(dateRange.start, 1);
    setDateRange({
      start: newStart,
      end: endOfWeek(newStart, { weekStartsOn: 1 })
    });
  };

  const goNextWeek = () => {
    const newStart = addWeeks(dateRange.start, 1);
    setDateRange({
      start: newStart,
      end: endOfWeek(newStart, { weekStartsOn: 1 })
    });
  };

  const goThisWeek = () => {
    const now = new Date();
    setDateRange({
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 })
    });
  };

  const handleDeleteTransaction = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Failed to delete transaction");
      return;
    }

    toast.success("Transaction deleted successfully");
    void fetchData();
    setDeleteConfirm({ isOpen: false, id: '', type: 'transaction' });
  };

  const handleDeleteCategory = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("transaction_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
      return;
    }

    toast.success("Category deleted successfully");
    void fetchData();
    setDeleteConfirm({ isOpen: false, id: '', type: 'category' });
  };

  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getTotalExpense = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getNetIncome = () => {
    return getTotalIncome() - getTotalExpense();
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    return category?.color || '#6B7280';
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-gray-500">
          Loading income/expense data...
        </div>
      </AdminGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-red-600">
          Access restricted. You must be an admin to view income/expense data.
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Income & Expenses</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            {/* Navigation buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={goPrevWeek}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                title="Previous Week"
              >
                <FaChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={goThisWeek}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                title="This Week"
              >
                Today
              </button>
              <button
                onClick={goNextWeek}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-900 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                title="Next Week"
              >
                Next <FaChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/income-expense/import"
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                <FaFileImport className="w-4 h-4" />
                Import
              </Link>
              <button
                onClick={() => setShowTransactionModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="w-4 h-4" />
                Add Transaction
              </button>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaPlus className="w-4 h-4" />
                Manage Categories
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Income</div>
            <div className="text-2xl font-bold text-green-600">${Math.round(getTotalIncome())}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600">${Math.round(getTotalExpense())}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg md:col-span-1 col-span-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">Net Income</div>
            <div className={`text-2xl font-bold ${getNetIncome() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.round(getNetIncome())}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <FaFilter className="w-4 h-4 text-gray-500" />
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as 'all' | 'income' | 'expense' }))}
                className="w-full sm:w-auto px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full sm:w-auto px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters(prev => ({ ...prev, payment_method: e.target.value as 'all' | 'cash' | 'bank' | 'card' }))}
                className="w-full sm:w-auto px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Method</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No transactions found for the selected period
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {format(new Date(transaction.date), "MMM dd, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'income' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {transaction.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getCategoryColor(transaction.category) }}
                        >
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {transaction.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {transaction.reference_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white capitalize">
                        {transaction.payment_method}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          {transaction.document_url && (
                            <a
                              href={transaction.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View Document"
                            >
                              <FaFileAlt className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setEditingTransaction(transaction);
                              setShowTransactionModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit Transaction"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, id: transaction.id, type: 'transaction' })}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete Transaction"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Modal */}
        <TransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setEditingTransaction(null);
          }}
          onSave={fetchData}
          transaction={editingTransaction}
          categories={categories}
        />

        {/* Category Modal */}
        <CategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onSave={fetchData}
          categories={categories}
        />

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: '', type: 'transaction' })}
          onConfirm={() => {
            if (deleteConfirm.type === 'transaction') {
              handleDeleteTransaction(deleteConfirm.id);
            } else {
              handleDeleteCategory(deleteConfirm.id);
            }
          }}
          title={`Delete ${deleteConfirm.type === 'transaction' ? 'Transaction' : 'Category'}`}
          message={`Are you sure you want to delete this ${deleteConfirm.type}? This action cannot be undone.`}
        />
      </div>
    </AdminGuard>
  );
}
