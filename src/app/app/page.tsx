'use client';

/**
 * Home Hub — Soft-Launch Dashboard
 *
 * Layout (top to bottom):
 *   1. Greeting + Tagline
 *   2. Three Primary Actions (Session, Loop, Vault)
 *   3. Today's Practice (returning users — streak & daily status)
 *   4. Daily Briefing
 *   5. Suggested for You
 *   6. Recent Loops
 *   7. Secondary Action Cards
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

// Inline PauseIcon and SpinnerIcon for playback states
function PauseIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
    );
}

function SpinnerIcon({ className }: { className?: string }) {
    return (
        <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
    );
}
import { generateBriefing } from '@/services/AIService';
import { getCachedBriefing, saveBriefing } from '@/services/BriefingService';
import { getMorningStreakInfo, getStreakMessage } from '@/services/morningStreakService';
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
    const { loops, fetchLoops, addLoop, isLoading: vaultLoading, error: vaultError, clearError: clearVaultError } = useVaultStore();
    const pinnedLoops = usePinnedLoops();
    const { tier } = useTierStore();
    const { loadAndPlay, isLoading, loadingLoopId, loadError, isPlaying, currentLoop, pause } = useAudioStore();

    // Briefing state
    const [briefingText, setBriefingText] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [briefingError, setBriefingError] = useState<string | null>(null);
    const [isBriefingSaved, setIsBriefingSaved] = useState(false);
    const [isSavingBriefing, setIsSavingBriefing] = useState(false);

    // Morning flow completion & streak
    const [morningDone, setMorningDone] = useState(false);
    const [streakInfo, setStreakInfo] = useState({ currentStreak: 0, totalCompletions: 0, completedToday: false, last7Days: [false, false, false, false, false, false, false] });

    useEffect(() => {
        const key = `engrainit_morning_${getTodayKey()}`;
        setMorningDone(localStorage.getItem(key) === 'done');
        setStreakInfo(getMorningStreakInfo());
    }, []);

    // Fetch loops on mount
    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // First-run: vault data has loaded and user truly has no loops yet
    const isFirstRun = !vaultLoading && loops.length === 0;

    // Load today's briefing from Firestore on mount
    useEffect(() => {
        if (user?.uid) {
            loadCachedBriefing(user.uid);
        }
    }, [user?.uid]);

    // Recent loops: 3 most recently created
    const recentLoops = useMemo(() => {
        return [...loops]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3);
    }, [loops]);

    // Smart resurfacing — distinctly different from recent
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
        setBriefingError(null);
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
            setBriefingError('Couldn\u2019t generate your briefing right now. Tap to try again.');
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

    // ── Secondary Action Cards ────────────────────────────────

    const actions = [
        {
            id: 'generate',
            label: 'Generate Loop',
            description: 'Create a personalized training loop',
            icon: LoopIcon,
            href: '/app/generate',
        },
        {
            id: 'session',
            label: 'Start Session',
            description: 'Focus session with your loops',
            icon: SessionIcon,
            href: '/app/session',
        },
        {
            id: 'remember',
            label: 'Remember Something',
            description: 'Memorize with intelligent repetition',
            icon: MemoryIcon,
            href: '/app/remember',
        },
        {
            id: 'vault',
            label: 'My Loops',
            description: `${loops.length} saved loop${loops.length === 1 ? '' : 's'}`,
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

    const streakMessage = getStreakMessage(streakInfo.currentStreak, streakInfo.completedToday);

    // Display name: prefer displayName, fall back to first part of email
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'there';

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

            {/* ── Greeting + Tagline ──────────────────────────── */}
            <section className="text-center space-y-2 pt-2">
                <p className="text-sm text-forest-500 font-medium">
                    Hello, {displayName}
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-800 leading-tight">
                    Train your mind through intelligent repetition.
                </h2>
                <p className="text-sm text-forest-400">
                    Choose how you want to begin today.
                </p>
            </section>

            {/* ── Vault Fetch Error ── */}
            {vaultError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-700">
                        Couldn&rsquo;t load your loops. Please check your connection.
                    </p>
                    <button
                        onClick={() => { clearVaultError(); user?.uid && fetchLoops(user.uid); }}
                        className="text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ── Three Primary Actions ──────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="primary-actions">
                <Link
                    href="/app/session"
                    className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-800 text-parchment-100 shadow-lg hover:shadow-xl hover:from-forest-600 hover:to-forest-700 transition-all group"
                    id="action-start-session"
                >
                    <SessionIcon className="w-8 h-8 text-parchment-100 group-hover:scale-110 transition-transform" />
                    <span className="font-serif text-base font-bold">Start a Session</span>
                    <span className="text-xs text-parchment-300">Play your saved loops</span>
                </Link>

                <Link
                    href="/app/generate"
                    className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-800 text-parchment-100 shadow-lg hover:shadow-xl hover:from-forest-600 hover:to-forest-700 transition-all group"
                    id="action-create-loop"
                >
                    <LoopIcon className="w-8 h-8 text-parchment-100 group-hover:scale-110 transition-transform" />
                    <span className="font-serif text-base font-bold">Create a Loop</span>
                    <span className="text-xs text-parchment-300">Build a new loop</span>
                </Link>

                <Link
                    href="/app/vault"
                    className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-800 text-parchment-100 shadow-lg hover:shadow-xl hover:from-forest-600 hover:to-forest-700 transition-all group"
                    id="action-open-vault"
                >
                    <VaultIcon className="w-8 h-8 text-parchment-100 group-hover:scale-110 transition-transform" />
                    <span className="font-serif text-base font-bold">Open Vault</span>
                    <span className="text-xs text-parchment-300">Your saved loops</span>
                </Link>
            </section>

            {/* ── Hero: Create First Loop (zero-loop users only, after data loads) ── */}
            {isFirstRun && (
                <Link
                    href="/app/generate"
                    className="block bg-gradient-to-br from-forest-600 to-forest-800 rounded-2xl p-7 text-parchment-100 shadow-lg hover:shadow-xl transition-all group"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-parchment-300 text-xs uppercase tracking-widest mb-2">Step 1 of your practice</p>
                            <h2 className="font-serif text-2xl font-bold mb-2 leading-tight">
                                Create Your First Training Loop
                            </h2>
                            <p className="text-parchment-300 text-sm leading-relaxed">
                                Your mental practice starts here. In 60 seconds, you'll have a personalized loop ready to use.
                            </p>
                        </div>
                        <div className="w-12 h-12 flex-shrink-0 rounded-full bg-parchment-100/20 group-hover:bg-parchment-100/30 flex items-center justify-center transition-colors text-xl">
                            ✨
                        </div>
                    </div>
                    <div className="mt-5">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold bg-parchment-100/20 group-hover:bg-parchment-100/30 transition-colors px-4 py-2 rounded-full">
                            Build My First Loop →
                        </span>
                    </div>
                </Link>
            )}

            {/* ── Today's Practice — returning users only ────── */}
            {!isFirstRun && (
                <section className="bg-gradient-to-br from-parchment-100 to-parchment-200 rounded-2xl border border-forest-100 p-5 space-y-3" id="todays-practice">
                    <div className="flex items-center justify-between">
                        <h2 className="font-serif text-lg font-bold text-forest-700">
                            Today&rsquo;s Practice
                        </h2>
                        {streakInfo.currentStreak > 0 && (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                                🔥 {streakInfo.currentStreak} day{streakInfo.currentStreak !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Daily checklist */}
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 text-sm ${morningDone ? 'text-green-700' : 'text-forest-400'}`}>
                            {morningDone ? (
                                <CheckIcon className="w-4 h-4 text-green-600" />
                            ) : (
                                <span className="w-4 h-4 rounded-full border-2 border-forest-300 inline-block" />
                            )}
                            <span>Morning Ritual</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-forest-400">
                            <span className="w-4 h-4 rounded-full border-2 border-forest-300 inline-block" />
                            <span>{loops.length} loop{loops.length !== 1 ? 's' : ''} ready</span>
                        </div>
                    </div>

                    {/* Streak message */}
                    <p className="text-xs text-forest-500 italic">
                        {streakMessage}
                    </p>

                    {/* CTA */}
                    {!morningDone ? (
                        <Link
                            href="/app/morning"
                            className="inline-flex items-center gap-2 text-sm font-semibold bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors px-4 py-2 rounded-full"
                        >
                            Start Morning Ritual →
                        </Link>
                    ) : (
                        <div className="flex gap-2">
                            <Link
                                href="/app/session"
                                className="inline-flex items-center gap-2 text-sm font-medium bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors px-4 py-2 rounded-full"
                            >
                                Continue with a Session
                            </Link>
                            <Link
                                href="/app/progress"
                                className="inline-flex items-center gap-2 text-sm font-medium bg-parchment-300 text-forest-600 hover:bg-parchment-400 transition-colors px-4 py-2 rounded-full"
                            >
                                View Progress
                            </Link>
                        </div>
                    )}
                </section>
            )}

            {/* ── Daily Briefing Card (high in hierarchy) ── */}
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
                    <div>
                        {briefingError ? (
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-red-600">{briefingError}</p>
                                <button
                                    onClick={handleGenerateBriefing}
                                    className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-forest-400 italic">
                                    {isBriefingLoading
                                        ? 'Preparing your daily briefing…'
                                        : isFirstRun
                                            ? 'Create your first loop, then come back to generate a personalized daily briefing.'
                                            : 'Your personalized daily briefing is ready to generate.'}
                                </p>
                                {!isFirstRun && !isBriefingLoading && !briefingText && (
                                    <button
                                        onClick={handleGenerateBriefing}
                                        className="mt-2 text-sm font-medium bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors px-4 py-2 rounded-full"
                                    >
                                        Generate My Briefing
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* ── Suggested for You — returning users, distinct from recent ──── */}
            {!isFirstRun && suggestions.length > 0 && (
                <section className="space-y-3">
                    <div>
                        <h2 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                            Suggested for You
                        </h2>
                        <p className="text-xs text-forest-400 mt-0.5">
                            Loops you haven't played recently or match your current time of day
                        </p>
                    </div>
                    <div className="space-y-2">
                        {suggestions.map(({ loop, reason }) => {
                            const isThisLoading = isLoading && loadingLoopId === loop.id;
                            const isThisPlaying = isPlaying && currentLoop?.id === loop.id;
                            const isPlayable = !!(loop.audioUrl || loop.text);

                            return (
                            <div
                                key={loop.id}
                                className={`bg-parchment-100/60 rounded-lg border border-dashed p-3 flex items-center justify-between transition-colors ${
                                    isThisPlaying ? 'border-forest-500 bg-forest-50' : 'border-forest-200'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-forest-700 truncate">
                                        {loop.title}
                                    </h4>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        {isThisPlaying ? 'Now playing' : reason}
                                    </p>
                                </div>
                                {isPlayable ? (
                                    <button
                                        onClick={() => isThisPlaying ? pause() : loadAndPlay(loop)}
                                        disabled={isThisLoading}
                                        className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                                            isThisPlaying
                                                ? 'bg-forest-700 text-parchment-100'
                                                : 'bg-parchment-300 text-forest-600 hover:bg-forest-700 hover:text-parchment-100'
                                        } disabled:opacity-50`}
                                        title={isThisPlaying ? 'Pause' : isThisLoading ? 'Loading...' : 'Play loop'}
                                    >
                                        {isThisLoading ? (
                                            <SpinnerIcon className="w-4 h-4" />
                                        ) : isThisPlaying ? (
                                            <PauseIcon className="w-4 h-4" />
                                        ) : (
                                            <PlayIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-forest-400 px-2">No audio</span>
                                )}
                            </div>
                        )})}
                    </div>
                </section>
            )}

            {/* ── Recent Loops — distinct from suggestions ───────────────── */}
            {!isFirstRun && recentLoops.length > 0 && (
                <section className="space-y-3">
                    <div>
                        <h2 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                            Recent Loops
                        </h2>
                        <p className="text-xs text-forest-400 mt-0.5">
                            Your most recently created loops
                        </p>
                    </div>
                    <div className="space-y-2">
                        {recentLoops.map((loop) => {
                            const isThisLoading = isLoading && loadingLoopId === loop.id;
                            const isThisPlaying = isPlaying && currentLoop?.id === loop.id;
                            const isPlayable = !!(loop.audioUrl || loop.text);

                            return (
                            <div
                                key={loop.id}
                                className={`bg-parchment-100 rounded-lg border p-3 flex items-center justify-between transition-colors ${
                                    isThisPlaying ? 'border-forest-500 bg-forest-50' : 'border-forest-100'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-forest-700 truncate">
                                        {loop.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-forest-400">{loop.category}</span>
                                        {isThisPlaying && (
                                            <span className="text-[10px] bg-forest-700 text-parchment-100 px-1.5 py-0.5 rounded-full">Playing</span>
                                        )}
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
                                {isPlayable ? (
                                    <button
                                        onClick={() => isThisPlaying ? pause() : loadAndPlay(loop)}
                                        disabled={isThisLoading}
                                        className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                                            isThisPlaying
                                                ? 'bg-forest-600 text-parchment-100'
                                                : 'bg-forest-700 text-parchment-100 hover:bg-forest-600'
                                        } disabled:opacity-50`}
                                        title={isThisPlaying ? 'Pause' : isThisLoading ? 'Loading...' : 'Play loop'}
                                    >
                                        {isThisLoading ? (
                                            <SpinnerIcon className="w-4 h-4" />
                                        ) : isThisPlaying ? (
                                            <PauseIcon className="w-4 h-4" />
                                        ) : (
                                            <PlayIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-forest-400 px-2">No audio</span>
                                )}
                            </div>
                        )})}
                    </div>

                    {/* Inline playback error */}
                    {loadError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {loadError}
                        </p>
                    )}
                </section>
            )}

            {/* ── Secondary Action Cards ──────────────────────── */}
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
        </div>
    );
}
