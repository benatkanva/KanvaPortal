import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Gmail Webhook for SAIA Daily Reports
 * This endpoint receives notifications when new emails arrive at ben@kanvabotanicals.com
 * with SAIA CSV attachments and automatically imports them to Firestore
 */

// Initialize Gmail API
function getGmailClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  });

  return google.gmail({ version: 'v1', auth });
}

// Process SAIA CSV attachment
async function processSAIAAttachment(gmail: any, messageId: string, attachmentId: string, filename: string) {
  try {
    // Get attachment data
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = Buffer.from(attachment.data.data, 'base64').toString('utf-8');
    
    // Parse CSV and import to Firestore
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/saia/import-shipping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvData: data,
        filename,
        importedBy: 'gmail-automation',
        messageId,
      }),
    });

    const result = await response.json();
    
    // Log the import
    await adminDb.collection('saia_import_logs').add({
      messageId,
      filename,
      importedAt: Timestamp.now(),
      status: result.success ? 'success' : 'error',
      processedCount: result.processedCount || 0,
      matchedCustomers: result.matchedCustomers || 0,
      errorCount: result.errorCount || 0,
      details: result.message || result.error,
    });

    return result;
  } catch (error) {
    console.error('Error processing SAIA attachment:', error);
    
    await adminDb.collection('saia_import_logs').add({
      messageId,
      filename,
      importedAt: Timestamp.now(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

// Handle Gmail push notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Gmail sends push notifications in this format
    const message = body.message;
    if (!message || !message.data) {
      return NextResponse.json({ success: true, message: 'No message data' });
    }

    // Decode the message
    const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
    const notification = JSON.parse(decodedData);

    console.log('Gmail notification received:', notification);

    // Initialize Gmail client
    const gmail = getGmailClient();

    // Get the email message
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: notification.historyId,
      format: 'full',
    });

    // Check if email has SAIA CSV attachment
    const parts = email.data.payload?.parts || [];
    let processedAny = false;

    for (const part of parts) {
      const filename = part.filename || '';
      
      // Check if it's a SAIA report CSV
      if (filename.toLowerCase().includes('saiarpt') && filename.toLowerCase().endsWith('.csv')) {
        console.log(`Processing SAIA attachment: ${filename}`);
        
        if (part.body?.attachmentId) {
          await processSAIAAttachment(
            gmail,
            notification.historyId,
            part.body.attachmentId,
            filename
          );
          processedAny = true;
        }
      }
    }

    if (processedAny) {
      return NextResponse.json({
        success: true,
        message: 'SAIA report processed successfully',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No SAIA attachments found',
    });

  } catch (error) {
    console.error('Gmail webhook error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process Gmail notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Verification endpoint for Gmail webhook setup
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Gmail SAIA webhook endpoint active',
    timestamp: new Date().toISOString(),
  });
}
