"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";

type Defaults = { pay_rate: number };

export default function SettingsPage() {
  const [defaults, setDefaults] = useState<Defaults>({ pay_rate: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await getSupabaseClient().from("settings").select("value").eq("key", "defaults").maybeSingle();
    const value = (data?.value as Defaults | undefined) ?? { pay_rate: 0 };
    setDefaults(value);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await getSupabaseClient().from("settings").upsert({ key: "defaults", value: defaults }, { onConflict: "key" });
  };

  return (
    <AdminGuard>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">Control defaults for your business</p>
        <form onSubmit={save} className="mt-6 grid gap-4">
          <label className="grid gap-2 max-w-xs">
            <span className="text-sm text-gray-600">Default pay rate</span>
            <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={defaults.pay_rate} onChange={(e) => setDefaults({ pay_rate: parseFloat(e.target.value || "0") })} />
          </label>
          <button className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black w-fit">Save</button>
        </form>
      </div>
    </AdminGuard>
  );
}


