"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from 'react-toastify';

type Staff = {
  id: string;
  name: string;
  pay_rate: number; // legacy
  email: string | null;
  default_rate: number | null;
  mon_rate: number | null;
  tue_rate: number | null;
  wed_rate: number | null;
  thu_rate: number | null;
  fri_rate: number | null;
  sat_rate: number | null;
  sun_rate: number | null;
};
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null; non_billable_hours?: number };
type StaffPaymentInstruction = {
  id: string;
  staff_id: string;
  label: string;
  adjustment_per_hour: number;
  weekly_hours_cap: number | null;
  payment_method: string | null;
  priority: number;
  active: boolean;
};

interface FinancialReportRow {
  date: string;
  staffName: string;
  startTime: string;
  endTime: string;
  hours: number;
  nonBillableHours: number;
  payRate: number;
  totalWage: number;
  shiftId: string;
}

export default function ReportsPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday
    end: endOfWeek(new Date(), { weekStartsOn: 1 }) // Sunday
  });
  const [reportData, setReportData] = useState<FinancialReportRow[]>([]);
  const [instructions, setInstructions] = useState<StaffPaymentInstruction[]>([]);

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

  const fetchData = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    const [{ data: staffData }, { data: shiftData }] = await Promise.all([
      supabase.from("staff").select("id, name, pay_rate, email, default_rate, mon_rate, tue_rate, wed_rate, thu_rate, fri_rate, sat_rate, sun_rate"),
      supabase.from("shifts").select("id, staff_id, start_time, end_time, notes, non_billable_hours")
    ]);

    setStaff(staffData || []);
    setShifts(shiftData || []);
    if (staffData && staffData.length > 0) {
      const staffIds = staffData.map(s => s.id);
      const { data: instr } = await supabase
        .from("staff_payment_instructions")
        .select("*")
        .in("staff_id", staffIds)
        .eq("active", true)
        .order("priority", { ascending: true });
      setInstructions(instr || []);
    } else {
      setInstructions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function getBaseRateForDate(staffMember: Staff, date: Date): number {
    const dow = date.getDay(); // 0 Sun - 6 Sat
    const lookup: Array<number | null | undefined> = [
      staffMember.sun_rate,
      staffMember.mon_rate,
      staffMember.tue_rate,
      staffMember.wed_rate,
      staffMember.thu_rate,
      staffMember.fri_rate,
      staffMember.sat_rate,
    ];
    const dayRate = lookup[dow];
    return Number(dayRate ?? staffMember.default_rate ?? staffMember.pay_rate);
  }

  const generateReportData = useCallback(() => {
    const reportRows: FinancialReportRow[] = [];
    // Build per-staff instruction caps map for this week
    const capsByStaff: Record<string, { list: StaffPaymentInstruction[]; remaining: number[] }> = {};
    const byStaff = new Map<string, StaffPaymentInstruction[]>();
    instructions.forEach(i => {
      if (!byStaff.has(i.staff_id)) byStaff.set(i.staff_id, []);
      byStaff.get(i.staff_id)!.push(i);
    });
    staff.forEach(s => {
      const list = (byStaff.get(s.id) || []).slice().sort((a, b) => a.priority - b.priority);
      capsByStaff[s.id] = { list, remaining: list.map(i => i.weekly_hours_cap ?? Number.POSITIVE_INFINITY) };
    });
    // Sort shifts by start time for deterministic allocation
    const sortedShifts = [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    sortedShifts.forEach(shift => {
      const shiftDate = new Date(shift.start_time);
      
      // Only include shifts within the selected date range
      if (isWithinInterval(shiftDate, { start: dateRange.start, end: dateRange.end })) {
        const staffMember = staff.find(s => s.id === shift.staff_id);
        
        if (staffMember) {
          const start = new Date(shift.start_time);
          const end = new Date(shift.end_time);
          const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const nonbill = Number(shift.non_billable_hours || 0);
          const hours = Math.max(0, rawHours - nonbill);
          const baseRate = getBaseRateForDate(staffMember, shiftDate);
          // Allocate hours across instructions
          let remaining = hours;
          let amount = 0;
          const caps = capsByStaff[staffMember.id];
          if (caps && caps.list.length > 0) {
            for (let idx = 0; idx < caps.list.length && remaining > 0; idx++) {
              const ins = caps.list[idx];
              const capLeft = caps.remaining[idx];
              if (capLeft <= 0) continue;
              const take = Math.min(remaining, capLeft);
              amount += take * (baseRate + ins.adjustment_per_hour);
              caps.remaining[idx] = capLeft - take;
              remaining -= take;
            }
          }
          if (remaining > 0) {
            amount += remaining * baseRate;
          }
          
          reportRows.push({
            date: format(shiftDate, "yyyy-MM-dd"),
            staffName: staffMember.name,
            startTime: format(start, "HH:mm"),
            endTime: format(end, "HH:mm"),
            hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
            nonBillableHours: nonbill,
            payRate: baseRate,
            totalWage: Math.round(amount * 100) / 100,
            shiftId: shift.id
          });
        }
      }
    });
    
    // Sort by date, then by staff name
    reportRows.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.staffName.localeCompare(b.staffName);
    });
    
    setReportData(reportRows);
  }, [shifts, staff, dateRange, instructions]);

  useEffect(() => {
    generateReportData();
  }, [generateReportData]);


  const getTotalHours = () => {
    return reportData.reduce((total, row) => total + row.hours, 0);
  };

  const getTotalWages = () => {
    return reportData.reduce((total, row) => total + row.totalWage, 0);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text("Financial Report", 14, 22);
    
    // Date range
    doc.setFontSize(12);
    doc.text(`Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`, 14, 30);
    
    // Summary
    doc.setFontSize(10);
    doc.text(`Total Hours: ${getTotalHours().toFixed(2)}`, 14, 38);
    doc.text(`Total Wages: $${getTotalWages().toFixed(2)}`, 14, 46);
    
    // Table data
    const tableData = reportData.map(row => [
      row.date,
      row.staffName,
      `${row.startTime} - ${row.endTime}`,
      row.hours.toString(),
      row.nonBillableHours > 0 ? row.nonBillableHours.toString() : '-',
      `$${row.payRate.toFixed(2)}`,
      `$${row.totalWage.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['Date', 'Staff', 'Time', 'Billable Hours', 'Non-Billable', 'Rate', 'Total']],
      body: tableData,
      startY: 54,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });
    
    // Footer
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 54;
    doc.setFontSize(8);
    doc.text(`Generated on ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")}`, 14, finalY + 10);
    
    doc.save(`financial-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.pdf`);
    toast.success('PDF downloaded');
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(row => ({
      Date: row.date,
      'Staff Name': row.staffName,
      'Start Time': row.startTime,
      'End Time': row.endTime,
      'Billable Hours': row.hours,
      'Non-Billable Hours': row.nonBillableHours,
      'Pay Rate': row.payRate,
      'Total Wage': row.totalWage
    })));
    
    // Add summary row
    const summaryRow = {
      Date: '',
      'Staff Name': 'TOTAL',
      'Start Time': '',
      'End Time': '',
      'Billable Hours': getTotalHours(),
      'Non-Billable Hours': '',
      'Pay Rate': '',
      'Total Wage': getTotalWages()
    };
    
    XLSX.utils.sheet_add_json(worksheet, [summaryRow], { skipHeader: true, origin: -1 });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Report");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `financial-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.xlsx`);
    toast.success('Excel downloaded');
  };

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading reports...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view reports.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Reports</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FaFilePdf className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaFileExcel className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 p-4 bg-white dark:bg-neutral-900 rounded-lg border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Date Range:</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={format(dateRange.start, "yyyy-MM-dd")}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 min-w-0 flex-1"
              />
              <span className="text-gray-600 dark:text-gray-300">to</span>
              <input
                type="date"
                value={format(dateRange.end, "yyyy-MM-dd")}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 min-w-0 flex-1"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Shifts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.length}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalHours().toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Wages</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">${getTotalWages().toFixed(2)}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billable Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Non-Billable</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No shifts found for the selected date range
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr key={`${row.shiftId}-${index}`} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.staffName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.startTime} - {row.endTime}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.hours}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.nonBillableHours > 0 ? row.nonBillableHours : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row.payRate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${row.totalWage.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportData.length > 0 && (
                <tfoot className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{getTotalHours().toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">-</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">-</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${getTotalWages().toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
