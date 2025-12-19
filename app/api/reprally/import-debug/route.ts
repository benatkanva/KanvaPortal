import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Debug import to diagnose RepRally billing field mapping
 * Logs EVERY field for first 10 RepRally orders
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🐛 REPRALLY DEBUG IMPORT`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`📁 File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    console.log(`📊 Total rows: ${data.length}`);
    console.log(`📋 Headers found: ${Object.keys(data[0] || {}).length}`);
    console.log(`\n🔍 All column headers:\n`);
    
    const headers = Object.keys(data[0] || {});
    headers.forEach((header, idx) => {
      console.log(`   ${String(idx + 1).padStart(3)}. "${header}"`);
    });

    // Find RepRally orders (order number starts with #)
    const repRallyRows = data.filter((row: any) => {
      const orderNum = String(row['Sales order Number'] || row['Sales Order Number'] || '').trim();
      return orderNum.startsWith('#');
    });

    console.log(`\n🛍️ Found ${repRallyRows.length} RepRally orders (# prefix)\n`);

    // Log first 10 RepRally orders in FULL detail
    const samplesToLog = Math.min(10, repRallyRows.length);
    console.log(`${'='.repeat(80)}`);
    console.log(`📋 FIRST ${samplesToLog} REPRALLY ORDERS - FULL ROW DATA`);
    console.log(`${'='.repeat(80)}\n`);

    for (let i = 0; i < samplesToLog; i++) {
      const row = repRallyRows[i];
      const orderNum = String(row['Sales order Number'] || row['Sales Order Number'] || '').trim();
      
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`REPRALLY ORDER ${i + 1}: ${orderNum}`);
      console.log(`${'-'.repeat(80)}`);
      
      // Log ALL fields
      for (const [key, value] of Object.entries(row)) {
        const stringValue = String(value || '');
        if (stringValue.length > 0) {
          console.log(`   ${key.padEnd(35)} = "${stringValue}"`);
        }
      }
      
      // Highlight billing fields specifically
      console.log(`\n   🎯 BILLING FIELDS:`);
      console.log(`   ${'Billing Name'.padEnd(35)} = "${row['Billing Name'] || '(EMPTY)'}"`);
      console.log(`   ${'Billing Address'.padEnd(35)} = "${row['Billing Address'] || '(EMPTY)'}"`);
      console.log(`   ${'Billing City'.padEnd(35)} = "${row['Billing City'] || '(EMPTY)'}"`);
      console.log(`   ${'Billing State'.padEnd(35)} = "${row['Billing State'] || '(EMPTY)'}"`);
      console.log(`   ${'Billing Zip'.padEnd(35)} = "${row['Billing Zip'] || '(EMPTY)'}"`);
      
      console.log(`\n   🎯 CUSTOMER FIELDS:`);
      console.log(`   ${'Customer Name'.padEnd(35)} = "${row['Customer Name'] || '(EMPTY)'}"`);
      console.log(`   ${'Company name'.padEnd(35)} = "${row['Company name'] || '(EMPTY)'}"`);
      console.log(`   ${'Customer id'.padEnd(35)} = "${row['Customer id'] || '(EMPTY)'}"`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ DEBUG IMPORT COMPLETE`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      totalRows: data.length,
      repRallyOrders: repRallyRows.length,
      headers: headers,
      samplesLogged: samplesToLog,
      message: `Check server logs for detailed field mapping of ${samplesToLog} RepRally orders`
    });

  } catch (error: any) {
    console.error('❌ Debug import error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
