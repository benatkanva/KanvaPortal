import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/copper/activity-types
 * Fetches all activity types from Copper CRM
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

    // Fetch activity types from Copper
    const response = await fetch('https://api.copper.com/developer_api/v1/activity_types', {
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
      console.error('[Copper Activity Types] API Error:', errorText);
      return NextResponse.json(
        { error: `Copper API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Copper returns { user: [...], system: [...] }
    const allTypes: any[] = [];
    
    if (data.user && Array.isArray(data.user)) {
      allTypes.push(...data.user);
    }
    if (data.system && Array.isArray(data.system)) {
      allTypes.push(...data.system);
    }
    
    console.log(`[Copper Activity Types] Found ${allTypes.length} total types (${data.user?.length || 0} user, ${data.system?.length || 0} system)`);
    
    // Transform the data to a simpler format
    const activityTypes = allTypes.map((type: any) => ({
      id: type.id.toString(),
      name: type.name,
      category: type.category,
      isDisabled: type.is_disabled || false,
    }));

    console.log(`[Copper Activity Types] Transformed ${activityTypes.length} activity types`);

    return NextResponse.json({
      activityTypes,
      total: activityTypes.length,
    });
  } catch (error: any) {
    console.error('[Copper Activity Types] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch activity types',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
