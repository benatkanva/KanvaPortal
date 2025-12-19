import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

interface ImportStats {
  totalCompanies: number;
  matchedByAccountNumber: number;
  matchedByAccountOrderId: number;
  matchedByName: number;
  unmatched: number;
  errors: Array<{ company: string; error: string }>;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarityScore(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Match and update Firestore customers with Copper company IDs
 */
async function matchCompanies(buffer: Buffer, stats: ImportStats): Promise<void> {
  console.log('📥 Reading Copper companies file...');
  
  // Read Excel file from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  console.log(`📋 Workbook sheets: ${workbook.SheetNames.join(', ')}`);
  
  const sheetName = workbook.SheetNames[0];
  console.log(`📄 Using sheet: ${sheetName}`);
  
  const worksheet = workbook.Sheets[sheetName];
  const range = worksheet['!ref'];
  console.log(`📏 Sheet range: ${range}`);
  
  // Try different parsing options
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    defval: '',
    blankrows: false 
  }) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} Copper companies`);
  
  if (data.length === 0) {
    console.log('⚠️  No data found! Checking first few cells...');
    console.log('Cell A1:', worksheet['A1']);
    console.log('Cell B1:', worksheet['B1']);
    console.log('Cell A2:', worksheet['A2']);
    throw new Error('No data found in Excel file. The file may be empty or in an unsupported format.');
  }
  
  if (data.length > 0) {
    console.log(`📊 Sample fields: ${Object.keys(data[0]).slice(0, 5).join(', ')}`);
  }
  
  stats.totalCompanies = data.length;
  
  let processed = 0;
  
  for (const copperCompany of data) {
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`📊 Progress: ${processed}/${data.length}`);
    }
    
    try {
      const accountNumber = copperCompany['Account Number cf_698260'];
      const accountOrderId = copperCompany['Account Order ID cf_698467'];
      const companyName = copperCompany['Company'] || copperCompany['Name'];
      const copperCompanyId = copperCompany['Company Id'] || copperCompany['Copper ID'];
      
      if (!copperCompanyId) {
        stats.errors.push({ company: companyName, error: 'Missing Copper Company ID' });
        continue;
      }
      
      let matchedDoc = null;
      let matchMethod = '';
      
      // Method 1: Match by Account Number (most reliable)
      if (accountNumber) {
        const snapshot = await adminDb.collection('fishbowl_customers')
          .where('accountId', '==', String(accountNumber))
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          matchedDoc = snapshot.docs[0];
          matchMethod = 'accountNumber';
          stats.matchedByAccountNumber++;
        }
      }
      
      // Method 2: Match by Account Order ID
      if (!matchedDoc && accountOrderId) {
        const snapshot = await adminDb.collection('fishbowl_customers')
          .where('id', '==', String(accountOrderId))
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          matchedDoc = snapshot.docs[0];
          matchMethod = 'accountOrderId';
          stats.matchedByAccountOrderId++;
        }
      }
      
      // Method 3: Fuzzy match by name (85%+ similarity)
      if (!matchedDoc && companyName) {
        const allCustomers = await adminDb.collection('fishbowl_customers')
          .where('copperCompanyId', '==', null)
          .limit(100)
          .get();
        
        let bestMatch = null;
        let bestScore = 0;
        
        allCustomers.forEach(doc => {
          const customer = doc.data();
          const score = similarityScore(companyName, customer.name);
          
          if (score > 0.85 && score > bestScore) {
            bestScore = score;
            bestMatch = doc;
          }
        });
        
        if (bestMatch) {
          matchedDoc = bestMatch;
          matchMethod = `name (${(bestScore * 100).toFixed(0)}% match)`;
          stats.matchedByName++;
        }
      }
      
      // Update Firestore if matched
      if (matchedDoc) {
        await matchedDoc.ref.update({
          copperCompanyId: Number(copperCompanyId),
          syncStatus: 'matched',
          lastSyncedToCopperAt: Timestamp.now(),
          copperMatchMethod: matchMethod,
          updatedAt: Timestamp.now()
        });
      } else {
        stats.unmatched++;
      }
      
    } catch (error: any) {
      stats.errors.push({
        company: String(copperCompany['Company'] || copperCompany['Name'] || 'unknown'),
        error: error.message
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const startTime = new Date();
  
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const companiesFile = formData.get('companiesFile') as File | null;
    
    if (!companiesFile) {
      return NextResponse.json(
        { error: 'No file provided. Please upload the Copper companies Excel file.' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${companiesFile.name} (${(companiesFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const stats: ImportStats = {
      totalCompanies: 0,
      matchedByAccountNumber: 0,
      matchedByAccountOrderId: 0,
      matchedByName: 0,
      unmatched: 0,
      errors: []
    };
    
    // Convert file to buffer
    console.log('📦 Converting file to buffer...');
    const buffer = Buffer.from(await companiesFile.arrayBuffer());
    console.log(`✅ Buffer created: ${buffer.length} bytes`);
    
    // Match companies
    console.log('🔍 Starting matching process...');
    await matchCompanies(buffer, stats);
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const totalMatched = stats.matchedByAccountNumber + stats.matchedByAccountOrderId + stats.matchedByName;
    const matchRate = stats.totalCompanies > 0 
      ? ((totalMatched / stats.totalCompanies) * 100).toFixed(1)
      : '0.0';
    
    console.log(`✅ Matching complete! ${totalMatched}/${stats.totalCompanies} matched (${matchRate}%)`);
    
    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats: {
        totalCompanies: stats.totalCompanies,
        matched: {
          total: totalMatched,
          byAccountNumber: stats.matchedByAccountNumber,
          byAccountOrderId: stats.matchedByAccountOrderId,
          byName: stats.matchedByName
        },
        unmatched: stats.unmatched,
        matchRate: `${matchRate}%`,
        errors: stats.errors.length,
        errorSamples: stats.errors.slice(0, 10)
      }
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
