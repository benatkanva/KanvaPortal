import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * Save Fishbowl Import Log
 * 
 * Records each import with:
 * - Stats (rows processed, orders/items created/updated)
 * - Date range (earliest → latest order date)
 * - File metadata (name, size)
 * - Performance metrics (duration, writes/sec)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      stats,
      filename,
      fileSizeMB,
      startTime,
      endTime,
      dateRange,
    } = body;

    const duration = endTime ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 : null;
    const rowsPerSecond = duration ? Math.floor(stats.processed / duration) : null;

    // Create log document
    const logRef = adminDb.collection('fishbowl_import_logs').doc();
    
    const logData = {
      id: logRef.id,
      timestamp: Timestamp.now(),
      filename: filename || 'unknown',
      fileSizeMB: fileSizeMB || 0,
      
      // Stats
      stats: {
        rowsProcessed: stats.processed || 0,
        customersCreated: stats.customersCreated || 0,
        customersNotFound: stats.customersNotFound || 0,
        
        ordersCreated: stats.ordersCreated || 0,
        ordersUpdated: stats.ordersUpdated || 0,
        ordersUnchanged: stats.ordersUnchanged || 0,
        ordersTotal: (stats.ordersCreated || 0) + (stats.ordersUpdated || 0) + (stats.ordersUnchanged || 0),
        
        itemsCreated: stats.itemsCreated || 0,
        itemsUpdated: stats.itemsUpdated || 0,
        itemsUnchanged: stats.itemsUnchanged || 0,
        itemsTotal: (stats.itemsCreated || 0) + (stats.itemsUpdated || 0) + (stats.itemsUnchanged || 0),
        
        skipped: stats.skipped || 0,
      },
      
      // Date range from imported orders
      dateRange: dateRange || null,
      
      // Performance
      performance: {
        durationSeconds: duration,
        rowsPerSecond,
        startTime: startTime ? Timestamp.fromDate(new Date(startTime)) : null,
        endTime: endTime ? Timestamp.fromDate(new Date(endTime)) : null,
      },
      
      // Firestore efficiency
      firestoreWrites: (stats.ordersCreated || 0) + (stats.ordersUpdated || 0) + (stats.itemsCreated || 0) + (stats.itemsUpdated || 0) + (stats.customersCreated || 0),
      firestoreSkipped: (stats.ordersUnchanged || 0) + (stats.itemsUnchanged || 0),
      efficiencyPercentage: (() => {
        const writes = (stats.ordersCreated || 0) + (stats.ordersUpdated || 0) + (stats.itemsCreated || 0) + (stats.itemsUpdated || 0);
        const skipped = (stats.ordersUnchanged || 0) + (stats.itemsUnchanged || 0);
        const total = writes + skipped;
        return total > 0 ? ((skipped / total) * 100).toFixed(1) : '0.0';
      })(),
    };

    await logRef.set(logData);

    console.log(`✅ Import log saved: ${logRef.id}`);

    return NextResponse.json({
      success: true,
      logId: logRef.id,
    });

  } catch (error: any) {
    console.error('❌ Failed to save import log:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
