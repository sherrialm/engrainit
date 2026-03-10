import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth } from '@/lib/firebaseAdmin';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for Pro subscription.
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
        const email = decodedToken.email;

        // Parse plan from body (default to monthly)
        let plan: 'monthly' | 'yearly' = 'monthly';
        try {
            const body = await request.json();
            if (body.plan === 'yearly') plan = 'yearly';
        } catch {
            // No body or invalid JSON — use default
        }

        // Validate price ID
        const priceId = plan === 'yearly'
            ? process.env.STRIPE_PRICE_PRO_YEARLY
            : process.env.STRIPE_PRICE_PRO_MONTHLY;

        if (!priceId) {
            return NextResponse.json(
                { error: `Stripe price not configured for ${plan} plan` },
                { status: 500 }
            );
        }

        // Determine origin for URLs
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create checkout session
        const session = await getStripe().checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: email || undefined,
            metadata: {
                firebaseUid: uid,
            },
            subscription_data: {
                metadata: {
                    firebaseUid: uid,
                },
            },
            success_url: `${origin}/app?upgrade=success`,
            cancel_url: `${origin}/app?upgrade=cancel`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        console.error('[Stripe Checkout] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
