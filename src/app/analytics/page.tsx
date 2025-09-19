"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { LoadingPage } from "@/components/Loading";
import { 
  FaChartLine, 
  FaUsers, 
  FaDollarSign, 
  FaBox, 
  FaClock, 
  FaExclamationTriangle,
  FaCalendarAlt,
  FaShoppingCart,
  FaArrowUp,
  FaArrowDown
} from "react-icons/fa";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { format, startOfWeek, endOfWeek, subDays, subWeeks, subMonths } from "date-fns";

interface AnalyticsData {
  // Revenue & Financial
  totalRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
  averageOrderValue: number;
  
  // Staff & Labor
  totalStaff: number;
  totalHoursWorked: number;
  laborCost: number;
  laborCostPercentage: number;
  averageHourlyRate: number;
  
  // Inventory
  totalProducts: number;
  lowStockProducts: number;
  inventoryValue: number;
  inventoryTurnover: number;
  
  // Operations
  totalShifts: number;
  shiftsThisWeek: number;
  averageShiftLength: number;
  staffUtilization: number;
}

interface TimeSeriesData {
  date: string;
  revenue: number;
  laborCost: number;
  shifts: number;
  hours: number;
}

interface StaffPerformance {
  name: string;
  hours: number;
  cost: number;
  shifts: number;
  efficiency: number;
}

interface ProductPerformance {
  name: string;
  quantity: number;
  value: number;
  category: string;
  turnover: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Calculate date ranges
        const endDate = new Date();
        const startDate = timeRange === '7d' ? subDays(endDate, 7) : 
                         timeRange === '30d' ? subDays(endDate, 30) : 
                         subDays(endDate, 90);

        // Fetch all data in parallel
        const [
          staffResult,
          shiftsResult,
          productsResult,
          inventoryMovementsResult,
          categoriesResult
        ] = await Promise.all([
          supabase.from("staff").select("id, name, pay_rate"),
          supabase.from("shifts").select(`
            id, date, start_time, end_time,
            staff:staff_id (name, pay_rate)
          `).gte("date", startDate.toISOString().split('T')[0]),
          supabase.from("products").select(`
            id, name, quantity_in_stock, purchase_price, sale_price, reorder_level,
            category:category_id (name)
          `),
          supabase.from("inventory_movements").select(`
            id, movement_type, quantity, unit_cost, total_cost, created_at,
            product:product_id (name, sale_price)
          `).gte("created_at", startDate.toISOString()),
          supabase.from("categories").select("id, name")
        ]);

        // Process analytics data
        const staff = staffResult.data || [];
        const shifts = shiftsResult.data || [];
        const products = productsResult.data || [];
        const movements = inventoryMovementsResult.data || [];
        const categories = categoriesResult.data || [];

        // Calculate financial metrics
        const totalRevenue = movements
          .filter(m => m.movement_type === 'sale')
          .reduce((sum, m) => sum + (m.total_cost || 0), 0);

        const weeklyRevenue = movements
          .filter(m => m.movement_type === 'sale' && 
            new Date(m.created_at) >= subDays(new Date(), 7))
          .reduce((sum, m) => sum + (m.total_cost || 0), 0);

        const monthlyRevenue = movements
          .filter(m => m.movement_type === 'sale' && 
            new Date(m.created_at) >= subDays(new Date(), 30))
          .reduce((sum, m) => sum + (m.total_cost || 0), 0);

        // Calculate labor metrics
        let totalHoursWorked = 0;
        let laborCost = 0;
        const staffHours: { [key: string]: { hours: number; cost: number; shifts: number } } = {};

        shifts.forEach(shift => {
          const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff;
          if (staff && staff.pay_rate) {
            const start = new Date(`2000-01-01T${shift.start_time}`);
            const end = new Date(`2000-01-01T${shift.end_time}`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const cost = hours * staff.pay_rate;
            
            totalHoursWorked += hours;
            laborCost += cost;

            if (!staffHours[staff.name]) {
              staffHours[staff.name] = { hours: 0, cost: 0, shifts: 0 };
            }
            staffHours[staff.name].hours += hours;
            staffHours[staff.name].cost += cost;
            staffHours[staff.name].shifts += 1;
          }
        });

        // Calculate inventory metrics
        const inventoryValue = products.reduce((sum, p) => 
          sum + (p.quantity_in_stock * (p.purchase_price || 0)), 0);

        const lowStockProducts = products.filter(p => 
          p.quantity_in_stock <= p.reorder_level).length;

        // Calculate time series data
        const timeSeriesMap: { [key: string]: TimeSeriesData } = {};
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i <= daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          timeSeriesMap[dateStr] = {
            date: dateStr,
            revenue: 0,
            laborCost: 0,
            shifts: 0,
            hours: 0
          };
        }

        // Populate time series data
        movements.forEach(movement => {
          const date = movement.created_at.split('T')[0];
          if (timeSeriesMap[date]) {
            if (movement.movement_type === 'sale') {
              timeSeriesMap[date].revenue += movement.total_cost || 0;
            }
          }
        });

        shifts.forEach(shift => {
          const date = shift.date;
          const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff;
          if (timeSeriesMap[date] && staff && staff.pay_rate) {
            const start = new Date(`2000-01-01T${shift.start_time}`);
            const end = new Date(`2000-01-01T${shift.end_time}`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const cost = hours * staff.pay_rate;
            
            timeSeriesMap[date].laborCost += cost;
            timeSeriesMap[date].shifts += 1;
            timeSeriesMap[date].hours += hours;
          }
        });

        // Process staff performance data
        const staffPerf: StaffPerformance[] = Object.entries(staffHours).map(([name, data]) => ({
          name,
          hours: Math.round(data.hours * 10) / 10,
          cost: Math.round(data.cost * 100) / 100,
          shifts: data.shifts,
          efficiency: data.shifts > 0 ? Math.round((data.hours / data.shifts) * 10) / 10 : 0
        }));

        // Process product performance data
        const productPerf: ProductPerformance[] = products.map(p => {
          const category = Array.isArray(p.category) ? p.category[0] : p.category;
          return {
            name: p.name,
            quantity: p.quantity_in_stock,
            value: p.quantity_in_stock * (p.purchase_price || 0),
            category: category?.name || 'Uncategorized',
            turnover: 0 // Would need more data to calculate actual turnover
          };
        });

        // Calculate growth rates
        const previousPeriodRevenue = timeRange === '7d' ? 
          movements.filter(m => m.movement_type === 'sale' && 
            new Date(m.created_at) >= subDays(new Date(), 14) && 
            new Date(m.created_at) < subDays(new Date(), 7))
            .reduce((sum, m) => sum + (m.total_cost || 0), 0) :
          movements.filter(m => m.movement_type === 'sale' && 
            new Date(m.created_at) >= subDays(new Date(), 60) && 
            new Date(m.created_at) < subDays(new Date(), 30))
            .reduce((sum, m) => sum + (m.total_cost || 0), 0);

        const revenueGrowth = previousPeriodRevenue > 0 ? 
          ((weeklyRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 : 0;

        setAnalyticsData({
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
          monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
          averageOrderValue: movements.filter(m => m.movement_type === 'sale').length > 0 ?
            Math.round((totalRevenue / movements.filter(m => m.movement_type === 'sale').length) * 100) / 100 : 0,
          
          totalStaff: staff.length,
          totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
          laborCost: Math.round(laborCost * 100) / 100,
          laborCostPercentage: totalRevenue > 0 ? Math.round((laborCost / totalRevenue) * 100 * 100) / 100 : 0,
          averageHourlyRate: totalHoursWorked > 0 ? Math.round((laborCost / totalHoursWorked) * 100) / 100 : 0,
          
          totalProducts: products.length,
          lowStockProducts,
          inventoryValue: Math.round(inventoryValue * 100) / 100,
          inventoryTurnover: 0, // Would need more data
          
          totalShifts: shifts.length,
          shiftsThisWeek: shifts.filter(s => 
            new Date(s.date) >= subDays(new Date(), 7)).length,
          averageShiftLength: shifts.length > 0 ? Math.round((totalHoursWorked / shifts.length) * 10) / 10 : 0,
          staffUtilization: staff.length > 0 ? Math.round((shifts.length / (staff.length * 7)) * 100 * 100) / 100 : 0
        });

        setTimeSeriesData(Object.values(timeSeriesMap));
        setStaffPerformance(staffPerf);
        setProductPerformance(productPerf);

      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalyticsData();
  }, [timeRange]);

  if (loading) {
    return <LoadingPage message="Loading analytics..." />;
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <FaChartLine className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Analytics Data</h3>
          <p className="text-gray-600 dark:text-gray-400">Start using the system to see analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Business insights and performance metrics</p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Revenue Metrics */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${analyticsData.totalRevenue}</p>
                  <div className="flex items-center mt-1">
                    {analyticsData.revenueGrowth >= 0 ? (
                      <FaArrowUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <FaArrowDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm ${analyticsData.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analyticsData.revenueGrowth >= 0 ? '+' : ''}{analyticsData.revenueGrowth}%
                    </span>
                  </div>
                </div>
                <FaDollarSign className="w-8 h-8 text-green-600" />
              </div>
            </div>

            {/* Labor Cost */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Labor Cost</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${analyticsData.laborCost}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {analyticsData.laborCostPercentage}% of revenue
                  </p>
                </div>
                <FaUsers className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {/* Inventory Value */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inventory Value</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${analyticsData.inventoryValue}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {analyticsData.totalProducts} products
                  </p>
                </div>
                <FaBox className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            {/* Staff Utilization */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Staff Utilization</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsData.staffUtilization}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {analyticsData.totalHoursWorked}h worked
                  </p>
                </div>
                <FaClock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue & Labor Cost Trend */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue vs Labor Cost</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="laborCost" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Staff Performance */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Staff Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={staffPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Staff Performance Table */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
              <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Staff Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Staff</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shifts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                    {staffPerformance.map((staff, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {staff.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {staff.hours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          ${staff.cost}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {staff.shifts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Performance Table */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
              <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Products by Value</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-neutral-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                    {productPerformance
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 10)
                      .map((product, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          ${product.value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.category}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
