"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay } from "date-fns";
import { FaFilePdf, FaFileExcel, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { addBrandingHeader, getBrandingHeaderHeight } from "@/lib/pdf-branding";
import { BrandSettings } from "@/lib/brand-settings";

type Staff = {
  id: string;
  name: string;
  applies_public_holiday_rules?: boolean;
};

type StaffRate = {
  id: string;
  staff_id: string;
  rate: number;
  rate_type: string; // 'default', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  effective_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};

type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; non_billable_hours?: number };
type StaffPaymentInstruction = {
  id: string;
  staff_id: string;
  label: string;
  adjustment_per_hour: number;
  weekly_hours_cap: number | null;
  payment_method: string | null;
  priority: number;
  active: boolean;
  effective_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};

type DayCell = { hours: number; amount: number };

export default function WagesReportPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEnd, setWeekEnd] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffRates, setStaffRates] = useState<StaffRate[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [instructions, setInstructions] = useState<StaffPaymentInstruction[]>([]);
  const [holidays, setHolidays] = useState<{ date: string; markup_percentage: number; markup_amount: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);

  const reloadWeek = useCallback((base: Date) => {
    setWeekStart(startOfWeek(base, { weekStartsOn: 1 }));
    setWeekEnd(endOfWeek(base, { weekStartsOn: 1 }));
  }, []);

  const goPrevWeek = () => reloadWeek(subWeeks(weekStart, 1));
  const goNextWeek = () => reloadWeek(addWeeks(weekStart, 1));
  const goThisWeek = () => reloadWeek(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const [{ data: staffData, error: staffErr }, { data: ratesData, error: ratesErr }, { data: shiftData, error: shiftErr }, { data: holidayData, error: holidayErr }, brandSettingsResponse] = await Promise.all([
        supabase.from("staff").select("id, name, applies_public_holiday_rules"),
        supabase.from("staff_rates").select("*"),
        supabase
          .from("shifts")
          .select("id, staff_id, start_time, end_time, non_billable_hours")
          .gte("start_time", weekStart.toISOString())
          .lte("start_time", weekEnd.toISOString()),
        supabase
          .from("public_holidays")
          .select("holiday_date, markup_percentage, markup_amount")
          .gte("holiday_date", weekStart.toISOString().split('T')[0])
          .lte("holiday_date", weekEnd.toISOString().split('T')[0])
          .eq("is_active", true),
        fetch('/api/brand-settings').then(res => res.json())
      ]);

      if (staffErr) throw new Error(staffErr.message);
      if (ratesErr) throw new Error(ratesErr.message);
      if (shiftErr) throw new Error(shiftErr.message);
      if (holidayErr) throw new Error(holidayErr.message);

      setStaff((staffData as Staff[]) || []);
      setStaffRates((ratesData as StaffRate[]) || []);
      setShifts((shiftData as Shift[]) || []);
      setHolidays((holidayData as { holiday_date: string; markup_percentage: number; markup_amount: number }[])?.map(h => ({
        date: h.holiday_date,
        markup_percentage: h.markup_percentage,
        markup_amount: h.markup_amount
      })) || []);
      setBrandSettings(brandSettingsResponse.success ? brandSettingsResponse.data : null);
      if (staffData && staffData.length > 0) {
        const { data: instr } = await supabase
          .from("staff_payment_instructions")
          .select("*")
          .in("staff_id", (staffData as Staff[]).map(s => s.id))
          .eq("active", true)
          .eq("is_current", true)
          .order("priority", { ascending: true });
        setInstructions((instr as StaffPaymentInstruction[]) || []);
      } else {
        setInstructions([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load wages report data");
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const daysOfWeek = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
    }
    return days;
  }, [weekStart]);

  const getBaseRateForDate = useCallback((staffId: string, date: Date): number => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const rateTypeMap: { [key: number]: string } = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
    const rateType = rateTypeMap[dayOfWeek];
    let rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === rateType && r.effective_date <= dateStr && r.end_date >= dateStr);
    if (!rate) {
      rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === 'default' && r.effective_date <= dateStr && r.end_date >= dateStr);
    }
    let baseRate = rate?.rate || 0;
    const staffRow = staff.find(s => s.id === staffId);
    if (staffRow?.applies_public_holiday_rules) {
      const holiday = holidays.find(h => h.date === dateStr);
      if (holiday) {
        if (holiday.markup_percentage > 0) {
          baseRate = baseRate * (holiday.markup_percentage / 100.0);
        } else if (holiday.markup_amount > 0) {
          baseRate = baseRate + holiday.markup_amount;
        }
      }
    }
    return baseRate;
  }, [staff, staffRates, holidays]);

  const grid = useMemo(() => {
    const staffMap: Record<string, { staff: Staff; cells: DayCell[]; totalHours: number; totalAmount: number }> = {};
    for (const s of staff) {
      staffMap[s.id] = {
        staff: s,
        cells: daysOfWeek.map(() => ({ hours: 0, amount: 0 })),
        totalHours: 0,
        totalAmount: 0,
      };
    }

    // Prepare weekly caps per staff
    const byStaff = new Map<string, StaffPaymentInstruction[]>();
    for (const ins of instructions) {
      if (!byStaff.has(ins.staff_id)) byStaff.set(ins.staff_id, []);
      byStaff.get(ins.staff_id)!.push(ins);
    }
    const capsByStaff: Record<string, { list: StaffPaymentInstruction[]; remaining: number[] }> = {};
    for (const s of staff) {
      const list = (byStaff.get(s.id) || []).slice().sort((a,b) => a.priority - b.priority);
      capsByStaff[s.id] = { list, remaining: list.map(i => i.weekly_hours_cap ?? Number.POSITIVE_INFINITY) };
    }

    const sortedShifts = [...shifts].sort((a,b) => a.start_time.localeCompare(b.start_time));
    for (const shift of sortedShifts) {
      if (!shift.staff_id) continue;
      const staffRow = staffMap[shift.staff_id];
      if (!staffRow) continue;
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const rawHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const nonbill = Number(shift.non_billable_hours || 0);
      const hours = Math.max(0, rawHours - nonbill);
      const baseRate = getBaseRateForDate(staffRow.staff.id, start);
      let remaining = hours;
      let amount = 0;
      const caps = capsByStaff[staffRow.staff.id];
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
      if (remaining > 0) amount += remaining * baseRate;

      const dayIndex = daysOfWeek.findIndex((d) => isSameDay(d, start));
      if (dayIndex >= 0) {
        staffRow.cells[dayIndex].hours += hours;
        staffRow.cells[dayIndex].amount += amount;
        staffRow.totalHours += hours;
        staffRow.totalAmount += amount;
      }
    }

    const rows = Object.values(staffMap);
    rows.sort((a, b) => a.staff.name.localeCompare(b.staff.name));
    return rows;
  }, [staff, staffRates, shifts, daysOfWeek, instructions, holidays, getBaseRateForDate]);

  const exportPdf = async () => {
    try {
      const doc = new jsPDF();
      
      // Add branding header
      if (brandSettings) {
        await addBrandingHeader(
          doc, 
          brandSettings, 
          "Wages Report",
          `Week: ${format(weekStart, "MMM dd, yyyy")} - ${format(weekEnd, "MMM dd, yyyy")}`
        );
      } else {
        // Fallback if no brand settings
        doc.setFontSize(16);
        doc.text("Wages Report", 14, 18);
        doc.setFontSize(10);
        doc.text(
          `Week: ${format(weekStart, "MMM dd, yyyy")} - ${format(weekEnd, "MMM dd, yyyy")}`,
          14,
          24
        );
      }
      
      // Calculate start position based on branding header height
      const headerHeight = brandSettings ? getBrandingHeaderHeight(brandSettings, true) : 30;
      const startY = headerHeight + 10;

      const head = [
        [
          "Staff",
          ...daysOfWeek.map((d) => format(d, "EEE dd")),
          "Total",
        ],
      ];

      const body = grid.map((row) => [
        row.staff.name,
        ...row.cells.map((c) => `${c.hours.toFixed(2)}h ($${c.amount.toFixed(2)})`),
        `$${row.totalAmount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        head,
        body,
        startY: startY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });

      doc.save(
        `wages-report-${format(weekStart, "yyyy-MM-dd")}-to-${format(weekEnd, "yyyy-MM-dd")}.pdf`
      );
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Failed to export PDF");
    }
  };

  const exportExcel = () => {
    try {
      const worksheetData: Array<Record<string, string | number>> = [];
      for (const row of grid) {
        const record: Record<string, string | number> = { Staff: row.staff.name };
        daysOfWeek.forEach((d, i) => {
          record[format(d, "EEE dd")] = `${row.cells[i].hours.toFixed(2)}h ($${row.cells[i].amount.toFixed(2)})`;
        });
        record["Total"] = Number(row.totalAmount.toFixed(2));
        worksheetData.push(record);
      }

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Wages Report");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        data,
        `wages-report-${format(weekStart, "yyyy-MM-dd")}-to-${format(weekEnd, "yyyy-MM-dd")}.xlsx`
      );
      toast.success("Excel downloaded");
    } catch (e) {
      toast.error("Failed to export Excel");
    }
  };

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wages Report</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Week: {format(weekStart, "MMM dd, yyyy")} - {format(weekEnd, "MMM dd, yyyy")}
            </p>
          </div>
          <div className="flex flex-col gap-3 print:hidden">
            {/* Navigation buttons - always on first row */}
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

            {/* Export buttons - second row on mobile, same row on desktop */}
            <div className="flex items-center gap-3 flex-wrap md:flex-nowrap md:ml-auto">
              <button
                onClick={exportPdf}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FaFilePdf className="w-4 h-4" /> Export PDF
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaFileExcel className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                {daysOfWeek.map((d) => (
                  <th key={d.toISOString()} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {format(d, "EEE")}<span className="ml-1 text-gray-400">{format(d, "dd")}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td>
                </tr>
              ) : grid.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No data for this week</td>
                </tr>
              ) : (
                grid.map((row) => (
                  <tr key={row.staff.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{row.staff.name}</td>
                    {row.cells.map((cell, idx) => (
                      <td key={`${row.staff.id}-${idx}`} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{cell.amount > 0 ? `$${cell.amount.toFixed(2)}` : '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {cell.hours > 0 ? `${cell.hours.toFixed(2)}h × $${getBaseRateForDate(row.staff.id, daysOfWeek[idx]).toFixed(2)}` : ''}
                          </span>
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${row.totalAmount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  );
}



