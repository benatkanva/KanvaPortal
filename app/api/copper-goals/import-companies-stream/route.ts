import { NextRequest } from 'next/server';
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
 * Send progress update to client
 */
function sendProgress(encoder: TextEncoder, controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

/**
 * Match and update Firestore customers with Copper company IDs
 */
async function matchCompanies(
  buffer: Buffer, 
  stats: ImportStats,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController
): Promise<void> {
  sendProgress(encoder, controller, { type: 'status', message: 'Reading Excel file...' });
  
  // Read Excel file from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  sendProgress(encoder, controller, { type: 'status', message: `Found sheet: ${sheetName}` });
  
  const worksheet = workbook.Sheets[sheetName];
  const range = worksheet['!ref'];
  sendProgress(encoder, controller, { type: 'status', message: `Sheet range: ${range}` });
  
  // Parse data
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    defval: '',
    blankrows: false 
  }) as Record<string, any>[];
  
  if (data.length === 0) {
    throw new Error('No data found in Excel file');
  }
  
  stats.totalCompanies = data.length;
  sendProgress(encoder, controller, { 
    type: 'total', 
    total: data.length,
    message: `Found ${data.length.toLocaleString()} companies` 
  });
  
  let processed = 0;
  
  for (const copperCompany of data) {
    processed++;
    
    // Send progress every 10 records
    if (processed % 10 === 0) {
      const percent = ((processed / data.length) * 100).toFixed(1);
      sendProgress(encoder, controller, { 
        type: 'progress', 
        processed,
        total: data.length,
        percent,
        matched: stats.matchedByAccountNumber + stats.matchedByAccountOrderId + stats.matchedByName
      });
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
  
  // Send final progress
  sendProgress(encoder, controller, { 
    type: 'progress', 
    processed: data.length,
    total: data.length,
    percent: '100.0',
    matched: stats.matchedByAccountNumber + stats.matchedByAccountOrderId + stats.matchedByName
  });
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Parse multipart form data
        const formData = await req.formData();
        const companiesFile = formData.get('companiesFile') as File | null;
        
        if (!companiesFile) {
          sendProgress(encoder, controller, { 
            type: 'error', 
            message: 'No file provided' 
          });
          controller.close();
          return;
        }
        
        sendProgress(encoder, controller, { 
          type: 'status', 
          message: `File received: ${companiesFile.name} (${(companiesFile.size / 1024 / 1024).toFixed(2)} MB)` 
        });
        
        const stats: ImportStats = {
          totalCompanies: 0,
          matchedByAccountNumber: 0,
          matchedByAccountOrderId: 0,
          matchedByName: 0,
          unmatched: 0,
          errors: []
        };
        
        // Convert file to buffer
        sendProgress(encoder, controller, { type: 'status', message: 'Converting file to buffer...' });
        const buffer = Buffer.from(await companiesFile.arrayBuffer());
        sendProgress(encoder, controller, { type: 'status', message: 'Buffer created, starting matching...' });
        
        // Match companies
        await matchCompanies(buffer, stats, encoder, controller);
        
        const totalMatched = stats.matchedByAccountNumber + stats.matchedByAccountOrderId + stats.matchedByName;
        const matchRate = stats.totalCompanies > 0 
          ? ((totalMatched / stats.totalCompanies) * 100).toFixed(1)
          : '0.0';
        
        // Send completion
        sendProgress(encoder, controller, {
          type: 'complete',
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
        
        controller.close();
        
      } catch (error: any) {
        sendProgress(encoder, controller, { 
          type: 'error', 
          message: error.message || 'Import failed' 
        });
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
