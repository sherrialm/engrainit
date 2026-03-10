import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

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

        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        console.error('[Stripe Portal] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
