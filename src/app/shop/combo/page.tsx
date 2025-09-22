"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaMagic } from "react-icons/fa";

type ConstraintsForm = {
  numCombos: number;
  itemsPerCombo?: number;
  serves?: number;
  priceMin?: number;
  priceMax?: number;
  preferredCategories: string;
  dietaryNotes: string;
  mealPeriod: 'lunch' | 'dinner' | 'all_day';
  groupType: 'couple' | 'friends' | 'family' | 'custom';
  peopleCount?: number;
};

type ComboItem = { productId: string; name: string; quantity: number; imageUrl?: string };
type ComboRecommendation = {
  title: string;
  items: ComboItem[];
  suggestedBundlePrice: number;
  estimatedMarginPercent?: number;
  reasoning: string;
  originalTotalPrice?: number;
};

export default function ComboBuilderPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [combos, setCombos] = useState<ComboRecommendation[]>([]);

  const [form, setForm] = useState<ConstraintsForm>({
    numCombos: 3,
    itemsPerCombo: 3,
    serves: undefined,
    priceMin: 25,
    priceMax: 35,
    preferredCategories: "",
    dietaryNotes: "",
    mealPeriod: 'all_day',
    groupType: 'couple',
    peopleCount: undefined,
  });

  useEffect(() => {
    // Check admin via existing session
    (async () => {
      try {
        const { getSupabaseClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_slug')
          .eq('id', user.id)
          .single();
        setIsAdmin(profile?.role_slug === 'admin');
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    setSubmitting(true);
    setCombos([]);
    try {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('No valid session found. Please log in again.');
        return;
      }

      const preferredCategories = form.preferredCategories
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const constraints = {
        numCombos: form.numCombos,
        itemsPerCombo: form.itemsPerCombo || undefined,
        serves: form.serves || undefined,
        priceMin: form.priceMin || undefined,
        priceMax: form.priceMax || undefined,
        preferredCategories: preferredCategories.length ? preferredCategories : undefined,
        dietaryNotes: form.dietaryNotes || undefined,
        mealPeriod: form.mealPeriod,
        groupType: form.groupType,
        peopleCount: form.groupType === 'friends' || form.groupType === 'custom' ? (form.peopleCount || undefined) : undefined,
      };

      const res = await fetch('/api/ai/generate-combo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ constraints }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate combos');
      }
      setCombos(data.combos || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate combos');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-600 dark:text-gray-300">Loading...</div>;
  }
  if (isAdmin === false) {
    return <div className="p-6 text-sm text-red-600">Admin access required</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Combo Builder</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Generate revenue-optimized combos using AI.</p>
      </div>

      {/* Constraints Form */}
      <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 bg-gray-50 dark:bg-neutral-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Meal period</div>
            <select
              value={form.mealPeriod}
              onChange={e => setForm(f => ({ ...f, mealPeriod: e.target.value as ConstraintsForm['mealPeriod'] }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
            >
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="all_day">All day</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Group type</div>
            <select
              value={form.groupType}
              onChange={e => setForm(f => ({ ...f, groupType: e.target.value as ConstraintsForm['groupType'] }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
            >
              <option value="couple">Couple</option>
              <option value="friends">Friends</option>
              <option value="family">Family (2 adults, 2 kids)</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">People count (for friends/custom)</div>
            <input
              type="number"
              value={form.peopleCount ?? ''}
              onChange={e => setForm(f => ({ ...f, peopleCount: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              min={1}
              placeholder="e.g., 4"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Number of combos</div>
            <input
              type="number"
              value={form.numCombos}
              onChange={e => setForm(f => ({ ...f, numCombos: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              min={1}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Items per combo</div>
            <input
              type="number"
              value={form.itemsPerCombo ?? ''}
              onChange={e => setForm(f => ({ ...f, itemsPerCombo: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              min={1}
              placeholder="e.g., 3"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Serves</div>
            <input
              type="number"
              value={form.serves ?? ''}
              onChange={e => setForm(f => ({ ...f, serves: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              min={1}
              placeholder="e.g., 2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Price min</div>
            <input
              type="number"
              value={form.priceMin ?? ''}
              onChange={e => setForm(f => ({ ...f, priceMin: e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              step="0.01"
              placeholder="e.g., 15"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Price max</div>
            <input
              type="number"
              value={form.priceMax ?? ''}
              onChange={e => setForm(f => ({ ...f, priceMax: e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              step="0.01"
              placeholder="e.g., 30"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Preferred categories (comma-separated)</div>
            <input
              type="text"
              value={form.preferredCategories}
              onChange={e => setForm(f => ({ ...f, preferredCategories: e.target.value }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              placeholder="e.g., Burgers, Drinks, Sides"
            />
          </label>
          <label className="text-sm md:col-span-3">
            <div className="mb-1 text-gray-700 dark:text-gray-300">Dietary notes / constraints</div>
            <input
              type="text"
              value={form.dietaryNotes}
              onChange={e => setForm(f => ({ ...f, dietaryNotes: e.target.value }))}
              className="w-full px-3 py-2 rounded border bg-white dark:bg-neutral-900"
              placeholder="e.g., include vegetarian options, halal-friendly"
            />
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50"
          >
            <FaMagic className="w-4 h-4" />
            {submitting ? 'Generating...' : 'Generate Combos'}
          </button>
        </div>
      </div>

      {/* Results */}
      {combos.length > 0 && (
        <div className="space-y-4">
          {combos.map((c, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{c.title}</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 text-right">
                  <div>
                    <span className="text-gray-500">Original:</span> ${c.originalTotalPrice?.toFixed(2) ?? '—'}
                  </div>
                  <div>
                    <span className="text-gray-500">Combo:</span> ${c.suggestedBundlePrice.toFixed(2)}{c.estimatedMarginPercent != null ? ` · ${c.estimatedMarginPercent.toFixed(0)}%` : ''}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {c.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} className="w-14 h-14 object-cover rounded-md border border-gray-200 dark:border-neutral-700" />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-gray-200 dark:bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{it.quantity} × {it.name}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {c.reasoning}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


