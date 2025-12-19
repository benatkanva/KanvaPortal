import { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductThumbnailProps {
  imageUrl: string | null;
  productName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showHoverPreview?: boolean;
  className?: string;
}

/**
 * Product thumbnail component with optional hover preview
 * Shows placeholder icon if no image available
 */
export function ProductThumbnail({ 
  imageUrl, 
  productName, 
  size = 'sm',
  showHoverPreview = true,
  className = '',
}: ProductThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  const previewSizeClasses = {
    xs: 'w-40 h-40',
    sm: 'w-48 h-48',
    md: 'w-64 h-64',
    lg: 'w-80 h-80',
  };

  // Show placeholder if no image or error loading
  if (!imageUrl || imageError) {
    return (
      <div 
        className={`${sizeClasses[size]} flex items-center justify-center bg-gray-100 rounded border border-gray-200 ${className}`}
        title={productName}
      >
        <Package className={`${iconSizeClasses[size]} text-gray-400`} />
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <img
        src={imageUrl}
        alt={productName}
        className={`${sizeClasses[size]} object-cover rounded border border-gray-200 ${
          showHoverPreview ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : ''
        } transition-all ${className}`}
        onError={() => setImageError(true)}
        onMouseEnter={() => showHoverPreview && setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        title={productName}
        loading="lazy"
      />
      
      {/* Hover Preview - positioned to the right */}
      {showPreview && showHoverPreview && (
        <div className="fixed z-[9999] bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-3 pointer-events-none"
          style={{
            left: 'calc(var(--mouse-x, 50%) + 20px)',
            top: 'calc(var(--mouse-y, 50%) - 120px)',
          }}
        >
          <img
            src={imageUrl}
            alt={productName}
            className={`${previewSizeClasses[size]} object-contain rounded`}
          />
          <p className="mt-2 text-xs text-gray-700 text-center max-w-xs font-medium">
            {productName}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Simplified version without hover preview for table cells
 */
export function ProductThumbnailSimple({ 
  imageUrl, 
  productName, 
  size = 'sm',
}: Pick<ProductThumbnailProps, 'imageUrl' | 'productName' | 'size'>) {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (!imageUrl || imageError) {
    return (
      <div 
        className={`${sizeClasses[size]} flex items-center justify-center bg-gray-100 rounded border border-gray-200`}
        title={productName}
      >
        <Package className={`${iconSizeClasses[size]} text-gray-400`} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={productName}
      className={`${sizeClasses[size]} object-cover rounded border border-gray-200`}
      onError={() => setImageError(true)}
      title={productName}
      loading="lazy"
    />
  );
}
