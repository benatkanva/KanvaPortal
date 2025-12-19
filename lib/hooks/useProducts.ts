import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface Product {
  id: string;
  partNumber: string;
  productDescription: string;
  imageUrl: string | null;
  imagePath: string | null;
  category1?: string;
  category2?: string;
  isActive: boolean;
  rawMaterial?: string;
  packType?: string;
  packSize?: string;
  quarterlyBonusEligible?: boolean;
}

/**
 * Hook to load and cache product data including images
 * Returns a Map keyed by partNumber for O(1) lookup
 */
export function useProducts() {
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading products from Firestore...');
      const productsSnap = await getDocs(collection(db, 'products'));
      console.log(`📦 Firestore returned ${productsSnap.size} documents`);
      
      const productsMap = new Map<string, Product>();
      
      productsSnap.forEach(doc => {
        const data = doc.data();
        
        // Use productNum (actual field name) not partNumber
        const productNum = data.productNum || data.partNumber;
        
        // Debug: Log if productNum is missing or duplicate
        if (!productNum) {
          console.warn(`⚠️ Product ${doc.id} has no productNum/partNumber, skipping`);
          return;
        }
        
        if (productsMap.has(productNum)) {
          console.warn(`⚠️ Duplicate productNum detected: ${productNum}`);
        }
        
        productsMap.set(productNum, {
          id: doc.id,
          partNumber: productNum, // Use productNum for consistency
          productDescription: data.productDescription,
          imageUrl: data.imageUrl || null,
          imagePath: data.imagePath || null,
          category1: data.category1,
          category2: data.category2,
          isActive: data.isActive ?? true,
          rawMaterial: data.rawMaterial,
          packType: data.packType,
          packSize: data.packSize,
          quarterlyBonusEligible: data.quarterlyBonusEligible ?? false,
        });
      });
      
      const withImages = Array.from(productsMap.values()).filter(p => p.imageUrl).length;
      console.log(`✅ Loaded ${productsMap.size} products (${withImages} with images)`);
      console.log(`📊 Sample products:`, Array.from(productsMap.keys()).slice(0, 5));
      
      setProducts(productsMap);
    } catch (err: any) {
      console.error('❌ Error loading products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  return { 
    products, 
    loading, 
    error,
    reload: loadProducts,
    getProduct: (partNumber: string) => products.get(partNumber),
  };
}
