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

type Staff = { id: string; name: string; pay_rate: number; email: string | null };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null };

interface FinancialReportRow {
  date: string;
  staffName: string;
  startTime: string;
  endTime: string;
  hours: number;
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
    const [{ data: staffData }, { data: shiftData }] = await Promise.all([
      getSupabaseClient().from("staff").select("id, name, pay_rate, email"),
      getSupabaseClient().from("shifts").select("id, staff_id, start_time, end_time, notes")
    ]);

    setStaff(staffData || []);
    setShifts(shiftData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const generateReportData = useCallback(() => {
    const reportRows: FinancialReportRow[] = [];
    
    shifts.forEach(shift => {
      const shiftDate = new Date(shift.start_time);
      
      // Only include shifts within the selected date range
      if (isWithinInterval(shiftDate, { start: dateRange.start, end: dateRange.end })) {
        const staffMember = staff.find(s => s.id === shift.staff_id);
        
        if (staffMember) {
          const start = new Date(shift.start_time);
          const end = new Date(shift.end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const totalWage = hours * staffMember.pay_rate;
          
          reportRows.push({
            date: format(shiftDate, "yyyy-MM-dd"),
            staffName: staffMember.name,
            startTime: format(start, "HH:mm"),
            endTime: format(end, "HH:mm"),
            hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
            payRate: staffMember.pay_rate,
            totalWage: Math.round(totalWage * 100) / 100,
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
  }, [shifts, staff, dateRange]);

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
      `$${row.payRate.toFixed(2)}`,
      `$${row.totalWage.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['Date', 'Staff', 'Time', 'Hours', 'Rate', 'Total']],
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
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(row => ({
      Date: row.date,
      'Staff Name': row.staffName,
      'Start Time': row.startTime,
      'End Time': row.endTime,
      Hours: row.hours,
      'Pay Rate': row.payRate,
      'Total Wage': row.totalWage
    })));
    
    // Add summary row
    const summaryRow = {
      Date: '',
      'Staff Name': 'TOTAL',
      'Start Time': '',
      'End Time': '',
      Hours: getTotalHours(),
      'Pay Rate': '',
      'Total Wage': getTotalWages()
    };
    
    XLSX.utils.sheet_add_json(worksheet, [summaryRow], { skipHeader: true, origin: -1 });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Report");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `financial-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.xlsx`);
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
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Reports</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Date Range:</label>
            <input
              type="date"
              value={format(dateRange.start, "yyyy-MM-dd")}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
            />
            <span className="text-gray-600 dark:text-gray-300">to</span>
            <input
              type="date"
              value={format(dateRange.end, "yyyy-MM-dd")}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
            />
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
