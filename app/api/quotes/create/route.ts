import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Quote } from '@/types/quote';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const quoteData = await request.json();
    
    // Generate quote number
    const year = new Date().getFullYear();
    const quotesRef = adminDb.collection('quotes');
    const lastQuoteQuery = await quotesRef
      .where('quoteNumber', '>=', `Q-${year}-`)
      .where('quoteNumber', '<', `Q-${year + 1}-`)
      .orderBy('quoteNumber', 'desc')
      .limit(1)
      .get();
    
    let quoteNumber = `Q-${year}-001`;
    if (!lastQuoteQuery.empty) {
      const lastQuote = lastQuoteQuery.docs[0].data();
      const lastNumber = parseInt(lastQuote.quoteNumber.split('-')[2]);
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      quoteNumber = `Q-${year}-${nextNumber}`;
    }
    
    const now = Timestamp.now();
    
    const quote = {
      ...quoteData,
      quoteNumber,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    
    const docRef = await quotesRef.add(quote);
    
    // Log activity
    await adminDb.collection('quote_activities').add({
      quoteId: docRef.id,
      type: 'created',
      description: `Quote ${quoteNumber} created`,
      userId: quoteData.createdBy,
      userEmail: quoteData.createdByEmail,
      createdAt: now,
    });
    
    return NextResponse.json({ 
      success: true, 
      quoteId: docRef.id,
      quoteNumber 
    });
  } catch (error: any) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
