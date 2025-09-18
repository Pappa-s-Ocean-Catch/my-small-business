"use server";
import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
};

const getAnonKey = (): string => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
};

const getServiceRoleKey = (): string | undefined => {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
};

export const createServerSupabaseClient = () => {
  const supabase = createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabase;
};

export const createServiceRoleClient = () => {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server actions");
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false },
  });
};


