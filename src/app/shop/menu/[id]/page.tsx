'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaUtensils, FaClock, FaBox, FaExclamationTriangle, FaCheckCircle, FaTag } from 'react-icons/fa';
import Card from '@/components/Card';
import { toast } from 'react-toastify';
import { getSupabaseClient } from '@/lib/supabase/client';

interface SaleProduct {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  preparation_time_minutes: number;
  sale_category_id: string | null;
  sale_category_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SaleCategory {
  name: string;
}

interface Product {
  name: string;
  sku: string;
  purchase_price: number;
  units_per_box: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
}

interface SaleProductQueryResult {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  preparation_time_minutes: number;
  sale_category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sale_categories: SaleCategory[] | null;
}

interface IngredientQueryResult {
  id: string;
  product_id: string;
  quantity_required: number;
  unit_of_measure: string;
  is_optional: boolean;
  notes: string | null;
  products: Product[];
}

interface Ingredient {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_required: number;
  unit_of_measure: string;
  is_optional: boolean;
  notes: string | null;
  current_stock: number;
  units_per_box: number;
  full_boxes: number;
  loose_units: number;
  total_units: number;
  purchase_price: number;
}

interface ProductionCapacity {
  max_possible: number;
  limiting_ingredient: string | null;
  limiting_quantity: number | null;
  can_make_any: boolean;
  total_cost: number;
  profit_margin: number;
}

export default function SaleProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [saleProduct, setSaleProduct] = useState<SaleProduct | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [productionCapacity, setProductionCapacity] = useState<ProductionCapacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchSaleProductDetails(params.id as string);
    }
  }, [params.id]);

  const fetchSaleProductDetails = async (id: string) => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      // Fetch sale product details
      const { data: productData, error: productError } = await supabase
        .from('sale_products')
        .select(`
          id,
          name,
          description,
          sale_price,
          image_url,
          preparation_time_minutes,
          sale_category_id,
          is_active,
          created_at,
          updated_at,
          sale_categories (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (productError) {
        throw productError;
      }

      if (!productData) {
        throw new Error('Sale product not found');
      }

      const typedProductData = productData as SaleProductQueryResult;
      const saleProduct: SaleProduct = {
        ...typedProductData,
        sale_category_name: typedProductData.sale_categories?.[0]?.name || null,
      };

      setSaleProduct(saleProduct);

      // Fetch ingredients with current stock
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('sale_product_ingredients')
        .select(`
          id,
          product_id,
          quantity_required,
          unit_of_measure,
          is_optional,
          notes,
          products (
            id,
            name,
            sku,
            purchase_price,
            units_per_box,
            full_boxes,
            loose_units,
            total_units
          )
        `)
        .eq('sale_product_id', id);

      if (ingredientsError) {
        throw ingredientsError;
      }

      const typedIngredientsData = ingredientsData as IngredientQueryResult[];
      const ingredients: Ingredient[] = typedIngredientsData.map(ing => ({
        id: ing.id,
        product_id: ing.product_id,
        product_name: ing.products[0]?.name || '',
        product_sku: ing.products[0]?.sku || '',
        quantity_required: ing.quantity_required,
        unit_of_measure: ing.unit_of_measure,
        is_optional: ing.is_optional,
        notes: ing.notes,
        current_stock: ing.products[0]?.total_units || 0,
        units_per_box: ing.products[0]?.units_per_box || 1,
        full_boxes: ing.products[0]?.full_boxes || 0,
        loose_units: ing.products[0]?.loose_units || 0,
        total_units: ing.products[0]?.total_units || 0,
        purchase_price: ing.products[0]?.purchase_price || 0,
      }));

      setIngredients(ingredients);

      // Calculate production capacity
      const capacity = calculateProductionCapacity(ingredients, saleProduct.sale_price);
      setProductionCapacity(capacity);

    } catch (error) {
      console.error('Error fetching sale product details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load product details');
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const calculateProductionCapacity = (ingredients: Ingredient[], salePrice: number): ProductionCapacity => {
    if (ingredients.length === 0) {
      return {
        max_possible: 0,
        limiting_ingredient: null,
        limiting_quantity: null,
        can_make_any: false,
        total_cost: 0,
        profit_margin: 0,
      };
    }

    let maxPossible = Infinity;
    let limitingIngredient: string | null = null;
    let limitingQuantity: number | null = null;
    let totalCost = 0;

    // Calculate how many we can make based on each ingredient
    ingredients.forEach(ingredient => {
      if (!ingredient.is_optional) {
        const possibleFromThisIngredient = Math.floor(ingredient.current_stock / ingredient.quantity_required);
        
        if (possibleFromThisIngredient < maxPossible) {
          maxPossible = possibleFromThisIngredient;
          limitingIngredient = ingredient.product_name;
          limitingQuantity = ingredient.current_stock;
        }
      }

      // Calculate cost contribution
      totalCost += ingredient.quantity_required * ingredient.purchase_price;
    });

    // If no limiting ingredient found (all optional), we can make 0
    if (maxPossible === Infinity) {
      maxPossible = 0;
    }

    const profitMargin = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0;

    return {
      max_possible: maxPossible,
      limiting_ingredient: limitingIngredient,
      limiting_quantity: limitingQuantity,
      can_make_any: maxPossible > 0,
      total_cost: totalCost,
      profit_margin: profitMargin,
    };
  };

  const getStockStatusColor = (ingredient: Ingredient) => {
    const required = ingredient.quantity_required;
    const available = ingredient.current_stock;
    const ratio = available / required;

    if (ratio >= 10) return 'text-green-600 dark:text-green-400';
    if (ratio >= 5) return 'text-yellow-600 dark:text-yellow-400';
    if (ratio >= 1) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStockStatusText = (ingredient: Ingredient) => {
    const required = ingredient.quantity_required;
    const available = ingredient.current_stock;
    const possible = Math.floor(available / required);

    if (possible >= 10) return 'Excellent';
    if (possible >= 5) return 'Good';
    if (possible >= 1) return 'Low';
    return 'Out of Stock';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-gray-200 dark:bg-neutral-700 rounded-lg"></div>
                <div className="h-32 bg-gray-200 dark:bg-neutral-700 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-lg"></div>
                <div className="h-32 bg-gray-200 dark:bg-neutral-700 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !saleProduct) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Product Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'The requested product could not be found.'}</p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Menu
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{saleProduct.name}</h1>
              {saleProduct.description && (
                <p className="text-gray-600 dark:text-gray-400 text-lg">{saleProduct.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saleProduct.is_active ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <FaCheckCircle className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Image */}
            {saleProduct.image_url && (
              <Card>
                <div className="p-6">
                  <img
                    src={saleProduct.image_url}
                    alt={saleProduct.name}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
              </Card>
            )}

            {/* Ingredients */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FaUtensils className="w-5 h-5 text-blue-600" />
                  Recipe & Ingredients
                </h2>
                
                {ingredients.length === 0 ? (
                  <div className="text-center py-8">
                    <FaUtensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No ingredients defined for this product.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ingredients.map((ingredient) => (
                      <div key={ingredient.id} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900 dark:text-white">{ingredient.product_name}</h3>
                              <span className="text-sm text-gray-500 dark:text-gray-400">({ingredient.product_sku})</span>
                              {ingredient.is_optional && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                  Optional
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span>Required: {ingredient.quantity_required} {ingredient.unit_of_measure}</span>
                              <span>Available: {ingredient.current_stock} {ingredient.unit_of_measure}</span>
                              <span className={`font-medium ${getStockStatusColor(ingredient)}`}>
                                {getStockStatusText(ingredient)}
                              </span>
                            </div>
                            {ingredient.notes && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">{ingredient.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Can make: {Math.floor(ingredient.current_stock / ingredient.quantity_required)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ${(ingredient.quantity_required * ingredient.purchase_price).toFixed(2)} cost
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Production Capacity */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FaBox className="w-5 h-5 text-green-600" />
                  Production Capacity
                </h2>
                
                {productionCapacity && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {productionCapacity.max_possible}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {productionCapacity.max_possible === 1 ? 'item can be made' : 'items can be made'}
                      </div>
                    </div>

                    {productionCapacity.limiting_ingredient && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FaExclamationTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Limited by:</span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          {productionCapacity.limiting_ingredient} ({productionCapacity.limiting_quantity} available)
                        </p>
                      </div>
                    )}

                    {!productionCapacity.can_make_any && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FaExclamationTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="text-sm font-medium text-red-800 dark:text-red-200">Cannot make any</span>
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Insufficient ingredients in stock
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Product Information */}
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FaTag className="w-5 h-5 text-purple-600" />
                  Product Details
                </h2>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Sale Price:</span>
                    <span className="font-medium text-gray-900 dark:text-white">${saleProduct.sale_price.toFixed(2)}</span>
                  </div>
                  
                  {productionCapacity && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Cost per Item:</span>
                        <span className="font-medium text-gray-900 dark:text-white">${productionCapacity.total_cost.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Profit Margin:</span>
                        <span className={`font-medium ${productionCapacity.profit_margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {productionCapacity.profit_margin.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Prep Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                      <FaClock className="w-3 h-3" />
                      {saleProduct.preparation_time_minutes} min
                    </span>
                  </div>
                  
                  {saleProduct.sale_category_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{saleProduct.sale_category_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
