'use client';

/**
 * Start a Session — Intent-Based Session Flow
 *
 * Five session types with weighted bias selection:
 *   1. Morning Session — identity, focus, vision
 *   2. Midday Reset — focus, clarity
 *   3. Evening Wind Down — reflection, faith, habit
 *   4. Quick Reset — short anytime, few loops
 *   5. Custom Session — inline user-built session
 *
 * Selection logic uses weighted bias (not hard category lock).
 * Custom Session provides a lightweight inline queue builder.
 *
 * Shows a "Session Complete" celebration when the queue
 * finishes naturally (not when user manually stops).
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useAudioStore } from '@/stores/audioStore';
import { usePlaylistStore, QueueItem } from '@/stores/playlistStore';
import { SessionIcon, PlayIcon, PauseIcon, StopIcon, SkipNextIcon, SkipPrevIcon, CheckIcon } from '@/components/Icons';
import PlaybackControls from '@/components/PlaybackControls';
import { playCompletionChime } from '@/services/chime';
import { getVoiceLabel } from '@/config/voices';
import type { Loop, LoopCategory, LoopTag } from '@/types';

// ── Tag priority for session ordering ─────────────────────────

const TAG_PRIORITY: LoopTag[] = ['identity', 'focus', 'memory', 'habit'];

function getTagPriority(loop: Loop): number {
    if (!loop.tags || loop.tags.length === 0) return TAG_PRIORITY.length;
    for (let i = 0; i < TAG_PRIORITY.length; i++) {
        if (loop.tags.includes(TAG_PRIORITY[i])) return i;
    }
    return TAG_PRIORITY.length;
}

// ── Session Types ─────────────────────────────────────────────

interface SessionType {
    id: string;
    label: string;
    description: string;
    emoji: string;
    // Weighted bias: categories and tags that are preferred (not hard-locked)
    biasCategories: LoopCategory[];
    biasTags: LoopTag[];
    maxLoops: number | null; // null = all matching
}

const SESSION_TYPES: SessionType[] = [
    {
        id: 'morning',
        label: 'Morning Session',
        description: 'Start your day with intention and clarity',
        emoji: '🌅',
        biasCategories: ['vision', 'faith'],
        biasTags: ['identity', 'focus'],
        maxLoops: null,
    },
    {
        id: 'midday',
        label: 'Midday Reset',
        description: 'Refocus and realign during the day',
        emoji: '☀️',
        biasCategories: ['study', 'vision'],
        biasTags: ['focus'],
        maxLoops: null,
    },
    {
        id: 'evening',
        label: 'Evening Wind Down',
        description: 'Reflect, release, and prepare for rest',
        emoji: '🌙',
        biasCategories: ['faith', 'habits'],
        biasTags: ['identity', 'habit'],
        maxLoops: null,
    },
    {
        id: 'quick',
        label: 'Quick Reset',
        description: 'A short reset you can do anytime',
        emoji: '⚡',
        biasCategories: [],
        biasTags: [],
        maxLoops: 3,
    },
    {
        id: 'custom',
        label: 'Custom Session',
        description: 'Choose your own loops',
        emoji: '🎯',
        biasCategories: [],
        biasTags: [],
        maxLoops: null,
    },
];

// ── Weighted loop selection ───────────────────────────────────

function getWeightedLoops(loops: Loop[], session: SessionType): Loop[] {
    if (session.id === 'custom') return []; // Custom uses manual selection
    if (session.id === 'quick') {
        // Quick Reset: take a random sample of up to 3, sorted by tag priority
        const shuffled = [...loops].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3).sort((a, b) => getTagPriority(a) - getTagPriority(b));
    }

    // Weighted bias scoring
    const scored = loops.map(loop => {
        let score = 0;
        // Category bias
        if (session.biasCategories.includes(loop.category)) score += 3;
        // Tag bias
        if (loop.tags) {
            for (const tag of loop.tags) {
                if (session.biasTags.includes(tag)) score += 2;
            }
        }
        // Small bonus for non-zero bias (any match)
        if (score > 0) score += 1;
        return { loop, score };
    });

    // Sort by score descending, then by tag priority within equal scores
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getTagPriority(a.loop) - getTagPriority(b.loop);
    });

    const result = scored.map(s => s.loop);
    return session.maxLoops ? result.slice(0, session.maxLoops) : result;
}

// ── Session Page ──────────────────────────────────────────────

export default function SessionPage() {
    const { user } = useAuthStore();
    const { loops, fetchLoops } = useVaultStore();
    const {
        currentLoop, isPlaying, repeatCount, currentRepeat,
    } = useAudioStore();
    const {
        queue, queueIndex, isQueueMode,
        setQueue, startQueue, stopQueue, nextInQueue, prevInQueue,
        setQueueMode, setDwellSec, dwellSec,
    } = usePlaylistStore();

    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    // Session completed naturally (queue ended, not user-stopped)
    const [sessionComplete, setSessionComplete] = useState(false);
    const [sessionLoopCount, setSessionLoopCount] = useState(0);

    // Custom session state
    const [customSelectedIds, setCustomSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Sessions loop continuously — completion only occurs when user manually stops.
    // (Natural queue completion watcher removed since sessions now repeat.)

    // Get loops for current session type
    const sessionType = SESSION_TYPES.find(s => s.id === selectedSession);
    const matchingLoops = useMemo(() => {
        if (!sessionType) return [];
        return getWeightedLoops(loops, sessionType);
    }, [loops, sessionType]);

    function handleSelectSession(id: string) {
        setSelectedSession(id);
        setCustomSelectedIds(new Set());
    }

    function toggleCustomLoop(id: string) {
        setCustomSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function getSessionLoops(): Loop[] {
        if (selectedSession === 'custom') {
            return loops.filter(l => customSelectedIds.has(l.id));
        }
        return matchingLoops;
    }

    function handleStartSession() {
        const sessionLoops = getSessionLoops();
        if (sessionLoops.length === 0) return;

        const items: QueueItem[] = sessionLoops.map(loop => ({
            loopId: loop.id,
            title: loop.title,
            audioUrl: loop.audioUrl,
            sourceType: loop.sourceType,
            intervalSeconds: loop.intervalSeconds,
            loop,
        }));

        setQueue(items);
        setQueueMode(true);
        startQueue();
        setIsStarted(true);
        setSessionComplete(false);
        setSessionLoopCount(items.length);
    }

    function handleStopSession() {
        stopQueue();
        setQueueMode(false);
        setIsStarted(false);
        setSessionComplete(false);
    }

    function handleNaturalCompletion() {
        setSessionComplete(true);
        setIsStarted(false);
        playCompletionChime();
    }

    function handleResetSession() {
        setSessionComplete(false);
        setIsStarted(false);
        setSessionLoopCount(0);
        setSelectedSession(null);
        setCustomSelectedIds(new Set());
    }

    const currentItem = queue[queueIndex];

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <SessionIcon className="w-6 h-6 text-forest-700" />
                <div>
                    <h1 className="font-serif text-2xl font-bold text-forest-700">
                        Start a Session
                    </h1>
                    <p className="text-xs text-forest-400 mt-0.5">
                        A guided mental alignment using repetition, identity, and focus.
                    </p>
                </div>
            </div>

            {/* ── Session Complete Celebration ────────────── */}
            {sessionComplete && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-8">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckIcon className="w-10 h-10 text-green-700" />
                    </div>
                    <div>
                        <h2 className="font-serif text-2xl font-bold text-forest-700 mb-2">
                            Session Complete
                        </h2>
                        <p className="text-forest-500">
                            You played through {sessionLoopCount} loop{sessionLoopCount !== 1 ? 's' : ''}. Well done.
                        </p>
                    </div>

                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 max-w-xs w-full">
                        <p className="text-sm text-forest-600 italic leading-relaxed">
                            &ldquo;Every repetition deepens the neural path. You are becoming who you rehearse.&rdquo;
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 max-w-xs w-full">
                        <Link
                            href="/app/progress"
                            className="block w-full py-3 rounded-xl text-sm font-semibold text-center text-parchment-100 bg-forest-700 hover:bg-forest-600 transition-colors"
                        >
                            Check My Progress →
                        </Link>
                        <div className="flex gap-3">
                            <Link
                                href="/app"
                                className="flex-1 py-3 rounded-xl text-sm font-medium text-center text-forest-700 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                            >
                                Back to Home
                            </Link>
                            <button
                                onClick={handleResetSession}
                                className="flex-1 py-3 rounded-xl text-sm font-medium text-center text-forest-500 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                            >
                                New Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Session Selection ────────────────────── */}
            {!sessionComplete && !isStarted && !selectedSession && (
                <>
                    <p className="text-sm text-forest-500">
                        Sessions are built from your saved loops. Loops are selected by context and time of day.
                    </p>
                    <div className="space-y-3">
                        {SESSION_TYPES.map(session => (
                            <button
                                key={session.id}
                                type="button"
                                onClick={() => handleSelectSession(session.id)}
                                className="flex items-center gap-4 w-full text-left px-5 py-4 bg-parchment-100 border border-forest-200 rounded-xl hover:border-forest-500 hover:bg-forest-50 transition-all shadow-sm group"
                            >
                                <span className="text-3xl">{session.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-forest-700 group-hover:text-forest-800">
                                        {session.label}
                                    </p>
                                    <p className="text-xs text-forest-400 mt-0.5">{session.description}</p>
                                </div>
                                <span className="text-forest-400 group-hover:text-forest-700 transition-colors">→</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* ── Session Setup (after selecting type) ──── */}
            {!sessionComplete && !isStarted && selectedSession && (
                <>
                    {/* Back to session selection */}
                    <button
                        onClick={() => { setSelectedSession(null); setCustomSelectedIds(new Set()); }}
                        className="text-sm text-forest-500 hover:text-forest-700 transition-colors"
                    >
                        ← Change session type
                    </button>

                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-4">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-2xl">{sessionType?.emoji}</span>
                            <h2 className="font-serif text-lg font-bold text-forest-700">
                                {sessionType?.label}
                            </h2>
                        </div>
                        <p className="text-xs text-forest-400 ml-11">{sessionType?.description}</p>
                    </div>

                    {/* Dwell Time */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Time per loop: {dwellSec >= 60 ? `${Math.floor(dwellSec / 60)}m` : `${dwellSec}s`}
                        </label>
                        <input
                            type="range"
                            value={dwellSec}
                            onChange={(e) => setDwellSec(Number(e.target.value))}
                            min={30}
                            max={600}
                            step={30}
                            className="w-full accent-forest-600"
                        />
                        <div className="flex justify-between text-xs text-forest-400 mt-1">
                            <span>30s</span>
                            <span>5m</span>
                            <span>10m</span>
                        </div>
                    </div>

                    {/* Custom Session: Inline loop selector */}
                    {selectedSession === 'custom' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-forest-600">
                                Select loops for your session
                            </h3>
                            {loops.length === 0 ? (
                                <div className="text-center py-4 space-y-2">
                                    <p className="text-sm text-forest-400 italic">No loops yet.</p>
                                    <Link
                                        href="/app/generate"
                                        className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
                                    >
                                        Create a loop to get started →
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {loops.map(loop => (
                                        <label
                                            key={loop.id}
                                            className={`flex items-center gap-3 rounded-lg p-3 border cursor-pointer transition-colors ${
                                                customSelectedIds.has(loop.id)
                                                    ? 'bg-forest-50 border-forest-400'
                                                    : 'bg-parchment-100 border-forest-100 hover:bg-parchment-200'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={customSelectedIds.has(loop.id)}
                                                onChange={() => toggleCustomLoop(loop.id)}
                                                className="accent-forest-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-forest-700 truncate">{loop.title}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-forest-400">{loop.category}</span>
                                                    {loop.tags && loop.tags.length > 0 && (
                                                        <span className="text-xs text-forest-300">· {loop.tags.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {customSelectedIds.size > 0 && (
                                <p className="text-xs text-forest-500 font-medium">
                                    {customSelectedIds.size} loop{customSelectedIds.size !== 1 ? 's' : ''} selected
                                </p>
                            )}
                        </div>
                    )}

                    {/* Playlist Preview (non-custom) */}
                    {selectedSession !== 'custom' && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-forest-600">
                                Playlist ({matchingLoops.length} loops)
                            </h3>
                            {matchingLoops.length === 0 ? (
                                <div className="text-center py-4 space-y-2">
                                    <p className="text-sm text-forest-400 italic">
                                        No loops match this session type yet.
                                    </p>
                                    <Link
                                        href="/app/generate"
                                        className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
                                    >
                                        Create a loop to get started →
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {matchingLoops.map((loop, i) => (
                                        <div key={loop.id} className="flex items-center gap-3 bg-parchment-100 rounded-lg p-3 border border-forest-100">
                                            <span className="text-xs text-forest-400 w-5 text-right">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-forest-700 truncate">{loop.title}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-forest-400">{loop.category}</span>
                                                    {loop.tags && loop.tags.length > 0 && (
                                                        <span className="text-xs text-forest-300">
                                                            · {loop.tags.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Start Button */}
                    <button
                        onClick={handleStartSession}
                        disabled={getSessionLoops().length === 0}
                        className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <PlayIcon className="w-5 h-5" />
                        Start Session ({getSessionLoops().length} loop{getSessionLoops().length !== 1 ? 's' : ''})
                    </button>
                </>
            )}

            {/* ── Active Session View ──────────────────── */}
            {!sessionComplete && isStarted && (
                <div className="space-y-6">
                    {/* Now Playing */}
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-6 text-center space-y-4">
                        <p className="text-xs text-forest-400 uppercase tracking-wide">Now Playing</p>
                        <h2 className="font-serif text-xl font-bold text-forest-700">
                            {currentItem?.title || 'Loading...'}
                        </h2>
                        <p className="text-sm text-forest-500">
                            Loop {queueIndex + 1} of {queue.length}
                        </p>

                        {/* Voice label */}
                        {currentLoop?.voiceId && (
                            <p className="text-xs text-forest-400">
                                Voice: {getVoiceLabel(currentLoop.voiceId)}
                            </p>
                        )}

                        {/* Repeat progress */}
                        {repeatCount !== null && currentRepeat > 0 && (
                            <p className="text-xs text-amber-600 font-semibold">
                                Play {currentRepeat} of {repeatCount}
                            </p>
                        )}

                        {/* Transport Controls */}
                        <div className="flex items-center justify-center gap-4 pt-2">
                            <button
                                onClick={prevInQueue}
                                className="p-3 rounded-full bg-parchment-300 text-forest-600 hover:bg-parchment-400 transition-colors"
                                title="Previous"
                            >
                                <SkipPrevIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleStopSession}
                                className="p-4 rounded-full bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors"
                                title="Stop Session"
                            >
                                <StopIcon className="w-6 h-6" />
                            </button>
                            <button
                                onClick={nextInQueue}
                                className="p-3 rounded-full bg-parchment-300 text-forest-600 hover:bg-parchment-400 transition-colors"
                                title="Next"
                            >
                                <SkipNextIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Inline Playback Controls */}
                    <PlaybackControls showVoice={false} compact />

                    {/* Queue */}
                    <div className="space-y-1">
                        {queue.map((item, i) => (
                            <div
                                key={item.loopId}
                                className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${
                                    i === queueIndex
                                        ? 'bg-forest-50 border-forest-300'
                                        : 'bg-parchment-100 border-forest-100'
                                }`}
                            >
                                <span className={`text-xs w-5 text-right ${i === queueIndex ? 'text-forest-700 font-bold' : 'text-forest-400'}`}>
                                    {i + 1}
                                </span>
                                <p className={`text-sm flex-1 truncate ${i === queueIndex ? 'text-forest-700 font-medium' : 'text-forest-500'}`}>
                                    {item.title}
                                </p>
                                {i === queueIndex && (
                                    <span className="text-xs text-forest-600 font-medium">Playing</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Link back */}
            {!sessionComplete && (
                <div className="pt-4 border-t border-parchment-300">
                    <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            )}
        </div>
    );
}
