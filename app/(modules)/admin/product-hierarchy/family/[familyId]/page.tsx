'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Package } from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ProductFamily {
  id: string;
  familyId: string;
  familyName: string;
  brand: string;
  category: string;
  productType: string;
  description: string;
  notes: string;
  images: string[];
  mainImage: string;
  isActive: boolean;
  showInQuoteTool: boolean;
  quarterlyBonusEligible: boolean;
}

interface SKU {
  id: string;
  productNum: string;
  productDescription: string;
  variantType: string;
  size: string;
  uom: string;
  imageUrl: string;
  baseDistributionPrice?: number;
  baseWholesalePrice?: number;
  msrp?: number;
  familyId: string;
}

export default function FamilyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = params.familyId as string;
  
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<ProductFamily | null>(null);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [deletingSKU, setDeletingSKU] = useState<SKU | null>(null);

  useEffect(() => {
    loadFamilyData();
  }, [familyId]);

  async function loadFamilyData() {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      let foundFamily: ProductFamily | null = null;
      const foundSKUs: SKU[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Find the family
        if (data.isFamilyParent && data.familyId === familyId) {
          foundFamily = {
            id: doc.id,
            familyId: data.familyId,
            familyName: data.familyName || data.productDescription,
            brand: data.brand || 'Kanva Botanicals',
            category: data.category || '',
            productType: data.productType || '',
            description: data.description || '',
            notes: data.notes || '',
            images: data.images || [],
            mainImage: data.mainImage || data.imageUrl || '',
            isActive: data.isActive || false,
            showInQuoteTool: data.showInQuoteTool || false,
            quarterlyBonusEligible: data.quarterlyBonusEligible || false,
          };
        }
        
        // Find SKUs with this familyId
        if (!data.isFamilyParent && data.familyId === familyId) {
          foundSKUs.push({
            id: doc.id,
            productNum: data.productNum || '',
            productDescription: data.productDescription || '',
            variantType: data.variantType || data.productType || '',
            size: data.size || '',
            uom: data.uom || '',
            imageUrl: data.imageUrl || '',
            baseDistributionPrice: data.baseDistributionPrice,
            baseWholesalePrice: data.baseWholesalePrice,
            msrp: data.msrp,
            familyId: data.familyId,
          });
        }
      });
      
      if (!foundFamily) {
        toast.error('Product family not found');
        router.push('/admin/products');
        return;
      }
      
      setFamily(foundFamily);
      setSkus(foundSKUs);
    } catch (error) {
      console.error('Error loading family:', error);
      toast.error('Failed to load product family');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveSKU(sku: SKU) {
    setDeletingSKU(sku);
  }

  async function confirmRemoveSKU() {
    if (!deletingSKU) return;

    try {
      const skuRef = doc(db, 'products', deletingSKU.id);
      await updateDoc(skuRef, {
        familyId: null,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Removed ${deletingSKU.productNum} from family`);
      setDeletingSKU(null);
      await loadFamilyData();
    } catch (error) {
      console.error('Error removing SKU:', error);
      toast.error('Failed to remove SKU from family');
      setDeletingSKU(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading family...</p>
        </div>
      </div>
    );
  }

  if (!family) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <AdminBreadcrumbs
          currentPage={family.familyName}
          parentPage={{ name: 'Product Hierarchy', path: '/admin/products' }}
        />

        {/* Family Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-6">
            {family.mainImage && (
              <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={family.mainImage}
                  alt={family.familyName}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{family.familyName}</h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium">{family.brand}</span>
                    <span>•</span>
                    <span>{family.category}</span>
                    {family.productType && (
                      <>
                        <span>•</span>
                        <span>{family.productType}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/admin/product-hierarchy/edit-family/${familyId}`)}
                    className="btn btn-primary"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Family
                  </button>
                  <button
                    onClick={() => router.push('/admin/products')}
                    className="btn btn-secondary"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Hierarchy
                  </button>
                </div>
              </div>
              
              {family.description && (
                <p className="text-gray-700 mb-4">{family.description}</p>
              )}
              
              {family.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">{family.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SKUs Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">SKUs</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {skus.length} SKU{skus.length !== 1 ? 's' : ''} in this family
                </p>
              </div>
              <button
                onClick={() => router.push(`/admin/product-hierarchy/create-sku?familyId=${familyId}`)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add SKUs
              </button>
            </div>
          </div>

          {skus.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No SKUs yet</p>
              <p className="text-sm mb-4">Add products to this family to get started</p>
              <button
                onClick={() => router.push(`/admin/product-hierarchy/create-sku?familyId=${familyId}`)}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First SKU
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product #</th>
                    <th>Description</th>
                    <th>Variant</th>
                    <th>Size</th>
                    <th>Distribution</th>
                    <th>Wholesale</th>
                    <th>MSRP</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skus.map((sku) => (
                    <tr key={sku.id}>
                      <td>
                        {sku.imageUrl ? (
                          <img
                            src={sku.imageUrl}
                            alt={sku.productDescription}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="font-mono font-semibold">{sku.productNum}</td>
                      <td className="max-w-xs truncate">{sku.productDescription}</td>
                      <td>{sku.variantType || 'N/A'}</td>
                      <td>{sku.size ? `${sku.size} ${sku.uom}` : 'N/A'}</td>
                      <td>{sku.baseDistributionPrice ? `$${sku.baseDistributionPrice.toFixed(2)}` : 'N/A'}</td>
                      <td>{sku.baseWholesalePrice ? `$${sku.baseWholesalePrice.toFixed(2)}` : 'N/A'}</td>
                      <td>{sku.msrp ? `$${sku.msrp.toFixed(2)}` : 'N/A'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/products/${sku.id}`)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit SKU"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveSKU(sku)}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            title="Remove from family"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Remove SKU Confirmation Modal */}
      {deletingSKU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Remove SKU from Family?
            </h3>
            <p className="text-gray-600 mb-2">
              Remove <strong>{deletingSKU.productNum}</strong> from this family?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              The SKU will not be deleted, just unlinked from this family.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeletingSKU(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmRemoveSKU}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
