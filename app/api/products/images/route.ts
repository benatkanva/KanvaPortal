import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get product images from Firestore
 * Returns a mapping of productNum -> imageUrl
 */
export async function GET(request: NextRequest) {
  try {
    const productsSnapshot = await adminDb.collection('products').get();
    
    const productImages: Record<string, string> = {};
    
    productsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.productNum && data.imageUrl) {
        productImages[data.productNum] = data.imageUrl;
      }
      // Also map by product name for flexibility
      if (data.productDescription && data.imageUrl) {
        productImages[data.productDescription] = data.imageUrl;
      }
    });
    
    return NextResponse.json({
      success: true,
      images: productImages,
      count: Object.keys(productImages).length
    });
  } catch (error: any) {
    console.error('Error fetching product images:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch product images' },
      { status: 500 }
    );
  }
}
