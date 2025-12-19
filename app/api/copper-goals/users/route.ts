import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/copper/users
 * Fetches all users from Copper CRM
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.COPPER_API_KEY;
    const apiEmail = process.env.COPPER_USER_EMAIL;

    if (!apiKey || !apiEmail) {
      return NextResponse.json(
        { error: 'Copper API credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch users from Copper
    const response = await fetch('https://api.copper.com/developer_api/v1/users', {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': apiKey,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': apiEmail,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Copper Users] API Error:', errorText);
      return NextResponse.json(
        { error: `Copper API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const users = await response.json();
    
    console.log(`[Copper Users] Fetched ${users.length} users from Copper`);

    return NextResponse.json({
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        inactive: u.inactive || false,
      })),
      total: users.length,
    });
  } catch (error: any) {
    console.error('[Copper Users] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch users',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
