import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/diagnose-email
 * Diagnoses email activity sync issues
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    const results: any = {
      timestamp: new Date().toISOString(),
      userEmail,
      checks: [],
      recommendations: [],
    };

    // 1. Find user by email in Firestore
    const usersSnapshot = await adminDb.collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      results.checks.push({
        name: 'User Exists',
        status: 'fail',
        message: `User not found in Firestore with email: ${userEmail}`,
      });
      results.recommendations.push('Verify the email address is correct');
      results.summary = '❌ User not found';
      return NextResponse.json(results);
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    results.userId = userId;

    results.checks.push({
      name: 'User Exists',
      status: 'pass',
      message: `User found in Firestore (ID: ${userId})`,
    });

    // 2. Check Copper org defaults
    const defaultsDoc = await adminDb.collection('settings').doc('copper_metadata').get();
    const data = defaultsDoc.exists ? defaultsDoc.data() : {};
    const defaults = (data as any).defaults || {};
    
    results.copperDefaults = {
      emailActivityId: defaults?.emailActivityId || 'NOT SET',
      emailActivityCategory: defaults?.emailActivityCategory || 'NOT SET',
      phoneCallActivityId: defaults?.phoneCallActivityId || 'NOT SET',
      phoneCallActivityCategory: defaults?.phoneCallActivityCategory || 'NOT SET',
      copperUserEmail: defaults?.copperUserEmail || 'NOT SET',
    };

    if (!defaults?.emailActivityId) {
      results.checks.push({
        name: 'Email Activity ID',
        status: 'fail',
        message: 'Email Activity Type ID not configured in org defaults',
      });
      results.recommendations.push('Go to Admin → Copper Setup → Discover Activity Types → Select Email type → Save');
    } else if (!defaults?.emailActivityCategory) {
      results.checks.push({
        name: 'Email Activity ID',
        status: 'fail',
        message: `Email Activity Type ID configured (${defaults.emailActivityId}) but category missing`,
      });
      results.recommendations.push('Re-save email activity type to include category (user/system)');
    } else {
      results.checks.push({
        name: 'Email Activity ID',
        status: 'pass',
        message: `Email Activity Type ID: ${defaults.emailActivityId} (${defaults.emailActivityCategory})`,
      });
    }

    // 3. Check user settings
    const userSettings = await adminDb.collection('settings').doc(userId).get();
    const settings = userSettings.exists ? userSettings.data() : {};
    
    results.userSettings = {
      copperUserEmail: settings?.copperUserEmail || 'NOT SET',
      emailActivityId: settings?.emailActivityId || 'USING ORG DEFAULT',
    };

    // 4. Check recent email metrics
    const emailMetricsSnapshot = await adminDb
      .collection('metrics')
      .where('userId', '==', userId)
      .where('type', '==', 'email_quantity')
      .orderBy('date', 'desc')
      .limit(5)
      .get();

    results.recentEmailMetrics = emailMetricsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        date: data.date?.toDate?.()?.toISOString() || data.date,
        value: data.value,
        source: data.source,
      };
    });

    if (emailMetricsSnapshot.empty) {
      results.checks.push({
        name: 'Email Metrics',
        status: 'warn',
        message: 'No email metrics found for this user',
      });
      results.recommendations.push('Run a Copper sync to populate email metrics');
    } else {
      results.checks.push({
        name: 'Email Metrics',
        status: 'pass',
        message: `Found ${emailMetricsSnapshot.size} recent email metrics`,
      });
    }

    // 5. Check all metrics to see what's syncing
    const allMetricsSnapshot = await adminDb
      .collection('metrics')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(10)
      .get();

    const metricTypes = new Set(allMetricsSnapshot.docs.map(d => d.data().type));
    results.recentMetricTypes = Array.from(metricTypes);

    // Only warn if we have phone calls but NO email metrics at all (not just missing from recent types)
    if (metricTypes.has('phone_call_quantity') && emailMetricsSnapshot.empty) {
      results.checks.push({
        name: 'Sync Pattern',
        status: 'warn',
        message: 'Phone calls syncing but emails are not',
      });
      results.recommendations.push('Email Activity Type ID may be incorrect or emails not in Copper');
    }

    // 6. TEST COPPER API - Actually query Copper for emails
    if (defaults?.emailActivityId && defaults?.emailActivityCategory) {
      try {
        // Get Copper user ID for this email
        const usersMapDoc = await adminDb.collection('settings').doc('copper_users_map').get();
        const usersMapData = usersMapDoc.exists ? usersMapDoc.data() : {};
        const byEmail = usersMapData?.byEmail || {};
        const copperId = byEmail[userEmail.toLowerCase()];

        if (!copperId) {
          results.checks.push({
            name: 'Copper User Mapping',
            status: 'fail',
            message: `User email ${userEmail} not found in Copper users cache`,
          });
          results.recommendations.push('User may not exist in Copper or cache needs refresh');
        } else {
          results.copperUserId = copperId;
          
          // Query Copper API for last 7 days of emails
          const now = Math.floor(Date.now() / 1000);
          const sevenDaysAgo = now - (7 * 24 * 60 * 60);
          
          const copperRes = await fetch('https://api.copper.com/developer_api/v1/activities/search', {
            method: 'POST',
            headers: {
              'X-PW-AccessToken': process.env.COPPER_API_KEY || '',
              'X-PW-Application': 'developer_api',
              'X-PW-UserEmail': process.env.COPPER_USER_EMAIL || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              page_number: 1,
              page_size: 200, // Get more to filter by sender
              sort_by: 'activity_date',
              sort_direction: 'desc',
              activity_types: [{ id: Number(defaults.emailActivityId), category: defaults.emailActivityCategory }],
              // NOTE: user_ids doesn't work for emails - it filters by assignee, not sender
              minimum_activity_date: sevenDaysAgo,
              maximum_activity_date: now,
            }),
          });

          if (!copperRes.ok) {
            const errorText = await copperRes.text();
            results.checks.push({
              name: 'Copper API Test',
              status: 'fail',
              message: `Copper API returned ${copperRes.status}: ${errorText}`,
            });
          } else {
            const copperData = await copperRes.json();
            
            // Filter by sender email (case-insensitive)
            const userEmails = copperData.filter((a: any) => {
              const senderEmail = a?.details?.sender?.email || '';
              return senderEmail.toLowerCase() === userEmail.toLowerCase();
            });
            
            results.copperApiTest = {
              totalEmailsInCopper: copperData.length || 0,
              emailsSentByUser: userEmails.length || 0,
              dateRange: '7 days',
              sampleEmails: userEmails.slice(0, 3).map((a: any) => ({
                id: a.id,
                activity_date: a.activity_date ? new Date(a.activity_date * 1000).toISOString() : null,
                type: a.type?.name || 'unknown',
                sender: a.details?.sender?.email || 'unknown',
                subject: a.details?.subject || '',
              })),
            };

            results.checks.push({
              name: 'Copper API Test',
              status: userEmails.length > 0 ? 'pass' : 'warn',
              message: `Found ${userEmails.length} emails sent by ${userEmail} (${copperData.length} total in Copper, last 7 days)`,
            });

            if (userEmails.length === 0) {
              results.recommendations.push(`No emails found sent by ${userEmail} in the last 7 days - user may not be sending emails through Copper`);
            }
          }
        }
      } catch (apiError: any) {
        results.checks.push({
          name: 'Copper API Test',
          status: 'fail',
          message: `API test failed: ${apiError.message}`,
        });
      }
    }

    // Summary
    const failCount = results.checks.filter((c: any) => c.status === 'fail').length;
    const warnCount = results.checks.filter((c: any) => c.status === 'warn').length;
    
    if (failCount > 0) {
      results.summary = `❌ ${failCount} critical issue(s) found`;
    } else if (warnCount > 0) {
      results.summary = `⚠️ ${warnCount} warning(s) found`;
    } else {
      results.summary = '✅ All checks passed';
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Email Diagnostics] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Diagnostic failed',
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}
