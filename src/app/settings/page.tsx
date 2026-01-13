"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from 'react-toastify';
import { getFeatureFlags, updateFeatureFlags, type FeatureFlags } from "@/app/actions/feature-flags";
import { getRewardPointsSettings, updateRewardPointsSettings, type RewardPointsSettings } from "@/app/actions/reward-points";

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
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    enable_pickup_order: true,
    enable_online_payment: true,
    enable_instore_payment: true,
    enable_online_delivery: false,
  });
  const [savingFlags, setSavingFlags] = useState(false);
  const [rewardPointsSettings, setRewardPointsSettings] = useState<RewardPointsSettings>({
    points_per_dollar: 10,
    dollars_per_point: 0.001,
    enabled: true,
  });
  const [savingRewardPoints, setSavingRewardPoints] = useState(false);

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

    // Load feature flags
    const flags = await getFeatureFlags();
    setFeatureFlags(flags);

    // Load reward points settings
    const rewardSettings = await getRewardPointsSettings();
    setRewardPointsSettings(rewardSettings);
    
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

  const saveFeatureFlags = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFlags(true);
    try {
      const result = await updateFeatureFlags(featureFlags);
      if (result.success) {
        toast.success("Feature flags saved successfully!");
      } else {
        toast.error(result.error || "Failed to save feature flags. Please try again.");
      }
    } catch (error) {
      console.error("Error saving feature flags:", error);
      toast.error("Failed to save feature flags. Please try again.");
    } finally {
      setSavingFlags(false);
    }
  };

  const saveRewardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRewardPoints(true);
    try {
      const result = await updateRewardPointsSettings(rewardPointsSettings);
      if (result.success) {
        toast.success("Reward points settings saved successfully!");
      } else {
        toast.error(result.error || "Failed to save reward points settings. Please try again.");
      }
    } catch (error) {
      console.error("Error saving reward points settings:", error);
      toast.error("Failed to save reward points settings. Please try again.");
    } finally {
      setSavingRewardPoints(false);
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

        {/* Feature Flags */}
        <form onSubmit={saveFeatureFlags} className="mt-12 grid gap-6">
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Order System Feature Flags</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enable or disable order system features. These settings control what options are available to customers.
            </p>
            
            <div className="grid gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  checked={featureFlags.enable_pickup_order}
                  onChange={(e) => setFeatureFlags(prev => ({ ...prev, enable_pickup_order: e.target.checked }))}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Pickup Orders</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow customers to place orders for pickup at the store
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  checked={featureFlags.enable_online_payment}
                  onChange={(e) => setFeatureFlags(prev => ({ ...prev, enable_online_payment: e.target.checked }))}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Online Payment</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow customers to pay online using Stripe (credit card, Google Pay, Apple Pay)
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  checked={featureFlags.enable_instore_payment}
                  onChange={(e) => setFeatureFlags(prev => ({ ...prev, enable_instore_payment: e.target.checked }))}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable In-Store Payment</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow customers to place orders and pay at the store when picking up
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  checked={featureFlags.enable_online_delivery}
                  onChange={(e) => setFeatureFlags(prev => ({ ...prev, enable_online_delivery: e.target.checked }))}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Online Delivery</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow customers to place orders for delivery (future feature)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <button 
            type="submit"
            disabled={savingFlags}
            className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingFlags ? "Saving Feature Flags..." : "Save Feature Flags"}
          </button>
        </form>

        {/* Reward Points Settings */}
        <form onSubmit={saveRewardPoints} className="mt-12 grid gap-6">
          <div className="grid gap-4">
            <h2 className="text-lg font-medium">Reward Points System</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure how customers earn and redeem reward points.
            </p>
            
            <div className="grid gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  checked={rewardPointsSettings.enabled}
                  onChange={(e) => setRewardPointsSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Reward Points</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Allow customers to earn and use reward points
                  </p>
                </div>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Points per Dollar (Earning)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    value={rewardPointsSettings.points_per_dollar}
                    onChange={(e) => setRewardPointsSettings(prev => ({ 
                      ...prev, 
                      points_per_dollar: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    How many points customers earn per $1 spent (e.g., 10 = $1 = 10 points)
                  </p>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Dollars per Point (Redemption)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    value={rewardPointsSettings.dollars_per_point}
                    onChange={(e) => setRewardPointsSettings(prev => ({ 
                      ...prev, 
                      dollars_per_point: parseFloat(e.target.value) || 0 
                    }))}
                    placeholder="0.001"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Dollar value per point (e.g., 0.001 = 1000 points = $1)
                  </p>
                </label>
              </div>

              {/* Example calculation */}
              {rewardPointsSettings.points_per_dollar > 0 && rewardPointsSettings.dollars_per_point > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Example:</h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Customer spends $50 → earns {Math.floor(50 * rewardPointsSettings.points_per_dollar)} points</li>
                    <li>• Customer has 1000 points → worth ${(1000 * rewardPointsSettings.dollars_per_point).toFixed(2)}</li>
                    <li>• Customer can use 1000 points to pay ${(1000 * rewardPointsSettings.dollars_per_point).toFixed(2)} of their order</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit"
            disabled={savingRewardPoints}
            className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black w-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingRewardPoints ? "Saving Reward Points Settings..." : "Save Reward Points Settings"}
          </button>
        </form>
      </div>
    </AdminGuard>
  );
}


