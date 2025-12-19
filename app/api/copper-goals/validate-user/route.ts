import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/copper/validate-user
 * Validates the Copper API user and returns their info
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

    // Fetch users from Copper and find the API user
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
      console.error('[Copper Validate User] API Error:', errorText);
      return NextResponse.json(
        { error: `Copper API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const users = await response.json();
    
    // Find the user matching the API email
    const apiUser = users.find((user: any) => 
      user.email.toLowerCase() === apiEmail.toLowerCase()
    );

    if (!apiUser) {
      return NextResponse.json(
        { error: `API user not found: ${apiEmail}` },
        { status: 404 }
      );
    }

    const userInfo = {
      id: apiUser.id,
      name: apiUser.name,
      email: apiUser.email,
      active: !apiUser.inactive,
    };

    console.log(`[Copper Validate User] Validated: ${userInfo.name} (${userInfo.email})`);

    return NextResponse.json({
      user: userInfo,
      valid: true,
    });
  } catch (error: any) {
    console.error('[Copper Validate User] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to validate user',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
