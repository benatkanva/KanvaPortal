'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Upload, X, Image as ImageIcon, Star } from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { db, storage } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

export default function CreateFamilyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    familyId: '',
    familyName: '',
    brand: 'Kanva Botanicals',
    category: '',
    productType: '',
    description: '',
    notes: '',
    isActive: true,
    showInQuoteTool: false,
    quarterlyBonusEligible: false,
  });
  
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate familyId from familyName
    if (field === 'familyName') {
      const familyId = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setFormData(prev => ({ ...prev, familyId }));
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImageUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        // Upload to Firebase Storage
        const timestamp = Date.now();
        const fileName = `family_${formData.familyId || 'temp'}_${timestamp}_${i}.${file.name.split('.').pop()}`;
        const storageRef = ref(storage, `product-images/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        newImageUrls.push(downloadUrl);
      }

      setImages(prev => [...prev, ...newImageUrls]);
      toast.success(`${newImageUrls.length} image(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (mainImageIndex >= images.length - 1) {
      setMainImageIndex(Math.max(0, images.length - 2));
    }
  };

  const setAsMainImage = (index: number) => {
    setMainImageIndex(index);
    toast.success('Main image updated');
  };

  const handleSave = async () => {
    // Validation
    if (!formData.familyName.trim()) {
      toast.error('Product family name is required');
      return;
    }
    if (!formData.brand.trim()) {
      toast.error('Brand is required');
      return;
    }
    if (!formData.category.trim()) {
      toast.error('Category is required');
      return;
    }
    if (images.length === 0) {
      toast.error('At least one image is required');
      return;
    }

    setSaving(true);
    try {
      // Create a new product family document in the products collection
      // This is a "parent" product that represents the family
      const familyData = {
        // Product Family specific fields
        familyId: formData.familyId,
        familyName: formData.familyName,
        isFamilyParent: true, // Flag to identify this as a product family parent
        
        // Standard product fields (for compatibility with existing app)
        productNum: formData.familyId, // Use familyId as product number for family
        productDescription: formData.familyName,
        brand: formData.brand,
        category: formData.category,
        productType: formData.productType,
        description: formData.description,
        notes: formData.notes,
        
        // Images
        images: images,
        mainImage: images[mainImageIndex],
        imageUrl: images[mainImageIndex], // For backward compatibility
        
        // Status flags
        isActive: formData.isActive,
        showInQuoteTool: formData.showInQuoteTool,
        quarterlyBonusEligible: formData.quarterlyBonusEligible,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to Firestore products collection (NOT product_families)
      const productsRef = collection(db, 'products');
      const docRef = await addDoc(productsRef, familyData);

      toast.success('Product family created successfully!');
      router.push(`/admin/product-hierarchy/family/${formData.familyId}`);
    } catch (error) {
      console.error('Error saving style:', error);
      toast.error('Failed to save product family');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <AdminBreadcrumbs
          currentPage="Create Product Family"
          parentPage={{ name: 'Product Hierarchy', path: '/admin/products' }}
        />

        <button
          onClick={() => router.push('/admin/products')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Product Hierarchy
        </button>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-[#93D500]" />
              <h1 className="text-2xl font-bold text-gray-900">Create New Product Family</h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Product Family
                </>
              )}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What is a Product Family?</h3>
            <p className="text-sm text-blue-800">
              A <strong>Product Family</strong> is the parent level in your product hierarchy (Brand → Product Family → SKU). 
              It contains all shared images and information that apply to all SKUs under this product family.
              After creating the product family, you&apos;ll add individual SKUs (Master Case, Box, Unit, etc.).
            </p>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Family Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.familyName}
                    onChange={(e) => handleInputChange('familyName', e.target.value)}
                    placeholder="e.g., Focus + Flow"
                    className="input w-full"
                  />
                  {formData.familyId && (
                    <p className="text-xs text-gray-500 mt-1">Family ID: {formData.familyId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="e.g., Kanva Botanicals"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select Category</option>
                    <option value="RAW">RAW</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Edible">Edible</option>
                    <option value="Topical">Topical</option>
                    <option value="Tincture">Tincture</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={formData.productType}
                    onChange={(e) => handleInputChange('productType', e.target.value)}
                    placeholder="e.g., Hemp Flower"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe this product style..."
                rows={3}
                className="input w-full"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Internal notes (not visible to customers)..."
                rows={2}
                className="input w-full"
              />
            </div>

            {/* Images */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Product Family Images <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload all images for this product family. These images will be shared across all SKUs. 
                You can also add SKU-specific images later.
              </p>

              {/* Image Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop images here, or click to select
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="btn btn-secondary cursor-pointer inline-flex"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Images
                </label>
              </div>

              {/* Image Preview Grid */}
              {images.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Uploaded Images ({images.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((url, index) => (
                      <div
                        key={index}
                        className={`relative group border-2 rounded-lg overflow-hidden ${
                          index === mainImageIndex ? 'border-primary-500' : 'border-gray-200'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Product family image ${index + 1}`}
                          className="w-full h-32 object-contain bg-gray-50"
                        />
                        
                        {/* Main Image Badge */}
                        {index === mainImageIndex && (
                          <div className="absolute top-2 left-2 bg-primary-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Main
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          {index !== mainImageIndex && (
                            <button
                              onClick={() => setAsMainImage(index)}
                              className="bg-white text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100"
                            >
                              Set as Main
                            </button>
                          )}
                          <button
                            onClick={() => removeImage(index)}
                            className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showInQuoteTool}
                    onChange={(e) => handleInputChange('showInQuoteTool', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text">Show in Quote Tool</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.quarterlyBonusEligible}
                    onChange={(e) => handleInputChange('quarterlyBonusEligible', e.target.checked)}
                    className="checkbox checkbox-primary"
                  />
                  <span className="label-text">Quarterly Bonus Eligible</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
