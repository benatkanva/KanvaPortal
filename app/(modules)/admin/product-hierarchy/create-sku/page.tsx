'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Search, Filter, Package } from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  productNum: string;
  productDescription: string;
  category: string;
  productType: string;
  brand: string;
  imageUrl?: string;
  familyId?: string;
  isFamilyParent?: boolean;
}

export default function CreateSKUPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const familyId = searchParams.get('familyId');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [familyName, setFamilyName] = useState('');
  const [actualFamilyId, setActualFamilyId] = useState('');

  useEffect(() => {
    if (!familyId) {
      toast.error('Family ID is required');
      router.push('/admin/products');
      return;
    }
    loadProducts();
  }, [familyId]);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, selectedCategory, allProducts]);

  async function loadProducts() {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      const products: Product[] = [];
      let foundFamilyName = '';
      let foundFamilyId = '';
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Find the family by matching familyId OR by searching for isFamilyParent with similar name
        if (data.isFamilyParent) {
          // Try exact match first
          if (data.familyId === familyId) {
            foundFamilyName = data.familyName || data.productDescription || 'Unknown Family';
            foundFamilyId = data.familyId;
          }
          // Try URL-decoded match (in case URL has encoded characters)
          else if (familyId && decodeURIComponent(familyId) === data.familyId) {
            foundFamilyName = data.familyName || data.productDescription || 'Unknown Family';
            foundFamilyId = data.familyId;
          }
          // Try matching the productNum or familyName
          else if (data.productNum === familyId || data.familyName?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === familyId) {
            foundFamilyName = data.familyName || data.productDescription || 'Unknown Family';
            foundFamilyId = data.familyId;
          }
        }
        
        // Only show products that are NOT family parents and DON'T have a familyId yet
        if (!data.isFamilyParent && !data.familyId) {
          products.push({
            id: doc.id,
            productNum: data.productNum || '',
            productDescription: data.productDescription || '',
            category: data.category || '',
            productType: data.productType || '',
            brand: data.brand || '',
            imageUrl: data.imageUrl || '',
          });
        }
      });
      
      if (!foundFamilyId) {
        toast.error('Product family not found');
        router.push('/admin/products');
        return;
      }
      
      setFamilyName(foundFamilyName);
      setActualFamilyId(foundFamilyId);
      setAllProducts(products);
      setFilteredProducts(products);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  function filterProducts() {
    let filtered = [...allProducts];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.productNum?.toLowerCase().includes(term) ||
        p.productDescription?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  }

  function toggleProduct(productId: string) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  }

  function toggleAll() {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  }

  async function handleSave() {
    if (selectedProducts.size === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setSaving(true);
    try {
      // Update each selected product with the ACTUAL familyId from the family document
      const updatePromises = Array.from(selectedProducts).map(productId => {
        const productRef = doc(db, 'products', productId);
        return updateDoc(productRef, {
          familyId: actualFamilyId, // Use the actual familyId from the family document, not the URL parameter
          updatedAt: new Date().toISOString()
        });
      });

      await Promise.all(updatePromises);

      toast.success(`Successfully added ${selectedProducts.size} SKU(s) to ${familyName}`);
      router.push(`/admin/product-hierarchy/family/${actualFamilyId}`);
    } catch (error) {
      console.error('Error adding SKUs:', error);
      toast.error('Failed to add SKUs to family');
    } finally {
      setSaving(false);
    }
  }

  const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <AdminBreadcrumbs
          currentPage="Add SKUs"
          parentPage={{ name: 'Product Hierarchy', path: '/admin/products' }}
        />

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add SKUs to {familyName}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Select existing products to add as SKUs to this product family
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/products')}
              className="btn btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product number or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <div className="w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input w-full"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selection Info */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedProducts.size} of {filteredProducts.length} products selected
            </p>
            <button
              onClick={handleSave}
              disabled={saving || selectedProducts.size === 0}
              className="btn btn-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Adding...' : `Add ${selectedProducts.size} SKU${selectedProducts.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleAll}
                      className="checkbox"
                    />
                  </th>
                  <th>Image</th>
                  <th>Product #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Brand</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-500 py-8">
                      {searchTerm || selectedCategory !== 'all' 
                        ? 'No products found matching your filters.' 
                        : 'No available products to add. All products are already assigned to families.'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr 
                      key={product.id}
                      className={`cursor-pointer hover:bg-gray-50 ${selectedProducts.has(product.id) ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="checkbox"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.productDescription}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="font-mono font-semibold">{product.productNum}</td>
                      <td className="max-w-xs truncate">{product.productDescription}</td>
                      <td>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {product.category || 'N/A'}
                        </span>
                      </td>
                      <td className="text-sm">{product.productType || 'N/A'}</td>
                      <td className="text-sm">{product.brand || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
