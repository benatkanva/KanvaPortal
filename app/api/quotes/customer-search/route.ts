import { NextRequest, NextResponse } from 'next/server';
import { searchCustomers, getRecentCustomers } from '@/lib/services/customerLookupService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const userId = searchParams.get('userId');
    const recent = searchParams.get('recent') === 'true';
    
    if (recent && userId) {
      const customers = await getRecentCustomers(userId, 5);
      return NextResponse.json({ customers });
    }
    
    if (!query || query.length < 2) {
      return NextResponse.json({ customers: [] });
    }
    
    const customers = await searchCustomers(query, 10);
    
    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error('Error searching customers:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
