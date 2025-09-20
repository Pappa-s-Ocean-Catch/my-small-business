"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/profile";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import { FaPlus, FaEdit, FaTrash, FaTags, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from 'react-toastify';
import { saveAs } from "file-saver";

type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ category: Category | null; isOpen: boolean }>({ category: null, isOpen: false });

  const [form, setForm] = useState({
    name: "",
    description: ""
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

  const fetchCategories = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    
    const { data: categoriesData } = await supabase
      .from("categories")
      .select(`
        *,
        product_count:products(count)
      `)
      .order("name");

    // Transform the data to include product count
    const transformedData = categoriesData?.map(category => ({
      ...category,
      product_count: category.product_count?.[0]?.count || 0
    })) || [];

    setCategories(transformedData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchCategories();
    }
  }, [isAdmin, fetchCategories]);

  const resetForm = () => {
    setForm({
      name: "",
      description: ""
    });
  };

  const startEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description || ""
    });
    setFormOpen(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();

    const categoryData = {
      name: form.name,
      description: form.description || null
    };

    if (editing) {
      await supabase.from("categories").update(categoryData).eq("id", editing.id);
    } else {
      await supabase.from("categories").insert(categoryData);
    }

    await fetchCategories();
    setFormOpen(false);
    setEditing(null);
    resetForm();
  };

  const handleDeleteCategory = (category: Category) => {
    setDeleteConfirm({ category, isOpen: true });
  };

  const confirmDeleteCategory = async () => {
    if (deleteConfirm.category) {
      const supabase = getSupabaseClient();
      await supabase.from("categories").delete().eq("id", deleteConfirm.category.id);
      await fetchCategories();
      setDeleteConfirm({ category: null, isOpen: false });
    }
  };

  const exportToExcel = () => {
    const exportData = categories.map(category => ({
      'Category Name': category.name,
      'Description': category.description || '',
      'Product Count': category.product_count || 0,
      'Created Date': new Date(category.created_at).toLocaleDateString(),
      'Updated Date': new Date(category.updated_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `categories-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Categories Excel downloaded');
  };

  if (loading || isAdmin === null) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading categories...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-red-600">
        Access restricted. You must be an admin to view categories.
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Organize your products into categories
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
              Add Category
            </button>
          </div>
        </div>

        {/* Categories List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} variant="elevated" padding="lg" hover>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <FaTags className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Edit category"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete category"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {category.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {category.description}
                </p>
              )}
              
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Created {new Date(category.created_at).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <FaTags className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No categories found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by creating your first product category
            </p>
            <button
              onClick={() => { resetForm(); setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <FaPlus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        )}

        {/* Category Form Modal */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? "Edit Category" : "Add Category"}
          size="md"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
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
                form="category-form"
                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {editing ? "Update" : "Create"} Category
              </button>
            </>
          }
        >
          <form id="category-form" onSubmit={saveCategory} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Category Name *</span>
              <input
                type="text"
                required
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Electronics, Clothing, Books"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
              <textarea
                className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description for this category..."
                rows={3}
              />
            </label>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ category: null, isOpen: false })}
          onConfirm={confirmDeleteCategory}
          title="Delete Category"
          message={`Are you sure you want to delete "${deleteConfirm.category?.name}"? This action cannot be undone. Products in this category will have their category removed.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </AdminGuard>
  );
}
