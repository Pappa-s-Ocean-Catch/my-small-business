"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { FaChevronLeft, FaChevronRight, FaEye } from "react-icons/fa";
import { toast } from "react-toastify";

type PaidPayment = {
  id: string;
  staff_id: string;
  week_start: string;
  week_end: string;
  total_hours: number;
  total_wages: number;
  booking_hours: number;
  booking_wages: number;
  cash_hours: number;
  cash_wages: number;
  payment_data: Record<string, unknown>;
  created_at: string;
  created_by: string;
  paid_at: string;
  staff: {
    name: string;
    email: string | null;
  };
};

export default function PaidPaymentsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [paidPayments, setPaidPayments] = useState<PaidPayment[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end };
  });
  const [selectedPayment, setSelectedPayment] = useState<PaidPayment | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role_slug")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role_slug === "admin");
    };
    void checkAdmin();
  }, []);

  const fetchPaidPayments = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("wage_payments")
      .select(`
        *,
        staff:staff_id (
          name,
          email
        )
      `)
      .gte("week_start", dateRange.start.toISOString().split('T')[0])
      .lte("week_end", dateRange.end.toISOString().split('T')[0])
      .order("paid_at", { ascending: false });

    if (error) {
      console.error("Error fetching paid payments:", error);
      toast.error("Failed to load paid payments");
      return;
    }

    setPaidPayments(data || []);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    if (isAdmin) {
      void fetchPaidPayments();
    }
  }, [isAdmin, fetchPaidPayments]);

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

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-gray-500">
          Loading paid payments...
        </div>
      </AdminGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-red-600">
          Access restricted. You must be an admin to view paid payments.
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paid Payments</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Payments</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{paidPayments.length}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {paidPayments.reduce((sum, p) => sum + p.total_hours, 0).toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Wages</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${paidPayments.reduce((sum, p) => sum + p.total_wages, 0).toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Paid At</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {paidPayments.length > 0 ? format(new Date(paidPayments[0].paid_at), "MMM dd, yyyy") : "N/A"}
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Wages</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Booking</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cash</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paid At</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {paidPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No paid payments found for the selected week
                    </td>
                  </tr>
                ) : (
                  paidPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div>
                          <div className="font-medium">{payment.staff.name}</div>
                          {payment.staff.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{payment.staff.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{payment.total_hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${payment.total_wages.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {payment.booking_hours.toFixed(2)}h (${payment.booking_wages.toFixed(2)})
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {payment.cash_hours.toFixed(2)}h (${payment.cash_wages.toFixed(2)})
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {format(new Date(payment.paid_at), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          <FaEye className="w-3 h-3" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Details Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Payment Details - {selectedPayment.staff.name}
                </h3>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              {/* Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Hours</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{selectedPayment.total_hours.toFixed(2)}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-green-600 dark:text-green-400">Total Wages</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">${selectedPayment.total_wages.toFixed(2)}</div>
                </div>
                <div className="bg-blue-100 dark:bg-blue-800/20 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300">Booking</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {selectedPayment.booking_hours.toFixed(2)}h - ${selectedPayment.booking_wages.toFixed(2)}
                  </div>
                </div>
                <div className="bg-green-100 dark:bg-green-800/20 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300">Cash</div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">
                    {selectedPayment.cash_hours.toFixed(2)}h - ${selectedPayment.cash_wages.toFixed(2)}
                  </div>
                </div>
              </div>

              {selectedPayment.payment_data && (
                <div className="space-y-6">
                  {/* Payment Breakdown Table */}
                  {(selectedPayment.payment_data as any).shifts && (selectedPayment.payment_data as any).shifts.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Breakdown</h4>
                      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-neutral-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Payment Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hours</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rate</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-neutral-600">
                              {(selectedPayment.payment_data as any).shifts.map((shift: Record<string, unknown>, index: number) => {
                                const startTime = new Date(shift.start_time as string);
                                const endTime = new Date(shift.end_time as string);
                                
                                // Use pre-calculated data from payment_data
                                const hours = shift.hours as number || 0;
                                const rate = shift.rate as number || 0;
                                const total = shift.total_amount as number || 0;
                                const paymentType = shift.payment_type as string || 'cash';
                                const isHoliday = shift.is_holiday as boolean || false;
                                const isPublicHoliday = shift.is_public_holiday as boolean || false;
                                
                                return (
                                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-neutral-700">
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      <div>
                                        <div className="font-medium">{format(startTime, "MMM dd, yyyy")}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{format(startTime, "EEE")}</div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        paymentType === 'booking' 
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                          : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                      }`}>
                                        {paymentType === 'booking' ? 'Booking' : 'Cash'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      {hours.toFixed(2)}h
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      <div className="flex items-center gap-2">
                                        <span>${rate.toFixed(2)}/h</span>
                                        {isPublicHoliday && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                            Public Holiday
                                          </span>
                                        )}
                                        {isHoliday && !isPublicHoliday && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                            Holiday
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                      ${total.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                      {shift.non_billable_hours ? `${shift.non_billable_hours}h non-billable` : 'Fully billable'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Holiday Adjustments */}
                  {(selectedPayment.payment_data as any).holidays && (selectedPayment.payment_data as any).holidays.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Holiday Adjustments</h4>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                        <div className="space-y-2">
                          {(selectedPayment.payment_data as any).holidays.map((holiday: Record<string, unknown>, index: number) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span className="text-orange-700 dark:text-orange-300 font-medium">
                                {format(new Date(holiday.date as string), "MMM dd, yyyy")}
                              </span>
                              <span className="text-orange-900 dark:text-orange-100 font-bold">
                                {(holiday.markup_percentage as number) > 0 
                                  ? `${holiday.markup_percentage}% markup`
                                  : `+$${(holiday.markup_amount as number)?.toFixed(2) || '0.00'}`
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Instructions */}
                  {(selectedPayment.payment_data as any).instructions && (selectedPayment.payment_data as any).instructions.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Instructions</h4>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <div className="space-y-3">
                          {(selectedPayment.payment_data as any).instructions.map((instruction: Record<string, unknown>, index: number) => (
                            <div key={index} className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-blue-900 dark:text-blue-100">{instruction.label as string}</span>
                                {(instruction as any).weekly_hours_cap && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Cap: {(instruction as any).weekly_hours_cap as number}h
                                  </div>
                                )}
                              </div>
                              <span className="text-blue-900 dark:text-blue-100 font-bold">
                                {(instruction.adjustment_per_hour as number) > 0 ? '+' : ''}${(instruction.adjustment_per_hour as number)?.toFixed(2) || '0.00'}/h
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
