'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface SpiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSpiff: any | null;
  allProducts: any[];
  onSaved: () => void;
}

export default function SpiffModal({
  isOpen,
  onClose,
  editingSpiff,
  allProducts,
  onSaved
}: SpiffModalProps) {
  const [selectedSpiffProducts, setSelectedSpiffProducts] = useState<string[]>(
    editingSpiff?.productNum ? [editingSpiff.productNum] : []
  );

  if (!isOpen) return null;

  const handleSaveSpiff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (selectedSpiffProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    const loadingToast = toast.loading(editingSpiff ? 'Updating spiff...' : 'Creating spiff(s)...');

    try {
      const spiffData = {
        name: formData.get('name') as string,
        incentiveType: formData.get('incentiveType') as string,
        incentiveValue: parseFloat(formData.get('incentiveValue') as string),
        startDate: formData.get('startDate') as string,
        endDate: (formData.get('endDate') as string) || null,
        isActive: formData.get('isActive') === 'on',
        notes: formData.get('notes') as string || '',
        updatedAt: new Date().toISOString(),
      };

      if (editingSpiff) {
        // Update existing spiff
        await updateDoc(doc(db, 'spiffs', editingSpiff.id), {
          ...spiffData,
          productNum: selectedSpiffProducts[0], // Only one product when editing
        });
        toast.success('Spiff updated!', { id: loadingToast });
      } else {
        // Create new spiff(s) - one per selected product
        for (const productNum of selectedSpiffProducts) {
          await addDoc(collection(db, 'spiffs'), {
            ...spiffData,
            productNum,
            createdAt: new Date().toISOString(),
          });
        }
        toast.success(`Created ${selectedSpiffProducts.length} spiff(s)!`, { id: loadingToast });
      }

      setSelectedSpiffProducts([]);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving spiff:', error);
      toast.error('Failed to save spiff', { id: loadingToast });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingSpiff ? 'Edit Spiff/Kicker' : 'Add New Spiff/Kicker'}
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

          <form onSubmit={handleSaveSpiff} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spiff Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingSpiff?.name || ''}
                  required
                  className="input w-full"
                  placeholder="Q4 2025 Acrylic Kit Promotion"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Products * {editingSpiff ? '(Single product when editing)' : '(Select multiple products)'}
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-64 overflow-y-auto bg-white">
                  {allProducts
                    .filter(p => p.isActive)
                    .sort((a, b) => a.productNum.localeCompare(b.productNum))
                    .map(product => (
                      <label key={product.id} className="flex items-center py-2 hover:bg-gray-50 px-2 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSpiffProducts.includes(product.productNum)}
                          onChange={(e) => {
                            if (editingSpiff) {
                              setSelectedSpiffProducts([product.productNum]);
                            } else {
                              if (e.target.checked) {
                                setSelectedSpiffProducts([...selectedSpiffProducts, product.productNum]);
                              } else {
                                setSelectedSpiffProducts(selectedSpiffProducts.filter(p => p !== product.productNum));
                              }
                            }
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          disabled={editingSpiff && selectedSpiffProducts.length > 0 && !selectedSpiffProducts.includes(product.productNum)}
                        />
                        <span className="ml-3 text-sm">
                          <span className="font-mono font-semibold">{product.productNum}</span>
                          {' - '}
                          <span className="text-gray-600">{product.productDescription}</span>
                        </span>
                      </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {editingSpiff 
                    ? 'When editing, you can only change to a different single product.'
                    : `Selected: ${selectedSpiffProducts.length} product(s). One spiff will be created per product with the same settings.`
                  }
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Incentive Type *
                  </label>
                  <select
                    name="incentiveType"
                    defaultValue={editingSpiff?.incentiveType || 'flat'}
                    required
                    className="input w-full"
                  >
                    <option value="flat">Flat Dollar Amount</option>
                    <option value="percentage">Percentage of Revenue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Incentive Value *
                  </label>
                  <input
                    type="number"
                    name="incentiveValue"
                    defaultValue={editingSpiff?.incentiveValue || ''}
                    required
                    step="0.01"
                    min="0"
                    className="input w-full"
                    placeholder="16.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter dollar amount (e.g., 16.00) or percentage (e.g., 5.0)
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={editingSpiff?.startDate || ''}
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={editingSpiff?.endDate || ''}
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank for ongoing incentive
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  id="spiffIsActive"
                  defaultChecked={editingSpiff?.isActive !== false}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="spiffIsActive" className="ml-2 block text-sm text-gray-900">
                  Active (spiff is currently in effect)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  defaultValue={editingSpiff?.notes || ''}
                  rows={3}
                  className="input w-full"
                  placeholder="Additional details about this spiff/kicker..."
                />
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
                {editingSpiff ? 'Update Spiff' : 'Add Spiff'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
