"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/src/lib/supabase/client";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  pay_rate: number;
  is_available: boolean;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    pay_rate: 0,
    is_available: true,
  });

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabaseClient.from("staff").select("*").order("created_at", { ascending: false });
    if (!error && data) setStaff(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", pay_rate: 0, is_available: true });
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await supabaseClient.from("staff").update(form).eq("id", editing.id);
    } else {
      await supabaseClient.from("staff").insert({ ...form, phone: form.phone || null, email: form.email || null });
    }
    await fetchStaff();
    setFormOpen(false);
    resetForm();
  };

  const startEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      pay_rate: s.pay_rate,
      is_available: s.is_available,
    });
    setFormOpen(true);
  };

  const remove = async (id: string) => {
    await supabaseClient.from("staff").delete().eq("id", id);
    await fetchStaff();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-gray-500">Manage staff, pay rates, and availability</p>
        </div>
        <button onClick={() => { resetForm(); setFormOpen(true); }} className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black inline-flex items-center gap-2">
          <Plus className="size-4" /> Add staff
        </button>
      </div>

      <div className="mt-6 rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-900">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Pay rate</th>
              <th className="text-left p-3">Available</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500"><Loader2 className="size-4 animate-spin inline" /> Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No staff yet</td></tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.phone || "—"}</td>
                  <td className="p-3">{s.email || "—"}</td>
                  <td className="p-3">${""}{s.pay_rate.toFixed(2)}</td>
                  <td className="p-3">{s.is_available ? <span className="inline-flex items-center gap-1 text-green-600"><Check className="size-4" /> Yes</span> : <span className="inline-flex items-center gap-1 text-red-600"><X className="size-4" /> No</span>}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => startEdit(s)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900"><Pencil className="size-4" /></button>
                      <button onClick={() => remove(s.id)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900 text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editing ? "Edit staff" : "Add staff"}</h2>
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-600">Name</span>
                <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-600">Phone</span>
                  <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-gray-600">Email</span>
                  <input type="email" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-600">Pay rate</span>
                  <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.pay_rate} onChange={(e) => setForm((f) => ({ ...f, pay_rate: parseFloat(e.target.value) }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-gray-600">Available</span>
                  <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.is_available ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.value === "yes" }))}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
                <button className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


