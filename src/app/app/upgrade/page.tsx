'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTierStore } from '@/stores/tierStore';
import { TIER_LIMITS, TIER_DISPLAY } from '@/config/tiers';
import { UserTier } from '@/types';

export default function UpgradePage() {
    const { user } = useAuthStore();
    const { tier } = useTierStore();
    const [email, setEmail] = useState(user?.email || '');
    const [selectedPlan, setSelectedPlan] = useState<UserTier | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleNotifyMe = () => {
        if (!email.trim()) return;
        // For now, just store locally. In the future, this could write to Firestore.
        console.log('[Upgrade] Interest registered:', { email, plan: selectedPlan });
        setSubmitted(true);
    };

    const plans: { tier: UserTier; features: string[] }[] = [
        {
            tier: 'free',
            features: [
                `${TIER_LIMITS.free.maxLoops} saved loops`,
                `${TIER_LIMITS.free.maxGenerationsPerMonth} saves/month`,
                `${TIER_LIMITS.free.maxTextLength} character limit`,
                '1 voice (Sage)',
            ],
        },
        {
            tier: 'core',
            features: [
                `${TIER_LIMITS.core.maxLoops} saved loops`,
                `${TIER_LIMITS.core.maxGenerationsPerMonth} saves/month`,
                `${TIER_LIMITS.core.maxTextLength} character limit`,
                'All 4 voices',
                'Document upload',
            ],
        },
        {
            tier: 'pro',
            features: [
                'Unlimited saved loops',
                'Unlimited saves/month',
                `${TIER_LIMITS.pro.maxTextLength.toLocaleString()} character limit`,
                'All 4 voices',
                'Document upload',
                'Background sounds',
                'Priority support',
            ],
        },
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    Choose Your Plan
                </h2>
                <p className="text-forest-500 mb-1">
                    Unlock deeper memorization with more loops, voices, and features.
                </p>
                <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-medium px-4 py-1.5 rounded-full mt-3">
                    <span className="animate-pulse">✨</span>
                    Paid plans coming soon!
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">
                {plans.map(({ tier: planTier, features }) => {
                    const display = TIER_DISPLAY[planTier];
                    const isCurrent = planTier === tier;
                    const isPopular = planTier === 'core';

                    return (
                        <div
                            key={planTier}
                            className={`relative rounded-2xl p-6 transition-all duration-200 ${isCurrent
                                    ? 'bg-forest-700 text-parchment-100 shadow-lg ring-2 ring-amber-400'
                                    : isPopular
                                        ? 'bg-white shadow-lg ring-2 ring-forest-300 hover:ring-forest-500'
                                        : 'bg-white shadow-sm ring-1 ring-forest-200 hover:shadow-md'
                                }`}
                        >
                            {/* Popular badge */}
                            {isPopular && !isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-600 text-parchment-100 text-xs font-bold px-3 py-1 rounded-full">
                                    Most Popular
                                </div>
                            )}

                            {/* Current badge */}
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-forest-900 text-xs font-bold px-3 py-1 rounded-full">
                                    Your Plan
                                </div>
                            )}

                            {/* Plan info */}
                            <div className="text-center mb-5">
                                <span className="text-3xl">{display.emoji}</span>
                                <h3 className={`font-serif text-xl font-bold mt-2 ${isCurrent ? 'text-parchment-100' : 'text-forest-700'
                                    }`}>
                                    {display.name}
                                </h3>
                                <p className={`text-2xl font-bold mt-1 ${isCurrent ? 'text-amber-300' : 'text-forest-600'
                                    }`}>
                                    {display.price}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className={`h-px mb-5 ${isCurrent ? 'bg-parchment-100/20' : 'bg-forest-200'
                                }`} />

                            {/* Features */}
                            <ul className="space-y-3 mb-6">
                                {features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <span className={`mt-0.5 ${isCurrent ? 'text-amber-300' : 'text-forest-500'
                                            }`}>✓</span>
                                        <span className={
                                            isCurrent ? 'text-parchment-200' : 'text-forest-600'
                                        }>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Action */}
                            {isCurrent ? (
                                <div className="text-center text-sm text-parchment-200/70 font-medium">
                                    Current plan
                                </div>
                            ) : planTier === 'free' ? (
                                <div className="text-center text-sm text-forest-400">
                                    Always free
                                </div>
                            ) : (
                                <button
                                    onClick={() => setSelectedPlan(planTier)}
                                    className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${selectedPlan === planTier
                                            ? 'bg-amber-400 text-forest-900'
                                            : 'bg-forest-600 text-parchment-100 hover:bg-forest-700'
                                        }`}
                                >
                                    {selectedPlan === planTier ? '✓ Selected' : `Get ${display.name}`}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Notify Me Section */}
            {!submitted ? (
                <div className="max-w-md mx-auto bg-parchment-300 rounded-2xl p-6 text-center">
                    <h3 className="font-serif text-lg font-bold text-forest-700 mb-2">
                        🔔 Get Notified When Plans Launch
                    </h3>
                    <p className="text-sm text-forest-500 mb-4">
                        Be the first to know when Core and Pro plans are available.
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="input-field flex-1 text-sm"
                        />
                        <button
                            onClick={handleNotifyMe}
                            disabled={!email.trim()}
                            className="px-5 py-2 bg-forest-600 text-parchment-100 rounded-lg font-medium text-sm hover:bg-forest-700 transition-colors disabled:opacity-50"
                        >
                            Notify Me
                        </button>
                    </div>
                </div>
            ) : (
                <div className="max-w-md mx-auto bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                    <span className="text-4xl">🎉</span>
                    <h3 className="font-serif text-lg font-bold text-forest-700 mt-2 mb-1">
                        You&apos;re on the list!
                    </h3>
                    <p className="text-sm text-forest-500">
                        We&apos;ll email you at <strong>{email}</strong> when paid plans launch.
                    </p>
                </div>
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
