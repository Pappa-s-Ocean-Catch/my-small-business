"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isWithinInterval } from "date-fns";
import { FaFilePdf, FaFileExcel, FaChevronLeft, FaChevronRight, FaCheckCircle, FaLock } from "react-icons/fa";
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
  email: string | null;
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

type Shift = { 
  id: string; 
  staff_id: string | null; 
  start_time: string; 
  end_time: string; 
  notes: string | null; 
  non_billable_hours?: number; 
  section_id?: string | null 
};

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

interface PaymentReportRow {
  staffName: string;
  totalHours: number;
  totalWages: number;
  bookingHours: number;
  bookingRate: number;
  bookingWages: number;
  cashHours: number;
  cashRate: number;
  cashWages: number;
}

export default function PaymentReportPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffRates, setStaffRates] = useState<StaffRate[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    
    // Set to start and end of day in Melbourne timezone
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    return { start: startDate, end: endDate };
  });
  const [reportData, setReportData] = useState<PaymentReportRow[]>([]);
  const [instructions, setInstructions] = useState<StaffPaymentInstruction[]>([]);
  const [holidays, setHolidays] = useState<{ date: string; markup_percentage: number; markup_amount: number }[]>([]);
  const [paidStaffIds, setPaidStaffIds] = useState<Set<string>>(new Set());
  const [markingAsPaid, setMarkingAsPaid] = useState<string | null>(null);

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

  const fetchData = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    const [{ data: staffData }, { data: ratesData }, { data: shiftData }, { data: holidayData }, brandSettingsResponse, { data: wagePaymentData }] = await Promise.all([
      supabase.from("staff").select("id, name, email, applies_public_holiday_rules"),
      supabase.from("staff_rates").select("*"),
      supabase.from("shifts").select("id, staff_id, start_time, end_time, notes, non_billable_hours, section_id"),
      supabase
        .from("public_holidays")
        .select("holiday_date, markup_percentage, markup_amount")
        .gte("holiday_date", dateRange.start.toISOString().split('T')[0])
        .lte("holiday_date", dateRange.end.toISOString().split('T')[0])
        .eq("is_active", true),
      fetch('/api/brand-settings').then(res => res.json()),
      supabase
        .from("wage_payments")
        .select("staff_id")
        .eq("week_start", dateRange.start.toISOString().split('T')[0])
        .eq("week_end", dateRange.end.toISOString().split('T')[0])
    ]);

    setStaff(staffData || []);
    setStaffRates(ratesData || []);
    setShifts(shiftData || []);
    setHolidays((holidayData as { holiday_date: string; markup_percentage: number; markup_amount: number }[])?.map(h => ({
      date: h.holiday_date,
      markup_percentage: h.markup_percentage,
      markup_amount: h.markup_amount
    })) || []);
    setBrandSettings(brandSettingsResponse.success ? brandSettingsResponse.data : null);
    setPaidStaffIds(new Set((wagePaymentData || []).map((wp: { staff_id: string }) => wp.staff_id)));
    if (staffData && staffData.length > 0) {
      const staffIds = staffData.map(s => s.id);
      const { data: instr } = await supabase
        .from("staff_payment_instructions")
        .select("*")
        .in("staff_id", staffIds)
        .eq("active", true)
        .eq("is_current", true)
        .order("priority", { ascending: true });
      setInstructions((instr as StaffPaymentInstruction[]) || []);
    } else {
      setInstructions([]);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const generateReportData = useCallback(() => {
    function getBaseRateForDate(staffId: string, date: Date): number {
      // Find the rate that was effective on the given date
      // Use Melbourne timezone for date string to ensure consistency
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
      
      // Map day of week to rate type
      const rateTypeMap: { [key: number]: string } = {
        0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
      };
      const rateType = rateTypeMap[dayOfWeek];
      
      // First try to find specific day rate
      let rate = staffRates.find(r => 
        r.staff_id === staffId && 
        r.rate_type === rateType &&
        r.effective_date <= dateStr && 
        r.end_date >= dateStr
      );
      
      // If no specific day rate, fall back to default rate
      if (!rate) {
        rate = staffRates.find(r => 
          r.staff_id === staffId && 
          r.rate_type === 'default' &&
          r.effective_date <= dateStr && 
          r.end_date >= dateStr
        );
      }
      
      const baseRate = rate?.rate || 0;
      
      // Check for holiday adjustments (only if staff opted in)
      const staffRow = staff.find(s => s.id === staffId);
      if (staffRow?.applies_public_holiday_rules) {
        const holiday = holidays.find(h => h.date === dateStr);
        if (holiday) {
          if (holiday.markup_percentage > 0) {
            // Apply percentage markup
            return baseRate * (holiday.markup_percentage / 100.0);
          } else if (holiday.markup_amount > 0) {
            // Apply fixed amount markup
            return baseRate + holiday.markup_amount;
          }
        }
      }
      
      return baseRate;
    }
    const reportRows: PaymentReportRow[] = [];
    
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
    
    // Initialize staff totals
    const staffTotals: Record<string, {
      staff: Staff;
      totalHours: number;
      totalWages: number;
      bookingHours: number;
      bookingWages: number;
      cashHours: number;
      cashWages: number;
    }> = {};

    staff.forEach(s => {
      staffTotals[s.id] = {
        staff: s,
        totalHours: 0,
        totalWages: 0,
        bookingHours: 0,
        bookingWages: 0,
        cashHours: 0,
        cashWages: 0,
      };
    });
    
    sortedShifts.forEach(shift => {
      const shiftDate = new Date(shift.start_time);
      
      // Only include shifts within the selected date range
      // Compare dates in Melbourne timezone to ensure proper filtering
      const shiftDateMelbourne = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      const rangeStartMelbourne = dateRange.start.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      const rangeEndMelbourne = dateRange.end.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      
      if (shiftDateMelbourne >= rangeStartMelbourne && shiftDateMelbourne <= rangeEndMelbourne) {
        const staffMember = staff.find(s => s.id === shift.staff_id);
        
        if (staffMember) {
          const start = new Date(shift.start_time);
          const end = new Date(shift.end_time);
          const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const nonbill = Number(shift.non_billable_hours || 0);
          const hours = Math.max(0, rawHours - nonbill);
          const baseRate = getBaseRateForDate(staffMember.id, shiftDate);
          
          // Allocate hours across instructions
          let remaining = hours;
          let totalAmount = 0;
          let bookingAmount = 0;
          let cashAmount = 0;
          let bookingHours = 0;
          let cashHours = 0;
          
          const caps = capsByStaff[staffMember.id];
          if (caps && caps.list.length > 0) {
            for (let idx = 0; idx < caps.list.length && remaining > 0; idx++) {
              const ins = caps.list[idx];
              const capLeft = caps.remaining[idx];
              if (capLeft <= 0) continue;
              const take = Math.min(remaining, capLeft);
              const amount = take * (baseRate + ins.adjustment_per_hour);
              totalAmount += amount;
              
              // Categorize by payment method
              if (ins.payment_method === 'Booking') {
                bookingAmount += amount;
                bookingHours += take;
              } else if (ins.payment_method === 'Cash') {
                cashAmount += amount;
                cashHours += take;
              }
              
              caps.remaining[idx] = capLeft - take;
              remaining -= take;
            }
          }
          
          // Add remaining hours at base rate
          if (remaining > 0) {
            const amount = remaining * baseRate;
            totalAmount += amount;
            // Default to Cash for unassigned hours
            cashAmount += amount;
            cashHours += remaining;
          }
          
          // Update staff totals
          const totals = staffTotals[staffMember.id];
          totals.totalHours += hours;
          totals.totalWages += totalAmount;
          totals.bookingHours += bookingHours;
          totals.bookingWages += bookingAmount;
          totals.cashHours += cashHours;
          totals.cashWages += cashAmount;
        }
      }
    });
    
    // Convert to report rows
    Object.values(staffTotals).forEach(totals => {
      if (totals.totalHours > 0) {
        const bookingRate = totals.bookingHours > 0 ? totals.bookingWages / totals.bookingHours : 0;
        const cashRate = totals.cashHours > 0 ? totals.cashWages / totals.cashHours : 0;
        
        reportRows.push({
          staffName: totals.staff.name,
          totalHours: Math.round(totals.totalHours * 100) / 100,
          totalWages: Math.round(totals.totalWages * 100) / 100,
          bookingHours: Math.round(totals.bookingHours * 100) / 100,
          bookingRate: Math.round(bookingRate * 100) / 100,
          bookingWages: Math.round(totals.bookingWages * 100) / 100,
          cashHours: Math.round(totals.cashHours * 100) / 100,
          cashRate: Math.round(cashRate * 100) / 100,
          cashWages: Math.round(totals.cashWages * 100) / 100,
        });
      }
    });
    
    // Sort by staff name
    reportRows.sort((a, b) => a.staffName.localeCompare(b.staffName));
    
    setReportData(reportRows);
  }, [shifts, staff, staffRates, dateRange, instructions, holidays]);

  useEffect(() => {
    generateReportData();
  }, [generateReportData]);

  const getTotalHours = () => {
    return reportData.reduce((total, row) => total + row.totalHours, 0);
  };

  const getTotalWages = () => {
    return reportData.reduce((total, row) => total + row.totalWages, 0);
  };

  const getBookingTotals = () => {
    return reportData.reduce((acc, row) => ({
      hours: acc.hours + row.bookingHours,
      wages: acc.wages + row.bookingWages
    }), { hours: 0, wages: 0 });
  };

  const getCashTotals = () => {
    return reportData.reduce((acc, row) => ({
      hours: acc.hours + row.cashHours,
      wages: acc.wages + row.cashWages
    }), { hours: 0, wages: 0 });
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    
    // Debug: Log brand settings
    console.log('📄 Payment Report PDF - Brand Settings:', brandSettings);
    
    // Add branding header
    if (brandSettings) {
      console.log('📄 Using brand settings for PDF header');
      await addBrandingHeader(
        doc, 
        brandSettings, 
        "Payment Report",
        `Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
      );
    } else {
      console.log('📄 No brand settings found, using fallback header');
      // Fallback if no brand settings
      doc.setFontSize(16);
      doc.text("Payment Report", 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`,
        14,
        24
      );
    }
    
    // Calculate start position based on branding header height
    const headerHeight = brandSettings ? getBrandingHeaderHeight(brandSettings, true) : 30;
    const startY = headerHeight + 10;
    
    // Summary
    doc.setFontSize(10);
    doc.text(`Total Hours: ${getTotalHours().toFixed(2)}`, 14, startY);
    doc.text(`Total Wages: $${getTotalWages().toFixed(2)}`, 14, startY + 8);
    
    // Table data
    const tableData = reportData.map(row => [
      row.staffName,
      row.totalHours.toString(),
      `$${row.totalWages.toFixed(2)}`,
      row.bookingHours.toString(),
      `$${row.bookingRate.toFixed(2)}`,
      `$${row.bookingWages.toFixed(2)}`,
      row.cashHours.toString(),
      `$${row.cashRate.toFixed(2)}`,
      `$${row.cashWages.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [
        ['Staff', 'Total Hours', 'Total Wages', 'Booking', '', '', 'Cash', '', ''],
        ['', '', '', 'Hours', 'Rate', 'Wages', 'Hours', 'Rate', 'Wages']
      ],
      body: tableData,
      startY: startY + 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });
    
    // Summary table
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 54;
    doc.setFontSize(12);
    doc.text("Payment Method Summary", 14, finalY + 20);
    
    const bookingTotals = getBookingTotals();
    const cashTotals = getCashTotals();
    const summaryData = [
      ['Booking', bookingTotals.hours.toFixed(2), `$${bookingTotals.wages.toFixed(2)}`],
      ['Cash', cashTotals.hours.toFixed(2), `$${cashTotals.wages.toFixed(2)}`],
      ['Total', getTotalHours().toFixed(2), `$${getTotalWages().toFixed(2)}`]
    ];
    
    autoTable(doc, {
      head: [['Payment Method', 'Total Hours', 'Total Wages']],
      body: summaryData,
      startY: finalY + 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });
    
    // Footer
    const summaryFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || finalY + 30;
    doc.setFontSize(8);
    doc.text(`Generated on ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")}`, 14, summaryFinalY + 10);
    
    doc.save(`payment-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.pdf`);
    toast.success('PDF downloaded');
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(row => ({
      'Staff Name': row.staffName,
      'Total Hours': row.totalHours,
      'Total Wages': row.totalWages,
      'Booking Hours': row.bookingHours,
      'Booking Rate': row.bookingRate,
      'Booking Wages': row.bookingWages,
      'Cash Hours': row.cashHours,
      'Cash Rate': row.cashRate,
      'Cash Wages': row.cashWages
    })));
    
    // Add summary row
    const summaryRow = {
      'Staff Name': 'TOTAL',
      'Total Hours': getTotalHours(),
      'Total Wages': getTotalWages(),
      'Booking Hours': getBookingTotals().hours,
      'Booking Rate': '',
      'Booking Wages': getBookingTotals().wages,
      'Cash Hours': getCashTotals().hours,
      'Cash Rate': '',
      'Cash Wages': getCashTotals().wages
    };
    
    XLSX.utils.sheet_add_json(worksheet, [summaryRow], { skipHeader: true, origin: -1 });
    
    // Create payment method summary worksheet
    const bookingTotals = getBookingTotals();
    const cashTotals = getCashTotals();
    const summaryWorksheet = XLSX.utils.json_to_sheet([
      { 'Payment Method': 'Booking', 'Total Hours': bookingTotals.hours, 'Total Wages': bookingTotals.wages },
      { 'Payment Method': 'Cash', 'Total Hours': cashTotals.hours, 'Total Wages': cashTotals.wages },
      { 'Payment Method': 'Total', 'Total Hours': getTotalHours(), 'Total Wages': getTotalWages() }
    ]);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payment Report");
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Payment Summary");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `payment-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.xlsx`);
    toast.success('Excel downloaded');
  };

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

  const [confirmPayment, setConfirmPayment] = useState<{
    isOpen: boolean;
    staffId: string | null;
    staffName: string;
    totalWages: number;
  }>({ isOpen: false, staffId: null, staffName: '', totalWages: 0 });

  const markAsPaid = async (staffId: string) => {
    if (paidStaffIds.has(staffId)) {
      toast.error("This staff member is already marked as paid!");
      return;
    }

    setMarkingAsPaid(staffId);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to mark payments as paid");
        return;
      }

      // Find the staff member's data
      const staffMember = staff.find(s => s.id === staffId);
      const staffReportData = reportData.find(row => {
        const staffMember = staff.find(s => s.id === staffId);
        return staffMember && row.staffName === staffMember.name;
      });

      if (!staffMember || !staffReportData) {
        toast.error("Staff member data not found");
        return;
      }

      // Get the detailed breakdown for this staff member (same logic as getStaffDailyDetails)
      const staffShifts = shifts.filter(shift => 
        shift.staff_id === staffId &&
        shift.start_time >= dateRange.start.toISOString() &&
        shift.start_time <= dateRange.end.toISOString()
      );

      // Prepare instruction caps for this staff
      const staffInstructions = instructions.filter(inst => inst.staff_id === staffId);
      const list = staffInstructions.slice().sort((a, b) => a.priority - b.priority);
      const remaining = list.map(i => i.weekly_hours_cap ?? Number.POSITIVE_INFINITY);

      // Calculate detailed shift breakdown with payment types
      const detailedShifts = staffShifts.map(shift => {
        const shiftDate = new Date(shift.start_time);
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const nonbill = Number(shift.non_billable_hours || 0);
        const hours = Math.max(0, rawHours - nonbill);

        // Calculate base rate (same logic as in generateReportData)
        const dateStr = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
        const dayOfWeek = shiftDate.getDay();
        const rateTypeMap: { [key: number]: string } = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
        const rateType = rateTypeMap[dayOfWeek];
        let rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === rateType && r.effective_date <= dateStr && r.end_date >= dateStr);
        if (!rate) {
          rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === 'default' && r.effective_date <= dateStr && r.end_date >= dateStr);
        }
        let baseRate = rate?.rate || 0;
        
        // Apply holiday adjustments
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

        // Allocate hours across instructions to determine payment types
        let remainingHours = hours;
        let totalAmount = 0;
        let bookingHours = 0;
        let bookingAmount = 0;
        let cashHours = 0;
        let cashAmount = 0;
        let paymentType = 'cash'; // default
        let effectiveRate = baseRate; // Default to base rate

        if (list.length > 0) {
          for (let idx = 0; idx < list.length && remainingHours > 0; idx++) {
            const capLeft = remaining[idx];
            if (capLeft <= 0) continue;
            const take = Math.min(remainingHours, capLeft);
            const adjustedRate = baseRate + list[idx].adjustment_per_hour;
            const lineAmount = take * adjustedRate;
            totalAmount += lineAmount;
            
            // Set the effective rate based on the first instruction that applies
            if (take > 0 && effectiveRate === baseRate) {
              effectiveRate = adjustedRate;
            }
            
            if (list[idx].payment_method === 'Booking') {
              bookingHours += take;
              bookingAmount += lineAmount;
              paymentType = 'booking';
            } else if (list[idx].payment_method === 'Cash') {
              cashHours += take;
              cashAmount += lineAmount;
              paymentType = 'cash';
            }
            
            remaining[idx] = capLeft - take;
            remainingHours -= take;
          }
        }
        
        if (remainingHours > 0) {
          const lineAmount = remainingHours * baseRate;
          totalAmount += lineAmount;
          cashHours += remainingHours;
          cashAmount += lineAmount;
          paymentType = 'cash';
        }

        return {
          id: shift.id,
          start_time: shift.start_time,
          end_time: shift.end_time,
          hours: hours,
          rate: effectiveRate, // Store the effective rate (base + adjustments)
          base_rate: baseRate, // Keep original base rate for reference
          rate_type: rateType,
          total_amount: totalAmount,
          payment_type: paymentType,
          booking_hours: bookingHours,
          booking_amount: bookingAmount,
          cash_hours: cashHours,
          cash_amount: cashAmount,
          non_billable_hours: shift.non_billable_hours,
          notes: shift.notes,
          is_holiday: holidays.some(h => h.date === dateStr),
          is_public_holiday: staffRow?.applies_public_holiday_rules && holidays.some(h => h.date === dateStr)
        };
      });

      // Prepare the payment data for this specific staff member
      const paymentData = {
        staff: {
          id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email
        },
        summary: {
          totalHours: staffReportData.totalHours,
          totalWages: staffReportData.totalWages,
          bookingHours: staffReportData.bookingHours,
          bookingWages: staffReportData.bookingWages,
          cashHours: staffReportData.cashHours,
          cashWages: staffReportData.cashWages,
          reportGenerated: new Date().toISOString(),
          weekStart: dateRange.start.toISOString(),
          weekEnd: dateRange.end.toISOString()
        },
        shifts: detailedShifts, // Store the pre-calculated detailed shifts
        rates: staffRates.filter(rate => rate.staff_id === staffId),
        instructions: staffInstructions,
        holidays: holidays
      };

      const { error } = await supabase
        .from("wage_payments")
        .insert({
          staff_id: staffId,
          week_start: dateRange.start.toISOString().split('T')[0],
          week_end: dateRange.end.toISOString().split('T')[0],
          total_hours: staffReportData.totalHours,
          total_wages: staffReportData.totalWages,
          booking_hours: staffReportData.bookingHours,
          booking_wages: staffReportData.bookingWages,
          cash_hours: staffReportData.cashHours,
          cash_wages: staffReportData.cashWages,
          payment_data: paymentData,
          created_by: user.id
        });

      if (error) {
        throw error;
      }

      setPaidStaffIds(prev => new Set([...prev, staffId]));
      toast.success(`${staffMember.name}'s payment has been marked as paid and sealed!`);
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast.error("Failed to mark payment as paid. Please try again.");
    } finally {
      setMarkingAsPaid(null);
    }
  };

  const handleMarkAsPaidClick = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    const staffReportData = reportData.find(row => {
      const staffMember = staff.find(s => s.id === staffId);
      return staffMember && row.staffName === staffMember.name;
    });

    if (!staffMember || !staffReportData) {
      toast.error("Staff member data not found");
      return;
    }

    setConfirmPayment({
      isOpen: true,
      staffId,
      staffName: staffMember.name,
      totalWages: staffReportData.totalWages
    });
  };

  const confirmMarkAsPaid = () => {
    if (confirmPayment.staffId) {
      markAsPaid(confirmPayment.staffId);
      setConfirmPayment({ isOpen: false, staffId: null, staffName: '', totalWages: 0 });
    }
  };

  // Expand/collapse details per staff row
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Build per-day details for a staff within the selected range using same allocation logic
  const getStaffDailyDetails = useCallback((staffId: string) => {
    // Prepare instruction caps (copy per staff)
    const list = instructions
      .filter(i => i.staff_id === staffId)
      .slice()
      .sort((a, b) => a.priority - b.priority);
    const remaining = list.map(i => i.weekly_hours_cap ?? Number.POSITIVE_INFINITY);

    // Group by date string (Melbourne)
    const byDate: Record<string, { hours: number; amount: number; rate: number; bookingHours: number; bookingAmount: number; cashHours: number; cashAmount: number }> = {};
    const sorted = shifts
      .filter(s => s.staff_id === staffId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (const shift of sorted) {
      const shiftDate = new Date(shift.start_time);
      const shiftDateMel = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      const rangeStartMel = dateRange.start.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      const rangeEndMel = dateRange.end.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
      if (shiftDateMel < rangeStartMel || shiftDateMel > rangeEndMel) continue;

      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const nonbill = Number(shift.non_billable_hours || 0);
      const hours = Math.max(0, rawHours - nonbill);
      const baseRate = (function () {
        // same as in generateReportData but reuse code inline
        const dateStr = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
        const dayOfWeek = shiftDate.getDay();
        const rateTypeMap: { [key: number]: string } = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
        const rateType = rateTypeMap[dayOfWeek];
        let rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === rateType && r.effective_date <= dateStr && r.end_date >= dateStr);
        if (!rate) {
          rate = staffRates.find(r => r.staff_id === staffId && r.rate_type === 'default' && r.effective_date <= dateStr && r.end_date >= dateStr);
        }
        let br = rate?.rate || 0;
        const holiday = holidays.find(h => h.date === dateStr);
        if (holiday) {
          if (holiday.markup_percentage > 0) br = br * (holiday.markup_percentage / 100.0);
          else if (holiday.markup_amount > 0) br = br + holiday.markup_amount;
        }
        return br;
      })();

      // Allocate with caps across instructions
      let remainingHours = hours;
      let amount = 0;
      let bookingHours = 0;
      let bookingAmount = 0;
      let cashHours = 0;
      let cashAmount = 0;
      let effectiveRate = baseRate; // Default to base rate
      
      if (list.length > 0) {
        for (let idx = 0; idx < list.length && remainingHours > 0; idx++) {
          const capLeft = remaining[idx];
          if (capLeft <= 0) continue;
          const take = Math.min(remainingHours, capLeft);
          const adjustedRate = baseRate + list[idx].adjustment_per_hour;
          const lineAmount = take * adjustedRate;
          amount += lineAmount;
          
          // Set the effective rate based on the first instruction that applies
          if (take > 0 && effectiveRate === baseRate) {
            effectiveRate = adjustedRate;
          }
          
          if (list[idx].payment_method === 'Booking') {
            bookingHours += take;
            bookingAmount += lineAmount;
          } else if (list[idx].payment_method === 'Cash') {
            cashHours += take;
            cashAmount += lineAmount;
          }
          remaining[idx] = capLeft - take;
          remainingHours -= take;
        }
      }
      if (remainingHours > 0) {
        const lineAmount = remainingHours * baseRate;
        amount += lineAmount;
        // Default remaining to Cash
        cashHours += remainingHours;
        cashAmount += lineAmount;
      }

      if (!byDate[shiftDateMel]) byDate[shiftDateMel] = { hours: 0, amount: 0, rate: baseRate, bookingHours: 0, bookingAmount: 0, cashHours: 0, cashAmount: 0 };
      byDate[shiftDateMel].hours += hours;
      byDate[shiftDateMel].amount += amount;
      byDate[shiftDateMel].rate = effectiveRate; // display effective rate (base + adjustments)
      byDate[shiftDateMel].bookingHours += bookingHours;
      byDate[shiftDateMel].bookingAmount += bookingAmount;
      byDate[shiftDateMel].cashHours += cashHours;
      byDate[shiftDateMel].cashAmount += cashAmount;
    }

    // Return as sorted array by date
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, hours: v.hours, amount: v.amount, rate: v.rate, bookingHours: v.bookingHours, bookingAmount: v.bookingAmount, cashHours: v.cashHours, cashAmount: v.cashAmount }));
  }, [shifts, dateRange, staffRates, instructions, holidays]);

  if (loading) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-gray-500">
          Loading payment report...
        </div>
      </AdminGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGuard>
        <div className="p-6 text-center text-red-600">
          Access restricted. You must be an admin to view payment reports.
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Report</h1>
              {paidStaffIds.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                  <FaCheckCircle className="w-4 h-4" />
                  {paidStaffIds.size} Paid
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
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
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Date Range:</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={format(dateRange.start, "yyyy-MM-dd")}
                onChange={(e) => {
                  const newStart = new Date(e.target.value);
                  setDateRange({
                    start: newStart,
                    end: endOfWeek(newStart, { weekStartsOn: 1 })
                  });
                }}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 min-w-0 flex-1"
              />
              <span className="text-gray-500 dark:text-gray-400">to</span>
              <input
                type="date"
                value={format(dateRange.end, "yyyy-MM-dd")}
                onChange={(e) => {
                  const newEnd = new Date(e.target.value);
                  setDateRange({
                    start: startOfWeek(newEnd, { weekStartsOn: 1 }),
                    end: newEnd
                  });
                }}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 min-w-0 flex-1"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg print:p-2 print:border print:border-gray-300">
            <div className="text-sm text-gray-600 dark:text-gray-400 print:text-xs">Total Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white print:text-lg">{getTotalHours().toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg print:p-2 print:border print:border-gray-300">
            <div className="text-sm text-gray-600 dark:text-gray-400 print:text-xs">Total Wages</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white print:text-lg">${getTotalWages().toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg print:p-2 print:border print:border-gray-300">
            <div className="text-sm text-gray-600 dark:text-gray-400 print:text-xs">Booking Wages</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white print:text-lg">${getBookingTotals().wages.toFixed(2)}</div>
          </div>
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-lg print:p-2 print:border print:border-gray-300">
            <div className="text-sm text-gray-600 dark:text-gray-400 print:text-xs">Cash Wages</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white print:text-lg">${getCashTotals().wages.toFixed(2)}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-800">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</th>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Hours</th>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Wages</th>
                  <th colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Booking</th>
                  <th colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cash</th>
                  <th rowSpan={2} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wages</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No payment data found for the selected date range
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => {
                    const row = reportData.find(r => r.staffName === s.name);
                    const details = expandedStaffId === s.id ? getStaffDailyDetails(s.id) : [];
                    return (
                      <>
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer" onClick={() => setExpandedStaffId(prev => prev === s.id ? null : s.id)}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{s.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row ? row.totalHours : 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row ? row.totalWages.toFixed(2) : '0.00'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row ? row.bookingHours : 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row ? row.bookingRate.toFixed(2) : '0.00'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row ? row.bookingWages.toFixed(2) : '0.00'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row ? row.cashHours : 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row ? row.cashRate.toFixed(2) : '0.00'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">${row ? row.cashWages.toFixed(2) : '0.00'}</td>
                          <td className="px-4 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                            {paidStaffIds.has(s.id) ? (
                              <div className="flex items-center justify-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                                <FaCheckCircle className="w-3 h-3" />
                                Paid
                              </div>
                            ) : row && row.totalWages > 0 ? (
                              <button
                                onClick={() => handleMarkAsPaidClick(s.id)}
                                disabled={markingAsPaid === s.id}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                              >
                                <FaLock className="w-3 h-3" />
                                {markingAsPaid === s.id ? "Marking..." : "Mark as Paid"}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No wages</span>
                            )}
                          </td>
                        </tr>
                        {expandedStaffId === s.id && details.length > 0 && (
                          <tr key={`${s.id}-details`} className="bg-gray-50/70 dark:bg-neutral-800/50">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2">
                                {details.map(d => (
                                  <div key={d.date} className="flex items-center justify-between">
                                    <span className="font-medium">{format(new Date(d.date), 'EEE dd MMM')}</span>
                                    <span className="text-right">
                                      <span className="mr-2">{d.hours.toFixed(2)}h × ${d.rate.toFixed(2)} = ${d.amount.toFixed(2)}</span>
                                      {d.bookingHours > 0 && (
                                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">Booking: {d.bookingHours.toFixed(2)}h (${d.bookingAmount.toFixed(2)})</span>
                                      )}
                                      {d.cashHours > 0 && (
                                        <span className="ml-2 text-blue-600 dark:text-blue-400">Cash: {d.cashHours.toFixed(2)}h (${d.cashAmount.toFixed(2)})</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
              {reportData.length > 0 && (
                <tfoot className="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{getTotalHours().toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${getTotalWages().toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{getBookingTotals().hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">-</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${getBookingTotals().wages.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{getCashTotals().hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">-</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${getCashTotals().wages.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmPayment.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <FaLock className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mark as Paid</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to mark <strong>{confirmPayment.staffName}</strong>&apos;s payment as paid?
              </p>
              <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Wages:</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${confirmPayment.totalWages.toFixed(2)}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                This action will seal the payment data and cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmPayment({ isOpen: false, staffId: null, staffName: '', totalWages: 0 })}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-neutral-700 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMarkAsPaid}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Mark as Paid
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
