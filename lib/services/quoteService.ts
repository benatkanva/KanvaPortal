import { db } from '@/lib/firebase/config';
import { adminDb } from '@/lib/firebase/admin';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp as ClientTimestamp,
  serverTimestamp
} from 'firebase/firestore';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { Quote, QuoteSummary, QuoteStatus, QuoteActivity } from '@/types/quote';

/**
 * Generate next quote number
 */
export async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const quotesRef = collection(db, 'quotes');
  const q = query(
    quotesRef,
    where('quoteNumber', '>=', `Q-${year}-`),
    where('quoteNumber', '<', `Q-${year + 1}-`),
    orderBy('quoteNumber', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return `Q-${year}-001`;
  }
  
  const lastQuote = snapshot.docs[0].data();
  const lastNumber = parseInt(lastQuote.quoteNumber.split('-')[2]);
  const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
  
  return `Q-${year}-${nextNumber}`;
}

/**
 * Create a new quote
 */
export async function createQuote(quote: Omit<Quote, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const quoteNumber = await generateQuoteNumber();
    const now = ClientTimestamp.now();
    
    const quoteData = {
      ...quote,
      quoteNumber,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    
    const quotesRef = collection(db, 'quotes');
    const docRef = await addDoc(quotesRef, quoteData);
    
    // Log activity
    await logQuoteActivity({
      quoteId: docRef.id,
      type: 'created',
      description: `Quote ${quoteNumber} created`,
      userId: quote.createdBy,
      userEmail: quote.createdByEmail,
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating quote:', error);
    throw error;
  }
}

/**
 * Update an existing quote
 */
export async function updateQuote(quoteId: string, updates: Partial<Quote>): Promise<void> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    
    await updateDoc(quoteRef, {
      ...updates,
      updatedAt: ClientTimestamp.now(),
    });
    
    // Log activity if status changed
    if (updates.status) {
      await logQuoteActivity({
        quoteId,
        type: 'updated',
        description: `Quote status changed to ${updates.status}`,
        userId: updates.createdBy,
        userEmail: updates.createdByEmail,
      });
    }
  } catch (error) {
    console.error('Error updating quote:', error);
    throw error;
  }
}

/**
 * Get quote by ID
 */
export async function getQuoteById(quoteId: string): Promise<Quote | null> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteDoc = await getDoc(quoteRef);
    
    if (!quoteDoc.exists()) {
      return null;
    }
    
    const data = quoteDoc.data();
    return {
      id: quoteDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      expiresAt: data.expiresAt?.toDate(),
      sentAt: data.sentAt?.toDate(),
      viewedAt: data.viewedAt?.toDate(),
    } as Quote;
  } catch (error) {
    console.error('Error getting quote:', error);
    throw error;
  }
}

/**
 * Get quotes for a user
 */
export async function getUserQuotes(userId: string, status?: QuoteStatus): Promise<QuoteSummary[]> {
  try {
    const quotesRef = collection(db, 'quotes');
    let q = query(
      quotesRef,
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    if (status) {
      q = query(
        quotesRef,
        where('createdBy', '==', userId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }
    
    const snapshot = await getDocs(q);
    const quotes: QuoteSummary[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      quotes.push({
        id: doc.id,
        quoteNumber: data.quoteNumber,
        status: data.status,
        customer: {
          companyName: data.customer.companyName,
          email: data.customer.email,
        },
        total: data.calculation.total,
        createdAt: data.createdAt?.toDate(),
        sentAt: data.sentAt?.toDate(),
        createdBy: data.createdBy,
      });
    });
    
    return quotes;
  } catch (error) {
    console.error('Error getting user quotes:', error);
    throw error;
  }
}

/**
 * Mark quote as sent
 */
export async function markQuoteAsSent(quoteId: string, userId: string, userEmail: string): Promise<void> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const now = ClientTimestamp.now();
    
    await updateDoc(quoteRef, {
      status: 'sent',
      sentAt: now,
      updatedAt: now,
    });
    
    await logQuoteActivity({
      quoteId,
      type: 'sent',
      description: 'Quote sent to customer',
      userId,
      userEmail,
    });
  } catch (error) {
    console.error('Error marking quote as sent:', error);
    throw error;
  }
}

/**
 * Mark quote as viewed
 */
export async function markQuoteAsViewed(quoteId: string): Promise<void> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteDoc = await getDoc(quoteRef);
    
    if (!quoteDoc.exists()) return;
    
    const data = quoteDoc.data();
    
    // Only update if not already viewed
    if (data.status === 'sent' && !data.viewedAt) {
      await updateDoc(quoteRef, {
        status: 'viewed',
        viewedAt: ClientTimestamp.now(),
        updatedAt: ClientTimestamp.now(),
      });
      
      await logQuoteActivity({
        quoteId,
        type: 'viewed',
        description: 'Quote viewed by customer',
      });
    }
  } catch (error) {
    console.error('Error marking quote as viewed:', error);
    throw error;
  }
}

/**
 * Accept quote
 */
export async function acceptQuote(quoteId: string, userId?: string, userEmail?: string): Promise<void> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    
    await updateDoc(quoteRef, {
      status: 'accepted',
      updatedAt: ClientTimestamp.now(),
    });
    
    await logQuoteActivity({
      quoteId,
      type: 'accepted',
      description: 'Quote accepted by customer',
      userId,
      userEmail,
    });
  } catch (error) {
    console.error('Error accepting quote:', error);
    throw error;
  }
}

/**
 * Decline quote
 */
export async function declineQuote(quoteId: string, reason?: string, userId?: string, userEmail?: string): Promise<void> {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    
    await updateDoc(quoteRef, {
      status: 'declined',
      updatedAt: ClientTimestamp.now(),
    });
    
    await logQuoteActivity({
      quoteId,
      type: 'declined',
      description: reason ? `Quote declined: ${reason}` : 'Quote declined by customer',
      userId,
      userEmail,
    });
  } catch (error) {
    console.error('Error declining quote:', error);
    throw error;
  }
}

/**
 * Create a new version of a quote
 */
export async function reviseQuote(
  originalQuoteId: string,
  updates: Partial<Quote>,
  revisionReason: string,
  userId: string,
  userEmail: string
): Promise<string> {
  try {
    const originalQuote = await getQuoteById(originalQuoteId);
    if (!originalQuote) {
      throw new Error('Original quote not found');
    }
    
    // Create new quote with incremented version
    const newQuote = {
      ...originalQuote,
      ...updates,
      version: originalQuote.version + 1,
      previousVersionId: originalQuoteId,
      revisionReason,
      status: 'draft' as QuoteStatus,
      createdBy: userId,
      createdByEmail: userEmail,
    };
    
    // Remove fields that should be reset
    delete (newQuote as any).id;
    delete (newQuote as any).quoteNumber;
    delete (newQuote as any).createdAt;
    delete (newQuote as any).updatedAt;
    delete (newQuote as any).sentAt;
    delete (newQuote as any).viewedAt;
    
    const newQuoteId = await createQuote(newQuote);
    
    await logQuoteActivity({
      quoteId: newQuoteId,
      type: 'revised',
      description: `Quote revised from ${originalQuote.quoteNumber}: ${revisionReason}`,
      userId,
      userEmail,
    });
    
    return newQuoteId;
  } catch (error) {
    console.error('Error revising quote:', error);
    throw error;
  }
}

/**
 * Log quote activity
 */
export async function logQuoteActivity(activity: Omit<QuoteActivity, 'id' | 'createdAt'>): Promise<void> {
  try {
    const activitiesRef = collection(db, 'quote_activities');
    await addDoc(activitiesRef, {
      ...activity,
      createdAt: ClientTimestamp.now(),
    });
  } catch (error) {
    console.error('Error logging quote activity:', error);
  }
}

/**
 * Get quote activities
 */
export async function getQuoteActivities(quoteId: string): Promise<QuoteActivity[]> {
  try {
    const activitiesRef = collection(db, 'quote_activities');
    const q = query(
      activitiesRef,
      where('quoteId', '==', quoteId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const activities: QuoteActivity[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
      } as QuoteActivity);
    });
    
    return activities;
  } catch (error) {
    console.error('Error getting quote activities:', error);
    return [];
  }
}

/**
 * Search quotes
 */
export async function searchQuotes(searchTerm: string, userId?: string): Promise<QuoteSummary[]> {
  try {
    const quotesRef = collection(db, 'quotes');
    let q = query(quotesRef, orderBy('createdAt', 'desc'), limit(100));
    
    if (userId) {
      q = query(quotesRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'), limit(100));
    }
    
    const snapshot = await getDocs(q);
    const quotes: QuoteSummary[] = [];
    const searchLower = searchTerm.toLowerCase();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const companyName = (data.customer.companyName || '').toLowerCase();
      const quoteNumber = (data.quoteNumber || '').toLowerCase();
      const email = (data.customer.email || '').toLowerCase();
      
      if (
        companyName.includes(searchLower) ||
        quoteNumber.includes(searchLower) ||
        email.includes(searchLower)
      ) {
        quotes.push({
          id: doc.id,
          quoteNumber: data.quoteNumber,
          status: data.status,
          customer: {
            companyName: data.customer.companyName,
            email: data.customer.email,
          },
          total: data.calculation.total,
          createdAt: data.createdAt?.toDate(),
          sentAt: data.sentAt?.toDate(),
          createdBy: data.createdBy,
        });
      }
    });
    
    return quotes;
  } catch (error) {
    console.error('Error searching quotes:', error);
    return [];
  }
}
