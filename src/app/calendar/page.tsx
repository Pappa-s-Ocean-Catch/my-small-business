"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { addDays, startOfWeek, endOfWeek, format, setHours, setMinutes } from "date-fns";
import { ensureProfile } from "@/app/actions/profile";
import { DragDropCalendar } from "@/components/DragDropCalendar";
import { Loading } from "@/components/Loading";
import { useRouter } from "next/navigation";

type Staff = { id: string; name: string; email: string | null; is_available: boolean };
type StaffRate = { id: string; staff_id: string; rate: number; rate_type: string; effective_date: string; end_date: string; is_current: boolean; created_at: string };
type Section = { id: string; name: string; description: string | null; color: string; active: boolean; sort_order: number };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null; non_billable_hours?: number; section_id?: string | null };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };
type StaffHoliday = { id: string; staff_id: string; start_date: string; end_date: string; reason: string | null };

export default function CalendarPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffRates, setStaffRates] = useState<StaffRate[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [holidays, setHolidays] = useState<StaffHoliday[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [anchor, setAnchor] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Check admin status
      const profileResult = await ensureProfile(user.id, user.email || undefined);
      let isUserAdmin = false;
      if (profileResult.ok) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .single();
        isUserAdmin = profile?.role_slug === 'admin';
        setIsAdmin(isUserAdmin);
        
        // Ensure staff profile is linked for non-admin users
        if (!isUserAdmin) {
          await supabase.rpc('link_staff_profile', { p_profile_id: user.id });
        }
      }

      // Fetch shifts for current week
      const startOfThisWeek = startOfWeek(anchor, { weekStartsOn: 1 });
      const endOfThisWeek = endOfWeek(anchor, { weekStartsOn: 1 });
      
       let shiftsQuery = supabase
         .from("shifts")
         .select(`
           id,
           staff_id,
           start_time,
           end_time,
           notes,
           non_billable_hours,
           section_id
         `)
         .gte("start_time", startOfThisWeek.toISOString())
         .lte("start_time", endOfThisWeek.toISOString())
         .order("start_time", { ascending: true });

       if (!isUserAdmin) {
         // Non-admins see only their assigned shifts
         // First, find the staff record linked to this user's profile
         const { data: staffRecord } = await supabase
           .from("staff")
           .select("id")
           .eq("profile_id", user.id)
           .single();
         
         if (staffRecord) {
           shiftsQuery = shiftsQuery.eq("staff_id", staffRecord.id);
         } else {
           // If no staff record found, show no shifts
           shiftsQuery = shiftsQuery.eq("staff_id", "00000000-0000-0000-0000-000000000000");
         }
       }

      const [shiftsResult, staffResult, ratesResult, sectionsResult, availabilityResult, holidaysResult] = await Promise.all([
        shiftsQuery,
        
        supabase
          .from("staff")
          .select(`
            id,
            name,
            email,
            is_available
          `)
          .order("name", { ascending: true }),
        
        supabase
          .from("staff_rates")
          .select("*"),
        
        supabase
          .from("sections")
          .select(`
            id,
            name,
            description,
            color,
            active,
            sort_order
          `)
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        
        supabase
          .from("staff_availability")
          .select(`
            id,
            staff_id,
            day_of_week,
            start_time,
            end_time
          `),
        
        supabase
          .from("staff_holidays")
          .select(`
            id,
            staff_id,
            start_date,
            end_date,
            reason
          `)
          .order("start_date", { ascending: false })
      ]);

      if (shiftsResult.data) setShifts(shiftsResult.data);
      if (staffResult.data) setStaff(staffResult.data);
      if (ratesResult.data) setStaffRates(ratesResult.data);
      if (sectionsResult.data) setSections(sectionsResult.data);
      if (availabilityResult.data) setAvailability(availabilityResult.data);
      if (holidaysResult.data) setHolidays(holidaysResult.data);

    } catch (error) {
      console.error("Error fetching calendar data:", error);
    }
  }, [anchor, router]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createShift = useCallback(async (shift: Omit<Shift, 'id'>) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("shifts")
        .insert([shift])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setShifts(prev => [...prev, data]);
      }
    } catch (error) {
      console.error("Error creating shift:", error);
    }
  }, []);

  const updateShift = useCallback(async (id: string, updates: Partial<Shift>) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("shifts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setShifts(prev => prev.map(s => s.id === id ? data : s));
      }
    } catch (error) {
      console.error("Error updating shift:", error);
    }
  }, []);

  const deleteShift = useCallback(async (id: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("Error deleting shift:", error);
    }
  }, []);

  const updateShiftStaff = useCallback(async (shiftId: string, staffId: string | null) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("shifts")
        .update({ staff_id: staffId })
        .eq("id", shiftId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setShifts(prev => prev.map(s => s.id === shiftId ? data : s));
      }
    } catch (error) {
      console.error("Error updating shift staff:", error);
    }
  }, []);

  if (isAdmin === null) {
    return <Loading message="Loading calendar..." size="sm" />;
  }

  return (
    <DragDropCalendar
      shifts={shifts}
      staff={staff}
      staffRates={staffRates}
      sections={sections}
      availability={availability}
      holidays={holidays}
      isAdmin={isAdmin}
      onShiftCreate={createShift}
      onShiftUpdate={updateShift}
      onShiftDelete={deleteShift}
      onShiftStaffUpdate={updateShiftStaff}
      currentWeek={anchor}
      onWeekChange={setAnchor}
    />
  );
}
