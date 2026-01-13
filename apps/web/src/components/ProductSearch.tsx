"use client";

import { useState, useRef, useEffect } from 'react';
import { FaSearch, FaCheck, FaBox, FaDollarSign, FaWarehouse } from 'react-icons/fa';

interface Product {
  id: string;
  name: string;
  sku: string;
  purchase_price: number;
  unit_price: number;
  total_units: number;
  units_per_box: number;
}

interface ProductSearchProps {
  products: Product[];
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ProductSearch({
  products,
  selectedProductId,
  onProductSelect,
  placeholder = "Search products by name or SKU...",
  className = "",
  disabled = false
}: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected product
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term)
    );
  });

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    onProductSelect(product.id);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
          handleProductSelect(filteredProducts[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get stock status
  const getStockStatus = (product: Product) => {
    if (product.total_units === 0) {
      return { status: 'out', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    } else if (product.total_units <= 10) {
      return { status: 'low', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
    } else {
      return { status: 'good', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {selectedProduct && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <FaCheck className="h-4 w-4 text-green-600" />
          </div>
        )}
      </div>

      {/* Selected Product Display */}
      {selectedProduct && !isOpen && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900 dark:text-blue-100">
                {selectedProduct.name}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                SKU: {selectedProduct.sku} • Unit: ${selectedProduct.unit_price.toFixed(3)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onProductSelect('')}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <FaCheck className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
              No products found
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const stockStatus = getStockStatus(product);
              const isHighlighted = index === highlightedIndex;
              const isSelected = product.id === selectedProductId;

              return (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-neutral-700 last:border-b-0 transition-colors ${
                    isHighlighted
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-neutral-700'
                  } ${isSelected ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900 dark:text-white text-base whitespace-normal break-words">
                          {product.name}
                        </div>
                        {isSelected && (
                          <FaCheck className="h-3 w-3 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        SKU: {product.sku}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      {/* Unit Price */}
                      <div className="flex items-center gap-1">
                        <FaDollarSign className="h-3 w-3 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {product.unit_price.toFixed(3)}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">/unit</span>
                      </div>

                      {/* Stock Status */}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bg}`}>
                        <FaWarehouse className={`h-3 w-3 ${stockStatus.color}`} />
                        <span className={stockStatus.color}>
                          {product.total_units} units
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <FaBox className="h-3 w-3" />
                      <span>Box: ${product.purchase_price.toFixed(2)} ({product.units_per_box} units)</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
