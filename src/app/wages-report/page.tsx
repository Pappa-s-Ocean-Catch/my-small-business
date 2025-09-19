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

type Staff = { id: string; name: string; pay_rate: number };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string };

type DayCell = { hours: number; amount: number };

export default function WagesReportPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEnd, setWeekEnd] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      const [{ data: staffData, error: staffErr }, { data: shiftData, error: shiftErr }] = await Promise.all([
        supabase.from("staff").select("id, name, pay_rate"),
        supabase
          .from("shifts")
          .select("id, staff_id, start_time, end_time")
          .gte("start_time", format(weekStart, "yyyy-MM-dd"))
          .lte("start_time", format(weekEnd, "yyyy-MM-dd")),
      ]);

      if (staffErr) throw new Error(staffErr.message);
      if (shiftErr) throw new Error(shiftErr.message);

      setStaff((staffData as Staff[]) || []);
      setShifts((shiftData as Shift[]) || []);
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

    for (const shift of shifts) {
      if (!shift.staff_id) continue;
      const staffRow = staffMap[shift.staff_id];
      if (!staffRow) continue;
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const amount = hours * staffRow.staff.pay_rate;

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
  }, [staff, shifts, daysOfWeek]);

  const exportPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Wages Report", 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Week: ${format(weekStart, "MMM dd, yyyy")} - ${format(weekEnd, "MMM dd, yyyy")}`,
        14,
        24
      );

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
        startY: 30,
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={goPrevWeek}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800"
              title="Previous Week"
            >
              <FaChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={goThisWeek}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800"
              title="This Week"
            >
              Today
            </button>
            <button
              onClick={goNextWeek}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800"
              title="Next Week"
            >
              Next <FaChevronRight className="w-4 h-4" />
            </button>

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

        {/* Grid */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-x-auto">
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
                          <span className="text-xs text-gray-500 dark:text-gray-400">{cell.hours > 0 ? `${cell.hours.toFixed(2)}h` : ''}</span>
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



