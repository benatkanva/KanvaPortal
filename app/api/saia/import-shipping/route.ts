import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { parse } from 'csv-parse/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

interface SAIAShipment {
  proNumber: string;
  bolNumber: string;
  shipNumber: string;
  poNumber: string;
  onTime: string;
  latePickup: string;
  appointment: string;
  accessorials: string;
  pieces: string;
  netCharge: number;
  codAmount: number;
  discount: number;
  totalCharges: number;
  terms: string;
  pickupDate: string;
  pickupArriveTime: string;
  pickupDepartTime: string;
  shipperCode: string;
  shipperName: string;
  shipperAddress: string;
  shipperCity: string;
  shipperState: string;
  shipperZip: string;
  consigneeCode: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity: string;
  consigneeState: string;
  consigneeZip: string;
  deliveryDate: string;
  deliveryTime: string;
  timeArrive: string;
  timeDepart: string;
  weight: number;
  signature: string;
  weightAvgClass: number;
  actualDays: number;
  standardDays: number;
  trailer: string;
  currentStatus: string;
  originTerminal: string;
  destTerminal: string;
  fuelSurcharge: number;
  estDeliveryDate: string;
  importedAt: Timestamp;
  importedBy: string;
  customerId?: string;
  customerName?: string;
}

interface CSVRecord {
  [key: string]: string;
}

// Helper function to match consignee to customer
async function matchConsigneeToCustomer(consigneeName: string, consigneeCity: string): Promise<{ customerId?: string; customerName?: string }> {
  try {
    // Try exact name match first
    const nameQuery = await adminDb.collection('customers')
      .where('name', '==', consigneeName)
      .limit(1)
      .get();
    
    if (!nameQuery.empty) {
      const customer = nameQuery.docs[0];
      return {
        customerId: customer.id,
        customerName: customer.data().name
      };
    }

    // Try partial name match with city
    const allCustomers = await adminDb.collection('customers')
      .where('city', '==', consigneeCity)
      .limit(50)
      .get();
    
    for (const doc of allCustomers.docs) {
      const customerName = doc.data().name || '';
      if (customerName.toLowerCase().includes(consigneeName.toLowerCase()) ||
          consigneeName.toLowerCase().includes(customerName.toLowerCase())) {
        return {
          customerId: doc.id,
          customerName: doc.data().name
        };
      }
    }

    return {};
  } catch (error) {
    console.error('Error matching customer:', error);
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('SAIA import started');
    
    // Check if adminDb is initialized
    if (!adminDb) {
      console.error('Firebase Admin DB not initialized');
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importedBy = formData.get('importedBy') as string || 'system';

    if (!file) {
      console.error('No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Reading CSV file:', file.name);
    let csvText = await file.text();
    
    // Remove EOF character and other control characters that can cause parsing issues
    csvText = csvText.replace(/\x1A/g, '').trim();
    
    console.log('Parsing CSV...');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Allow inconsistent column counts
      skip_records_with_error: true, // Skip malformed records
    }) as CSVRecord[];

    console.log(`Processing ${records.length} SAIA shipment records`);

    let batch = adminDb.batch();
    const shipments: SAIAShipment[] = [];
    let processedCount = 0;
    let errorCount = 0;
    let matchedCustomers = 0;
    let batchCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const proNumber = record['PRO#']?.trim();
        
        if (!proNumber || proNumber === 'NS' || proNumber === '') {
          console.log(`Skipping record ${i + 1}: No valid PRO number (value: "${proNumber}")`);
          errorCount++;
          continue;
        }

        console.log(`Processing record ${i + 1}: PRO# ${proNumber}`);

        const consigneeName = record['CNAME'] || '';
        const consigneeCity = record['CCITY'] || '';
        
        // Skip customer matching for now to avoid timeout - can be added later as background job
        const customerMatch = { customerId: undefined, customerName: undefined };

        // Parse numeric fields safely
        const netCharge = parseFloat(record['NETCHG']?.replace(/,/g, '') || '0') || 0;
        const codAmount = parseFloat(record['COD$']?.replace(/,/g, '') || '0') || 0;
        const discount = parseFloat(record['DISCOUNT$']?.replace(/,/g, '') || '0') || 0;
        const totalCharges = parseFloat(record['CHARGES$']?.replace(/,/g, '') || '0') || 0;
        const weight = parseFloat(record['WEIGHT']?.replace(/,/g, '') || '0') || 0;
        const weightAvgClass = parseFloat(record['WGTAVGCLS']?.replace(/,/g, '') || '0') || 0;
        const actualDays = parseInt(record['ACTUALDAYS'] || '0') || 0;
        const standardDays = parseInt(record['STANDARDDAYS'] || '0') || 0;
        const fuelSurcharge = parseFloat(record['FUELSURCHARGE']?.replace(/,/g, '') || '0') || 0;

        const shipment: SAIAShipment = {
          proNumber,
          bolNumber: record['BOL#'] || '',
          shipNumber: record['SHIP#'] || '',
          poNumber: record['PO#'] || '',
          onTime: record['ONTIME'] || '',
          latePickup: record['LATEPICKUP'] || '',
          appointment: record['APPT'] || '',
          accessorials: record['ACCESSORIALS'] || '',
          pieces: record['PIECES'] || '',
          netCharge,
          codAmount,
          discount,
          totalCharges,
          terms: record['TERMS'] || '',
          pickupDate: record['PDATE'] || '',
          pickupArriveTime: record['PARRTIME'] || '',
          pickupDepartTime: record['PDPTTIME'] || '',
          shipperCode: record['SCODE'] || '',
          shipperName: record['SNAME'] || '',
          shipperAddress: record['SADDR'] || '',
          shipperCity: record['SCITY'] || '',
          shipperState: record['SSTATE'] || '',
          shipperZip: record['SZIP'] || '',
          consigneeCode: record['CCODE'] || '',
          consigneeName,
          consigneeAddress: record['CADDR'] || '',
          consigneeCity,
          consigneeState: record['CSTATE'] || '',
          consigneeZip: record['CZIP'] || '',
          deliveryDate: record['DELDATE'] || '',
          deliveryTime: record['DELTIME'] || '',
          timeArrive: record['TIMEARRIVE'] || '',
          timeDepart: record['TIMEDEPART'] || '',
          weight,
          signature: record['SIGNATURE'] || '',
          weightAvgClass,
          actualDays,
          standardDays,
          trailer: record['TRAILER'] || '',
          currentStatus: record['CURRENTSTATUS'] || '',
          originTerminal: record['ORIGINTERMINAL'] || '',
          destTerminal: record['DESTTERMINAL'] || '',
          fuelSurcharge,
          estDeliveryDate: record['ESTDELDATE'] || '',
          importedAt: Timestamp.now(),
          importedBy,
          customerId: customerMatch.customerId,
          customerName: customerMatch.customerName,
        };

        console.log(`Creating Firestore doc for PRO# ${proNumber}`);
        const docRef = adminDb.collection('saia_shipments').doc(proNumber);
        batch.set(docRef, shipment, { merge: true });
        
        shipments.push(shipment);
        processedCount++;
        batchCount++;
        console.log(`Successfully queued PRO# ${proNumber} (${processedCount} total)`);

        // Commit batch every 400 records to avoid timeout
        if (batchCount >= 400) {
          console.log(`Committing batch of ${batchCount} records...`);
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`Error processing record ${i + 1}:`, errorMsg);
        console.error('Error stack:', errorStack);
        console.error('Record data:', JSON.stringify(record).substring(0, 200));
        errorCount++;
      }
    }
    
    console.log(`Import summary: ${processedCount} processed, ${errorCount} errors`);

    // Commit remaining records
    if (batchCount > 0) {
      console.log(`Committing final batch of ${batchCount} records...`);
      await batch.commit();
    }

    console.log(`Successfully imported ${processedCount} SAIA shipments`);

    return NextResponse.json({
      success: true,
      message: `Imported ${processedCount} SAIA shipments`,
      processedCount,
      errorCount,
      matchedCustomers: 0,
      shipments: shipments.slice(0, 5),
    });

  } catch (error) {
    console.error('Error importing SAIA shipments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error stack:', errorStack);
    
    return NextResponse.json(
      { 
        error: 'Failed to import SAIA shipments',
        details: errorMessage,
        stack: errorStack
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proNumber = searchParams.get('proNumber');
    const customerId = searchParams.get('customerId');
    const consigneeName = searchParams.get('consigneeName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query: any = adminDb.collection('saia_shipments');

    // If specific PRO number requested, fetch directly
    if (proNumber) {
      const doc = await adminDb.collection('saia_shipments').doc(proNumber).get();
      if (!doc.exists) {
        return NextResponse.json({
          success: true,
          count: 0,
          shipments: [],
        });
      }
      return NextResponse.json({
        success: true,
        count: 1,
        shipments: [{ id: doc.id, ...doc.data() }],
      });
    }

    // Filter by customer ID if provided
    if (customerId) {
      query = query.where('customerId', '==', customerId);
    }

    // Filter by consignee name if provided
    if (consigneeName) {
      query = query.where('consigneeName', '==', consigneeName);
    }

    // Date range filtering
    if (startDate) {
      query = query.where('pickupDate', '>=', startDate);
    }

    if (endDate) {
      query = query.where('pickupDate', '<=', endDate);
    }

    query = query.orderBy('pickupDate', 'desc').limit(limit);

    const snapshot = await query.get();
    const shipments = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      count: shipments.length,
      shipments,
    });

  } catch (error) {
    console.error('Error fetching SAIA shipments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch SAIA shipments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
