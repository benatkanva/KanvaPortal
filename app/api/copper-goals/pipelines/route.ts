import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/copper/pipelines
 * Fetches all pipelines from Copper CRM
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

    // Fetch pipelines from Copper
    const response = await fetch('https://api.copper.com/developer_api/v1/pipelines', {
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
      console.error('[Copper Pipelines] API Error:', errorText);
      return NextResponse.json(
        { error: `Copper API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform the data to a simpler format
    const pipelines = data.map((pipeline: any) => ({
      id: pipeline.id.toString(),
      name: pipeline.name,
      stagesCount: pipeline.stages?.length || 0,
      stages: pipeline.stages?.map((stage: any) => ({
        id: stage.id,
        name: stage.name,
      })) || [],
    }));

    console.log(`[Copper Pipelines] Found ${pipelines.length} pipelines`);

    return NextResponse.json({
      pipelines,
      total: pipelines.length,
    });
  } catch (error: any) {
    console.error('[Copper Pipelines] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch pipelines',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
