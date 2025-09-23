"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek } from "date-fns";
import { User, Shift, BusinessStats } from "@/types/dashboard";

export function useDashboardData() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffShifts, setStaffShifts] = useState<Shift[]>([]);
  const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_slug")
            .eq("id", authUser.id)
            .single();
          
          const userData = {
            id: authUser.id,
            email: authUser.email || '',
            role_slug: profile?.role_slug as 'admin' | 'staff' || 'staff'
          };
          
          setUser(userData);

          if (profile?.role_slug === 'staff') {
            // Fetch staff's shifts for this week - handle timezone properly
            const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
            const endOfThisWeek = endOfWeek(new Date(), { weekStartsOn: 1 });
            
            // Create timezone-aware week boundaries
            const weekStartDate = new Date(startOfThisWeek);
            weekStartDate.setHours(0, 0, 0, 0); // Start of day in local timezone
            const weekEndDate = new Date(endOfThisWeek);
            weekEndDate.setHours(23, 59, 59, 999); // End of day in local timezone
            
            // First, find the staff record linked to this user's profile
            const { data: staffRecord } = await supabase
              .from("staff")
              .select("id, name, email")
              .eq("profile_id", authUser.id)
              .single();
            
            if (staffRecord) {
              const { data: shifts } = await supabase
                .from("shifts")
                .select(`
                  id,
                  start_time,
                  end_time,
                  staff_id,
                  notes
                `)
                .eq("staff_id", staffRecord.id)
                .gte("start_time", weekStartDate.toISOString())
                .lte("start_time", weekEndDate.toISOString())
                .order("start_time", { ascending: true });
              
              // Transform the data to match our Shift type
              const transformedShifts = (shifts || []).map(shift => ({
                id: shift.id,
                date: shift.start_time.split('T')[0], // Extract date from ISO string
                start_time: shift.start_time.split('T')[1].slice(0, 5), // Extract time (HH:MM)
                end_time: shift.end_time.split('T')[1].slice(0, 5), // Extract time (HH:MM)
                staff_id: shift.staff_id,
                staff: {
                  name: staffRecord.name,
                  email: staffRecord.email
                }
              }));
              
              setStaffShifts(transformedShifts);
            } else {
              // No staff record found, set empty shifts
              setStaffShifts([]);
            }
          } else if (profile?.role_slug === 'admin') {
            // Fetch business statistics
            const [staffResult, shiftsResult, productsResult, categoriesResult, suppliersResult] = await Promise.all([
              supabase.from("staff").select("id", { count: "exact" }),
              supabase.from("shifts").select("id", { count: "exact" }),
              supabase.from("products").select("id, quantity_in_stock, reorder_level", { count: "exact" }),
              supabase.from("categories").select("id", { count: "exact" }),
              supabase.from("suppliers").select("id", { count: "exact" })
            ]);

            const lowStockProducts = productsResult.data?.filter(p => p.quantity_in_stock <= p.reorder_level).length || 0;
            
            // Calculate weekly cost using staff rates
            const { data: weeklyShifts } = await supabase
              .from("shifts")
              .select(`
                start_time,
                end_time,
                staff_id,
                non_billable_hours
              `)
              .gte("start_time", startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
              .lte("start_time", endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
              .not("staff_id", "is", null);

            let weeklyCost = 0;
            if (weeklyShifts && weeklyShifts.length > 0) {
              // Get all staff rates for the current week
              const { data: staffRates } = await supabase
                .from("staff_rates")
                .select(`
                  staff_id,
                  rate,
                  rate_type,
                  effective_date,
                  end_date
                `)
                .eq("is_current", true);

              weeklyShifts.forEach(shift => {
                if (shift.staff_id) {
                  // Find the appropriate rate for this staff member
                  const staffRate = staffRates?.find(rate => 
                    rate.staff_id === shift.staff_id && 
                    rate.rate_type === 'default'
                  );
                  
                  if (staffRate) {
                    const start = new Date(shift.start_time);
                    const end = new Date(shift.end_time);
                    const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                    const nonBillableHours = shift.non_billable_hours || 0;
                    const billableHours = Math.max(0, rawHours - nonBillableHours);
                    weeklyCost += billableHours * staffRate.rate;
                  }
                }
              });
            }

            setBusinessStats({
              totalStaff: staffResult.count || 0,
              totalShifts: shiftsResult.count || 0,
              lowStockProducts,
              totalProducts: productsResult.count || 0,
              totalCategories: categoriesResult.count || 0,
              totalSuppliers: suppliersResult.count || 0,
              weeklyCost
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchUserAndData();
  }, []);

  return {
    user,
    loading,
    staffShifts,
    businessStats
  };
}
