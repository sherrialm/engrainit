'use client';

/**
 * Home Hub — 5-action dashboard
 *
 * The central control surface for EngrainIt.
 * Actions: Generate Loop, Start Session, Remember Something, My Loops, Progress
 * Plus: Quick Loops (pinned), Daily Briefing card.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore, usePinnedLoops } from '@/stores/vaultStore';
import { useTierStore } from '@/stores/tierStore';
import { useAudioStore } from '@/stores/audioStore';
import { LoopIcon, SessionIcon, MemoryIcon, VaultIcon, ProgressIcon, BriefingIcon, PlayIcon, RefreshIcon, PinFilledIcon } from '@/components/Icons';
import { generateBriefing } from '@/services/AIService';

// ── Daily Briefing helpers ────────────────────────────────────

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

// ── Home Hub ──────────────────────────────────────────────────

export default function AppDashboard() {
    const { user } = useAuthStore();
    const { loops, fetchLoops } = useVaultStore();
    const pinnedLoops = usePinnedLoops();
    const { tier } = useTierStore();
    const { loadAndPlay } = useAudioStore();

    // Briefing state
    const [briefingText, setBriefingText] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);

    // Fetch loops on mount
    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Load today's briefing (cached)
    useEffect(() => {
        loadCachedBriefing();
    }, []);

    function loadCachedBriefing() {
        const todayKey = getTodayKey();
        const cached = localStorage.getItem(`engrainit_briefing_${todayKey}`);
        if (cached) {
            setBriefingText(cached);
        }
    }

    async function handleGenerateBriefing() {
        setIsBriefingLoading(true);
        try {
            const text = await generateBriefing({
                goals: loops.filter(l => l.category === 'vision').map(l => l.title).slice(0, 3),
                habits: [],
                recentMoods: [],
                recentLoopNames: loops.slice(0, 5).map(l => l.title),
            });
            const todayKey = getTodayKey();
            localStorage.setItem(`engrainit_briefing_${todayKey}`, text);
            setBriefingText(text);
        } catch (err) {
            console.error('[Briefing] Generation failed:', err);
        } finally {
            setIsBriefingLoading(false);
        }
    }

    // ── 5 Action Cards ────────────────────────────────────────

    const actions = [
        {
            id: 'generate',
            label: 'Generate Loop',
            description: 'AI-powered mental alignment loops',
            icon: LoopIcon,
            href: '/app/generate',
            color: 'text-forest-700',
        },
        {
            id: 'session',
            label: 'Start Session',
            description: 'Playlist-style loop playback',
            icon: SessionIcon,
            href: '/app/session',
            color: 'text-forest-700',
        },
        {
            id: 'remember',
            label: 'Remember Something',
            description: 'AI memory aids & mnemonics',
            icon: MemoryIcon,
            href: '/app/remember',
            color: 'text-forest-700',
        },
        {
            id: 'vault',
            label: 'My Loops',
            description: `${loops.length} saved loops`,
            icon: VaultIcon,
            href: '/app/vault',
            color: 'text-forest-700',
        },
        {
            id: 'progress',
            label: 'Progress',
            description: 'Habits & consistency tracking',
            icon: ProgressIcon,
            href: '/app/progress',
            color: 'text-forest-700',
        },
    ];

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
            {/* Daily Briefing Card */}
            <section className="bg-parchment-100 rounded-xl border border-forest-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BriefingIcon className="w-5 h-5 text-forest-600" />
                        <h2 className="font-serif text-lg font-bold text-forest-700">
                            Daily Briefing
                        </h2>
                    </div>
                    <button
                        onClick={handleGenerateBriefing}
                        disabled={isBriefingLoading}
                        className="p-2 rounded-lg text-forest-500 hover:bg-parchment-300 transition-colors disabled:opacity-50"
                        title="Generate new briefing"
                    >
                        <RefreshIcon className={`w-4 h-4 ${isBriefingLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {briefingText ? (
                    <p className="text-sm text-forest-600 leading-relaxed">
                        {briefingText}
                    </p>
                ) : (
                    <p className="text-sm text-forest-400 italic">
                        {isBriefingLoading ? 'Generating your briefing...' : 'Tap refresh to generate your daily mental briefing.'}
                    </p>
                )}
            </section>

            {/* 5 Action Cards */}
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <Link
                            key={action.id}
                            href={action.href}
                            className="action-card flex flex-col items-center text-center gap-3"
                            id={`action-${action.id}`}
                        >
                            <Icon className={`w-8 h-8 ${action.color}`} />
                            <div>
                                <h3 className="font-serif text-sm font-bold text-forest-700">
                                    {action.label}
                                </h3>
                                <p className="text-xs text-forest-400 mt-0.5">
                                    {action.description}
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </section>

            {/* Quick Loops (Pinned) */}
            {pinnedLoops.length > 0 && (
                <section className="space-y-3">
                    <h2 className="font-serif text-lg font-bold text-forest-700 flex items-center gap-2">
                        <PinFilledIcon className="w-4 h-4 text-amber-500" />
                        Quick Loops
                    </h2>
                    <div className="space-y-2">
                        {pinnedLoops.map((loop) => (
                            <div
                                key={loop.id}
                                className="bg-parchment-100 rounded-lg border border-forest-100 p-3 flex items-center justify-between"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-forest-700 truncate">
                                        {loop.title}
                                    </h4>
                                    <p className="text-xs text-forest-400 mt-0.5">
                                        {loop.category} · {Math.round(loop.duration)}s
                                    </p>
                                </div>
                                <button
                                    onClick={() => loadAndPlay(loop)}
                                    className="p-2 rounded-lg bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors"
                                    title="Play loop"
                                >
                                    <PlayIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

