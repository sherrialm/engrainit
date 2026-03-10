'use client';

/**
 * Start Session — Playlist-style loop playback
 *
 * Maps session types to vault loops by category/tags,
 * feeds them into the existing playlistStore.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { usePlaylistStore, QueueItem } from '@/stores/playlistStore';
import { SessionIcon, PlayIcon, PauseIcon, StopIcon, SkipNextIcon, SkipPrevIcon } from '@/components/Icons';
import type { Loop, LoopCategory } from '@/types';

// ── Session Types ─────────────────────────────────────────────

interface SessionType {
    id: string;
    label: string;
    description: string;
    categories: LoopCategory[];
}

const SESSION_TYPES: SessionType[] = [
    { id: 'morning', label: 'Morning Alignment', description: 'Start the day with intention', categories: ['vision', 'faith'] },
    { id: 'focus', label: 'Focus Session', description: 'Deep work and concentration', categories: ['study'] },
    { id: 'study', label: 'Study Session', description: 'Learning and retention', categories: ['study', 'memory'] },
    { id: 'confidence', label: 'Confidence Boost', description: 'Build self-belief', categories: ['vision', 'habits'] },
    { id: 'calm', label: 'Calm Mind', description: 'Relax and release stress', categories: ['faith'] },
    { id: 'night', label: 'Night Reinforcement', description: 'End-of-day reflection', categories: ['faith', 'habits'] },
];

// ── Session Page ──────────────────────────────────────────────

export default function SessionPage() {
    const { user } = useAuthStore();
    const { loops, fetchLoops } = useVaultStore();
    const {
        queue, queueIndex, isQueueMode,
        setQueue, startQueue, stopQueue, nextInQueue, prevInQueue,
        setQueueMode, setDwellSec, dwellSec,
    } = usePlaylistStore();

    const [selectedSession, setSelectedSession] = useState<string>('morning');
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Get loops matching the selected session type
    const sessionType = SESSION_TYPES.find(s => s.id === selectedSession)!;
    const matchingLoops = useMemo(() => {
        return loops.filter(l => sessionType.categories.includes(l.category));
    }, [loops, sessionType]);

    function handleStartSession() {
        if (matchingLoops.length === 0) return;

        const items: QueueItem[] = matchingLoops.map(loop => ({
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
    }

    function handleStopSession() {
        stopQueue();
        setQueueMode(false);
        setIsStarted(false);
    }

    const currentItem = queue[queueIndex];

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <SessionIcon className="w-6 h-6 text-forest-700" />
                <h1 className="font-serif text-2xl font-bold text-forest-700">
                    Start Session
                </h1>
            </div>

            {!isStarted ? (
                <>
                    {/* Session Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Session Type
                        </label>
                        <select
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(e.target.value)}
                            className="input-field"
                        >
                            {SESSION_TYPES.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.label} — {s.description}
                                </option>
                            ))}
                        </select>
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

                    {/* Playlist Preview */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-forest-600">
                            Playlist ({matchingLoops.length} loops)
                        </h3>
                        {matchingLoops.length === 0 ? (
                            <p className="text-sm text-forest-400 italic">
                                No loops match this session type. Create some loops first!
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {matchingLoops.map((loop, i) => (
                                    <div key={loop.id} className="flex items-center gap-3 bg-parchment-100 rounded-lg p-3 border border-forest-100">
                                        <span className="text-xs text-forest-400 w-5 text-right">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-forest-700 truncate">{loop.title}</p>
                                            <p className="text-xs text-forest-400">{loop.category}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={handleStartSession}
                        disabled={matchingLoops.length === 0}
                        className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <PlayIcon className="w-5 h-5" />
                        Start Session
                    </button>
                </>
            ) : (
                /* Active Session View */
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
            <div className="pt-4 border-t border-parchment-300">
                <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                    ← Back to Home
                </Link>
            </div>
        </div>
    );
}
