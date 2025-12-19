import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

/**
 * Upload product image to Firebase Storage
 * Stores in product-images/ folder with product number as filename
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const productId = formData.get('productId') as string;
    const productNum = formData.get('productNum') as string;

    if (!file || !productId || !productNum) {
      return NextResponse.json(
        { error: 'Missing required fields: file, productId, productNum' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExt = file.name.split('.').pop() || 'jpg';
    
    // Create filename: productNum.ext (e.g., KB-038.jpg)
    const fileName = `${productNum}.${fileExt}`;
    const filePath = `product-images/${fileName}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Firebase Storage
    // Explicitly specify bucket name to avoid initialization issues
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucket = adminStorage.bucket(bucketName);
    const fileRef = bucket.file(filePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          productId: productId,
          productNum: productNum,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          fileSize: file.size.toString(),
        },
      },
      // Note: No ACL settings - bucket uses uniform bucket-level access (IAM only)
    });

    // Get public URL (Firebase Storage format for publicly accessible files)
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;

    console.log(`✅ Image uploaded to Storage: ${filePath}`);
    console.log(`📸 Public URL: ${publicUrl}`);
    console.log(`📝 Updating Firestore product doc: ${productId}`);

    // Update product document with image info
    const updateData = {
      imageUrl: publicUrl,
      imagePath: filePath,
      imageMetadata: {
        fileName: fileName,
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('products').doc(productId).update(updateData);
    
    console.log(`✅ Firestore updated successfully for product ${productId}`);
    console.log(`🎯 Image should now be visible at: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imagePath: filePath,
    });
  } catch (error: any) {
    console.error('Error uploading product image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

/**
 * Delete product image from Firebase Storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const imagePath = searchParams.get('imagePath');

    if (!productId || !imagePath) {
      return NextResponse.json(
        { error: 'Missing required parameters: productId, imagePath' },
        { status: 400 }
      );
    }

    // Delete from Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucket = adminStorage.bucket(bucketName);
    const fileRef = bucket.file(imagePath);
    
    try {
      await fileRef.delete();
    } catch (error: any) {
      // File might not exist, continue anyway
      console.warn('File not found in storage:', imagePath);
    }

    // Update product document
    await adminDb.collection('products').doc(productId).update({
      imageUrl: null,
      imagePath: null,
      imageMetadata: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting product image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete image' },
      { status: 500 }
    );
  }
}
