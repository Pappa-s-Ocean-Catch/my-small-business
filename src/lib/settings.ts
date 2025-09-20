import { getSupabaseClient } from "@/lib/supabase/client";

export type DefaultSettings = {
  pay_rate: number;
  default_shift_start_time: string;
  default_shift_end_time: string;
};

export async function getDefaultSettings(): Promise<DefaultSettings> {
  const { data } = await getSupabaseClient()
    .from("settings")
    .select("value")
    .eq("key", "defaults")
    .maybeSingle();
    
  const value = (data?.value as DefaultSettings | undefined) ?? {
    pay_rate: 0,
    default_shift_start_time: "11:00",
    default_shift_end_time: "18:00"
  };
  
  return value;
}
