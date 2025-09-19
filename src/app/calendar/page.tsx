"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { addDays, startOfWeek, endOfWeek, format, setHours, setMinutes } from "date-fns";
import { ensureProfile } from "@/app/actions/profile";
import { DragDropCalendar } from "@/components/DragDropCalendar";
import { Loading } from "@/components/Loading";

type Staff = { id: string; name: string; pay_rate: number; email: string | null };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };

export default function CalendarPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [anchor, setAnchor] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

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
           notes
         `)
         .gte("start_time", startOfThisWeek.toISOString())
         .lte("start_time", endOfThisWeek.toISOString())
         .order("start_time", { ascending: true });

       if (!isUserAdmin) {
         // Non-admins see only their assigned shifts
         shiftsQuery = shiftsQuery.eq("staff_id", user.id);
       }

       const [shiftsResult, staffResult, availabilityResult] = await Promise.all([
         shiftsQuery,
        
        supabase
          .from("staff")
          .select(`
            id,
            name,
            pay_rate,
            email
          `)
          .order("name", { ascending: true }),
        
        supabase
          .from("staff_availability")
          .select(`
            id,
            staff_id,
            day_of_week,
            start_time,
            end_time
          `)
      ]);

      if (shiftsResult.data) setShifts(shiftsResult.data);
      if (staffResult.data) setStaff(staffResult.data);
      if (availabilityResult.data) setAvailability(availabilityResult.data);

    } catch (error) {
      console.error("Error fetching calendar data:", error);
    }
  }, [anchor]);

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
      availability={availability}
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
