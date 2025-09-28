"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, format, subWeeks, addWeeks, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { FaFilePdf, FaFileExcel, FaChartLine, FaDollarSign, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";

type Transaction = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  payment_method: 'cash' | 'bank' | 'card';
  description: string | null;
  reference_number: string | null;
  created_at: string;
};

type CategorySummary = {
  category: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
};

type DailySummary = {
  date: string;
  income: number;
  expenses: number;
  net: number;
  transactions: number;
};

type PaymentMethodSummary = {
  method: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
};


function CashFlowContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end };
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle query parameters on component mount
  useEffect(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      const startDate = new Date(startParam);
      const endDate = new Date(endParam);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        setDateRange({ start: startDate, end: endDate });
        setCustomStartDate(format(startDate, "yyyy-MM-dd"));
        setCustomEndDate(format(endDate, "yyyy-MM-dd"));
      }
    } else {
      // Initialize custom date inputs with current date range
      setCustomStartDate(format(dateRange.start, "yyyy-MM-dd"));
      setCustomEndDate(format(dateRange.end, "yyyy-MM-dd"));
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", format(dateRange.start, "yyyy-MM-dd"))
      .lte("date", format(dateRange.end, "yyyy-MM-dd"))
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transaction data");
      return;
    }

    setTransactions(data || []);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);


  const goThisWeek = () => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };


  // Update existing functions to sync with custom date inputs
  const goPrevWeek = () => {
    const newStart = subWeeks(dateRange.start, 1);
    const start = newStart;
    const end = endOfWeek(newStart, { weekStartsOn: 1 });
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };

  const goNextWeek = () => {
    const newStart = addWeeks(dateRange.start, 1);
    const start = newStart;
    const end = endOfWeek(newStart, { weekStartsOn: 1 });
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };

  // New preset filter functions
  const goThisMonth = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };

  const goPrevMonth = () => {
    const newStart = subMonths(dateRange.start, 1);
    const start = startOfMonth(newStart);
    const end = endOfMonth(newStart);
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };

  const goNextMonth = () => {
    const newStart = addMonths(dateRange.start, 1);
    const start = startOfMonth(newStart);
    const end = endOfMonth(newStart);
    setDateRange({ start, end });
    setCustomStartDate(format(start, "yyyy-MM-dd"));
    setCustomEndDate(format(end, "yyyy-MM-dd"));
    updateURL(start, end);
  };


  // Custom date range handler
  const handleCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        setDateRange({ start, end });
        updateURL(start, end);
      } else {
        toast.error("Invalid date range. Please ensure start date is before end date.");
      }
    }
  };

  // Update URL with query parameters
  const updateURL = (start: Date, end: Date) => {
    const params = new URLSearchParams();
    params.set('start', format(start, "yyyy-MM-dd"));
    params.set('end', format(end, "yyyy-MM-dd"));
    router.replace(`/cash-flow?${params.toString()}`, { scroll: false });
  };

  // Calculate summary data
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalIncome - totalExpenses;
  const transactionCount = transactions.length;

  // Daily summary for trend chart
  const dailyData: DailySummary[] = [];
  const currentDate = new Date(dateRange.start);
  while (currentDate <= dateRange.end) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayTransactions = transactions.filter(t => t.date === dateStr);
    const dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const dayExpenses = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    dailyData.push({
      date: dateStr,
      income: dayIncome,
      expenses: dayExpenses,
      net: dayIncome - dayExpenses,
      transactions: dayTransactions.length
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Category breakdown
  const categoryData: CategorySummary[] = [];
  const categoryMap = new Map<string, { income: number; expenses: number; count: number }>();
  
  transactions.forEach(t => {
    if (!categoryMap.has(t.category)) {
      categoryMap.set(t.category, { income: 0, expenses: 0, count: 0 });
    }
    const cat = categoryMap.get(t.category)!;
    if (t.type === 'income') {
      cat.income += t.amount;
    } else {
      cat.expenses += t.amount;
    }
    cat.count += 1;
  });

  categoryMap.forEach((data, category) => {
    categoryData.push({
      category,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      count: data.count
    });
  });

  categoryData.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  // Payment method breakdown
  const paymentData: PaymentMethodSummary[] = [];
  const paymentMap = new Map<string, { income: number; expenses: number; count: number }>();
  
  transactions.forEach(t => {
    if (!paymentMap.has(t.payment_method)) {
      paymentMap.set(t.payment_method, { income: 0, expenses: 0, count: 0 });
    }
    const method = paymentMap.get(t.payment_method)!;
    if (t.type === 'income') {
      method.income += t.amount;
    } else {
      method.expenses += t.amount;
    }
    method.count += 1;
  });

  paymentMap.forEach((data, method) => {
    paymentData.push({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
      count: data.count
    });
  });

  // Income vs Expenses pie chart data
  const incomeExpenseData = [
    { name: 'Income', value: totalIncome, color: '#10B981' },
    { name: 'Expenses', value: totalExpenses, color: '#EF4444' }
  ];

  const exportToPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Cash Flow Analysis", 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`,
      14,
      24
    );

    // Summary
    doc.setFontSize(10);
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`, 14, 35);
    doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 14, 42);
    doc.text(`Net Cash Flow: $${netCashFlow.toFixed(2)}`, 14, 49);
    doc.text(`Total Transactions: ${transactionCount}`, 14, 56);

    // Category breakdown table
    const categoryTableData = categoryData.map(cat => [
      cat.category,
      `$${cat.income.toFixed(2)}`,
      `$${cat.expenses.toFixed(2)}`,
      `$${cat.net.toFixed(2)}`,
      cat.count.toString()
    ]);

    autoTable(doc, {
      head: [['Category', 'Income', 'Expenses', 'Net', 'Count']],
      body: categoryTableData,
      startY: 65,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });

    doc.save(`cash-flow-analysis-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.pdf`);
    toast.success('PDF downloaded');
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
      'Date': t.date,
      'Type': t.type,
      'Category': t.category,
      'Amount': t.amount,
      'Payment Method': t.payment_method,
      'Description': t.description || '',
      'Reference': t.reference_number || ''
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `cash-flow-transactions-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.xlsx`);
    toast.success('Excel downloaded');
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-gray-500">
          Loading cash flow analysis...
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-full sm:max-w-7xl mx-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FaChartLine className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Flow Analysis</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
            </p>
          </div>
          
          {/* Export buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end print:hidden">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              <FaFilePdf className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Export PDF</span><span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              <FaFileExcel className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Export Excel</span><span className="sm:hidden">Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Bar - Second Row */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-4 mb-6 print:hidden">
          <div className="space-y-4">
            {/* Preset Filter Buttons */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Filters</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={goPrevMonth}
                  className="px-3 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors text-sm"
                >
                  Prev Month
                </button>
                <button
                  onClick={goPrevWeek}
                  className="px-3 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors text-sm"
                >
                  Prev Week
                </button>
                <button
                  onClick={goThisWeek}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                >
                  This Week
                </button>
                <button
                  onClick={goThisMonth}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                >
                  This Month
                </button>
                <button
                  onClick={goNextWeek}
                  className="px-3 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors text-sm"
                >
                  Next Week
                </button>
                <button
                  onClick={goNextMonth}
                  className="px-3 py-2 bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors text-sm"
                >
                  Next Month
                </button>
              </div>
            </div>

            {/* Custom Date Range */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Date Range</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCustomDateRange}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FaArrowUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Income</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">${totalIncome.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <FaArrowDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">${totalExpenses.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${netCashFlow >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <FaDollarSign className={`w-5 h-5 ${netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Net Cash Flow</div>
                <div className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${netCashFlow.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FaChartLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transactions</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{transactionCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 w-full">
          {/* Cash Flow Trend */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 sm:p-6 w-full overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Flow Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), "MMM dd")}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
                  labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stackId="1" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.6}
                  name="Income"
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stackId="2" 
                  stroke="#EF4444" 
                  fill="#EF4444" 
                  fillOpacity={0.6}
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Income vs Expenses Pie Chart */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 sm:p-6 w-full overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Income vs Expenses</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={incomeExpenseData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incomeExpenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 sm:p-6 w-full overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                <Legend />
                <Bar dataKey="income" fill="#10B981" name="Income" />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Method Analysis */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-4 sm:p-6 w-full overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Method Analysis</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                <Legend />
                <Bar dataKey="income" fill="#10B981" name="Income" />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Category Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden w-full">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Summary</h3>
          </div>
          <div className="overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="w-2/5 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="w-2/5 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="w-1/5 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {categoryData.map((category, index) => {
                  const isIncome = category.income > 0;
                  const amount = isIncome ? category.income : -category.expenses;
                  const amountColor = isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="w-2/5 px-2 py-2 text-xs font-medium text-gray-900 dark:text-white">
                        <div className="truncate" title={category.category}>
                          {category.category}
                        </div>
                      </td>
                      <td className={`w-2/5 px-2 py-2 text-xs font-medium ${amountColor}`}>
                        <div className="truncate">
                          {isIncome ? '+' : '-'}${Math.abs(amount).toFixed(2)}
                        </div>
                      </td>
                      <td className="w-1/5 px-2 py-2 text-xs text-gray-900 dark:text-white">
                        <div className="truncate">{category.count}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

export default function CashFlowPage() {
  return (
    <Suspense fallback={
      <AdminGuard>
        <div className="p-6 text-center text-gray-500">
          Loading cash flow analysis...
        </div>
      </AdminGuard>
    }>
      <CashFlowContent />
    </Suspense>
  );
}
