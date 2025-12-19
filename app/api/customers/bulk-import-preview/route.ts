import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

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
  changes: string[];
  isNew: boolean;
}

/**
 * Preview CSV bulk import changes without committing
 * POST /api/customers/bulk-import-preview
 * 
 * Parses CSV and compares with existing data to show what will change
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData } = body;

    if (!csvData) {
      return NextResponse.json(
        { error: 'CSV data is required' },
        { status: 400 }
      );
    }

    // Parse CSV (8 commission-essential fields only)
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
    
    console.log('CSV Headers:', headers);
    console.log('Expected: 8 commission-essential fields');

    // Load existing customers from Firestore with multiple lookup keys
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const existingCustomers = new Map();
    
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const customerData = {
        id: doc.id,
        ...data
      };
      
      // Add multiple lookup keys for robust matching
      if (data.customerNum) {
        // Store as both string and number (handle type mismatches)
        existingCustomers.set(String(data.customerNum).trim(), customerData);
        existingCustomers.set(Number(data.customerNum), customerData);
      }
      if (data.accountNumber) {
        existingCustomers.set(String(data.accountNumber).trim(), customerData);
      }
      // Also map by document ID
      existingCustomers.set(doc.id, customerData);
    });

    console.log(`Loaded ${customersSnapshot.size} existing customers with ${existingCustomers.size} lookup keys`);

    // Parse CSV rows and detect changes
    const updates: CustomerUpdate[] = [];
    const errors: string[] = [];
    let newCustomers = 0;
    let updatedCustomers = 0;
    let unchangedCustomers = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV row - proper handling of empty values
        // Split by comma but respect quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.replace(/^"(.*)"$/, '$1').trim());
            current = '';
          } else {
            current += char;
          }
        }
        // Push last value
        values.push(current.replace(/^"(.*)"$/, '$1').trim());

        if (values.length < 8) {
          errors.push(`Row ${i + 1}: Invalid format - expected 8 columns, got ${values.length}. Values: ${values.join(', ')}`);
          continue;
        }

        const [
          customerNum,
          customerName,
          accountNumber,
          salesRep,
          accountType,
          transferStatus,
          originalOwner,
          copperId
        ] = values;

        if (!customerNum || customerNum === 'undefined') {
          errors.push(`Row ${i + 1}: Missing customer number`);
          continue;
        }

        // Check if customer exists - try multiple lookup strategies
        let existing = existingCustomers.get(String(customerNum).trim());
        if (!existing) {
          existing = existingCustomers.get(Number(customerNum));
        }
        if (!existing && accountNumber && accountNumber !== 'undefined') {
          existing = existingCustomers.get(String(accountNumber).trim());
        }
        
        // Debug: Log first 3 lookups
        if (i <= 3) {
          console.log(`Row ${i}: Looking up customerNum="${customerNum}" (${typeof customerNum})`);
          console.log(`  Found: ${existing ? 'YES - ' + existing.customerName : 'NO'}`);
        }
        
        const changes: string[] = [];
        let isNew = false;

        if (!existing) {
          isNew = true;
          newCustomers++;
          changes.push('NEW CUSTOMER');
        } else {
          // Compare commission-essential fields only
          if (existing.customerName !== customerName && customerName !== 'undefined') {
            changes.push(`Name: "${existing.customerName}" → "${customerName}"`);
          }
          if (existing.accountNumber !== accountNumber && accountNumber !== 'undefined') {
            changes.push(`Account Number: "${existing.accountNumber || ''}" → "${accountNumber}"`);
          }
          if (existing.salesPerson !== salesRep && salesRep !== 'undefined') {
            changes.push(`Sales Rep: "${existing.salesPerson || ''}" → "${salesRep}"`);
          }
          if (existing.accountType !== accountType && accountType !== 'undefined') {
            changes.push(`Account Type: "${existing.accountType}" → "${accountType}"`);
          }
          if (existing.transferStatus !== transferStatus && transferStatus !== 'undefined' && transferStatus !== '') {
            changes.push(`Transfer Status: "${existing.transferStatus || ''}" → "${transferStatus}"`);
          }
          if (existing.originalOwner !== originalOwner && originalOwner !== 'undefined' && originalOwner !== '') {
            changes.push(`Original Owner: "${existing.originalOwner || ''}" → "${originalOwner}"`);
          }

          if (changes.length > 0) {
            updatedCustomers++;
          } else {
            unchangedCustomers++;
          }
        }

        // Only include customers with changes or new customers
        if (changes.length > 0 || isNew) {
          updates.push({
            id: existing?.id || '',
            customerNum,
            customerName,
            accountNumber,
            salesPerson: salesRep,
            accountType,
            transferStatus,
            originalOwner,
            copperId,
            changes,
            isNew
          });
        }

      } catch (error: any) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    console.log(`Preview Results: ${newCustomers} new, ${updatedCustomers} updated, ${unchangedCustomers} unchanged`);

    return NextResponse.json({
      success: true,
      stats: {
        total: lines.length - 1, // Exclude header
        new: newCustomers,
        updated: updatedCustomers,
        unchanged: unchangedCustomers,
        errors: errors.length
      },
      updates,
      errors
    });

  } catch (error: any) {
    console.error('Error previewing CSV import:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview import' },
      { status: 500 }
    );
  }
}
