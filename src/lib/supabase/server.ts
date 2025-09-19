"use server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    getSupabaseUrl(),
    getAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // Try to refresh the session to ensure we have the latest auth state
  try {
    await supabase.auth.getSession();
  } catch (error) {
    console.log("Session refresh error:", error);
  }

  return supabase;
};

export const createServiceRoleClient = async () => {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server actions");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false },
  });
};


