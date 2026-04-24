'use client';

/**
 * Morning Alignment Flow — "Start My Day"
 *
 * A single-tap daily mental reset ritual (~60–90 seconds).
 * Auto-advances through 4 segments:
 *   1. Daily Briefing
 *   2. Identity Loop
 *   3. Focus Loop
 *   4. Closing Encouragement
 *
 * Completion triggers chime and streak tracking.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { BriefingIcon, LoopIcon, CheckIcon } from '@/components/Icons';
import { generateBriefing } from '@/services/AIService';
import { getCachedBriefing, saveBriefing } from '@/services/BriefingService';
import { playCompletionChime } from '@/services/chime';
import { getMorningStreakInfo, getStreakMessage } from '@/services/morningStreakService';
import type { Loop, LoopTag } from '@/types';

// ── Segment definitions ───────────────────────────────────────

interface Segment {
    id: string;
    label: string;
    icon: 'briefing' | 'identity' | 'focus' | 'encouragement';
    durationMs: number;
}

const SEGMENTS: Segment[] = [
    { id: 'briefing', label: 'Daily Briefing', icon: 'briefing', durationMs: 20000 },
    { id: 'identity', label: 'Identity Loop', icon: 'identity', durationMs: 20000 },
    { id: 'focus', label: 'Focus Loop', icon: 'focus', durationMs: 20000 },
    { id: 'encouragement', label: 'Go Time', icon: 'encouragement', durationMs: 10000 },
];

const TOTAL_MS = SEGMENTS.reduce((sum, s) => sum + s.durationMs, 0);

const ENCOURAGEMENTS = [
    "You are prepared. You are aligned. Now go make it happen.",
    "Today is yours. Every action you take reinforces who you're becoming.",
    "You've set your mind. Now trust the process and show up fully.",
    "Clarity is your superpower today. Move with intention.",
    "You are exactly where you need to be. Now take the next step.",
];

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function getLoopsByTag(loops: Loop[], tag: LoopTag): Loop[] {
    return loops.filter(l => l.tags?.includes(tag));
}

// ── Morning Flow Page ─────────────────────────────────────────

export default function MorningFlowPage() {
    const { user } = useAuthStore();
    const { loops, fetchLoops } = useVaultStore();

    // Flow state
    const [phase, setPhase] = useState<'ready' | 'playing' | 'complete'>('ready');
    const [currentSegment, setCurrentSegment] = useState(0);
    const [segmentProgress, setSegmentProgress] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);

    // Content
    const [briefingText, setBriefingText] = useState<string | null>(null);
    const [identityLoop, setIdentityLoop] = useState<Loop | null>(null);
    const [focusLoop, setFocusLoop] = useState<Loop | null>(null);
    const [encouragement, setEncouragement] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Completion tracking
    const [completedToday, setCompletedToday] = useState(false);

    // Streak info — computed after completion
    const [streakInfo, setStreakInfo] = useState({ currentStreak: 0, totalCompletions: 0, completedToday: false, last7Days: [false, false, false, false, false, false, false] });

    // Check if already completed today
    useEffect(() => {
        const key = `engrainit_morning_${getTodayKey()}`;
        if (localStorage.getItem(key) === 'done') {
            setCompletedToday(true);
        }
        setStreakInfo(getMorningStreakInfo());
    }, []);

    // Load loops
    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Pick loops once they're loaded
    const identityLoops = useMemo(() => getLoopsByTag(loops, 'identity'), [loops]);
    const focusLoops = useMemo(() => getLoopsByTag(loops, 'focus'), [loops]);

    async function handleStart() {
        setIsLoading(true);

        // 1. Get or generate briefing
        let briefing = '';
        if (user?.uid) {
            const todayKey = getTodayKey();
            const cached = await getCachedBriefing(user.uid, todayKey);
            if (cached) {
                briefing = cached;
            } else {
                briefing = await generateBriefing({
                    goals: loops.filter(l => l.category === 'vision').map(l => l.title).slice(0, 3),
                    habits: [],
                    recentMoods: [],
                    recentLoopNames: loops.slice(0, 5).map(l => l.title),
                });
                await saveBriefing(user.uid, todayKey, briefing);
            }
        }
        setBriefingText(briefing || "Good morning. Today is a fresh opportunity to align your mind and move with purpose.");

        // 2. Pick identity and focus loops
        setIdentityLoop(pickRandom(identityLoops) || null);
        setFocusLoop(pickRandom(focusLoops) || null);

        // 3. Pick encouragement
        setEncouragement(pickRandom(ENCOURAGEMENTS) || ENCOURAGEMENTS[0]);

        setIsLoading(false);
        setPhase('playing');
        setCurrentSegment(0);
        setSegmentProgress(0);
        setOverallProgress(0);
    }

    // Auto-advance timer
    useEffect(() => {
        if (phase !== 'playing') return;

        const segment = SEGMENTS[currentSegment];
        if (!segment) return;

        const intervalMs = 50;
        let elapsed = 0;

        const timer = setInterval(() => {
            elapsed += intervalMs;
            const segProg = Math.min(elapsed / segment.durationMs, 1);
            setSegmentProgress(segProg);

            // Calculate overall progress
            const completedMs = SEGMENTS.slice(0, currentSegment).reduce((s, seg) => s + seg.durationMs, 0);
            const overallProg = (completedMs + elapsed) / TOTAL_MS;
            setOverallProgress(Math.min(overallProg, 1));

            if (elapsed >= segment.durationMs) {
                clearInterval(timer);
                // Move to next segment or complete
                if (currentSegment < SEGMENTS.length - 1) {
                    setCurrentSegment(prev => prev + 1);
                    setSegmentProgress(0);
                } else {
                    handleComplete();
                }
            }
        }, intervalMs);

        return () => clearInterval(timer);
    }, [phase, currentSegment]);

    function handleComplete() {
        setPhase('complete');
        setOverallProgress(1);
        const key = `engrainit_morning_${getTodayKey()}`;
        localStorage.setItem(key, 'done');
        setCompletedToday(true);
        playCompletionChime();
        // Refresh streak info after marking complete
        setStreakInfo(getMorningStreakInfo());
    }

    function handleSkipSegment() {
        if (currentSegment < SEGMENTS.length - 1) {
            setCurrentSegment(prev => prev + 1);
            setSegmentProgress(0);
        } else {
            handleComplete();
        }
    }

    // Get content for current segment
    function getSegmentContent(): { title: string; body: string } {
        const seg = SEGMENTS[currentSegment];
        if (!seg) return { title: '', body: '' };

        switch (seg.id) {
            case 'briefing':
                return {
                    title: 'Daily Briefing',
                    body: briefingText || 'Your briefing is ready.',
                };
            case 'identity':
                return {
                    title: identityLoop?.title || 'Identity Reinforcement',
                    body: identityLoop?.text || 'I am becoming who I am meant to be.\nEvery choice reinforces my identity.\nI grow stronger with each repetition.',
                };
            case 'focus':
                return {
                    title: focusLoop?.title || 'Focus Alignment',
                    body: focusLoop?.text || 'I am focused and clear.\nI direct my energy toward what matters.\nI move with intention.',
                };
            case 'encouragement':
                return {
                    title: 'Go Time',
                    body: encouragement,
                };
            default:
                return { title: '', body: '' };
        }
    }

    const content = phase === 'playing' ? getSegmentContent() : { title: '', body: '' };
    const hasLoops = identityLoops.length > 0 || focusLoops.length > 0;
    const streakMessage = getStreakMessage(streakInfo.currentStreak, streakInfo.completedToday);

    return (
        <div className="min-h-[80vh] flex flex-col max-w-2xl mx-auto px-4 py-6">
            {/* Ready State */}
            {phase === 'ready' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-forest-700 flex items-center justify-center glow-pulse">
                        <BriefingIcon className="w-10 h-10 text-parchment-100" />
                    </div>
                    <div>
                        <h1 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                            Start My Day
                        </h1>
                        <p className="text-forest-500">
                            ~90 second mental alignment ritual
                        </p>
                        <p className="text-xs text-forest-400 mt-1">
                            Train your mind through intelligent repetition.
                        </p>
                    </div>

                    {/* Streak badge on ready screen */}
                    {streakInfo.currentStreak > 0 && (
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-100 px-4 py-2 rounded-full">
                            🔥 {streakInfo.currentStreak} day streak
                        </div>
                    )}

                    {/* Segment preview */}
                    <div className="w-full max-w-xs space-y-2">
                        {SEGMENTS.map((seg, i) => (
                            <div key={seg.id} className="flex items-center gap-3 text-sm text-forest-500">
                                <span className="w-5 h-5 rounded-full bg-parchment-300 flex items-center justify-center text-xs font-bold text-forest-600">
                                    {i + 1}
                                </span>
                                <span>{seg.label}</span>
                                <span className="text-xs text-forest-400 ml-auto">
                                    {Math.round(seg.durationMs / 1000)}s
                                </span>
                            </div>
                        ))}
                    </div>

                    {!hasLoops && (
                        <div className="bg-parchment-100 border border-forest-100 rounded-xl px-4 py-3 text-left space-y-1 max-w-xs w-full">
                            <p className="text-xs font-semibold text-forest-700">
                                ✨ First time? No problem.
                            </p>
                            <p className="text-xs text-forest-500 leading-relaxed">
                                This ritual uses built-in affirmations until you create your own loops. After this, build your first personal loop to make it yours.
                            </p>
                        </div>
                    )}

                    {completedToday && (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-full">
                            <CheckIcon className="w-4 h-4" />
                            Completed today
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="btn-primary px-8 py-3 text-lg disabled:opacity-50"
                    >
                        {isLoading ? 'Preparing your daily briefing…' : completedToday ? 'Run Again' : 'Begin'}
                    </button>

                    <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            )}

            {/* Playing State */}
            {phase === 'playing' && (
                <div className="flex-1 flex flex-col">
                    {/* Overall progress bar */}
                    <div className="h-1 bg-parchment-300 rounded-full overflow-hidden mb-6">
                        <div
                            className="h-full bg-forest-600 rounded-full transition-all duration-100"
                            style={{ width: `${overallProgress * 100}%` }}
                        />
                    </div>

                    {/* Segment indicators */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {SEGMENTS.map((seg, i) => (
                            <div
                                key={seg.id}
                                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                    i < currentSegment ? 'bg-forest-600' :
                                    i === currentSegment ? 'bg-amber-500 ring-2 ring-amber-200' :
                                    'bg-parchment-300'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Content card */}
                    <div className="flex-1 flex items-center justify-center">
                        <div className="bg-parchment-100 rounded-2xl border border-forest-100 p-8 max-w-md w-full text-center space-y-4 shadow-lg">
                            <p className="text-xs text-forest-400 uppercase tracking-widest">
                                {SEGMENTS[currentSegment]?.label}
                            </p>
                            <h2 className="font-serif text-xl font-bold text-forest-700">
                                {content.title}
                            </h2>
                            <p className="text-sm text-forest-600 leading-relaxed italic">
                                {content.body}
                            </p>

                            {/* Segment progress */}
                            <div className="h-0.5 bg-parchment-300 rounded-full overflow-hidden mt-4">
                                <div
                                    className="h-full bg-forest-400 rounded-full transition-all duration-100"
                                    style={{ width: `${segmentProgress * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4 py-6">
                        <button
                            onClick={handleSkipSegment}
                            className="text-sm text-forest-400 hover:text-forest-600 transition-colors"
                        >
                            Skip →
                        </button>
                    </div>
                </div>
            )}

            {/* Complete State — Enhanced with streak + next steps */}
            {phase === 'complete' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckIcon className="w-10 h-10 text-green-700" />
                    </div>
                    <div>
                        <h1 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                            Aligned
                        </h1>
                        <p className="text-forest-500">
                            Your morning mental reset is complete.
                        </p>
                    </div>

                    {/* Streak & progress stats */}
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 max-w-xs w-full space-y-3">
                        {streakInfo.currentStreak > 0 && (
                            <div className="flex items-center justify-center gap-2 text-lg font-bold text-amber-700">
                                🔥 Day {streakInfo.currentStreak}
                            </div>
                        )}
                        <p className="text-sm text-forest-600 italic leading-relaxed">
                            {streakMessage}
                        </p>
                        {streakInfo.totalCompletions > 1 && (
                            <p className="text-xs text-forest-400">
                                {streakInfo.totalCompletions} total morning alignments
                            </p>
                        )}

                        {/* Last 7 days mini-dots */}
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                            {streakInfo.last7Days.map((done, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full ${
                                        done ? 'bg-forest-600' : 'bg-parchment-300 border border-forest-200'
                                    }`}
                                    title={done ? 'Completed' : 'Missed'}
                                />
                            ))}
                        </div>
                        <p className="text-[10px] text-forest-400">Last 7 days</p>
                    </div>

                    {/* Encouragement quote */}
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 max-w-xs w-full">
                        <p className="text-sm text-forest-600 italic leading-relaxed">
                            &ldquo;{encouragement}&rdquo;
                        </p>
                    </div>

                    {/* Next step CTAs */}
                    <div className="flex flex-col gap-3 max-w-xs w-full">
                        <Link
                            href="/app/session"
                            className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-parchment-100 bg-forest-700 hover:bg-forest-600 transition-colors"
                        >
                            Continue to a Session →
                        </Link>
                        <div className="flex gap-3">
                            <Link
                                href="/app"
                                className="flex-1 py-3 rounded-xl text-sm font-medium text-center text-forest-700 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                            >
                                Back to Home
                            </Link>
                            <button
                                onClick={() => {
                                    setPhase('ready');
                                    setCurrentSegment(0);
                                    setSegmentProgress(0);
                                    setOverallProgress(0);
                                }}
                                className="flex-1 py-3 rounded-xl text-sm font-medium text-center text-forest-500 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                            >
                                Run Again
                            </button>
                        </div>
                        <Link
                            href="/app/generate"
                            className="block text-xs text-forest-400 hover:text-forest-600 transition-colors text-center pt-1"
                        >
                            Create a New Loop
                        </Link>
                    </div>

                    {/* First-run next step: encourage loop creation */}
                    {!hasLoops && (
                        <div className="max-w-xs w-full text-center space-y-2">
                            <p className="text-xs text-forest-400">
                                Ready to make this practice your own?
                            </p>
                            <Link
                                href="/app/generate"
                                className="block w-full py-3 rounded-xl text-sm font-semibold text-forest-700 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                            >
                                Create My First Personal Loop →
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
