/**
 * ShipStation API Proxy - v1 endpoints
 * Proxies requests to ShipStation API with Basic Auth
 */

import { NextRequest, NextResponse } from 'next/server';

const SHIPSTATION_API_BASE = 'https://ssapi.shipstation.com';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'ShipStation API credentials not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${SHIPSTATION_API_BASE}/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`ShipStation API error: ${response.status} ${text}`);
      return NextResponse.json(
        { error: `ShipStation API error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('ShipStation proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to ShipStation', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'ShipStation API credentials not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const url = `${SHIPSTATION_API_BASE}/${path}`;

  try {
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const body = await request.json().catch(() => ({}));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`ShipStation API error: ${response.status} ${text}`);
      return NextResponse.json(
        { error: `ShipStation API error: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('ShipStation proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to ShipStation', details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
