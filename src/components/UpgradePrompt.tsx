'use client';

import Link from 'next/link';
import { useTierStore } from '@/stores/tierStore';
import { TIER_DISPLAY, TIER_LIMITS } from '@/config/tiers';
import { UserTier } from '@/types';

interface UpgradePromptProps {
    reason: 'generations' | 'loops' | 'voice' | 'document' | 'textLength';
    onDismiss?: () => void;
}

export default function UpgradePrompt({ reason, onDismiss }: UpgradePromptProps) {
    const { tier } = useTierStore();

    const messages: Record<string, string> = {
        generations: "You've used all your free generations this month.",
        loops: "You've reached the maximum saved loops for your plan.",
        voice: "This voice is available on the Core plan and above.",
        document: "Document upload is available on the Core plan and above.",
        textLength: `Your plan supports up to ${TIER_LIMITS[tier].maxTextLength} characters.`,
    };

    // Don't show for Pro users
    if (tier === 'pro') return null;

    const nextTier: UserTier = tier === 'free' ? 'core' : 'pro';
    const nextTierInfo = TIER_DISPLAY[nextTier];

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-forest-700 font-medium mb-2">
                {messages[reason]}
            </p>
            <p className="text-forest-500 text-sm mb-4">
                Upgrade to {nextTierInfo.emoji} <strong>{nextTierInfo.name}</strong> for more features.
            </p>

            {/* Tier comparison mini */}
            <div className="flex gap-3 justify-center mb-4">
                <TierBadge tier="free" current={tier} />
                <TierBadge tier="core" current={tier} />
                <TierBadge tier="pro" current={tier} />
            </div>

            <div className="flex gap-3 justify-center">
                <Link
                    href="/app/upgrade"
                    className="px-6 py-2 rounded-lg bg-forest-600 text-parchment-100 font-semibold hover:bg-forest-700 transition-colors text-sm"
                >
                    Upgrade to {nextTierInfo.name} — {nextTierInfo.price}
                </Link>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="px-4 py-2 text-forest-400 hover:text-forest-600 text-sm"
                    >
                        Maybe later
                    </button>
                )}
            </div>
        </div>
    );
}

function TierBadge({ tier, current }: { tier: UserTier; current: UserTier }) {
    const info = TIER_DISPLAY[tier];
    const isCurrent = tier === current;

    return (
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isCurrent
            ? 'bg-forest-600 text-parchment-100'
            : 'bg-parchment-300 text-forest-500'
            }`}>
            {info.emoji} {info.name}
        </div>
    );
}
