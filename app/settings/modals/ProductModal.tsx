'use client';

import { db } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: any | null;
  onSaved: () => void;
}

export default function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  onSaved
}: ProductModalProps) {
  if (!isOpen) return null;

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData = {
      productNum: formData.get('productNum') as string,
      productDescription: formData.get('productDescription') as string,
      category: formData.get('category') as string || '',
      productType: formData.get('productType') as string || '',
      size: formData.get('size') as string || '',
      uom: formData.get('uom') as string || '',
      notes: formData.get('notes') as string || '',
      isActive: formData.get('isActive') === 'on',
      quarterlyBonusEligible: formData.get('quarterlyBonusEligible') === 'on',
      updatedAt: new Date().toISOString(),
    };

    const loadingToast = toast.loading(editingProduct ? 'Updating product...' : 'Adding product...');

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success('Product updated!', { id: loadingToast });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Product added!', { id: loadingToast });
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product', { id: loadingToast });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Number *
                </label>
                <input
                  type="text"
                  name="productNum"
                  defaultValue={editingProduct?.productNum || ''}
                  required
                  className="input w-full"
                  placeholder="KB-038"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Description *
                </label>
                <input
                  type="text"
                  name="productDescription"
                  defaultValue={editingProduct?.productDescription || ''}
                  required
                  className="input w-full"
                  placeholder="Acrylic Kit - Black"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  name="category"
                  defaultValue={editingProduct?.category || ''}
                  className="input w-full"
                  placeholder="Kit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Type
                </label>
                <input
                  type="text"
                  name="productType"
                  defaultValue={editingProduct?.productType || ''}
                  className="input w-full"
                  placeholder="Acrylic"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size
                </label>
                <input
                  type="text"
                  name="size"
                  defaultValue={editingProduct?.size || ''}
                  className="input w-full"
                  placeholder="Mixed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit of Measure (UOM)
                </label>
                <input
                  type="text"
                  name="uom"
                  defaultValue={editingProduct?.uom || ''}
                  className="input w-full"
                  placeholder="EA, CS, KT"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                defaultValue={editingProduct?.notes || ''}
                rows={3}
                className="input w-full"
                placeholder="Additional product details..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  id="productIsActive"
                  defaultChecked={editingProduct?.isActive !== false}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="productIsActive" className="ml-2 block text-sm text-gray-900">
                  Active (product is available)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="quarterlyBonusEligible"
                  id="quarterlyBonusEligible"
                  defaultChecked={editingProduct?.quarterlyBonusEligible === true}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="quarterlyBonusEligible" className="ml-2 block text-sm text-gray-900">
                  Eligible for Quarterly Bonus
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
