import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

interface CustomerUpdate {
  id: string;
  customerNum: string;
  customerName: string;
  accountNumber: string;
  salesPerson: string;
  accountType: string;
  transferStatus: string;
  originalOwner: string;
  copperId: string;
  isNew: boolean;
}

/**
 * Commit CSV bulk import changes to Firestore
 * POST /api/customers/bulk-import-commit
 * 
 * Applies the approved changes from CSV to the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    console.log(`Committing ${updates.length} customer updates...`);

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process updates in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = adminDb.batch();
      const batchUpdates = updates.slice(i, i + batchSize);

      for (const update of batchUpdates) {
        try {
          const customerData: any = {
            customerNum: update.customerNum,
            customerName: update.customerName,
            accountNumber: update.accountNumber,
            salesPerson: update.salesPerson,
            accountType: update.accountType,
            updatedAt: Timestamp.now(),
            manuallyEdited: true,
            lastManualEdit: Timestamp.now(),
            editSource: 'csv_bulk_import'
          };
          
          // Optional fields (only if not empty/undefined)
          if (update.transferStatus && update.transferStatus !== 'undefined' && update.transferStatus !== '') {
            customerData.transferStatus = update.transferStatus;
          }
          if (update.originalOwner && update.originalOwner !== 'undefined' && update.originalOwner !== '') {
            customerData.originalOwner = update.originalOwner;
          }
          // copperId is read-only from Copper sync

          if (update.isNew) {
            // Create new customer
            const newRef = adminDb.collection('fishbowl_customers').doc();
            batch.set(newRef, {
              id: newRef.id,
              ...customerData,
              createdAt: Timestamp.now()
            });
            created++;
          } else if (update.id) {
            // Update existing customer
            const docRef = adminDb.collection('fishbowl_customers').doc(update.id);
            batch.update(docRef, customerData);
            updated++;
          }
        } catch (error: any) {
          errors.push(`Customer ${update.customerNum}: ${error.message}`);
        }
      }

      await batch.commit();
      console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
    }

    console.log(`✅ Bulk import complete: ${created} created, ${updated} updated`);

    return NextResponse.json({
      success: true,
      stats: {
        created,
        updated,
        errors: errors.length
      },
      errors
    });

  } catch (error: any) {
    console.error('Error committing CSV import:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to commit import' },
      { status: 500 }
    );
  }
}
