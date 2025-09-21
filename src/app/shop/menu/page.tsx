'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaUtensils, FaTag, FaDollarSign, FaClock, FaBox } from 'react-icons/fa';
import Modal from '@/components/Modal';
import { ActionButton } from '@/components/ActionButton';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { ProductSearch } from '@/components/ProductSearch';
import { ImageUpload } from '@/components/ImageUpload';
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

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0
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

  // Product modal handlers
  const openProductModal = (product?: SaleProductWithDetails) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        sale_price: product.sale_price,
        image_url: product.image_url || '',
        sale_category_id: product.sale_category_id || '',
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
        sale_category_id: '',
        preparation_time_minutes: 0,
        is_active: true,
        ingredients: []
      });
    }
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      sale_price: 0,
      image_url: '',
      sale_category_id: '',
      preparation_time_minutes: 0,
      is_active: true,
      ingredients: []
    });
  };

  // Category modal handlers
  const openCategoryModal = (category?: SaleCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        sort_order: category.sort_order
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        sort_order: 0
      });
    }
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      sort_order: 0
    });
  };

  // Delete handlers
  const openDeleteDialog = (type: 'product' | 'category', id: string, name: string) => {
    setDeletingItem({ type, id, name });
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeletingItem(null);
  };

  // Form submissions
  const handleProductSubmit = async () => {
    try {
      setError(null);
      
      const result = editingProduct 
        ? await updateSaleProduct(editingProduct.id, productForm)
        : await createSaleProduct(productForm);

      if (result.error) {
        console.error('Error submitting product:', result.error);
        toast.error(`Failed to ${editingProduct ? 'update' : 'create'} product: ${result.error}`);
        throw new Error(result.error);
      }

      closeProductModal();
      await loadData();
      
      // Show success message
      toast.success(`Product ${editingProduct ? 'updated' : 'created'} successfully!`);
      
    } catch (error) {
      console.error('Error submitting product:', error);
      // Error toast is already shown above if it's a result error
      if (!(error instanceof Error) || !error.message?.includes('Failed to')) {
        toast.error('An unexpected error occurred. Please try again.');
      }
      throw error;
    }
  };

  const handleCategorySubmit = async () => {
    try {
      setError(null);
      
      const result = editingCategory 
        ? await updateSaleCategory(editingCategory.id, categoryForm)
        : await createSaleCategory(categoryForm);

      if (result.error) {
        console.error('Error submitting category:', result.error);
        toast.error(`Failed to ${editingCategory ? 'update' : 'create'} category: ${result.error}`);
        throw new Error(result.error);
      }

      closeCategoryModal();
      await loadData();
      
      // Show success message
      toast.success(`Category ${editingCategory ? 'updated' : 'created'} successfully!`);
      
    } catch (error) {
      console.error('Error submitting category:', error);
      // Error toast is already shown above if it's a result error
      if (!(error instanceof Error) || !error.message?.includes('Failed to')) {
        toast.error('An unexpected error occurred. Please try again.');
      }
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      setError(null);
      
      const result = deletingItem.type === 'product' 
        ? await deleteSaleProduct(deletingItem.id)
        : await deleteSaleCategory(deletingItem.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      closeDeleteDialog();
      await loadData();
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error deleting item:', err);
    }
  };

  // Add ingredient to form
  const addIngredient = () => {
    setProductForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        product_id: '',
        quantity_required: 1,
        unit_of_measure: 'units',
        is_optional: false,
        notes: ''
      }]
    }));
  };

  // Remove ingredient from form
  const removeIngredient = (index: number) => {
    setProductForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  // Update ingredient in form
  const updateIngredient = (index: number, field: string, value: string | number | boolean) => {
    setProductForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => 
        i === index ? { ...ing, [field]: value } : ing
      )
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
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
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage your sale products and menu categories
              </p>
            </div>
            <div className="flex gap-3">
              <ActionButton
                onClick={() => openCategoryModal()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <FaTag className="mr-2" />
                Add Category
              </ActionButton>
              <ActionButton
                onClick={() => openProductModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FaPlus className="mr-2" />
                Add Product
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaEye className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaTag className="text-green-600" />
            Menu Categories ({saleCategories.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {saleCategories.map((category) => (
              <div key={category.id} className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{category.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Order: {category.sort_order}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openCategoryModal(category)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <FaEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openDeleteDialog('category', category.id, category.name)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Products Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaUtensils className="text-blue-600" />
            Sale Products ({saleProducts.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saleProducts.map((product) => (
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
                    <h3 className="font-medium text-gray-900 dark:text-white">{product.name}</h3>
                    <div className="flex items-center gap-2">
                      {product.is_active ? (
                        <FaEye className="h-4 w-4 text-green-600" />
                      ) : (
                        <FaEyeSlash className="h-4 w-4 text-gray-400" />
                      )}
                      <button
                        onClick={() => openProductModal(product)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <FaEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteDialog('product', product.id, product.name)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {product.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{product.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Price:</span>
                      <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <FaDollarSign className="h-3 w-3" />
                        {product.sale_price.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${product.cost_of_goods.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Profit:</span>
                      <span className={`font-medium ${product.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${product.profit_margin.toFixed(2)}
                      </span>
                    </div>
                    
                    {product.preparation_time_minutes > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Prep Time:</span>
                        <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <FaClock className="h-3 w-3" />
                          {product.preparation_time_minutes}m
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Ingredients:</span>
                      <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <FaBox className="h-3 w-3" />
                        {product.ingredients.length}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Available:</span>
                      <span className={`font-medium ${product.is_available ? 'text-green-600' : 'text-red-600'}`}>
                        {product.is_available ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  
                  {product.category_name && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-neutral-700">
                      <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">
                        {product.category_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Modal */}
        <Modal
          isOpen={showProductModal}
          onClose={closeProductModal}
          title={editingProduct ? 'Edit Sale Product' : 'Add Sale Product'}
          bodyClassName="p-6"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sale Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={productForm.sale_price}
                  onChange={(e) => setProductForm(prev => ({ ...prev, sale_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={productForm.sale_category_id}
                  onChange={(e) => setProductForm(prev => ({ ...prev, sale_category_id: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {saleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preparation Time (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={productForm.preparation_time_minutes}
                  onChange={(e) => setProductForm(prev => ({ ...prev, preparation_time_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <ImageUpload
              currentImageUrl={productForm.image_url}
              onImageChange={(url) => setProductForm(prev => ({ ...prev, image_url: url || "" }))}
              type="sale_product"
            />

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={productForm.is_active}
                onChange={(e) => setProductForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Active
              </label>
            </div>

            {/* Ingredients Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ingredients</h3>
                <ActionButton
                  onClick={addIngredient}
                  variant="success"
                  size="sm"
                  icon={<FaPlus className="w-4 h-4" />}
                >
                  Add Ingredient
                </ActionButton>
              </div>

              <div className="space-y-4">
                {productForm.ingredients.map((ingredient, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Ingredient {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Product
                        </label>
                        <ProductSearch
                          products={availableProducts}
                          selectedProductId={ingredient.product_id}
                          onProductSelect={(productId) => updateIngredient(index, 'product_id', productId)}
                          placeholder="Search products by name or SKU..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Quantity Required
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={ingredient.quantity_required}
                          onChange={(e) => updateIngredient(index, 'quantity_required', parseFloat(e.target.value) || 0)}
                          className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Unit of Measure
                        </label>
                        <input
                          type="text"
                          value={ingredient.unit_of_measure}
                          onChange={(e) => updateIngredient(index, 'unit_of_measure', e.target.value)}
                          placeholder="e.g., units, cups, grams"
                          className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`optional_${index}`}
                          checked={ingredient.is_optional}
                          onChange={(e) => updateIngredient(index, 'is_optional', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`optional_${index}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                          Optional
                        </label>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={ingredient.notes}
                        onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                        placeholder="e.g., garnish, to taste"
                        className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={closeProductModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-700 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                onClick={handleProductSubmit}
                variant="primary"
                size="md"
                icon={<FaUtensils className="w-4 h-4" />}
                loadingText={editingProduct ? "Updating..." : "Creating..."}
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </ActionButton>
            </div>
          </div>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={closeCategoryModal}
          title={editingCategory ? 'Edit Category' : 'Add Category'}
          bodyClassName="p-6"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                value={categoryForm.sort_order}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-neutral-600 px-3 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={closeCategoryModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-700 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                onClick={handleCategorySubmit}
                variant="success"
                size="md"
                icon={<FaTag className="w-4 h-4" />}
                loadingText={editingCategory ? "Updating..." : "Creating..."}
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </ActionButton>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={closeDeleteDialog}
          onConfirm={handleDelete}
          title={`Delete ${deletingItem?.type === 'product' ? 'Product' : 'Category'}`}
          message={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  );
}
