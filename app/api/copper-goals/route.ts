import { NextRequest, NextResponse } from 'next/server';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/copper - Fetch data from Copper
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${COPPER_API_BASE}/${endpoint}`, {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Copper API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Copper API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Copper' },
      { status: 500 }
    );
  }
}

// POST /api/copper - Send data to Copper
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(`${COPPER_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Copper API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Copper API error:', error);
    return NextResponse.json(
      { error: 'Failed to send to Copper' },
      { status: 500 }
    );
  }
}