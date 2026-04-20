'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTierStore } from '@/stores/tierStore';
import { TIER_LIMITS, TIER_DISPLAY } from '@/config/tiers';
import { startCheckout, BillingPlan } from '@/services/BillingService';

// ── Types ─────────────────────────────────────────────────────

interface PlanAction {
    label: string;
    plan?: BillingPlan;
    yearlyPlan?: BillingPlan;
    isCurrent?: boolean;
    isAlwaysFree?: boolean;
}

// ── Component ─────────────────────────────────────────────────

export default function UpgradePage() {
    const { user } = useAuthStore();
    const { tier, billingInterval } = useTierStore();
    const [loading, setLoading] = useState<BillingPlan | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async (plan: BillingPlan) => {
        if (!user) {
            window.location.href = '/login';
            return;
        }
        setLoading(plan);
        setError(null);
        try {
            await startCheckout(plan);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setLoading(null);
        }
    };

    const isFreeCurrent      = tier === 'free';
    // Card-level: is the user on this tier at all?
    const isCoreTier         = tier === 'core';
    const isProTier          = tier === 'pro';
    // Button-level: exact plan match (tier + interval)
    const isCoreMonthCurrent = isCoreTier && billingInterval === 'monthly';
    const isCoreYearCurrent  = isCoreTier && billingInterval === 'yearly';
    const isProMonthCurrent  = isProTier  && billingInterval === 'monthly';
    const isProYearCurrent   = isProTier  && billingInterval === 'yearly';
    // If interval is unknown (null) treat the whole tier-card as current (safe fallback)
    const isCoreCurrentCard  = isCoreTier;
    const isProCurrentCard   = isProTier;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    Choose Your Plan
                </h2>
                <p className="text-forest-500">
                    Unlock deeper memorization with more loops, voices, and features.
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                    <div className="flex-1">
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-600 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-5 mb-8">

                {/* ── Free ── */}
                <div
                    className={`relative rounded-2xl p-6 transition-all duration-200 ${
                        isFreeCurrent
                            ? 'bg-forest-700 text-parchment-100 shadow-lg ring-2 ring-amber-400'
                            : 'bg-white shadow-sm ring-1 ring-forest-200 hover:shadow-md'
                    }`}
                >
                    {isFreeCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-forest-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Your Plan
                        </div>
                    )}

                    <div className="text-center mb-5">
                        <span className="text-3xl">{TIER_DISPLAY.free.emoji}</span>
                        <h3 className={`font-serif text-xl font-bold mt-2 ${isFreeCurrent ? 'text-parchment-100' : 'text-forest-700'}`}>
                            {TIER_DISPLAY.free.name}
                        </h3>
                        <p className={`text-2xl font-bold mt-1 ${isFreeCurrent ? 'text-amber-300' : 'text-forest-600'}`}>
                            {TIER_DISPLAY.free.price}
                        </p>
                    </div>

                    <div className={`h-px mb-5 ${isFreeCurrent ? 'bg-parchment-100/20' : 'bg-forest-200'}`} />

                    <ul className="space-y-2.5 mb-6">
                        {[
                            `${TIER_LIMITS.free.maxLoops} saved loops`,
                            `${TIER_LIMITS.free.maxGenerationsPerMonth} saves/month`,
                            `${TIER_LIMITS.free.maxTextLength.toLocaleString()} char limit`,
                            '1 voice (Sage)',
                            'Morning sessions',
                        ].map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 ${isFreeCurrent ? 'text-amber-300' : 'text-forest-500'}`}>✓</span>
                                <span className={isFreeCurrent ? 'text-parchment-200' : 'text-forest-600'}>{f}</span>
                            </li>
                        ))}
                    </ul>

                    <div className={`text-center text-sm font-medium ${isFreeCurrent ? 'text-parchment-200/70' : 'text-forest-400'}`}>
                        {isFreeCurrent ? 'Current plan' : 'Always free'}
                    </div>
                </div>

                {/* ── Core ── */}
                <div
                    className={`relative rounded-2xl p-6 transition-all duration-200 ${
                        isCoreCurrentCard
                            ? 'bg-forest-700 text-parchment-100 shadow-lg ring-2 ring-amber-400'
                            : 'bg-white shadow-lg ring-2 ring-forest-200 hover:ring-forest-400'
                    }`}
                >
                    {isCoreCurrentCard ? (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-forest-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Your Plan
                        </div>
                    ) : (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-500 text-parchment-100 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Most Popular
                        </div>
                    )}

                    <div className="text-center mb-5">
                        <span className="text-3xl">{TIER_DISPLAY.core.emoji}</span>
                        <h3 className={`font-serif text-xl font-bold mt-2 ${isCoreCurrentCard ? 'text-parchment-100' : 'text-forest-700'}`}>
                            {TIER_DISPLAY.core.name}
                        </h3>
                        <p className={`text-2xl font-bold mt-1 ${isCoreCurrentCard ? 'text-amber-300' : 'text-forest-600'}`}>
                            {TIER_DISPLAY.core.price}
                        </p>
                    </div>

                    <div className={`h-px mb-5 ${isCoreCurrentCard ? 'bg-parchment-100/20' : 'bg-forest-200'}`} />

                    <ul className="space-y-2.5 mb-6">
                        {[
                            `${TIER_LIMITS.core.maxLoops} saved loops`,
                            `${TIER_LIMITS.core.maxGenerationsPerMonth} saves/month`,
                            `${TIER_LIMITS.core.maxTextLength.toLocaleString()} char limit`,
                            'All 4 voices',
                            'All session types',
                            'Document upload',
                            'Smart Resurfacing',
                        ].map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 ${isCoreCurrentCard ? 'text-amber-300' : 'text-forest-500'}`}>✓</span>
                                <span className={isCoreCurrentCard ? 'text-parchment-200' : 'text-forest-600'}>{f}</span>
                            </li>
                        ))}
                    </ul>

                    {isCoreCurrentCard && (
                        <div className="text-center text-xs font-semibold px-3 py-1.5 rounded-full mb-3 bg-amber-400/20 text-amber-200 tracking-wide">
                            Current plan:&nbsp;
                            {isCoreMonthCurrent
                                ? 'Core Monthly'
                                : isCoreYearCurrent
                                ? 'Core Yearly'
                                : 'Core (interval not yet synced)'}
                        </div>
                    )}

                    <div className="space-y-2">
                            <button
                                id="btn-core-monthly"
                                onClick={() => handleCheckout('core-monthly')}
                                disabled={loading !== null || isCoreMonthCurrent}
                                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-forest-600 text-parchment-100 hover:bg-forest-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isCoreMonthCurrent ? 'Current plan — Monthly' : loading === 'core-monthly' ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-parchment-100/40 border-t-parchment-100 rounded-full animate-spin" />
                                        Redirecting…
                                    </>
                                ) : 'Get Core — Monthly'}
                            </button>
                            <button
                                id="btn-core-yearly"
                                type="button"
                                onClick={() => handleCheckout('core-yearly')}
                                disabled={loading !== null || isCoreYearCurrent}
                                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-forest-600 text-parchment-100 hover:bg-forest-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isCoreYearCurrent ? 'Current plan — Yearly' : loading === 'core-yearly' ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-parchment-100/40 border-t-parchment-100 rounded-full animate-spin" />
                                        Redirecting…
                                    </>
                                ) : 'Get Core — Yearly'}
                            </button>
                        </div>
                </div>

                {/* ── Pro ── */}
                <div
                    className={`relative rounded-2xl p-6 transition-all duration-200 ${
                        isProCurrentCard
                            ? 'bg-forest-700 text-parchment-100 shadow-lg ring-2 ring-amber-400'
                            : 'bg-white shadow-lg ring-2 ring-forest-300 hover:ring-forest-500'
                    }`}
                >
                    {isProCurrentCard ? (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-forest-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Your Plan
                        </div>
                    ) : (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-600 text-parchment-100 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Full Access
                        </div>
                    )}

                    <div className="text-center mb-5">
                        <span className="text-3xl">{TIER_DISPLAY.pro.emoji}</span>
                        <h3 className={`font-serif text-xl font-bold mt-2 ${isProCurrentCard ? 'text-parchment-100' : 'text-forest-700'}`}>
                            {TIER_DISPLAY.pro.name}
                        </h3>
                        <p className={`text-2xl font-bold mt-1 ${isProCurrentCard ? 'text-amber-300' : 'text-forest-600'}`}>
                            {TIER_DISPLAY.pro.price}
                        </p>
                    </div>

                    <div className={`h-px mb-5 ${isProCurrentCard ? 'bg-parchment-100/20' : 'bg-forest-200'}`} />

                    <ul className="space-y-2.5 mb-6">
                        {[
                            'Unlimited saved loops',
                            'Unlimited saves/month',
                            `${TIER_LIMITS.pro.maxTextLength.toLocaleString()} char limit`,
                            'All 4 voices',
                            'All session types',
                            'Document upload',
                            'Background sounds',
                            'Smart Resurfacing',
                        ].map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 ${isProCurrentCard ? 'text-amber-300' : 'text-forest-500'}`}>✓</span>
                                <span className={isProCurrentCard ? 'text-parchment-200' : 'text-forest-600'}>{f}</span>
                            </li>
                        ))}
                    </ul>

                    {isProCurrentCard && (
                        <div className="text-center text-xs font-semibold px-3 py-1.5 rounded-full mb-3 bg-amber-400/20 text-amber-200 tracking-wide">
                            Current plan:&nbsp;
                            {isProMonthCurrent
                                ? 'Pro Monthly'
                                : isProYearCurrent
                                ? 'Pro Yearly'
                                : 'Pro (interval not yet synced)'}
                        </div>
                    )}

                    <div className="space-y-2">
                            <button
                                id="btn-pro-monthly"
                                onClick={() => handleCheckout('pro-monthly')}
                                disabled={loading !== null || isProMonthCurrent}
                                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-forest-600 text-parchment-100 hover:bg-forest-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProMonthCurrent ? 'Current plan — Monthly' : loading === 'pro-monthly' ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-parchment-100/40 border-t-parchment-100 rounded-full animate-spin" />
                                        Redirecting…
                                    </>
                                ) : 'Upgrade to Pro — Monthly'}
                            </button>
                            <button
                                id="btn-pro-yearly"
                                type="button"
                                onClick={() => handleCheckout('pro-yearly')}
                                disabled={loading !== null || isProYearCurrent}
                                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-forest-600 text-parchment-100 hover:bg-forest-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProYearCurrent ? 'Current plan — Yearly' : loading === 'pro-yearly' ? (
                                    <>
                                        <span className="inline-block w-4 h-4 border-2 border-parchment-100/40 border-t-parchment-100 rounded-full animate-spin" />
                                        Redirecting…
                                    </>
                                ) : 'Upgrade to Pro — Yearly'}
                            </button>
                        </div>
                </div>
            </div>

            {/* Secure checkout note */}
            {!isProCurrentCard && !isCoreCurrentCard && (
                <p className="text-center text-xs text-forest-400 mb-6">
                    🔒 Secure checkout powered by Stripe. Cancel anytime.
                </p>
            )}

            {/* Back link */}
            <div className="text-center mt-8">
                <Link href="/app" className="text-forest-500 hover:text-forest-600 text-sm">
                    ← Back to creating loops
                </Link>
            </div>
        </div>
    );
}
