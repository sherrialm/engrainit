'use client';

/**
 * Home Hub — Daily Reliance Dashboard
 *
 * Layout (top to bottom):
 *   1. Start My Day card (prominent)
 *   2. Quick Loops (pinned, or fallback to recently played)
 *   3. Suggested for You (smart resurfacing)
 *   4. 5 Action Cards
 *   5. Daily Briefing card
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore, usePinnedLoops } from '@/stores/vaultStore';
import { useTierStore } from '@/stores/tierStore';
import { useAudioStore } from '@/stores/audioStore';
import {
    LoopIcon, SessionIcon, MemoryIcon, VaultIcon, ProgressIcon,
    BriefingIcon, PlayIcon, RefreshIcon, PinFilledIcon, CheckIcon,
} from '@/components/Icons';
import { generateBriefing } from '@/services/AIService';
import { getCachedBriefing, saveBriefing } from '@/services/BriefingService';
import type { Loop, LoopTag } from '@/types';

// ── Helpers ───────────────────────────────────────────────────

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function formatBriefingDate() {
    return new Date().toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

function daysSince(date: Date): number {
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Smart Resurfacing Logic ───────────────────────────────────

interface Suggestion {
    loop: Loop;
    reason: string;
}

function getSuggestions(loops: Loop[]): Suggestion[] {
    const now = new Date();
    const hour = now.getHours();
    const isBeforeNoon = hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;
    const suggestions: Suggestion[] = [];

    // 1. Dormant loops (not updated in 7+ days)
    const dormant = loops
        .filter(l => daysSince(l.updatedAt) >= 7)
        .sort((a, b) => daysSince(b.updatedAt) - daysSince(a.updatedAt))
        .slice(0, 2);

    for (const loop of dormant) {
        suggestions.push({
            loop,
            reason: `Not played in ${daysSince(loop.updatedAt)} days`,
        });
    }

    // 2. Time-aware suggestions
    if (isBeforeNoon && suggestions.length < 3) {
        const morningReady = loops
            .filter(l => l.tags?.some(t => t === 'identity' || t === 'focus'))
            .filter(l => !suggestions.some(s => s.loop.id === l.id))
            .slice(0, 2);

        for (const loop of morningReady) {
            if (suggestions.length >= 3) break;
            const tag = loop.tags?.includes('identity') ? 'identity' : 'focus';
            suggestions.push({
                loop,
                reason: tag === 'identity' ? 'Reinforce your identity this morning' : 'Set your focus for the day',
            });
        }
    } else if (isAfternoon && suggestions.length < 3) {
        const focusLoops = loops
            .filter(l => l.tags?.some(t => t === 'focus'))
            .filter(l => !suggestions.some(s => s.loop.id === l.id))
            .slice(0, 2);

        for (const loop of focusLoops) {
            if (suggestions.length >= 3) break;
            suggestions.push({
                loop,
                reason: 'Refocus for the afternoon',
            });
        }
    }

    // 3. Recently created (last 48 hours, not already suggested)
    if (suggestions.length < 3) {
        const recent = loops
            .filter(l => daysSince(l.createdAt) <= 2)
            .filter(l => !suggestions.some(s => s.loop.id === l.id))
            .slice(0, 1);

        for (const loop of recent) {
            if (suggestions.length >= 3) break;
            suggestions.push({
                loop,
                reason: 'Recently created',
            });
        }
    }

    return suggestions.slice(0, 3);
}

// ── Home Hub ──────────────────────────────────────────────────

export default function AppDashboard() {
    const { user } = useAuthStore();
    const { loops, fetchLoops, addLoop } = useVaultStore();
    const pinnedLoops = usePinnedLoops();
    const { tier } = useTierStore();
    const { loadAndPlay } = useAudioStore();

    // Briefing state
    const [briefingText, setBriefingText] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [isBriefingSaved, setIsBriefingSaved] = useState(false);
    const [isSavingBriefing, setIsSavingBriefing] = useState(false);

    // Morning flow completion check
    const [morningDone, setMorningDone] = useState(false);

    useEffect(() => {
        const key = `engrainit_morning_${getTodayKey()}`;
        setMorningDone(localStorage.getItem(key) === 'done');
    }, []);

    // Fetch loops on mount
    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Load today's briefing from Firestore on mount
    useEffect(() => {
        if (user?.uid) {
            loadCachedBriefing(user.uid);
        }
    }, [user?.uid]);

    // Quick loops: pinned first, fallback to 3 most recent
    const quickLoops = useMemo(() => {
        if (pinnedLoops.length > 0) return pinnedLoops;
        return [...loops]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3);
    }, [pinnedLoops, loops]);

    // Smart resurfacing
    const suggestions = useMemo(() => getSuggestions(loops), [loops]);

    async function loadCachedBriefing(uid: string) {
        const todayKey = getTodayKey();
        const cached = await getCachedBriefing(uid, todayKey);
        if (cached) {
            setBriefingText(cached);
            return;
        }
        // Fall back to localStorage (migration)
        const localCached = localStorage.getItem(`engrainit_briefing_${todayKey}`);
        if (localCached) {
            setBriefingText(localCached);
            await saveBriefing(uid, todayKey, localCached);
            localStorage.removeItem(`engrainit_briefing_${todayKey}`);
        }
    }

    async function handleGenerateBriefing() {
        if (!user?.uid) return;
        setIsBriefingLoading(true);
        setIsBriefingSaved(false);
        try {
            const text = await generateBriefing({
                goals: loops.filter(l => l.category === 'vision').map(l => l.title).slice(0, 3),
                habits: [],
                recentMoods: [],
                recentLoopNames: loops.slice(0, 5).map(l => l.title),
            });
            const todayKey = getTodayKey();
            await saveBriefing(user.uid, todayKey, text);
            setBriefingText(text);
        } catch (err) {
            console.error('[Briefing] Generation failed:', err);
        } finally {
            setIsBriefingLoading(false);
        }
    }

    async function handleSaveBriefingAsLoop() {
        if (!user?.uid || !briefingText || isBriefingSaved) return;
        setIsSavingBriefing(true);
        try {
            await addLoop(user.uid, {
                title: `Daily Briefing – ${formatBriefingDate()}`,
                category: 'vision',
                sourceType: 'tts',
                text: briefingText,
                audioUrl: '',
                voiceId: 'calm-mentor',
                duration: 0,
                intervalSeconds: 180,
                tags: ['identity', 'briefing'],
            });
            setIsBriefingSaved(true);
        } catch (err) {
            console.error('[Briefing] Save as loop failed:', err);
        } finally {
            setIsSavingBriefing(false);
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
        },
        {
            id: 'session',
            label: 'Start Session',
            description: 'Playlist-style loop playback',
            icon: SessionIcon,
            href: '/app/session',
        },
        {
            id: 'remember',
            label: 'Remember Something',
            description: 'AI memory aids & mnemonics',
            icon: MemoryIcon,
            href: '/app/remember',
        },
        {
            id: 'vault',
            label: 'My Loops',
            description: `${loops.length} saved loops`,
            icon: VaultIcon,
            href: '/app/vault',
        },
        {
            id: 'progress',
            label: 'Progress',
            description: 'Habits & consistency tracking',
            icon: ProgressIcon,
            href: '/app/progress',
        },
    ];

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

            {/* ── Brand Statement ──────────────────────────────── */}
            <p className="text-xs text-forest-400 tracking-wide text-center">
                What you repeat shapes who you become.
            </p>

            {/* ── Start My Day ──────────────────────────────── */}
            <Link
                href="/app/morning"
                className="block bg-gradient-to-br from-forest-700 to-forest-800 rounded-2xl p-6 text-parchment-100 shadow-lg hover:shadow-xl transition-all group"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-xl font-bold mb-1">
                            Start My Day
                        </h2>
                        <p className="text-parchment-300 text-sm">
                            ~90 second mental alignment ritual
                        </p>
                        {!morningDone && (
                            <p className="text-parchment-400 text-xs mt-1">
                                Begin your day with a short mental alignment.
                            </p>
                        )}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        morningDone
                            ? 'bg-green-500/30'
                            : 'bg-parchment-100/15 group-hover:bg-parchment-100/25'
                    }`}>
                        {morningDone ? (
                            <CheckIcon className="w-6 h-6 text-green-300" />
                        ) : (
                            <BriefingIcon className="w-6 h-6 text-parchment-100" />
                        )}
                    </div>
                </div>
                {morningDone && (
                    <p className="text-xs text-green-300 mt-2 flex items-center gap-1">
                        <CheckIcon className="w-3 h-3" /> Completed today · tap to run again
                    </p>
                )}
            </Link>

            {/* ── First Loop Guidance (empty vault) ──────────── */}
            {loops.length === 0 && (
                <Link
                    href="/app/generate"
                    className="block bg-amber-50 border border-amber-200 rounded-xl p-5 text-center hover:bg-amber-100 transition-colors"
                >
                    <p className="text-sm font-medium text-amber-800 mb-1">
                        Create your first loop to begin training your mind.
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        Generate Loop →
                    </span>
                </Link>
            )}

            {/* ── Quick Loops ───────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="font-serif text-sm font-bold text-forest-700 flex items-center gap-2 uppercase tracking-wide">
                    {pinnedLoops.length > 0 ? (
                        <>
                            <PinFilledIcon className="w-3.5 h-3.5 text-amber-500" />
                            Pinned Loops
                        </>
                    ) : (
                        'Recent Loops'
                    )}
                </h2>
                {quickLoops.length > 0 ? (
                    <div className="space-y-2">
                        {quickLoops.map((loop) => (
                            <div
                                key={loop.id}
                                className="bg-parchment-100 rounded-lg border border-forest-100 p-3 flex items-center justify-between"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-forest-700 truncate">
                                        {loop.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-forest-400">{loop.category}</span>
                                        {loop.tags && loop.tags.length > 0 && (
                                            <div className="flex gap-1">
                                                {loop.tags.map(tag => (
                                                    <span key={tag} className="text-[10px] bg-parchment-300 text-forest-500 px-1.5 py-0.5 rounded-full">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => loadAndPlay(loop)}
                                    className="p-2 rounded-lg bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors flex-shrink-0"
                                    title="Play loop"
                                >
                                    <PlayIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-parchment-100 rounded-lg border border-forest-100 p-4 text-center">
                        <p className="text-sm text-forest-400">No loops yet.</p>
                        <Link href="/app/generate" className="text-sm text-forest-600 font-medium hover:text-forest-700 transition-colors">
                            Create your first loop →
                        </Link>
                    </div>
                )}
            </section>

            {/* ── Suggested for You ────────────────────────── */}
            {suggestions.length > 0 && (
                <section className="space-y-3">
                    <h2 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                        Suggested for You
                    </h2>
                    <div className="space-y-2">
                        {suggestions.map(({ loop, reason }) => (
                            <div
                                key={loop.id}
                                className="bg-parchment-100/60 rounded-lg border border-dashed border-forest-200 p-3 flex items-center justify-between"
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-forest-700 truncate">
                                        {loop.title}
                                    </h4>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        {reason}
                                    </p>
                                </div>
                                <button
                                    onClick={() => loadAndPlay(loop)}
                                    className="p-2 rounded-lg bg-parchment-300 text-forest-600 hover:bg-forest-700 hover:text-parchment-100 transition-colors flex-shrink-0"
                                    title="Play loop"
                                >
                                    <PlayIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── 5 Action Cards ────────────────────────────── */}
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
                            <Icon className="w-8 h-8 text-forest-700" />
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

            {/* ── Daily Briefing Card ───────────────────────── */}
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
                    <>
                        <p className="text-sm text-forest-600 leading-relaxed">
                            {briefingText}
                        </p>
                        <button
                            onClick={handleSaveBriefingAsLoop}
                            disabled={isBriefingSaved || isSavingBriefing}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                                isBriefingSaved
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-parchment-300 text-forest-600 hover:bg-forest-700 hover:text-parchment-100'
                            }`}
                        >
                            {isBriefingSaved ? (
                                <span className="flex items-center gap-1">
                                    <CheckIcon className="w-3 h-3" /> Saved to Vault
                                </span>
                            ) : isSavingBriefing ? (
                                'Saving...'
                            ) : (
                                'Save as Loop'
                            )}
                        </button>
                    </>
                ) : (
                    <p className="text-sm text-forest-400 italic">
                        {isBriefingLoading ? 'Generating your briefing...' : 'Tap refresh to generate your daily mental briefing.'}
                    </p>
                )}
            </section>
        </div>
    );
}
