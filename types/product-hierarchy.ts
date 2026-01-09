/**
 * Product Hierarchy Types
 * Structure: Brand > Product Family > SKU
 */

export interface ProductFamily {
  id: string;
  familyId: string; // Unique identifier for the product family
  familyName: string; // e.g., "Focus + Flow"
  brand: string; // e.g., "Kanva Botanicals"
  category: string;
  productType: string;
  
  // Shared information for all SKUs under this product family
  description: string;
  notes?: string;
  
  // Shared images for the product family (all SKUs inherit these)
  images: string[]; // Array of Firebase Storage URLs
  mainImage: string; // Primary image URL
  
  // Metadata
  isActive: boolean;
  showInQuoteTool: boolean;
  quarterlyBonusEligible: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface ProductSKU {
  id: string;
  skuId: string; // Product number/SKU (e.g., "KB-2000")
  familyId: string; // Reference to parent product family
  
  // SKU-specific information
  skuName: string; // e.g., "Master Case MC12", "Box", "Unit"
  variantType: string; // e.g., "Master Case", "Box", "Unit"
  size: string; // e.g., "MC12", "12pk", "1pk"
  uom: string; // Unit of measure
  
  // SKU-specific image (optional - if not set, uses parent product family images)
  skuImage?: string; // Single image specific to this SKU
  
  // Pricing and inventory
  baseDistributionPrice?: number;
  baseWholesalePrice?: number;
  msrp?: number;
  
  // Unit configuration
  unitsPerCase: number;
  displayBoxesPerCase?: number;
  unitsPerDisplayBox?: number;
  casesPerPallet?: number;
  
  // UPC codes
  upc?: string;
  
  // Dimensions
  masterCaseDimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  displayBoxDimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  
  // Status
  isActive: boolean;
  showInQuoteTool: boolean;
  quarterlyBonusEligible: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface ProductHierarchyView {
  family: ProductFamily;
  skus: ProductSKU[];
}
