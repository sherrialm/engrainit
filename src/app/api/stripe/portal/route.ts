export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { logger } from '@/lib/logger';

/**
 * Sanitize Stripe/internal errors so raw details never reach the client.
 */
function safePortalError(error: unknown): { message: string; status: number } {
    const raw = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe Portal', 'Error opening portal', raw);

    if (raw.includes('auth') || raw.includes('token') || raw.includes('Unauthorized')) {
        return { message: 'Your session has expired. Please sign in again.', status: 401 };
    }
    if (raw.includes('configured') || raw.includes('SECRET_KEY') || raw.includes('customer')) {
        return { message: 'Billing portal is temporarily unavailable. Please try again later.', status: 503 };
    }
    return { message: 'Something went wrong opening billing. Please try again.', status: 500 };
}

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session.
 * Requires Firebase ID token in Authorization header.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify Firebase ID token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await getAdminAuth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Retrieve stripeCustomerId from Firestore
        const db = getAdminDb();
        const billingDoc = await db.doc(`users/${uid}/billing/status`).get();

        if (!billingDoc.exists) {
            return NextResponse.json(
                { error: 'No billing record found. Please subscribe first.' },
                { status: 400 }
            );
        }

        const billing = billingDoc.data();
        const stripeCustomerId = billing?.stripeCustomerId;

        if (!stripeCustomerId) {
            return NextResponse.json(
                { error: 'No Stripe customer found. Please subscribe first.' },
                { status: 400 }
            );
        }

        // Determine return URL
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || `${origin}/app`;

        // Create portal session
        const session = await getStripe().billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
        });

        logger.info('Stripe Portal', 'Session created', { uid });
        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        const { message, status } = safePortalError(error);
        return NextResponse.json({ error: message }, { status });
    }
}
