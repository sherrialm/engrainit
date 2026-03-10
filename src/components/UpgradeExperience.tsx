'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTierStore } from '@/stores/tierStore';
import { getReinforcementStats } from '@/services/InsightsService';
import { IDENTITY_MODES } from '@/config/identityModes';
import PricingModal from '@/components/PricingModal';
import { BillingPlan } from '@/services/BillingService';

// ── Types ─────────────────────────────────────────────────────

interface UpgradeExperienceProps {
    reason: 'generations' | 'loops' | 'voice' | 'document' | 'textLength';
    onDismiss?: () => void;
}

interface LiveStats {
    streak: number;
    minutesEngrained: number;
    favoriteModeName?: string;
    favoriteModeIcon?: string;
}

// ── Component ─────────────────────────────────────────────────

export default function UpgradeExperience({ reason, onDismiss }: UpgradeExperienceProps) {
    const router = useRouter();
    const { tier } = useTierStore();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<LiveStats | null>(null);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [pricingDefault, setPricingDefault] = useState<BillingPlan>('monthly');

    // Don't render for Pro users
    if (tier === 'pro') return null;

    // Load stats asynchronously after mount (non-blocking)
    useEffect(() => {
        if (!user?.uid) return;
        getReinforcementStats(user.uid)
            .then((s) => {
                const mode = s.favoriteModeId
                    ? IDENTITY_MODES.find((m) => m.id === s.favoriteModeId)
                    : undefined;
                setStats({
                    streak: s.currentStreak,
                    minutesEngrained: s.totalMinutesEngrained,
                    favoriteModeName: mode?.label,
                    favoriteModeIcon: mode?.icon,
                });
            })
            .catch(() => { }); // silently fail — stats are optional
    }, [user?.uid]);

    const handleUpgrade = (defaultPlan: BillingPlan = 'monthly') => {
        if (!user) {
            // Logged-out: redirect to login first
            router.push('/login');
            return;
        }
        setPricingDefault(defaultPlan);
        setIsPricingOpen(true);
    };

    // Contextual trigger messages (momentum-focused, not feature-focused)
    const triggerMessages: Record<string, string> = {
        generations: 'Your reinforcement practice is growing. Don\'t let generation limits slow your momentum.',
        loops: 'You\'re building a strong library. Pro ensures your momentum isn\'t capped.',
        voice: 'Premium voices deepen immersion and strengthen reinforcement.',
        document: 'Turn any document into a reinforcement loop — keep your identity practice expanding.',
        textLength: 'Longer affirmations allow deeper identity work. Pro removes the limit.',
    };

    const hasStats = stats && (stats.streak > 0 || stats.minutesEngrained > 0);

    return (
        <>
            <div className="bg-gradient-to-b from-forest-50 to-parchment-200 border border-forest-200 rounded-2xl p-6 shadow-lg">
                {/* Behavioral Header */}
                <h3 className="font-serif text-xl font-bold text-forest-700 text-center mb-1">
                    Don&rsquo;t break your reinforcement momentum.
                </h3>
                <p className="text-sm text-forest-500 text-center mb-5">
                    {triggerMessages[reason]}
                </p>

                {/* Identity Progress Card */}
                {hasStats && (
                    <div className="bg-parchment-100 rounded-xl p-4 border border-forest-100 mb-5">
                        <div className="flex justify-around text-center">
                            {stats.streak > 0 && (
                                <div>
                                    <p className="text-2xl font-bold text-forest-700">🔥 {stats.streak}</p>
                                    <p className="text-[11px] text-forest-500 mt-0.5">Reinforcement Days</p>
                                </div>
                            )}
                            {stats.minutesEngrained > 0 && (
                                <div>
                                    <p className="text-2xl font-bold text-forest-700">🧠 {stats.minutesEngrained}m</p>
                                    <p className="text-[11px] text-forest-500 mt-0.5">Minutes Engrained</p>
                                </div>
                            )}
                            {stats.favoriteModeName && (
                                <div>
                                    <p className="text-2xl font-bold text-forest-700">{stats.favoriteModeIcon || '⭐'}</p>
                                    <p className="text-[11px] text-forest-500 mt-0.5">{stats.favoriteModeName}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Identity-Anchored Messaging */}
                <div className="text-center mb-5">
                    <p className="text-sm text-forest-600 leading-relaxed mb-3">
                        {hasStats
                            ? 'You\'ve started building a reinforcement rhythm. Pro helps you stay consistent so your identity continues strengthening every day.'
                            : 'Pro helps you build a powerful reinforcement rhythm so your identity strengthens every day.'
                        }
                    </p>
                    <div className="space-y-1.5 text-left max-w-xs mx-auto">
                        <ProUnlock text="Unlimited affirmation refinement" />
                        <ProUnlock text="Premium immersion voices" />
                        <ProUnlock text="Document → Loop conversion" />
                        <ProUnlock text="Advanced reinforcement routines" />
                    </div>
                </div>

                {/* Conversion CTA */}
                <button
                    onClick={() => handleUpgrade('monthly')}
                    className="w-full py-3 bg-forest-600 text-parchment-100 rounded-xl font-bold text-base hover:bg-forest-700 transition-colors shadow-lg shadow-forest-200"
                >
                    Upgrade to Pro
                </button>
                <p className="text-xs text-forest-400 text-center mt-2">
                    Cancel anytime.
                </p>

                {/* Yearly upsell link */}
                <button
                    type="button"
                    onClick={() => handleUpgrade('yearly')}
                    className="w-full mt-1 py-1 text-xs text-forest-500 hover:text-forest-700 underline transition-colors"
                >
                    Prefer yearly? Save with annual.
                </button>

                {/* Dismiss */}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="w-full mt-2 py-2 text-sm text-forest-400 hover:text-forest-600 transition-colors"
                    >
                        Maybe later
                    </button>
                )}
            </div>

            {/* Pricing Modal */}
            <PricingModal
                isOpen={isPricingOpen}
                onClose={() => setIsPricingOpen(false)}
                defaultPlan={pricingDefault}
            />
        </>
    );
}

// ── Sub-component ─────────────────────────────────────────────

function ProUnlock({ text }: { text: string }) {
    return (
        <p className="text-sm text-forest-600 flex items-center gap-2">
            <span className="text-forest-500">✅</span>
            {text}
        </p>
    );
}

