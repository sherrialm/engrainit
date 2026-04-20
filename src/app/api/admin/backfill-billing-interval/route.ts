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
 *   curl -X POST https://your-app.vercel.app/api/admin/backfill-billing-interval \
 *        -H "x-admin-secret: YOUR_SECRET"
 *
 *   Dry run (no writes):
 *   curl -X POST "https://your-app.vercel.app/api/admin/backfill-billing-interval?dryRun=true" \
 *        -H "x-admin-secret: YOUR_SECRET"
 */
export async function POST(request: NextRequest) {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const adminSecret = process.env.ADMIN_BACKFILL_SECRET;
    if (!adminSecret) {
        return NextResponse.json(
            { error: 'ADMIN_BACKFILL_SECRET is not configured on the server.' },
            { status: 503 }
        );
    }
    const provided = request.headers.get('x-admin-secret');
    if (!provided || provided !== adminSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Dry-run flag ─────────────────────────────────────────────────────────
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

    const db = getAdminDb();
    const stripe = getStripe();

    const results: {
        uid: string;
        status: 'updated' | 'skipped_no_sub_id' | 'skipped_cancelled' | 'skipped_stripe_error' | 'dry_run';
        interval?: string;
        reason?: string;
    }[] = [];

    // ── Query all billing/status docs for paid tiers ─────────────────────────
    // collectionGroup('billing') matches users/{uid}/billing/* docs.
    // We filter to active paid tiers in memory — Firestore OR queries on
    // subcollections require a composite index; filtering in memory is simpler
    // for a one-time admin utility.
    const billingSnap = await db
        .collectionGroup('billing')
        .where('tier', 'in', ['pro', 'core'])
        .get();

    if (billingSnap.empty) {
        return NextResponse.json({
            message: 'No paid users found.',
            processed: 0,
            results: [],
        });
    }

    for (const docSnap of billingSnap.docs) {
        const data = docSnap.data() as {
            tier?: string;
            billingInterval?: string | null;
            stripeSubscriptionId?: string | null;
        };

        // Extract UID from path: users/{uid}/billing/status
        const pathParts = docSnap.ref.path.split('/');
        const uid = pathParts[1] ?? 'unknown';

        // Skip if billingInterval is already populated with a valid value
        if (data.billingInterval === 'monthly' || data.billingInterval === 'yearly') {
            // Already synced — do not touch
            continue;
        }

        // Skip if no subscription ID to look up
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
            const sub = await stripe.subscriptions.retrieve(subId, {
                expand: ['items.data.plan'],
            });

            // Skip cancelled/incomplete subscriptions
            if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
                results.push({
                    uid,
                    status: 'skipped_cancelled',
                    reason: `Subscription status is '${sub.status}'`,
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
                reason: 'Would write billingInterval (dry run)',
            });
        } else {
            await docSnap.ref.set(
                { billingInterval, updatedAt: new Date() },
                { merge: true }
            );
            results.push({ uid, status: 'updated', interval: billingInterval });
        }
    }

    const updated  = results.filter(r => r.status === 'updated').length;
    const dryRuns  = results.filter(r => r.status === 'dry_run').length;
    const skipped  = results.filter(r => r.status.startsWith('skipped')).length;

    return NextResponse.json({
        message: dryRun
            ? `Dry run complete. Would update ${dryRuns} user(s).`
            : `Backfill complete. Updated ${updated} user(s), skipped ${skipped}.`,
        dryRun,
        processed: billingSnap.size,
        updated:   dryRun ? dryRuns : updated,
        skipped,
        results,
    });
}
