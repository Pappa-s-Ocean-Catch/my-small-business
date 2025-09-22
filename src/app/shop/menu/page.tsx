'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaUtensils, FaTag, FaClock, FaBox, FaChevronDown, FaChevronRight, FaFilter } from 'react-icons/fa';
import Modal from '@/components/Modal';
import { ActionButton } from '@/components/ActionButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { ProductSearch } from '@/components/ProductSearch';
import { ImageUpload } from '@/components/ImageUpload';
import { AIImageGenerator } from '@/components/AIImageGenerator';
import { toast } from 'react-toastify';
import { 
  getSaleProducts, 
  getSaleCategories, 
  createSaleProduct, 
  updateSaleProduct, 
  deleteSaleProduct,
  createSaleCategory,
  updateSaleCategory,
  deleteSaleCategory,
  getAvailableProducts,
  type SaleProductWithDetails,
  type SaleCategory
} from '@/app/actions/sale-products';

export default function MenuPage() {
  const router = useRouter();
  const [saleProducts, setSaleProducts] = useState<SaleProductWithDetails[]>([]);
  const [saleCategories, setSaleCategories] = useState<SaleCategory[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Array<{
    id: string;
    name: string;
    sku: string;
    purchase_price: number;
    unit_price: number;
    total_units: number;
    units_per_box: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SaleProductWithDetails | null>(null);
  const [editingCategory, setEditingCategory] = useState<SaleCategory | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'product' | 'category'; id: string; name: string } | null>(null);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    sale_price: 0,
    image_url: '',
    sale_category_id: '',
    sub_category_id: '',
    preparation_time_minutes: 0,
    is_active: true,
    ingredients: [] as Array<{
      product_id: string;
      quantity_required: number;
      unit_of_measure: string;
      is_optional: boolean;
      notes: string;
    }>
  });

  // Tab state for product form
  const [activeProductTab, setActiveProductTab] = useState<'overview' | 'ingredients'>('overview');

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    parent_category_id: '',
    is_active: true
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsResult, categoriesResult, availableProductsResult] = await Promise.all([
        getSaleProducts(),
        getSaleCategories(),
        getAvailableProducts()
      ]);

      if (productsResult.error) {
        setError(productsResult.error);
        return;
      }

      if (categoriesResult.error) {
        setError(categoriesResult.error);
        return;
      }

      if (availableProductsResult.error) {
        setError(availableProductsResult.error);
        return;
      }

      setSaleProducts(productsResult.data || []);
      setSaleCategories(categoriesResult.data || []);
      setAvailableProducts(availableProductsResult.data || []);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Organize categories into hierarchy
  const categoryHierarchy = useMemo(() => {
    const mainCategories = saleCategories.filter(cat => !cat.parent_category_id);
    const subCategories = saleCategories.filter(cat => cat.parent_category_id);
    
    return mainCategories.map(mainCat => ({
      ...mainCat,
      sub_categories: subCategories.filter(subCat => subCat.parent_category_id === mainCat.id)
    }));
  }, [saleCategories]);

  // Filter products based on selected category and search
  const filteredProducts = useMemo(() => {
    let filtered = saleProducts;

    // Filter by category
    if (selectedCategoryId) {
      if (selectedSubCategoryId) {
        filtered = filtered.filter(product => product.sub_category_id === selectedSubCategoryId);
      } else {
        filtered = filtered.filter(product => product.sale_category_id === selectedCategoryId);
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sub_category_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [saleProducts, selectedCategoryId, selectedSubCategoryId, searchTerm]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string | null, subCategoryId: string | null = null) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId(subCategoryId);
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setSearchTerm('');
  };

  // Modal handlers
  const openProductModal = (product?: SaleProductWithDetails) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        sale_price: product.sale_price,
        image_url: product.image_url || '',
        sale_category_id: product.sale_category_id || '',
        sub_category_id: product.sub_category_id || '',
        preparation_time_minutes: product.preparation_time_minutes,
        is_active: product.is_active,
        ingredients: product.ingredients.map(ing => ({
          product_id: ing.product_id,
          quantity_required: ing.quantity_required,
          unit_of_measure: ing.unit_of_measure,
          is_optional: ing.is_optional,
          notes: ing.notes || ''
        }))
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        sale_price: 0,
        image_url: '',
        sale_category_id: selectedCategoryId || '',
        sub_category_id: selectedSubCategoryId || '',
        preparation_time_minutes: 0,
        is_active: true,
        ingredients: []
      });
    }
    setActiveProductTab('overview'); // Reset to overview tab
    setShowProductModal(true);
  };

  const openCategoryModal = (category?: SaleCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        sort_order: category.sort_order,
        parent_category_id: category.parent_category_id || '',
        is_active: category.is_active
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        sort_order: 0,
        parent_category_id: '',
        is_active: true
      });
    }
    setShowCategoryModal(true);
  };

  const openDeleteDialog = (type: 'product' | 'category', id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setShowDeleteDialog(true);
  };

  // Form submission handlers
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const result = await updateSaleProduct(editingProduct.id, productForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Product updated successfully');
      } else {
        const result = await createSaleProduct(productForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Product created successfully');
      }
      setShowProductModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save product');
      console.error('Error saving product:', err);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const result = await updateSaleCategory(editingCategory.id, categoryForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Category updated successfully');
      } else {
        const result = await createSaleCategory(categoryForm);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Category created successfully');
      }
      setShowCategoryModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save category');
      console.error('Error saving category:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    try {
      let result;
      if (deletingItem.type === 'product') {
        result = await deleteSaleProduct(deletingItem.id);
      } else {
        result = await deleteSaleCategory(deletingItem.id);
      }
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success(`${deletingItem.type === 'product' ? 'Product' : 'Category'} deleted successfully`);
      setShowDeleteDialog(false);
      loadData();
    } catch (err) {
      toast.error(`Failed to delete ${deletingItem.type}`);
      console.error('Error deleting:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Menu</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <FaUtensils className="text-blue-600" />
                Menu Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your menu categories and products with sub-category support
              </p>
            </div>
            <div className="flex gap-3">
              <ActionButton
                onClick={() => openCategoryModal()}
                icon={<FaTag />}
                variant="secondary"
              >
                Add Category
              </ActionButton>
              <ActionButton
                onClick={() => openProductModal()}
                icon={<FaPlus />}
              >
                Add Product
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - Categories */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700">
              <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FaFilter className="text-blue-600" />
                  Categories
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {filteredProducts.length} products
                </p>
              </div>
              
              <div className="p-4">
                {/* All Products Filter */}
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    !selectedCategoryId 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">All Products</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {saleProducts.length}
                    </span>
                  </div>
                </button>

                {/* Category List */}
                <div className="space-y-1">
                  {categoryHierarchy.map((category) => (
                    <div key={category.id}>
                      {/* Main Category */}
                      <div className="group relative">
                        <button
                          onClick={() => {
                            if (category.sub_categories.length > 0) {
                              toggleCategory(category.id);
                            } else {
                              handleCategorySelect(category.id);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                            selectedCategoryId === category.id && !selectedSubCategoryId
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                              : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {category.sub_categories.length > 0 && (
                                expandedCategories.has(category.id) ? 
                                  <FaChevronDown className="h-3 w-3" /> : 
                                  <FaChevronRight className="h-3 w-3" />
                              )}
                              <span className="font-medium">{category.name}</span>
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {saleProducts.filter(p => p.sale_category_id === category.id).length}
                            </span>
                          </div>
                        </button>
                        
                        {/* Category Actions */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openCategoryModal(category);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit category"
                            >
                              <FaEdit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog('category', category.id, category.name);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete category"
                            >
                              <FaTrash className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sub Categories */}
                      {expandedCategories.has(category.id) && category.sub_categories.length > 0 && (
                        <div className="ml-4 space-y-1">
                          {category.sub_categories.map((subCategory) => (
                            <div key={subCategory.id} className="group relative">
                              <button
                                onClick={() => handleCategorySelect(category.id, subCategory.id)}
                                className={`w-full text-left p-2 rounded-lg transition-colors ${
                                  selectedSubCategoryId === subCategory.id
                                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                                    : 'hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">{subCategory.name}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {saleProducts.filter(p => p.sub_category_id === subCategory.id).length}
                                  </span>
                                </div>
                              </button>
                              
                              {/* Sub-Category Actions */}
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCategoryModal(subCategory);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                    title="Edit sub-category"
                                  >
                                    <FaEdit className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog('category', subCategory.id, subCategory.name);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Delete sub-category"
                                  >
                                    <FaTrash className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Clear Filters */}
                {(selectedCategoryId || searchTerm) && (
                  <button
                    onClick={clearFilters}
                    className="w-full mt-4 p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Products */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <FaUtensils className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
                  {product.image_url && (
                    <div className="h-48 bg-gray-200 dark:bg-neutral-700">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {product.name}
                      </h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openProductModal(product)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit product"
                        >
                          <FaEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog('product', product.id, product.name)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete product"
                        >
                          <FaTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {product.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Category Info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <FaTag className="text-blue-600" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {product.category_name}
                          {product.sub_category_name && (
                            <span className="text-gray-500 dark:text-gray-400">
                              {' '}• {product.sub_category_name}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Price and Details */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-green-600">
                            ${product.sale_price.toFixed(2)}
                          </span>
                        </div>
                        {product.preparation_time_minutes > 0 && (
                          <div className="flex items-center gap-1">
                            <FaClock className="text-orange-600" />
                            <span>{product.preparation_time_minutes}m</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {product.is_available ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <FaEye className="h-3 w-3 mr-1" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <FaEyeSlash className="h-3 w-3 mr-1" />
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <FaUtensils className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No products found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchTerm || selectedCategoryId 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Get started by adding your first product'
                  }
                </p>
                {!searchTerm && !selectedCategoryId && (
                  <button
                    onClick={() => openProductModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <FaPlus className="h-4 w-4 mr-2" />
                    Add Product
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Product Modal */}
        <Modal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          title={editingProduct ? 'Edit Product' : 'Add Product'}
          size="xl"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <FaTrash className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <ActionButton
                onClick={async () => {
                  await handleProductSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
                variant="primary"
                size="md"
                icon={<FaPlus className="w-4 h-4" />}
                loadingText={editingProduct ? 'Updating...' : 'Creating...'}
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </ActionButton>
            </div>
          }
        >
          <form id="product-form" className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 dark:border-neutral-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  type="button"
                  onClick={() => setActiveProductTab('overview')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeProductTab === 'overview'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <FaUtensils className="w-4 h-4 inline mr-2" />
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProductTab('ingredients')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeProductTab === 'ingredients'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <FaBox className="w-4 h-4 inline mr-2" />
                  Ingredients
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeProductTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Product Name</span>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="Enter product name"
                      required
                    />
                  </label>
                  
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Price</span>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.sale_price}
                      onChange={(e) => setProductForm({ ...productForm, sale_price: parseFloat(e.target.value) || 0 })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="0.00"
                      required
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    rows={3}
                    className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                    placeholder="Enter product description"
                  />
                </label>

                {/* Image Upload Section */}
                <div className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Product Image</span>
                  <div className="space-y-3">
                    {productForm.image_url && (
                      <div className="relative">
                        <img
                          src={productForm.image_url}
                          alt="Product preview"
                          className="w-full h-48 object-cover rounded-xl border border-gray-300 dark:border-neutral-600"
                        />
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, image_url: '' })}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                        >
                          <FaTrash className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {/* AI Image Generator */}
                    <AIImageGenerator
                      onImageGenerated={(url) => setProductForm({ ...productForm, image_url: url || '' })}
                      currentImageUrl={productForm.image_url}
                      productName={productForm.name}
                      description={productForm.description}
                      category={(() => {
                        const mainCategory = saleCategories.find(cat => cat.id === productForm.sale_category_id);
                        const subCategory = saleCategories.find(cat => cat.id === productForm.sub_category_id);
                        if (subCategory) return `${mainCategory?.name || ''} - ${subCategory.name}`;
                        return mainCategory?.name || '';
                      })()}
                      ingredients={productForm.ingredients.map(ing => {
                        const product = availableProducts.find(p => p.id === ing.product_id);
                        return product ? `${product.name} (${ing.quantity_required} ${ing.unit_of_measure})` : '';
                      }).filter(Boolean)}
                      className="w-full"
                    />
                    
                    {/* Traditional Image Upload */}
                    <div className="border-t border-gray-200 dark:border-neutral-700 pt-3">
                      <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Or upload your own image:</div>
                      <ImageUpload
                        onImageChange={(url) => setProductForm({ ...productForm, image_url: url || '' })}
                        currentImageUrl={productForm.image_url}
                        type="sale_product"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Main Category</span>
                    <select
                      value={productForm.sale_category_id}
                      onChange={(e) => setProductForm({ ...productForm, sale_category_id: e.target.value, sub_category_id: '' })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                    >
                      <option value="">Select Category</option>
                      {categoryHierarchy.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Sub Category</span>
                    <select
                      value={productForm.sub_category_id}
                      onChange={(e) => setProductForm({ ...productForm, sub_category_id: e.target.value })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      disabled={!productForm.sale_category_id}
                    >
                      <option value="">No Sub Category</option>
                      {productForm.sale_category_id && categoryHierarchy
                        .find(cat => cat.id === productForm.sale_category_id)
                        ?.sub_categories.map((subCategory) => (
                          <option key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Preparation Time (minutes)</span>
                    <input
                      type="number"
                      min="0"
                      value={productForm.preparation_time_minutes}
                      onChange={(e) => setProductForm({ ...productForm, preparation_time_minutes: parseInt(e.target.value) || 0 })}
                      className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                      placeholder="0"
                    />
                  </label>

                  <div className="flex items-center justify-center">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={productForm.is_active}
                        onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Product is active
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeProductTab === 'ingredients' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recipe Ingredients</h3>
                  <button
                    type="button"
                    onClick={() => setProductForm({
                      ...productForm,
                      ingredients: [...productForm.ingredients, {
                        product_id: '',
                        quantity_required: 1,
                        unit_of_measure: 'units',
                        is_optional: false,
                        notes: ''
                      }]
                    })}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaPlus className="w-4 h-4" />
                    Add Ingredient
                  </button>
                </div>

                {productForm.ingredients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FaBox className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h4 className="text-lg font-medium mb-2">No ingredients added yet</h4>
                    <p className="text-sm mb-4">Build your recipe by adding ingredients from your inventory</p>
                    <button
                      type="button"
                      onClick={() => setProductForm({
                        ...productForm,
                        ingredients: [...productForm.ingredients, {
                          product_id: '',
                          quantity_required: 1,
                          unit_of_measure: 'units',
                          is_optional: false,
                          notes: ''
                        }]
                      })}
                      className="flex items-center gap-2 px-4 py-2 mx-auto text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FaPlus className="w-4 h-4" />
                      Add First Ingredient
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productForm.ingredients.map((ingredient, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50/50 dark:bg-neutral-800/50">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Product
                          </label>
                          <select
                            value={ingredient.product_id}
                            onChange={(e) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].product_id = e.target.value;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                          >
                            <option value="">Select Product</option>
                            {availableProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={ingredient.quantity_required}
                            onChange={(e) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].quantity_required = parseFloat(e.target.value) || 0;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                            placeholder="1"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Unit
                          </label>
                          <select
                            value={ingredient.unit_of_measure}
                            onChange={(e) => {
                              const newIngredients = [...productForm.ingredients];
                              newIngredients[index].unit_of_measure = e.target.value;
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="w-full h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 text-sm"
                          >
                            <option value="units">Units</option>
                            <option value="cups">Cups</option>
                            <option value="grams">Grams</option>
                            <option value="ml">ML</option>
                            <option value="tbsp">Tablespoons</option>
                            <option value="tsp">Teaspoons</option>
                            <option value="lbs">Pounds</option>
                            <option value="oz">Ounces</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-center">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={ingredient.is_optional}
                              onChange={(e) => {
                                const newIngredients = [...productForm.ingredients];
                                newIngredients[index].is_optional = e.target.checked;
                                setProductForm({ ...productForm, ingredients: newIngredients });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">Optional</span>
                          </label>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newIngredients = productForm.ingredients.filter((_, i) => i !== index);
                              setProductForm({ ...productForm, ingredients: newIngredients });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove ingredient"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </form>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title={editingCategory ? 'Edit Category' : 'Add Category'}
          size="lg"
          bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <FaTrash className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <ActionButton
                onClick={async () => {
                  await handleCategorySubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
                variant="primary"
                size="md"
                icon={<FaTag className="w-4 h-4" />}
                loadingText={editingCategory ? 'Updating...' : 'Creating...'}
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </ActionButton>
            </div>
          }
        >
          <form id="category-form" className="space-y-4">
            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Category Name</span>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                placeholder="Enter category name"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows={3}
                className="min-h-20 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y"
                placeholder="Enter category description"
              />
            </label>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Parent Category</span>
                <select
                  value={categoryForm.parent_category_id}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parent_category_id: e.target.value })}
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                >
                  <option value="">Main Category</option>
                  {categoryHierarchy.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Sort Order</span>
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                  className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900"
                  placeholder="0"
                />
              </label>
            </div>

            <div className="flex items-center justify-center">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category is active
                </span>
              </label>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title={`Delete ${deletingItem?.type === 'product' ? 'Product' : 'Category'}`}
          message={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
        />
      </div>
    </div>
  );
}