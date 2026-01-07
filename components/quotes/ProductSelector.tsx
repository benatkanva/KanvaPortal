'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { QuoteLineItem, QuoteProduct, PricingMode } from '@/types/quote';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

interface ProductSelectorProps {
  pricingMode: PricingMode;
  onAddProduct: (lineItem: QuoteLineItem) => void;
}

export default function ProductSelector({ pricingMode, onAddProduct }: ProductSelectorProps) {
  const [products, setProducts] = useState<QuoteProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<QuoteProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  async function loadProducts() {
    try {
      // Load from Firebase Realtime Database (kanva-quotes data)
      const response = await fetch('/quotes/data/products.json');
      const data = await response.json();
      
      // Convert object to array
      const productsArray: QuoteProduct[] = Object.entries(data).map(([id, product]: [string, any]) => ({
        id,
        productId: id,
        name: product.name || '',
        category: product.category || 'Other',
        unitsPerCase: product.unitsPerCase || 12,
        price: product.price || 0,
        msrp: product.msrp || product.price || 0,
        image: product.image,
      }));

      setProducts(productsArray);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(productsArray.map(p => p.category)));
      setCategories(uniqueCategories);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setLoading(false);
    }
  }

  function filterProducts() {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.productId.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  }

  function handleAddProduct(product: QuoteProduct) {
    const price = pricingMode === 'retail' ? product.msrp : product.price;
    
    const lineItem: QuoteLineItem = {
      id: `${Date.now()}-${Math.random()}`,
      productId: product.productId,
      product,
      masterCases: 1,
      displayBoxes: product.unitsPerCase,
      unitPrice: price,
      lineTotal: price * product.unitsPerCase,
    };

    onAddProduct(lineItem);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all"
            >
              {/* Product Image */}
              {product.image && (
                <div className="w-full h-32 mb-3 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Product Info */}
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{product.name}</h3>
                <p className="text-xs text-gray-500">{product.category}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {product.unitsPerCase} units per case
                </p>
              </div>

              {/* Pricing */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">
                    {pricingMode === 'retail' ? 'Retail' : 'Distribution'}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    ${pricingMode === 'retail' ? product.msrp.toFixed(2) : product.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">per unit</p>
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => handleAddProduct(product)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add to Quote
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
