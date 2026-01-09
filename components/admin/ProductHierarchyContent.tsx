'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, ChevronDown, ChevronRight, Edit, 
  Package, Search, Trash2
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { ProductFamily, ProductSKU, ProductHierarchyView } from '@/types/product-hierarchy';
import toast from 'react-hot-toast';

export default function ProductHierarchyContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hierarchies, setHierarchies] = useState<ProductHierarchyView[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [deletingFamily, setDeletingFamily] = useState<ProductHierarchyView | null>(null);

  useEffect(() => {
    loadHierarchies();
  }, []);

  async function loadHierarchies() {
    try {
      setLoading(true);
      
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      const familyMap = new Map<string, ProductHierarchyView>();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Only process products that are marked as family parents
        if (data.isFamilyParent) {
          const familyId = data.familyId || doc.id;
          familyMap.set(familyId, {
            family: {
              id: doc.id,
              familyId: familyId,
              familyName: data.familyName || data.productDescription || 'Unnamed Family',
              brand: data.brand || 'Kanva Botanicals',
              category: data.category || 'Other',
              productType: data.productType || '',
              description: data.description || '',
              notes: data.notes || '',
              images: data.images || [],
              mainImage: data.mainImage || data.imageUrl || '',
              isActive: data.isActive || false,
              showInQuoteTool: data.showInQuoteTool || false,
              quarterlyBonusEligible: data.quarterlyBonusEligible || false,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            },
            skus: []
          });
        }
      });
      
      // Now add SKUs to their families
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Skip family parent documents
        if (data.isFamilyParent) return;
        
        // Only add products that have a familyId
        if (data.familyId && familyMap.has(data.familyId)) {
          const hierarchy = familyMap.get(data.familyId)!;
          hierarchy.skus.push({
            id: doc.id,
            skuId: data.productNum || doc.id,
            familyId: data.familyId,
            skuName: data.productDescription || '',
            variantType: data.variantType || data.productType || '',
            size: data.size || '',
            uom: data.uom || '',
            skuImage: data.imageUrl || '',
            baseDistributionPrice: data.baseDistributionPrice,
            baseWholesalePrice: data.baseWholesalePrice,
            msrp: data.msrp,
            unitsPerCase: data.unitsPerCase || 1,
            displayBoxesPerCase: data.displayBoxesPerCase,
            unitsPerDisplayBox: data.unitsPerDisplayBox,
            casesPerPallet: data.casesPerPallet,
            upc: data.upc,
            masterCaseDimensions: data.masterCaseDimensions,
            displayBoxDimensions: data.displayBoxDimensions,
            isActive: data.isActive || false,
            showInQuoteTool: data.showInQuoteTool || false,
            quarterlyBonusEligible: data.quarterlyBonusEligible || false,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        }
      });
      
      const hierarchyArray = Array.from(familyMap.values());
      setHierarchies(hierarchyArray);
      
      const uniqueBrands = Array.from(new Set(hierarchyArray.map(h => h.family.brand)));
      const uniqueCategories = Array.from(new Set(hierarchyArray.map(h => h.family.category)));
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading hierarchies:', error);
      toast.error('Failed to load product hierarchies');
      setLoading(false);
    }
  }

  function toggleFamily(familyId: string) {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(familyId)) {
      newExpanded.delete(familyId);
    } else {
      newExpanded.add(familyId);
    }
    setExpandedFamilies(newExpanded);
  }

  async function handleDeleteFamily(hierarchy: ProductHierarchyView) {
    setDeletingFamily(hierarchy);
  }

  async function confirmDeleteFamily() {
    if (!deletingFamily) return;

    try {
      // 1. Remove familyId from all SKUs
      if (deletingFamily.skus.length > 0) {
        const updatePromises = deletingFamily.skus.map(sku => {
          const skuRef = doc(db, 'products', sku.id);
          return updateDoc(skuRef, {
            familyId: null,
            updatedAt: new Date().toISOString()
          });
        });
        await Promise.all(updatePromises);
      }

      // 2. Delete the family document
      const familyRef = doc(db, 'products', deletingFamily.family.id);
      await deleteDoc(familyRef);

      toast.success(`Deleted "${deletingFamily.family.familyName}" and disassociated ${deletingFamily.skus.length} SKU(s)`);
      
      setDeletingFamily(null);
      
      // Reload hierarchies
      await loadHierarchies();
    } catch (error) {
      console.error('Error deleting family:', error);
      toast.error('Failed to delete product family');
      setDeletingFamily(null);
    }
  }

  const filteredHierarchies = hierarchies.filter(h => {
    const matchesSearch = searchTerm === '' || 
      h.family.familyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.skus.some(sku => sku.skuId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBrand = selectedBrand === 'all' || h.family.brand === selectedBrand;
    const matchesCategory = selectedCategory === 'all' || h.family.category === selectedCategory;
    
    return matchesSearch && matchesBrand && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#93D500] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product hierarchies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product Hierarchy</h2>
          <p className="text-sm text-gray-500 mt-1">
            <strong>Brand</strong> → <strong>Product Family</strong> → <strong>SKU</strong>
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/product-hierarchy/create-family')}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Product Family
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product families or SKUs..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Brands</option>
          {brands.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
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

      {/* Hierarchy List */}
      <div className="space-y-2">
        {filteredHierarchies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No product hierarchies found</p>
          </div>
        ) : (
          filteredHierarchies.map(hierarchy => {
            const isExpanded = expandedFamilies.has(hierarchy.family.familyId);
            
            return (
              <div key={hierarchy.family.familyId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 p-4">
                    <button
                      onClick={() => toggleFamily(hierarchy.family.familyId)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    
                    {hierarchy.family.mainImage && (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={hierarchy.family.mainImage.startsWith('http') ? hierarchy.family.mainImage : `https://${hierarchy.family.mainImage.replace(/^https?:\/\//, '')}`}
                          alt={hierarchy.family.familyName}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => router.push(`/admin/product-hierarchy/family/${hierarchy.family.familyId}`)}
                          className="font-semibold text-gray-900 hover:text-primary-600 transition-colors text-left"
                        >
                          {hierarchy.family.familyName}
                        </button>
                        {!hierarchy.family.isActive && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{hierarchy.family.brand}</span>
                        <span>•</span>
                        <span>{hierarchy.family.category}</span>
                        <span>•</span>
                        <span className="font-medium">{hierarchy.skus.length} SKU{hierarchy.skus.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/product-hierarchy/create-sku?familyId=${hierarchy.family.familyId}`)}
                        className="btn btn-sm btn-secondary"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add SKU
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFamily(hierarchy);
                        }}
                        className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                        title="Delete family and disassociate SKUs"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-200">
                    {hierarchy.skus.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <p>No SKUs for this product family yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {hierarchy.skus.map(sku => (
                          <div key={sku.id} className="flex items-center gap-4 p-4 pl-16 hover:bg-gray-100 transition-colors">
                            {sku.skuImage && (
                              <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                <img
                                  src={sku.skuImage.startsWith('http') ? sku.skuImage : `https://${sku.skuImage.replace(/^https?:\/\//, '')}`}
                                  alt={sku.skuName}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-medium text-gray-900">{sku.skuId}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <span>{sku.variantType}</span>
                                {sku.size && (
                                  <>
                                    <span>•</span>
                                    <span>{sku.size}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => router.push(`/admin/products/${sku.id}`)}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingFamily && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Product Family?
            </h3>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <strong>{deletingFamily.family.familyName}</strong>?
            </p>
            {deletingFamily.skus.length > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                This will disassociate {deletingFamily.skus.length} SKU(s) from this family. 
                The SKUs will not be deleted, just unlinked.
              </p>
            )}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeletingFamily(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmDeleteFamily}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
