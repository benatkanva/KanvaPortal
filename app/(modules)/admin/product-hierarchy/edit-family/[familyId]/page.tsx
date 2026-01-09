'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Upload, X, Image as ImageIcon, Star } from 'lucide-react';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { db, storage } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

export default function EditFamilyPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = params.familyId as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [familyDocId, setFamilyDocId] = useState('');
  
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

  useEffect(() => {
    loadFamilyData();
  }, [familyId]);

  async function loadFamilyData() {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      
      let found = false;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isFamilyParent && data.familyId === familyId) {
          found = true;
          setFamilyDocId(doc.id);
          setFormData({
            familyId: data.familyId || '',
            familyName: data.familyName || '',
            brand: data.brand || 'Kanva Botanicals',
            category: data.category || '',
            productType: data.productType || '',
            description: data.description || '',
            notes: data.notes || '',
            isActive: data.isActive ?? true,
            showInQuoteTool: data.showInQuoteTool ?? false,
            quarterlyBonusEligible: data.quarterlyBonusEligible ?? false,
          });
          setImages(data.images || []);
          const mainIdx = data.images?.indexOf(data.mainImage) ?? 0;
          setMainImageIndex(mainIdx >= 0 ? mainIdx : 0);
        }
      });
      
      if (!found) {
        toast.error('Product family not found');
        router.push('/admin/products');
      }
    } catch (error) {
      console.error('Error loading family:', error);
      toast.error('Failed to load product family');
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImageUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

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
      const familyData = {
        familyName: formData.familyName,
        brand: formData.brand,
        category: formData.category,
        productType: formData.productType,
        description: formData.description,
        notes: formData.notes,
        images: images,
        mainImage: images[mainImageIndex],
        imageUrl: images[mainImageIndex],
        isActive: formData.isActive,
        showInQuoteTool: formData.showInQuoteTool,
        quarterlyBonusEligible: formData.quarterlyBonusEligible,
        updatedAt: new Date().toISOString(),
      };

      const familyRef = doc(db, 'products', familyDocId);
      await updateDoc(familyRef, familyData);

      toast.success('Product family updated successfully!');
      router.push(`/admin/product-hierarchy/family/${formData.familyId}`);
    } catch (error) {
      console.error('Error updating family:', error);
      toast.error('Failed to update product family');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <AdminBreadcrumbs
          currentPage="Edit Product Family"
          parentPage={{ name: formData.familyName, path: `/admin/product-hierarchy/family/${familyId}` }}
        />

        <button
          onClick={() => router.push(`/admin/product-hierarchy/family/${familyId}`)}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Family Detail
        </button>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-[#93D500]" />
              <h1 className="text-2xl font-bold text-gray-900">Edit Product Family</h1>
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
                  Save Changes
                </>
              )}
            </button>
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
                  <p className="text-xs text-gray-500 mt-1">Family ID: {formData.familyId}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
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
                    <option value="Beverage">Beverage</option>
                    <option value="Edible">Edible</option>
                    <option value="Powder">Powder</option>
                    <option value="Capsules">Capsules</option>
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
                    placeholder="e.g., Tonic, Shot, etc."
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
                rows={4}
                className="input w-full"
                placeholder="Describe this product family..."
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
                rows={3}
                className="input w-full"
                placeholder="Internal notes (not visible to customers)..."
              />
            </div>

            {/* Images */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h2>
              
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop images here, or click to select files
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="btn btn-secondary cursor-pointer">
                  {uploading ? 'Uploading...' : 'Choose Files'}
                </label>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Product ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        {mainImageIndex === index ? (
                          <div className="bg-yellow-500 text-white p-1 rounded-full">
                            <Star className="w-4 h-4 fill-current" />
                          </div>
                        ) : (
                          <button
                            onClick={() => setAsMainImage(index)}
                            className="bg-white hover:bg-yellow-500 hover:text-white p-1 rounded-full shadow-sm transition-colors"
                            title="Set as main image"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(index)}
                          className="bg-white hover:bg-red-500 hover:text-white p-1 rounded-full shadow-sm transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Flags */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status & Visibility</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700">Active (visible in system)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showInQuoteTool}
                    onChange={(e) => handleInputChange('showInQuoteTool', e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700">Show in Quote Tool</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.quarterlyBonusEligible}
                    onChange={(e) => handleInputChange('quarterlyBonusEligible', e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-700">Quarterly Bonus Eligible</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
