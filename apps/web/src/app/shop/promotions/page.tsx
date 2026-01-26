'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { createPromotion, deletePromotion, getPromotions, updatePromotion } from '@/app/actions/promotions';
import type { PromotionWithProducts } from '@/lib/promotions';
import { promotionLabel } from '@/lib/promotions';

type SaleProduct = { id: string; name: string; sale_price: number; is_active: boolean };

function toDateTimeLocalValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function timeToMinutes(v: string): number | null {
    if (!v) return null;
    const [hh, mm] = v.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return Math.max(0, Math.min(1439, hh * 60 + mm));
}

function minutesToTime(v: number | null): string {
    if (v == null || !Number.isFinite(v)) return '';
    const hh = Math.floor(v / 60);
    const mm = v % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hh)}:${pad(mm)}`;
}

const DEFAULT_FORM: Omit<PromotionWithProducts, 'id' | 'created_at' | 'updated_at'> & { product_ids: string[] } = {
    title: '',
    description: null,
    is_active: true,
    applies_to: 'cart',
    discount_type: 'percent',
    discount_value: 10,
    starts_at: null,
    ends_at: null,
    days_of_week: null,
    daily_start_minute: null,
    daily_end_minute: null,
    product_scope: 'all',
    min_product_price: null,
    cart_scope: 'subtotal_min',
    min_cart_subtotal: 30,
    show_on_home: false,
    home_title: null,
    priority: 0,
    product_ids: [],
};

export default function PromotionsAdminPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [promotions, setPromotions] = useState<PromotionWithProducts[]>([]);
    const [products, setProducts] = useState<SaleProduct[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        ...DEFAULT_FORM,
        starts_at_local: '',
        ends_at_local: '',
        daily_start_time: '',
        daily_end_time: '',
        days_of_week_set: new Set<number>(),
        productSearch: '',
    });

    const filteredProducts = useMemo(() => {
        const q = form.productSearch.trim().toLowerCase();
        const list = products.filter((p) => p.is_active);
        if (!q) return list;
        return list.filter((p) => p.name.toLowerCase().includes(q));
    }, [products, form.productSearch]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const supabase = getSupabaseClient();
                const [{ data: promoData, error: promoError }, prodRes] = await Promise.all([
                    getPromotions(),
                    supabase
                        .from('sale_products')
                        .select('id, name, sale_price, is_active')
                        .order('name', { ascending: true }),
                ]);

                if (promoError) throw new Error(promoError);
                setPromotions(promoData || []);

                if (prodRes.error) throw new Error(prodRes.error.message);
                setProducts((prodRes.data || []) as SaleProduct[]);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load promotions');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({
            ...form,
            ...DEFAULT_FORM,
            starts_at_local: '',
            ends_at_local: '',
            daily_start_time: '',
            daily_end_time: '',
            days_of_week_set: new Set<number>(),
            productSearch: '',
        });
        setIsModalOpen(true);
    };

    const openEdit = (p: PromotionWithProducts) => {
        setEditingId(p.id);
        setForm({
            ...form,
            ...DEFAULT_FORM,
            ...p,
            product_ids: p.product_ids || [],
            starts_at_local: toDateTimeLocalValue(p.starts_at),
            ends_at_local: toDateTimeLocalValue(p.ends_at),
            daily_start_time: minutesToTime(p.daily_start_minute),
            daily_end_time: minutesToTime(p.daily_end_minute),
            days_of_week_set: new Set<number>(p.days_of_week || []),
            productSearch: '',
        });
        setIsModalOpen(true);
    };

    const save = async () => {
        try {
            setSaving(true);
            setError(null);

            const days = form.days_of_week_set.size > 0 ? Array.from(form.days_of_week_set).sort() : null;

            const payload = {
                title: form.title,
                description: form.description || undefined,
                is_active: form.is_active,
                applies_to: form.applies_to,
                discount_type: form.discount_type,
                discount_value: Number(form.discount_value || 0),
                starts_at: fromDateTimeLocalValue(form.starts_at_local),
                ends_at: fromDateTimeLocalValue(form.ends_at_local),
                days_of_week: days,
                daily_start_minute: timeToMinutes(form.daily_start_time),
                daily_end_minute: timeToMinutes(form.daily_end_time),
                product_scope: form.product_scope,
                min_product_price: form.min_product_price != null ? Number(form.min_product_price) : null,
                cart_scope: form.cart_scope,
                min_cart_subtotal: form.min_cart_subtotal != null ? Number(form.min_cart_subtotal) : null,
                show_on_home: form.show_on_home,
                home_title: form.home_title,
                priority: Number(form.priority || 0),
                product_ids: form.product_scope === 'specific' ? form.product_ids : [],
            } as const;

            const res = editingId ? await updatePromotion(editingId, payload) : await createPromotion(payload);
            if (res.error) throw new Error(res.error);

            const refreshed = await getPromotions();
            if (refreshed.error) throw new Error(refreshed.error);
            setPromotions(refreshed.data || []);

            setIsModalOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save promotion');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        if (!confirm('Delete this promotion?')) return;

        const res = await deletePromotion(id);
        if (res.error) {
            setError(res.error);
            return;
        }

        const refreshed = await getPromotions();
        if (!refreshed.error && refreshed.data) setPromotions(refreshed.data);
    };

    const toggleDay = (day: number) => {
        const next = new Set<number>(form.days_of_week_set);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        setForm((f) => ({ ...f, days_of_week_set: next }));
    };

    const toggleProduct = (id: string) => {
        const next = new Set(form.product_ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setForm((f) => ({ ...f, product_ids: Array.from(next) }));
    };

    return (
        <AdminGuard>
            <div className="p-6 max-w-6xl mx-auto">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Promotions</h1>
                        <p className="text-gray-600 dark:text-gray-400">Create cart and product promotions (discount excludes delivery fee).</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                        New promotion
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-gray-600 dark:text-gray-400">Loading…</div>
                ) : promotions.length === 0 ? (
                    <div className="text-gray-600 dark:text-gray-400">No promotions yet.</div>
                ) : (
                    <div className="bg-white dark:bg-neutral-900 rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3">Title</th>
                                    <th className="text-left px-4 py-3">Type</th>
                                    <th className="text-left px-4 py-3">Discount</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promotions.map((p) => (
                                    <tr key={p.id} className="border-t border-gray-100 dark:border-neutral-800">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-900 dark:text-white">{p.title}</div>
                                            {p.show_on_home && (
                                                <div className="text-xs text-green-700 dark:text-green-300">Home banner: {p.home_title || 'Enabled'}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.applies_to}</td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{promotionLabel(p)}</td>
                                        <td className="px-4 py-3">
                                            {p.is_active ? (
                                                <span className="inline-flex px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Active</span>
                                            ) : (
                                                <span className="inline-flex px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">Inactive</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex gap-2">
                                                <button
                                                    onClick={() => openEdit(p)}
                                                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => remove(p.id)}
                                                    className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {isModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
                        <div className="min-h-full p-4 flex items-start sm:items-center justify-center">
                            <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xl flex flex-col max-h-[calc(100vh-2rem)]">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                        {editingId ? 'Edit promotion' : 'New promotion'}
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                    >
                                        Close
                                    </button>
                                </div>

                                <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                            <input
                                                value={form.title}
                                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                                            <input
                                                type="number"
                                                value={form.priority}
                                                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                                        <textarea
                                            value={form.description || ''}
                                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            rows={2}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Applies to</label>
                                            <select
                                                value={form.applies_to}
                                                onChange={(e) => setForm((f) => ({ ...f, applies_to: e.target.value as any }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            >
                                                <option value="cart">Cart</option>
                                                <option value="product">Product</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-3 pt-6">
                                            <input
                                                type="checkbox"
                                                checked={form.is_active}
                                                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount type</label>
                                            <select
                                                value={form.discount_type}
                                                onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as any }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            >
                                                <option value="percent">Percent</option>
                                                <option value="fixed">Fixed</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.discount_value}
                                                onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 pt-6">
                                            <input
                                                type="checkbox"
                                                checked={form.show_on_home}
                                                onChange={(e) => setForm((f) => ({ ...f, show_on_home: e.target.checked }))}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Show on home</span>
                                        </div>
                                    </div>

                                    {form.show_on_home && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home title (optional)</label>
                                            <input
                                                value={form.home_title || ''}
                                                onChange={(e) => setForm((f) => ({ ...f, home_title: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starts at (optional)</label>
                                            <input
                                                type="datetime-local"
                                                value={form.starts_at_local}
                                                onChange={(e) => setForm((f) => ({ ...f, starts_at_local: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ends at (optional)</label>
                                            <input
                                                type="datetime-local"
                                                value={form.ends_at_local}
                                                onChange={(e) => setForm((f) => ({ ...f, ends_at_local: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily start time (optional)</label>
                                            <input
                                                type="time"
                                                value={form.daily_start_time}
                                                onChange={(e) => setForm((f) => ({ ...f, daily_start_time: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily end time (optional)</label>
                                            <input
                                                type="time"
                                                value={form.daily_end_time}
                                                onChange={(e) => setForm((f) => ({ ...f, daily_end_time: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days of week (optional)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                ['Sun', 0],
                                                ['Mon', 1],
                                                ['Tue', 2],
                                                ['Wed', 3],
                                                ['Thu', 4],
                                                ['Fri', 5],
                                                ['Sat', 6],
                                            ].map(([label, day]) => (
                                                <button
                                                    key={String(day)}
                                                    type="button"
                                                    onClick={() => toggleDay(day as number)}
                                                    className={`px-3 py-1.5 rounded-full border text-sm ${form.days_of_week_set.has(day as number)
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-neutral-700'
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {form.applies_to === 'product' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product targeting</label>
                                                <select
                                                    value={form.product_scope}
                                                    onChange={(e) => setForm((f) => ({ ...f, product_scope: e.target.value as any }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                                >
                                                    <option value="all">All products</option>
                                                    <option value="specific">Specific products</option>
                                                    <option value="min_price">Product price ≥</option>
                                                </select>
                                            </div>

                                            {form.product_scope === 'min_price' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min product price</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={form.min_product_price ?? ''}
                                                        onChange={(e) => setForm((f) => ({ ...f, min_product_price: e.target.value ? Number(e.target.value) : null }))}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                                    />
                                                </div>
                                            )}

                                            {form.product_scope === 'specific' && (
                                                <div className="rounded-lg border border-gray-200 dark:border-neutral-800 p-3">
                                                    <input
                                                        value={form.productSearch}
                                                        onChange={(e) => setForm((f) => ({ ...f, productSearch: e.target.value }))}
                                                        className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                                        placeholder="Search products..."
                                                    />
                                                    <div className="max-h-56 overflow-auto space-y-2">
                                                        {filteredProducts.map((p) => (
                                                            <label key={p.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={form.product_ids.includes(p.id)}
                                                                    onChange={() => toggleProduct(p.id)}
                                                                />
                                                                <span className="flex-1">{p.name}</span>
                                                                <span className="text-gray-500">${p.sale_price.toFixed(2)}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {form.applies_to === 'cart' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cart targeting</label>
                                                <select
                                                    value={form.cart_scope}
                                                    onChange={(e) => setForm((f) => ({ ...f, cart_scope: e.target.value as any }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                                >
                                                    <option value="all">All carts</option>
                                                    <option value="subtotal_min">Cart subtotal ≥</option>
                                                </select>
                                            </div>

                                            {form.cart_scope === 'subtotal_min' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min cart subtotal</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={form.min_cart_subtotal ?? ''}
                                                        onChange={(e) => setForm((f) => ({ ...f, min_cart_subtotal: e.target.value ? Number(e.target.value) : null }))}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={save}
                                        disabled={saving || !form.title.trim()}
                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                                    >
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminGuard>
    );
}
