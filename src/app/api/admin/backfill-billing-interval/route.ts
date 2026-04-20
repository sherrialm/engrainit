import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/admin/backfill-billing-interval
 *
 * One-time admin utility that resolves billingInterval ('monthly' | 'yearly')
 * for legacy paid users who have tier = 'pro' | 'core' but no billingInterval
 * in their users/{uid}/billing/status Firestore document.
 *
 * Safety guarantees:
 *   - Only users with a missing/null billingInterval are touched.
 *   - Only users with a valid stripeSubscriptionId are processed.
 *   - Only billingInterval + updatedAt are written (tier is never changed).
 *   - merge: true prevents overwriting other fields.
 *   - Dry-run mode (?dryRun=true) logs what would change without writing.
 *
 * Auth:
 *   Header:  x-admin-secret: <ADMIN_BACKFILL_SECRET>
 *
 * Usage:
 *   Dry run:
 *   curl -X POST "https://engrainit.vercel.app/api/admin/backfill-billing-interval?dryRun=true" \
 *        -H "x-admin-secret: YOUR_SECRET"
 *
 *   Real run:
 *   curl -X POST "https://engrainit.vercel.app/api/admin/backfill-billing-interval" \
 *        -H "x-admin-secret: YOUR_SECRET"
 */
export async function POST(request: NextRequest) {
    // ── Top-level error boundary — always return JSON, never a raw 500 ────────
    try {
        return await runBackfill(request);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Backfill] Unhandled error:', message);
        return NextResponse.json(
            {
                error: 'Backfill route failed with an unhandled error.',
                detail: message,
            },
            { status: 500 }
        );
    }
}

async function runBackfill(request: NextRequest): Promise<NextResponse> {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const adminSecret = process.env.ADMIN_BACKFILL_SECRET;
    if (!adminSecret) {
        return NextResponse.json(
            { error: 'ADMIN_BACKFILL_SECRET is not configured on the server. Add it to your Vercel environment variables and redeploy.' },
            { status: 503 }
        );
    }
    const provided = request.headers.get('x-admin-secret');
    if (!provided || provided !== adminSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Dry-run flag ─────────────────────────────────────────────────────────
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

    // ── Initialize Firestore Admin ────────────────────────────────────────────
    let db: ReturnType<typeof getAdminDb>;
    try {
        db = getAdminDb();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: 'Failed to initialize Firestore Admin SDK.', detail: msg },
            { status: 503 }
        );
    }

    // ── Query all billing/* docs (no .where — avoids composite index requirement) ─
    // Filter to paid tiers in memory. This is safe for a one-time admin utility.
    let billingSnap: FirebaseFirestore.QuerySnapshot;
    try {
        billingSnap = await db.collectionGroup('billing').get();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: 'Firestore collectionGroup query failed.', detail: msg },
            { status: 500 }
        );
    }

    const results: {
        uid: string;
        status: 'updated' | 'skipped_no_sub_id' | 'skipped_cancelled' | 'skipped_already_synced' | 'skipped_not_paid' | 'skipped_stripe_error' | 'dry_run';
        interval?: string;
        reason?: string;
    }[] = [];

    for (const docSnap of billingSnap.docs) {
        const data = docSnap.data() as {
            tier?: string;
            billingInterval?: string | null;
            stripeSubscriptionId?: string | null;
        };

        // Extract UID from path: users/{uid}/billing/status
        const pathParts = docSnap.ref.path.split('/');
        const uid = pathParts[1] ?? 'unknown';

        // Only process paid tiers (filter in memory — no index needed)
        if (data.tier !== 'pro' && data.tier !== 'core') {
            continue; // silently skip free users — don't add to results
        }

        // Skip if billingInterval is already a valid value
        if (data.billingInterval === 'monthly' || data.billingInterval === 'yearly') {
            results.push({
                uid,
                status: 'skipped_already_synced',
                interval: data.billingInterval,
                reason: 'billingInterval already set — not touched',
            });
            continue;
        }

        // Skip if no subscription ID to look up in Stripe
        const subId = data.stripeSubscriptionId;
        if (!subId) {
            results.push({
                uid,
                status: 'skipped_no_sub_id',
                reason: 'No stripeSubscriptionId in billing doc',
            });
            continue;
        }

        // ── Retrieve subscription from Stripe ─────────────────────────────
        let billingInterval: 'monthly' | 'yearly';
        try {
            // Initialize Stripe lazily — only when we actually need it
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subId, {
                expand: ['items.data.plan'],
            });

            // Skip cancelled/incomplete subscriptions — don't write interval
            if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
                results.push({
                    uid,
                    status: 'skipped_cancelled',
                    reason: `Stripe subscription status is '${sub.status}'`,
                });
                continue;
            }

            const stripeInterval = sub.items?.data?.[0]?.plan?.interval;
            billingInterval = stripeInterval === 'year' ? 'yearly' : 'monthly';
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({
                uid,
                status: 'skipped_stripe_error',
                reason: `Stripe error: ${msg}`,
            });
            continue;
        }

        // ── Write back — only billingInterval + updatedAt ─────────────────
        if (dryRun) {
            results.push({
                uid,
                status: 'dry_run',
                interval: billingInterval,
                reason: 'Would write billingInterval (dry run — no changes made)',
            });
        } else {
            try {
                await docSnap.ref.set(
                    { billingInterval, updatedAt: new Date() },
                    { merge: true }
                );
                results.push({ uid, status: 'updated', interval: billingInterval });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                results.push({
                    uid,
                    status: 'skipped_stripe_error', // reuse closest status type
                    reason: `Firestore write error: ${msg}`,
                });
            }
        }
    }

    const updated  = results.filter(r => r.status === 'updated').length;
    const dryRuns  = results.filter(r => r.status === 'dry_run').length;
    const skipped  = results.filter(r => r.status.startsWith('skipped')).length;
    const paidDocs = results.length;

    return NextResponse.json({
        message: dryRun
            ? `Dry run complete. Would update ${dryRuns} user(s) out of ${paidDocs} paid account(s) found.`
            : `Backfill complete. Updated ${updated} user(s), skipped ${skipped} out of ${paidDocs} paid account(s).`,
        dryRun,
        totalBillingDocsScanned: billingSnap.size,
        paidDocsFound: paidDocs,
        wouldUpdate: dryRun ? dryRuns : undefined,
        updated:     dryRun ? undefined : updated,
        skipped,
        results,
    });
}
