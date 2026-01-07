import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { notifySAIAShipment } from '@/lib/services/notificationService';

export const dynamic = 'force-dynamic';

/**
 * Create notifications for new SAIA shipments
 * Triggered when new shipment data is synced to Firebase
 */
export async function POST(request: NextRequest) {
  try {
    const { proNumber, customerName, salesPerson } = await request.json();

    if (!proNumber || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: proNumber, customerName' },
        { status: 400 }
      );
    }

    // Get shipment data from Firebase Realtime Database
    const { getDatabase } = await import('firebase-admin/database');
    const realtimeDb = getDatabase();
    
    const shipmentRef = realtimeDb.ref(`shipping/saia/shipments/${proNumber}`);
    const snapshot = await shipmentRef.get();
    
    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: `Shipment ${proNumber} not found` },
        { status: 404 }
      );
    }

    const shipment = snapshot.val();

    // Find sales rep user by salesPerson field
    let salesRepUser: any = null;
    if (salesPerson) {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('salesPerson', '==', salesPerson)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        salesRepUser = {
          id: userDoc.id,
          ...userDoc.data(),
        };
      }
    }

    // If no sales rep found, try to find by customer assignment
    if (!salesRepUser && shipment.customerName) {
      const customerSnapshot = await adminDb
        .collection('fishbowl_customers')
        .where('name', '==', shipment.customerName)
        .limit(1)
        .get();

      if (!customerSnapshot.empty) {
        const customer = customerSnapshot.docs[0].data();
        if (customer.salesPerson) {
          const usersSnapshot = await adminDb
            .collection('users')
            .where('salesPerson', '==', customer.salesPerson)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            salesRepUser = {
              id: userDoc.id,
              ...userDoc.data(),
            };
          }
        }
      }
    }

    if (!salesRepUser) {
      return NextResponse.json(
        { 
          error: 'No sales rep found for this shipment',
          proNumber,
          customerName,
          salesPerson 
        },
        { status: 404 }
      );
    }

    // Create notification
    const notificationId = await notifySAIAShipment({
      proNumber: shipment.proNumber,
      customerName: shipment.customerName,
      customerCity: shipment.customerCity,
      customerState: shipment.customerState,
      weight: shipment.weight,
      charges: shipment.charges,
      salesRepEmail: salesRepUser.email,
      salesRepUserId: salesRepUser.id,
      salesPerson: salesRepUser.salesPerson || salesPerson,
    });

    return NextResponse.json({
      success: true,
      notificationId,
      proNumber: shipment.proNumber,
      customerName: shipment.customerName,
      salesRep: salesRepUser.name || salesRepUser.email,
    });

  } catch (error: any) {
    console.error('Error creating SAIA notification:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * Batch create notifications for multiple new shipments
 */
export async function PUT(request: NextRequest) {
  try {
    const { shipments } = await request.json();

    if (!Array.isArray(shipments) || shipments.length === 0) {
      return NextResponse.json(
        { error: 'shipments array is required' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const shipment of shipments) {
      try {
        const response = await fetch(
          `${request.nextUrl.origin}/api/notifications/saia-shipment`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shipment),
          }
        );

        if (response.ok) {
          results.success++;
        } else {
          results.failed++;
          const error = await response.json();
          results.errors.push({
            proNumber: shipment.proNumber,
            error: error.error,
          });
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          proNumber: shipment.proNumber,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error: any) {
    console.error('Error batch creating SAIA notifications:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
