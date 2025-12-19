/**
 * ShipStation API Proxy - v2 endpoints
 * Proxies requests to ShipStation v2 API with API-Key header
 */

import { NextRequest, NextResponse } from 'next/server';

const SHIPSTATION_API_V2_BASE = 'https://api.shipstation.com';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const apiKeyV2 = process.env.SHIPSTATION_API_KEY_V2;

  if (!apiKeyV2) {
    return NextResponse.json(
      { error: 'ShipStation v2 API key not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${SHIPSTATION_API_V2_BASE}/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'API-Key': apiKeyV2,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`ShipStation v2 API error: ${response.status} ${text}`);
      return NextResponse.json(
        { error: `ShipStation v2 API error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('ShipStation v2 proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to ShipStation v2', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const apiKeyV2 = process.env.SHIPSTATION_API_KEY_V2;

  if (!apiKeyV2) {
    return NextResponse.json(
      { error: 'ShipStation v2 API key not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const url = `${SHIPSTATION_API_V2_BASE}/${path}`;

  try {
    const body = await request.json().catch(() => ({}));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'API-Key': apiKeyV2,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`ShipStation v2 API error: ${response.status} ${text}`);
      return NextResponse.json(
        { error: `ShipStation v2 API error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('ShipStation v2 proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to ShipStation v2', details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
