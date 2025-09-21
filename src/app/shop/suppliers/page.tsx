"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import { FaPlus, FaEdit, FaTrash, FaTruck, FaPhone, FaEnvelope, FaMapMarkerAlt, FaFileExcel, FaGlobe } from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { ImageUpload } from "@/components/ImageUpload";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  image_url: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ supplier: Supplier | null; isOpen: boolean }>({ supplier: null, isOpen: false });

  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    image_url: "",
    website: ""
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        return;
      }

      const ensureResult = await ensureProfile(user.id, user.email);
      if (!ensureResult.ok) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role_slug")
        .eq("id", user.id)
        .single();

      if (profile && profile.role_slug === "admin") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    void checkAdmin();
  }, []);

  const fetchSuppliers = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    
    const { data: suppliersData } = await supabase
      .from("suppliers")
      .select(`
        *,
        product_count:products(count)
      `)
      .order("name");

    // Transform the data to include product count
    const transformedData = suppliersData?.map(supplier => ({
      ...supplier,
      product_count: supplier.product_count?.[0]?.count || 0
    })) || [];

    setSuppliers(transformedData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchSuppliers();
    }
  }, [isAdmin, fetchSuppliers]);

  const resetForm = () => {
    setForm({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      image_url: "",
      website: ""
    });
  };

  const startEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      image_url: supplier.image_url || "",
      website: supplier.website || ""
    });
    setFormOpen(true);
  };

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();

    const supplierData = {
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
      image_url: form.image_url || null,
      website: form.website || null
    };

    if (editing) {
      await supabase.from("suppliers").update(supplierData).eq("id", editing.id);
    } else {
      await supabase.from("suppliers").insert(supplierData);
    }

    await fetchSuppliers();
    setFormOpen(false);
    setEditing(null);
    resetForm();
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setDeleteConfirm({ supplier, isOpen: true });
  };

  const confirmDeleteSupplier = async () => {
    if (deleteConfirm.supplier) {
      const supabase = getSupabaseClient();
      await supabase.from("suppliers").delete().eq("id", deleteConfirm.supplier.id);
      await fetchSuppliers();
      setDeleteConfirm({ supplier: null, isOpen: false });
    }
  };

  const exportToExcel = () => {
    const exportData = suppliers.map(supplier => ({
      'Supplier Name': supplier.name,
      'Contact Person': supplier.contact_person || '',
      'Phone': supplier.phone || '',
      'Email': supplier.email || '',
      'Address': supplier.address || '',
      'Website': supplier.website || '',
      'Notes': supplier.notes || '',
      'Product Count': supplier.product_count || 0,
      'Created Date': new Date(supplier.created_at).toLocaleDateString(),
      'Updated Date': new Date(supplier.updated_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `suppliers-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading suppliers...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view suppliers.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your suppliers and vendors
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaFileExcel className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={() => { resetForm(); setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaPlus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>

        {/* Suppliers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} variant="elevated" padding="lg" hover>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {supplier.image_url ? (
                    <img 
                      src={supplier.image_url} 
                      alt={`${supplier.name} logo`}
                      className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                      <FaTruck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{supplier.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {supplier.product_count} product{supplier.product_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(supplier)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Edit supplier"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(supplier)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete supplier"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                {supplier.contact_person && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FaPhone className="w-3 h-3" />
                    <span>{supplier.contact_person}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FaPhone className="w-3 h-3" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FaEnvelope className="w-3 h-3" />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FaGlobe className="w-3 h-3" />
                    <a 
                      href={supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FaMapMarkerAlt className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{supplier.address}</span>
                  </div>
                )}
              </div>
              
              {supplier.notes && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    &ldquo;{supplier.notes}&rdquo;
                  </p>
                </div>
              )}
              
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Created {new Date(supplier.created_at).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>

        {suppliers.length === 0 && (
          <div className="text-center py-12">
            <FaTruck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No suppliers found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by adding your first supplier
            </p>
            <button
              onClick={() => { resetForm(); setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <FaPlus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        )}

        {/* Supplier Form Modal */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? "Edit Supplier" : "Add Supplier"}
          size="lg"
          bodyClassName="p-6"
          footer={
            <>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="supplier-form"
                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {editing ? "Update" : "Create"} Supplier
              </button>
            </>
          }
        >
          <form id="supplier-form" onSubmit={saveSupplier} className="grid gap-4">
            <ImageUpload
              currentImageUrl={form.image_url}
              onImageChange={(url) => setForm(f => ({ ...f, image_url: url || "" }))}
              type="supplier"
              disabled={false}
            />
            
            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Supplier Name *</span>
              <input
                type="text"
                required
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., ABC Electronics, XYZ Wholesale"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Contact Person</span>
                <input
                  type="text"
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                  value={form.contact_person}
                  onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))}
                  placeholder="John Smith"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Phone</span>
                <input
                  type="tel"
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
              <input
                type="email"
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contact@supplier.com"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Website</span>
              <input
                type="url"
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                value={form.website}
                onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://www.supplier.com"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Address</span>
              <textarea
                className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                value={form.address}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Notes</span>
              <textarea
                className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes about this supplier..."
                rows={3}
              />
            </label>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ supplier: null, isOpen: false })}
          onConfirm={confirmDeleteSupplier}
          title="Delete Supplier"
          message={`Are you sure you want to delete "${deleteConfirm.supplier?.name}"? This action cannot be undone. Products from this supplier will have their supplier removed.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </AdminGuard>
  );
}
