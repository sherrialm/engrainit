'use client';

/**
 * Session Page — Phase 2: Simple Session System
 *
 * Three views:
 *   1. Session Home — saved sessions list + create new
 *   2. Session Builder — pick loops, AI suggest, save
 *   3. Active Session — playback with transport controls
 *
 * A session is a playlist of saved loops. Users create, save,
 * and replay them. Playback is ordered and repeats continuously.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useAudioStore } from '@/stores/audioStore';
import { usePlaylistStore, QueueItem } from '@/stores/playlistStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
    SessionIcon, PlayIcon, PauseIcon, StopIcon, SkipNextIcon, SkipPrevIcon,
    CheckIcon, PlusIcon, SparklesIcon, TrashIcon,
} from '@/components/Icons';
import PlaybackControls from '@/components/PlaybackControls';
import { getVoiceLabel } from '@/config/voices';
import type { Loop, LoopCategory, LoopTag, SessionTypeId } from '@/types';

// ── Session Type Definitions ──────────────────────────────────

interface SessionTypeConfig {
    id: SessionTypeId;
    label: string;
    description: string;
    emoji: string;
    biasCategories: LoopCategory[];
    biasTags: LoopTag[];
}

const SESSION_TYPES: SessionTypeConfig[] = [
    {
        id: 'morning',
        label: 'Morning Session',
        description: 'Start your day with intention and clarity',
        emoji: '🌅',
        biasCategories: ['vision', 'faith'],
        biasTags: ['identity', 'focus'],
    },
    {
        id: 'midday',
        label: 'Midday Reset',
        description: 'Refocus and realign during the day',
        emoji: '☀️',
        biasCategories: ['study', 'vision'],
        biasTags: ['focus'],
    },
    {
        id: 'focus',
        label: 'Focus Session',
        description: 'Deep focus with study and memory loops',
        emoji: '🎯',
        biasCategories: ['study', 'memory'],
        biasTags: ['focus', 'memory'],
    },
    {
        id: 'evening',
        label: 'Evening Wind Down',
        description: 'Reflect, release, and prepare for rest',
        emoji: '🌙',
        biasCategories: ['faith', 'habits'],
        biasTags: ['identity', 'habit'],
    },
    {
        id: 'custom',
        label: 'Custom Session',
        description: 'Choose your own loops',
        emoji: '✨',
        biasCategories: [],
        biasTags: [],
    },
];

function getSessionTypeConfig(typeId: SessionTypeId): SessionTypeConfig {
    return SESSION_TYPES.find(s => s.id === typeId) || SESSION_TYPES[SESSION_TYPES.length - 1];
}

// ── AI Suggestion Helper ──────────────────────────────────────

/**
 * Suggests loops from the vault based on session type bias.
 * Does NOT produce new loops — only ranks existing ones.
 * Returns up to `count` loops sorted by relevance score.
 */
function suggestLoops(
    allLoops: Loop[],
    typeId: SessionTypeId,
    alreadySelected: string[],
    count = 5
): Loop[] {
    const config = getSessionTypeConfig(typeId);

    // Custom sessions have no bias — return most recently created
    if (config.biasCategories.length === 0 && config.biasTags.length === 0) {
        return allLoops
            .filter(l => !alreadySelected.includes(l.id))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, count);
    }

    const scored = allLoops
        .filter(l => !alreadySelected.includes(l.id))
        .map(loop => {
            let score = 0;
            if (config.biasCategories.includes(loop.category)) score += 3;
            if (loop.tags) {
                for (const tag of loop.tags) {
                    if (config.biasTags.includes(tag)) score += 2;
                }
            }
            if (score > 0) score += 1; // bonus for any match
            return { loop, score };
        })
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map(s => s.loop);
}

// ── Session Page ──────────────────────────────────────────────

export default function SessionPage() {
    const { user } = useAuthStore();
    const { loops, fetchLoops } = useVaultStore();
    const { currentLoop, isPlaying, repeatCount, currentRepeat } = useAudioStore();
    const {
        queue, queueIndex, isQueueMode,
        setQueue, startQueue, stopQueue, nextInQueue, prevInQueue,
        setQueueMode, setDwellSec, dwellSec,
    } = usePlaylistStore();
    const {
        sessions, draft, activeSessionId,
        startDraft, editSession, setDraftName,
        addLoopToDraft, removeLoopFromDraft, setDraftLoops,
        clearDraft, saveDraft, deleteSavedSession,
        setActiveSessionId,
    } = useSessionStore();

    const [isStarted, setIsStarted] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestedLoopIds, setSuggestedLoopIds] = useState<Set<string>>(new Set());
    // Confirmation state for session deletion
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const isBuilding = draft !== null && !isStarted;

    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    // Resolve loop IDs → Loop objects for the draft
    const draftLoops = useMemo(() => {
        if (!draft) return [];
        return draft.loopIds
            .map(id => loops.find(l => l.id === id))
            .filter(Boolean) as Loop[];
    }, [draft, loops]);

    // Available loops = vault loops NOT in the draft
    const availableLoops = useMemo(() => {
        if (!draft) return loops;
        return loops.filter(l => !draft.loopIds.includes(l.id));
    }, [draft, loops]);

    // AI suggestions
    const aiSuggestions = useMemo(() => {
        if (!draft || !showSuggestions) return [];
        return suggestLoops(loops, draft.typeId, draft.loopIds);
    }, [draft, loops, showSuggestions, draft?.loopIds]);

    // ── Actions ───────────────────────────────────────────────

    function handleCreateSession(typeId: SessionTypeId) {
        startDraft(typeId);
        setShowSuggestions(false);
        setSuggestedLoopIds(new Set());
    }

    function handleEditSession(id: string) {
        editSession(id);
        setShowSuggestions(false);
        setSuggestedLoopIds(new Set());
    }

    function handleCancelBuild() {
        clearDraft();
        setShowSuggestions(false);
        setSuggestedLoopIds(new Set());
    }

    function handleSuggestLoops() {
        setShowSuggestions(true);
        // Auto-add suggested loops to draft
        const suggested = suggestLoops(loops, draft!.typeId, draft!.loopIds);
        const newIds = new Set<string>();
        for (const loop of suggested) {
            addLoopToDraft(loop.id);
            newIds.add(loop.id);
        }
        setSuggestedLoopIds(newIds);
    }

    function handleSaveSession() {
        const sessionId = saveDraft();
        if (sessionId) {
            setShowSuggestions(false);
            setSuggestedLoopIds(new Set());
        }
    }

    function handleSaveAndStart() {
        // Save first
        const sessionId = saveDraft();
        if (!sessionId) return;

        // Find the session and start it
        const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
        if (!session) return;

        startSessionPlayback(session.loopIds, sessionId);
    }

    function handleStartSavedSession(sessionId: string) {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        startSessionPlayback(session.loopIds, sessionId);
    }

    function startSessionPlayback(loopIds: string[], sessionId: string) {
        console.log('[SessionPage] startSessionPlayback called', { loopIds, sessionId, loopsAvailable: loops.length, dwellSec });
        const sessionLoops = loopIds
            .map(id => loops.find(l => l.id === id))
            .filter(Boolean) as Loop[];

        console.log('[SessionPage] resolved sessionLoops:', sessionLoops.length, sessionLoops.map(l => l.title));
        if (sessionLoops.length === 0) {
            console.error('[SessionPage] No loops resolved! Aborting.');
            return;
        }

        const items: QueueItem[] = sessionLoops.map(loop => ({
            loopId: loop.id,
            title: loop.title,
            audioUrl: loop.audioUrl,
            sourceType: loop.sourceType,
            intervalSeconds: loop.intervalSeconds,
            loop,
        }));

        // Ensure dwellSec is at least 30s so the session always auto-advances.
        // The Vault page allows dwellSec=0 ("Manual"), but sessions must cycle.
        if (dwellSec <= 0) {
            console.log('[SessionPage] dwellSec was <=0, forcing to 30');
            setDwellSec(30);
        }

        console.log('[SessionPage] calling setQueue with', items.length, 'items');
        setQueue(items);
        console.log('[SessionPage] calling setQueueMode(true)');
        setQueueMode(true);
        console.log('[SessionPage] calling startQueue');
        startQueue();
        console.log('[SessionPage] session started, dwellSec =', usePlaylistStore.getState().dwellSec);
        setIsStarted(true);
        setActiveSessionId(sessionId);
    }

    function handleStopSession() {
        stopQueue();
        setQueueMode(false);
        setIsStarted(false);
        setActiveSessionId(null);
    }

    function handleDeleteSession(id: string) {
        deleteSavedSession(id);
        setDeleteConfirmId(null);
    }

    const currentItem = queue[queueIndex];

    // Whether the vault has any loops at all
    const hasLoops = loops.length > 0;

    // ── Render ────────────────────────────────────────────────

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="font-serif text-2xl font-bold text-forest-700">
                    Sessions
                </h1>
                <p className="text-xs text-forest-400 mt-0.5">
                    A session is a playlist of saved loops.
                </p>
            </div>

            {/* ══════════════════════════════════════════════════
                VIEW 1: Session Home
               ══════════════════════════════════════════════════ */}
            {!isBuilding && !isStarted && (
                <>
                    {/* No loops in vault — soft block */}
                    {!hasLoops && (
                        <div className="bg-parchment-100 rounded-xl border border-forest-100 p-6 text-center space-y-3">
                            <p className="text-sm text-forest-500">
                                Create or save loops to your Vault before building a session.
                            </p>
                            <Link
                                href="/app/generate"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-parchment-100 bg-forest-700 hover:bg-forest-600 transition-colors px-5 py-2.5 rounded-full"
                            >
                                Create a Loop →
                            </Link>
                        </div>
                    )}

                    {/* Has loops: show saved sessions + create */}
                    {hasLoops && (
                        <>
                            {/* Mental model explainer */}
                            <div className="bg-gradient-to-br from-forest-50 to-parchment-100 rounded-xl border border-forest-100 p-4">
                                <p className="text-sm text-forest-600 leading-relaxed">
                                    <span className="font-semibold text-forest-700">How sessions work:</span>{' '}
                                    Build a session by choosing loops from your Vault. Save it, then replay it anytime.
                                    Loops play in order and repeat continuously until you stop.
                                </p>
                            </div>

                            {/* Saved Sessions */}
                            {sessions.length > 0 && (
                                <section className="space-y-3">
                                    <h2 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                                        Your Sessions
                                    </h2>
                                    <div className="space-y-2">
                                        {sessions.map(session => {
                                            const config = getSessionTypeConfig(session.typeId);
                                            const loopCount = session.loopIds.length;
                                            const isConfirmingDelete = deleteConfirmId === session.id;

                                            return (
                                                <div
                                                    key={session.id}
                                                    className="bg-parchment-100 rounded-xl border border-forest-100 p-4 flex items-center gap-4 group hover:border-forest-300 transition-colors"
                                                    id={`session-${session.id}`}
                                                >
                                                    <span className="text-2xl flex-shrink-0">{config.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-semibold text-forest-700 truncate">
                                                            {session.name}
                                                        </h3>
                                                        <p className="text-xs text-forest-400 mt-0.5">
                                                            {loopCount} loop{loopCount !== 1 ? 's' : ''} · {config.label}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleStartSavedSession(session.id)}
                                                            className="p-2 rounded-lg bg-forest-700 text-parchment-100 hover:bg-forest-600 transition-colors"
                                                            title="Start session"
                                                        >
                                                            <PlayIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditSession(session.id)}
                                                            className="p-2 rounded-lg bg-parchment-300 text-forest-600 hover:bg-parchment-400 transition-colors"
                                                            title="Edit session"
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        {isConfirmingDelete ? (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleDeleteSession(session.id)}
                                                                    className="px-2 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                                                >
                                                                    Delete
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirmId(null)}
                                                                    className="px-2 py-1 text-xs font-medium rounded-lg bg-parchment-300 text-forest-600 hover:bg-parchment-400 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setDeleteConfirmId(session.id)}
                                                                className="p-2 rounded-lg text-forest-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Delete session"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Empty state for sessions (has loops, no sessions) */}
                            {sessions.length === 0 && (
                                <div className="bg-parchment-100 rounded-xl border border-dashed border-forest-200 p-6 text-center space-y-2">
                                    <p className="text-sm text-forest-500">
                                        You haven&rsquo;t created any sessions yet.
                                    </p>
                                    <p className="text-xs text-forest-400">
                                        Pick a session type below to get started.
                                    </p>
                                </div>
                            )}

                            {/* Session Type Cards — Create New */}
                            <section className="space-y-3">
                                <h2 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                                    Create a Session
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {SESSION_TYPES.map(session => (
                                        <button
                                            key={session.id}
                                            type="button"
                                            onClick={() => handleCreateSession(session.id)}
                                            className="flex items-center gap-3 text-left px-4 py-3.5 bg-parchment-100 border border-forest-200 rounded-xl hover:border-forest-500 hover:bg-forest-50 transition-all shadow-sm group"
                                            id={`create-session-${session.id}`}
                                        >
                                            <span className="text-2xl flex-shrink-0">{session.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-forest-700 group-hover:text-forest-800">
                                                    {session.label}
                                                </p>
                                                <p className="text-xs text-forest-400 mt-0.5">{session.description}</p>
                                            </div>
                                            <PlusIcon className="w-5 h-5 text-forest-400 group-hover:text-forest-700 transition-colors flex-shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </>
            )}

            {/* ══════════════════════════════════════════════════
                VIEW 2: Session Builder
               ══════════════════════════════════════════════════ */}
            {isBuilding && (
                <>
                    {/* Back */}
                    <button
                        onClick={handleCancelBuild}
                        className="text-sm text-forest-500 hover:text-forest-700 transition-colors"
                    >
                        ← Back to Sessions
                    </button>

                    {/* Session type header */}
                    {(() => {
                        const config = getSessionTypeConfig(draft.typeId);
                        return (
                            <div className="bg-parchment-100 rounded-xl border border-forest-100 p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">{config.emoji}</span>
                                    <div className="flex-1">
                                        <p className="text-xs text-forest-400 uppercase tracking-wide">{config.label}</p>
                                        <input
                                            type="text"
                                            value={draft.name}
                                            onChange={(e) => setDraftName(e.target.value)}
                                            className="w-full font-serif text-lg font-bold text-forest-700 bg-transparent border-none outline-none focus:ring-0 p-0"
                                            placeholder="Session name..."
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-forest-400 ml-11">
                                    A session is a playlist of saved loops.
                                </p>
                            </div>
                        );
                    })()}

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

                    {/* Selected Loops */}
                    <section className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-forest-700">
                                Selected Loops ({draftLoops.length})
                            </h3>
                            {draftLoops.length > 0 && (
                                <span className="text-xs text-forest-400">
                                    Drag order coming soon — loops play top to bottom
                                </span>
                            )}
                        </div>

                        {draftLoops.length === 0 ? (
                            <div className="bg-parchment-100 rounded-lg border border-dashed border-forest-200 p-4 text-center">
                                <p className="text-sm text-forest-400 italic">
                                    No loops selected yet. Add loops from your Vault below, or use AI to suggest some.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {draftLoops.map((loop, i) => (
                                    <div
                                        key={loop.id}
                                        className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${
                                            suggestedLoopIds.has(loop.id)
                                                ? 'bg-amber-50 border-amber-200'
                                                : 'bg-parchment-100 border-forest-100'
                                        }`}
                                    >
                                        <span className="text-xs text-forest-400 w-5 text-right font-medium">
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-forest-700 truncate">
                                                {loop.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs text-forest-400">{loop.category}</span>
                                                {suggestedLoopIds.has(loop.id) && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                        AI suggested
                                                    </span>
                                                )}
                                                {loop.tags && loop.tags.length > 0 && (
                                                    <span className="text-xs text-forest-300">
                                                        · {loop.tags.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                removeLoopFromDraft(loop.id);
                                                setSuggestedLoopIds(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(loop.id);
                                                    return next;
                                                });
                                            }}
                                            className="p-1.5 rounded-lg text-forest-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            title="Remove from session"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* AI Suggest Button */}
                    {availableLoops.length > 0 && (
                        <button
                            onClick={handleSuggestLoops}
                            className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                            id="suggest-loops-btn"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Suggest Loops for {getSessionTypeConfig(draft.typeId).label}
                        </button>
                    )}

                    {/* Available Loops from Vault */}
                    {availableLoops.length > 0 && (
                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold text-forest-700">
                                Available Loops ({availableLoops.length})
                            </h3>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {availableLoops.map(loop => (
                                    <button
                                        key={loop.id}
                                        type="button"
                                        onClick={() => addLoopToDraft(loop.id)}
                                        className="flex items-center gap-3 w-full text-left rounded-lg p-3 border border-forest-100 bg-parchment-100 hover:border-forest-400 hover:bg-forest-50 transition-colors group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-forest-700 truncate">
                                                {loop.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs text-forest-400">{loop.category}</span>
                                                {loop.tags && loop.tags.length > 0 && (
                                                    <span className="text-xs text-forest-300">
                                                        · {loop.tags.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <PlusIcon className="w-5 h-5 text-forest-400 group-hover:text-forest-700 transition-colors flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveSession}
                            disabled={draftLoops.length === 0 || !draft.name.trim()}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-forest-700 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            id="save-session-btn"
                        >
                            Save Session
                        </button>
                        <button
                            onClick={handleSaveAndStart}
                            disabled={draftLoops.length === 0 || !draft.name.trim()}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-parchment-100 bg-forest-700 hover:bg-forest-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            id="start-session-btn"
                        >
                            <PlayIcon className="w-4 h-4" />
                            Save & Start
                        </button>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════
                VIEW 3: Active Session
               ══════════════════════════════════════════════════ */}
            {isStarted && (
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
                        <p className="text-xs text-forest-400 mb-2">
                            Loops play in order and repeat continuously.
                            {dwellSec > 0 && (
                                <span className="ml-1 text-forest-500 font-medium">
                                    Auto-next every {dwellSec >= 60 ? `${Math.floor(dwellSec / 60)}m` : `${dwellSec}s`}.
                                </span>
                            )}
                        </p>
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
            {!isStarted && (
                <div className="pt-4 border-t border-parchment-300">
                    <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            )}
        </div>
    );
}
