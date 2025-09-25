"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PublicHoliday = {
  id: string;
  name: string;
  holiday_date: string;
  year: number;
  markup_percentage: number;
  markup_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
};

export type CreateHolidayData = {
  name: string;
  holiday_date: string;
  year: number;
  markup_percentage?: number;
  markup_amount?: number;
};

export type UpdateHolidayData = {
  id: string;
  name?: string;
  holiday_date?: string;
  year?: number;
  markup_percentage?: number;
  markup_amount?: number;
  is_active?: boolean;
};

export async function getHolidaysForYear(year: number): Promise<PublicHoliday[]> {
  // Use service role client to bypass RLS for testing
  const supabase = await createServiceRoleClient();
  
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*")
    .eq("year", year)
    .eq("is_active", true)
    .order("holiday_date");

  if (error) {
    console.error("Error fetching holidays:", error);
    throw new Error("Failed to fetch holidays");
  }

  return data || [];
}

export async function getHolidayById(id: string): Promise<PublicHoliday | null> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching holiday:", error);
    return null;
  }

  return data;
}

export async function createHoliday(data: CreateHolidayData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const { error } = await supabase
    .from("public_holidays")
    .insert({
      ...data,
      markup_percentage: data.markup_percentage || 0,
      markup_amount: data.markup_amount || 0,
      created_by: user.id,
    });

  if (error) {
    console.error("Error creating holiday:", error);
    return { success: false, error: "Failed to create holiday" };
  }

  revalidatePath("/holidays");
  return { success: true };
}

export async function updateHoliday(data: UpdateHolidayData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  
  const { id, ...updateData } = data;
  
  const { error } = await supabase
    .from("public_holidays")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error updating holiday:", error);
    return { success: false, error: "Failed to update holiday" };
  }

  revalidatePath("/holidays");
  return { success: true };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase
    .from("public_holidays")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deleting holiday:", error);
    return { success: false, error: "Failed to delete holiday" };
  }

  revalidatePath("/holidays");
  return { success: true };
}

export async function cloneHolidaysToYear(sourceYear: number, targetYear: number): Promise<{ success: boolean; error?: string; clonedCount?: number }> {
  const supabase = await createServerSupabaseClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  // Check if target year already has holidays
  const { data: existingHolidays } = await supabase
    .from("public_holidays")
    .select("id")
    .eq("year", targetYear)
    .eq("is_active", true)
    .limit(1);

  if (existingHolidays && existingHolidays.length > 0) {
    return { success: false, error: `Holidays already exist for year ${targetYear}. Please delete existing holidays first.` };
  }

  // Call the clone function
  const { data, error } = await supabase.rpc("clone_holidays_to_year", {
    source_year: sourceYear,
    target_year: targetYear,
    created_by_user: user.id,
  });

  if (error) {
    console.error("Error cloning holidays:", error);
    return { success: false, error: "Failed to clone holidays" };
  }

  revalidatePath("/holidays");
  return { success: true, clonedCount: data };
}

export async function getHolidayRateAdjustment(date: string): Promise<{ markup_percentage: number; markup_amount: number }> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase.rpc("get_holiday_rate_adjustment", {
    check_date: date,
  });

  if (error) {
    console.error("Error getting holiday rate adjustment:", error);
    return { markup_percentage: 0, markup_amount: 0 };
  }

  return data?.[0] || { markup_percentage: 0, markup_amount: 0 };
}

export async function getAvailableYears(): Promise<number[]> {
  // Use service role client to bypass RLS for testing
  const supabase = await createServiceRoleClient();
  
  const { data, error } = await supabase
    .from("public_holidays")
    .select("year")
    .eq("is_active", true)
    .order("year", { ascending: false });

  if (error) {
    console.error("Error fetching available years:", error);
    return [];
  }

  // Get unique years
  const years = [...new Set(data?.map(item => item.year) || [])];
  return years;
}
