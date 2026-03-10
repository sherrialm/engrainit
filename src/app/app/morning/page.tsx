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

    // Check if already completed today
    useEffect(() => {
        const key = `engrainit_morning_${getTodayKey()}`;
        if (localStorage.getItem(key) === 'done') {
            setCompletedToday(true);
        }
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
                    body: identityLoop?.text || "I am becoming the person I'm meant to be. Every thought, every action, every choice reinforces my identity.",
                };
            case 'focus':
                return {
                    title: focusLoop?.title || 'Focus Alignment',
                    body: focusLoop?.text || "I am focused. I am clear. I direct my energy toward what matters most.",
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
                    </div>

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
                        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            Tip: Create loops tagged &quot;identity&quot; or &quot;focus&quot; for a personalized flow.
                        </p>
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
                        {isLoading ? 'Preparing...' : completedToday ? 'Run Again' : 'Begin'}
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

            {/* Complete State */}
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

                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 max-w-xs w-full">
                        <p className="text-sm text-forest-600 italic leading-relaxed">
                            &ldquo;{encouragement}&rdquo;
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/app"
                            className="btn-primary px-6"
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
                            className="btn-ghost px-6"
                        >
                            Run Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
