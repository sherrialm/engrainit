export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { logger } from '@/lib/logger';

type BillingPlan = 'monthly' | 'yearly' | 'pro-monthly' | 'pro-yearly' | 'core-monthly' | 'core-yearly';

/**
 * Sanitize Stripe/internal errors so raw details never reach the client.
 * Logs the real error server-side for debugging.
 */
function safeCheckoutError(error: unknown): { message: string; status: number } {
    const raw = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe Checkout', 'Error during checkout', raw);

    // Auth / token issues
    if (raw.includes('auth') || raw.includes('token') || raw.includes('Unauthorized')) {
        return { message: 'Your session has expired. Please sign in again.', status: 401 };
    }
    // Stripe config issues (price not set, key missing, etc.)
    if (raw.includes('price') || raw.includes('configured') || raw.includes('SECRET_KEY')) {
        return { message: 'Checkout is temporarily unavailable. Please try again later.', status: 503 };
    }
    // Stripe API rate limiting
    if (raw.includes('rate') || raw.includes('429')) {
        return { message: 'Too many requests. Please wait a moment and try again.', status: 429 };
    }
    // Default
    return { message: 'Something went wrong starting checkout. Please try again.', status: 500 };
}

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for Core or Pro subscription.
 * Requires Firebase ID token in Authorization header.
 *
 * Body: { plan: 'pro-monthly' | 'pro-yearly' | 'core-monthly' | 'core-yearly' }
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

        // Parse plan from body — no silent default; require explicit valid plan
        const VALID_PLANS: BillingPlan[] = [
            'monthly', 'yearly',
            'pro-monthly', 'pro-yearly',
            'core-monthly', 'core-yearly',
        ];
        let plan: BillingPlan;
        try {
            const body = await request.json();
            if (VALID_PLANS.includes(body.plan)) {
                plan = body.plan as BillingPlan;
            } else {
                logger.error('Stripe Checkout', `Invalid or missing plan: ${body.plan}`);
                return NextResponse.json(
                    { error: 'Invalid plan specified.' },
                    { status: 400 }
                );
            }
        } catch {
            logger.error('Stripe Checkout', 'Missing or unparseable request body');
            return NextResponse.json(
                { error: 'Invalid plan specified.' },
                { status: 400 }
            );
        }

        // Resolve price ID and target tier based on plan
        const priceMap: Record<BillingPlan, string | undefined> = {
            'monthly':     process.env.STRIPE_PRICE_PRO_MONTHLY,   // legacy alias
            'yearly':      process.env.STRIPE_PRICE_PRO_YEARLY,    // legacy alias
            'pro-monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
            'pro-yearly':  process.env.STRIPE_PRICE_PRO_YEARLY,
            'core-monthly': process.env.STRIPE_PRICE_CORE_MONTHLY,
            'core-yearly':  process.env.STRIPE_PRICE_CORE_YEARLY,
        };
        const tierMap: Record<BillingPlan, string> = {
            'monthly':     'pro',
            'yearly':      'pro',
            'pro-monthly': 'pro',
            'pro-yearly':  'pro',
            'core-monthly': 'core',
            'core-yearly':  'core',
        };

        const priceId = priceMap[plan];
        const targetTier = tierMap[plan];

        if (!priceId) {
            logger.error('Stripe Checkout', `No price ID configured for ${plan} plan`);
            return NextResponse.json(
                { error: 'Checkout is temporarily unavailable. Please try again later.' },
                { status: 503 }
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
                targetTier,
            },
            subscription_data: {
                metadata: {
                    firebaseUid: uid,
                    targetTier,
                },
            },
            success_url: `${origin}/app?upgrade=success`,
            cancel_url: `${origin}/app/upgrade`,
        });

        logger.info('Stripe Checkout', 'Session created', { uid, plan });
        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        const { message, status } = safeCheckoutError(error);
        return NextResponse.json({ error: message }, { status });
    }
}
