'use client';

/**
 * BillingService
 *
 * Client-side service for initiating Stripe checkout.
 */

import { auth } from '@/lib/firebase';

export type BillingPlan = 'monthly' | 'yearly';

export async function startProCheckout(plan: BillingPlan = 'monthly'): Promise<void> {
    const user = auth?.currentUser;
    if (!user) {
        throw new Error('You must be signed in to upgrade.');
    }

    const idToken = await user.getIdToken();

    const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start checkout');
    }

    const { url } = await res.json();

    if (url) {
        window.location.href = url;
    } else {
        throw new Error('No checkout URL returned');
    }
}

export async function openBillingPortal(): Promise<void> {
    const user = auth?.currentUser;
    if (!user) {
        throw new Error('You must be signed in to manage billing.');
    }

    const idToken = await user.getIdToken();

    const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to open billing portal');
    }

    const { url } = await res.json();

    if (url) {
        window.location.href = url;
    } else {
        throw new Error('No portal URL returned');
    }
}

