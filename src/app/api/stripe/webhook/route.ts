import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events to update user billing status in Firestore.
 * Must use raw body for signature verification.
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json(
            { error: 'Missing signature or webhook secret' },
            { status: 400 }
        );
    }

    let event: Stripe.Event;

    try {
        event = getStripe().webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Stripe Webhook] Signature verification failed:', message);
        return NextResponse.json(
            { error: `Webhook signature verification failed: ${message}` },
            { status: 400 }
        );
    }

    const db = getAdminDb();

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const uid = session.metadata?.firebaseUid;

                if (!uid) {
                    console.error('[Stripe Webhook] No firebaseUid in session metadata');
                    break;
                }

                // Get subscription details
                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;
                // Read the target tier set at checkout time; default to 'pro' for safety
                const targetTier = (session.metadata?.targetTier === 'core') ? 'core' : 'pro';

                let currentPeriodEnd: number | undefined;
                let billingInterval: 'monthly' | 'yearly' = 'monthly';
                if (subscriptionId) {
                    const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
                        expand: ['items.data.plan'],
                    });
                    currentPeriodEnd = (sub as any).current_period_end;
                    // Derive interval from the first subscription item's plan
                    const stripeInterval = sub.items?.data?.[0]?.plan?.interval;
                    billingInterval = stripeInterval === 'year' ? 'yearly' : 'monthly';
                }

                // Upgrade user tier in Firestore
                await db.doc(`users/${uid}/billing/status`).set(
                    {
                        tier: targetTier,
                        billingInterval,
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                        currentPeriodEnd: currentPeriodEnd || null,
                        updatedAt: new Date(),
                    },
                    { merge: true }
                );

                // Also update profile tier for backward compatibility
                await db.doc(`users/${uid}/profile/data`).set(
                    { tier: targetTier },
                    { merge: true }
                );

                console.log(`[Stripe Webhook] User ${uid} upgraded to ${targetTier} (${billingInterval})`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const uid = subscription.metadata?.firebaseUid;

                if (!uid) {
                    console.error('[Stripe Webhook] No firebaseUid in subscription metadata');
                    break;
                }

                // Revoke Pro and clear any grace period
                await db.doc(`users/${uid}/billing/status`).set(
                    {
                        tier: 'free',
                        stripeSubscriptionId: null,
                        currentPeriodEnd: null,
                        paymentFailed: false,
                        gracePeriod: false,
                        gracePeriodEndsAt: null,
                        updatedAt: new Date(),
                    },
                    { merge: true }
                );

                await db.doc(`users/${uid}/profile/data`).set(
                    { tier: 'free' },
                    { merge: true }
                );

                console.log(`[Stripe Webhook] User ${uid} downgraded to free`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = (invoice as any).subscription as string;

                if (subscriptionId) {
                    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
                    const uid = sub.metadata?.firebaseUid;
                    const periodEnd = (sub as any).current_period_end;

                    if (uid) {
                        // Keep Pro access during grace period
                        await db.doc(`users/${uid}/billing/status`).set(
                            {
                                tier: 'pro',
                                paymentFailed: true,
                                gracePeriod: true,
                                gracePeriodEndsAt: periodEnd || null,
                                updatedAt: new Date(),
                            },
                            { merge: true }
                        );

                        // Do NOT update profile/data tier — keep pro

                        console.log(`[Stripe Webhook] Payment failed for user ${uid}, grace period active`);
                    }
                }
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = (invoice as any).subscription as string;

                if (subscriptionId) {
                    const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
                        expand: ['items.data.plan'],
                    });
                    const uid = sub.metadata?.firebaseUid;

                    if (uid) {
                        // Clear payment failure flags — preserve existing tier, refresh interval
                        const existingDoc = await db.doc(`users/${uid}/billing/status`).get();
                        const existingTier = (existingDoc.data() as any)?.tier || 'pro';
                        const stripeInterval = sub.items?.data?.[0]?.plan?.interval;
                        const billingInterval: 'monthly' | 'yearly' =
                            stripeInterval === 'year' ? 'yearly' : 'monthly';
                        await db.doc(`users/${uid}/billing/status`).set(
                            {
                                tier: existingTier,
                                billingInterval,
                                paymentFailed: false,
                                gracePeriod: false,
                                gracePeriodEndsAt: null,
                                currentPeriodEnd: (sub as any).current_period_end || null,
                                updatedAt: new Date(),
                            },
                            { merge: true }
                        );

                        console.log(`[Stripe Webhook] Payment succeeded for user ${uid}, grace cleared (${billingInterval})`);
                    }
                }
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }
    } catch (error) {
        console.error('[Stripe Webhook] Processing error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }

    return NextResponse.json({ received: true });
}
