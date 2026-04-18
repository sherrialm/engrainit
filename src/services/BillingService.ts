'use client';

/**
 * BillingService
 *
 * Client-side service for initiating Stripe checkout.
 * Includes request timeout and humanized error messages.
 */

import { auth } from '@/lib/firebase';

export type BillingPlan = 'monthly' | 'yearly' | 'core-monthly' | 'core-yearly';

const BILLING_TIMEOUT_MS = 15_000;

/**
 * Map raw server/network errors to human-friendly messages.
 */
function humanizeBillingError(err: unknown): string {
    const raw = err instanceof Error ? err.message : 'Unknown error';

    if (raw.includes('AbortError') || raw.includes('timed out')) {
        return 'The request took too long. Please check your connection and try again.';
    }
    if (raw.includes('401') || raw.includes('Unauthorized') || raw.includes('signed in') || raw.includes('session')) {
        return 'Your session has expired. Please sign in again.';
    }
    if (raw.includes('503') || raw.includes('unavailable') || raw.includes('configured')) {
        return 'Checkout is temporarily unavailable. Please try again later.';
    }
    if (raw.includes('429') || raw.includes('Too many')) {
        return 'Too many requests. Please wait a moment and try again.';
    }
    if (raw.includes('NetworkError') || raw.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
    }
    // Preserve already-humanized messages from the server
    if (raw.includes('Please') || raw.includes('try again')) {
        return raw;
    }
    return 'Something went wrong. Please try again or contact support.';
}

export async function startCheckout(plan: BillingPlan): Promise<void> {
    const user = auth?.currentUser;
    if (!user) {
        throw new Error('You must be signed in to upgrade.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BILLING_TIMEOUT_MS);

    try {
        const idToken = await user.getIdToken();

        const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ plan }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Checkout failed (${res.status})`);
        }

        const { url } = await res.json();

        if (url) {
            window.location.href = url;
        } else {
            throw new Error('No checkout URL returned. Please try again.');
        }
    } catch (err) {
        clearTimeout(timeoutId);
        throw new Error(humanizeBillingError(err));
    }
}

/** @deprecated Use startCheckout() instead */
export async function startProCheckout(plan: BillingPlan = 'monthly'): Promise<void> {
    return startCheckout(plan);
}

export async function openBillingPortal(): Promise<void> {
    const user = auth?.currentUser;
    if (!user) {
        throw new Error('You must be signed in to manage billing.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BILLING_TIMEOUT_MS);

    try {
        const idToken = await user.getIdToken();

        const res = await fetch('/api/stripe/portal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Portal failed (${res.status})`);
        }

        const { url } = await res.json();

        if (url) {
            window.location.href = url;
        } else {
            throw new Error('No portal URL returned. Please try again.');
        }
    } catch (err) {
        clearTimeout(timeoutId);
        throw new Error(humanizeBillingError(err));
    }
}
