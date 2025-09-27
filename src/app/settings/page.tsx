"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from 'react-toastify';

type Defaults = {
  pay_rate: number;
  default_shift_start_time: string;
  default_shift_end_time: string;
  store_open_time: string;
  store_close_time: string;
};

type BrandSettings = {
  id: string;
  business_name: string;
  slogan: string | null;
  logo_url: string | null;
};

export default function SettingsPage() {
  const [defaults, setDefaults] = useState<Defaults>({ 
    pay_rate: 0,
    default_shift_start_time: "11:00",
    default_shift_end_time: "18:00",
    store_open_time: "10:00",
    store_close_time: "21:00"
  });
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    id: '',
    business_name: 'OperateFlow',
    slogan: '',
    logo_url: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  const load = async () => {
    const supabase = getSupabaseClient();
    
    // Load defaults
    const { data: defaultsData } = await supabase.from("settings").select("value").eq("key", "defaults").maybeSingle();
    const value = (defaultsData?.value as Defaults | undefined) ?? { 
      pay_rate: 0,
      default_shift_start_time: "11:00",
      default_shift_end_time: "18:00",
      store_open_time: "10:00",
      store_close_time: "21:00"
    };
    setDefaults(value);

    // Load brand settings
    const { data: brandData } = await supabase.from("brand_settings").select("*").maybeSingle();
    if (brandData) {
      setBrandSettings(brandData);
    }
    
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await getSupabaseClient().from("settings").upsert({ key: "defaults", value: defaults }, { onConflict: "key" });
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    try {
      const supabase = getSupabaseClient();
      
      if (brandSettings.id) {
        // Update existing brand settings
        await supabase
          .from("brand_settings")
          .update({
            business_name: brandSettings.business_name,
            slogan: brandSettings.slogan,
            logo_url: brandSettings.logo_url,
            updated_at: new Date().toISOString()
          })
          .eq("id", brandSettings.id);
      } else {
        // Create new brand settings
        const { data, error } = await supabase
          .from("brand_settings")
          .insert({
            business_name: brandSettings.business_name,
            slogan: brandSettings.slogan,
            logo_url: brandSettings.logo_url
          })
          .select()
          .single();
        
        if (error) throw error;
        setBrandSettings(data);
      }
      
      toast.success("Brand settings saved successfully!");
    } catch (error) {
      console.error("Error saving brand settings:", error);
      toast.error("Failed to save brand settings. Please try again.");
    } finally {
      setSavingBrand(false);
    }
  };

  return (
    <AdminGuard>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">Control defaults for your business</p>
        <form onSubmit={save} className="mt-6 grid gap-6">
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Default Values</h2>
            <label className="grid gap-2 max-w-xs">
              <span className="text-sm text-gray-600 dark:text-gray-400">Default pay rate</span>
              <input 
                type="number" 
                step="0.01" 
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                value={defaults.pay_rate} 
                onChange={(e) => setDefaults(prev => ({ ...prev, pay_rate: parseFloat(e.target.value || "0") }))} 
              />
            </label>
          </div>

          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Default Shift Times</h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-md">
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Start time</span>
                <input 
                  type="time" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={defaults.default_shift_start_time} 
                  onChange={(e) => setDefaults(prev => ({ ...prev, default_shift_start_time: e.target.value }))} 
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">End time</span>
                <input 
                  type="time" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={defaults.default_shift_end_time} 
                  onChange={(e) => setDefaults(prev => ({ ...prev, default_shift_end_time: e.target.value }))} 
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              These times will be used when creating new shifts if no specific times are set.
            </p>
          </div>

          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Store Hours</h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-md">
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Store open time</span>
                <input 
                  type="time" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={defaults.store_open_time} 
                  onChange={(e) => setDefaults(prev => ({ ...prev, store_open_time: e.target.value }))} 
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Store close time</span>
                <input 
                  type="time" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={defaults.store_close_time} 
                  onChange={(e) => setDefaults(prev => ({ ...prev, store_close_time: e.target.value }))} 
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Store operating hours. Used for smart shift prefill when no existing shifts are found for a date + section.
            </p>
          </div>

          <button 
            type="submit"
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>

        {/* Brand Settings */}
        <form onSubmit={saveBrand} className="mt-12 grid gap-6">
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Brand Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure your business branding for emails and communications.
            </p>
            
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Business Name</span>
                <input 
                  type="text" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={brandSettings.business_name} 
                  onChange={(e) => setBrandSettings(prev => ({ ...prev, business_name: e.target.value }))}
                  placeholder="Your Business Name"
                  required
                />
              </label>
              
              <label className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Slogan (Optional)</span>
                <input 
                  type="text" 
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" 
                  value={brandSettings.slogan || ''} 
                  onChange={(e) => setBrandSettings(prev => ({ ...prev, slogan: e.target.value }))}
                  placeholder="Your business slogan or tagline"
                />
              </label>
              
              <div className="grid gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Logo</span>
                <ImageUpload
                  type="brand"
                  currentImageUrl={brandSettings.logo_url || undefined}
                  onImageChange={(url) => setBrandSettings(prev => ({ ...prev, logo_url: url }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upload your business logo. This will be used in email templates and communications.
                </p>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={savingBrand}
            className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingBrand ? "Saving Brand Settings..." : "Save Brand Settings"}
          </button>
        </form>
      </div>
    </AdminGuard>
  );
}


