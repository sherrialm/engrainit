'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore, useFilteredLoops } from '@/stores/vaultStore';
import { useAudioStore } from '@/stores/audioStore';
import { usePlaylistStore, QueueItem } from '@/stores/playlistStore';
import { useTierStore } from '@/stores/tierStore';
import { generateSpeech } from '@/services/TTSService';
import { uploadBase64Audio } from '@/services/LoopService';
import { getMorningStreakInfo } from '@/services/morningStreakService';
import { VOICE_OPTIONS, getVoiceLabel } from '@/config/voices';
import { Loop, LoopCategory } from '@/types';
import { formatDuration } from '@/lib/utils';
import { CardGridSkeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import PlaybackControls from '@/components/PlaybackControls';

const CATEGORIES: { id: LoopCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '📚' },
    { id: 'faith', label: 'Faith', icon: '🙏' },
    { id: 'study', label: 'Study', icon: '📖' },
    { id: 'vision', label: 'Vision', icon: '🎯' },
    { id: 'habits', label: 'Habits', icon: '⚡' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
];

const DWELL_PRESETS = [
    { label: 'Manual', value: 0 },
    { label: '1m', value: 60 },
    { label: '3m', value: 180 },
    { label: '5m', value: 300 },
    { label: '10m', value: 600 },
];

export default function VaultPage() {
    const { user } = useAuthStore();
    const { fetchLoops, isLoading, error, selectedCategory, setCategory, removeLoop, updateLoop } = useVaultStore();
    const filteredLoops = useFilteredLoops();
    const { loadAndPlay, currentLoop, isPlaying, toggle, stop } = useAudioStore();
    const {
        queue, queueIndex, isQueueMode, dwellSec,
        setQueue, clearQueue, setQueueMode, setDwellSec,
        startQueue, stopQueue, nextInQueue, prevInQueue,
    } = usePlaylistStore();

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLoop, setEditingLoop] = useState<Loop | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Form state
    const [editTitle, setEditTitle] = useState('');
    const [editCategory, setEditCategory] = useState<LoopCategory>('study');
    const [editInterval, setEditInterval] = useState(30);
    const [editVoiceId, setEditVoiceId] = useState('sage');
    const [editText, setEditText] = useState('');

    // Queue builder state
    const [queueBuilderOn, setQueueBuilderOn] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Morning completion check for returning-user prompt
    const [morningDone, setMorningDone] = useState(true); // default true to avoid flash
    useEffect(() => {
        const streak = getMorningStreakInfo();
        setMorningDone(streak.completedToday);
    }, []);

    const handleEdit = (loop: Loop) => {
        setEditingLoop(loop);
        setEditTitle(loop.title);
        setEditCategory(loop.category);
        setEditInterval(loop.intervalSeconds);
        setEditVoiceId(loop.voiceId || 'sage');
        setEditText(loop.text || '');
        setEditError(null);
        setIsEditModalOpen(true);
    };

    const handleSaveChanges = async () => {
        if (!user?.uid || !editingLoop) return;

        setIsSaving(true);
        setEditError(null);

        try {
            const voiceChanged = editingLoop.sourceType === 'tts' && editVoiceId !== editingLoop.voiceId;
            const textChanged = editingLoop.sourceType === 'tts' && editText !== editingLoop.text;
            const needsRegeneration = voiceChanged || textChanged;

            console.log('[Edit] Change detected:', { voiceChanged, textChanged, needsRegeneration });

            let audioUrl = editingLoop.audioUrl;
            let duration = editingLoop.duration;

            if (needsRegeneration && (editText || editingLoop.text)) {
                console.log('[Edit] Regeneration required, calling TTS...');
                const response = await generateSpeech({
                    text: editText || editingLoop.text || '',
                    voiceId: editVoiceId
                });

                if (!response.audioContent) throw new Error('Failed to generate audio');

                const filename = `tts-edit-${Date.now()}.mp3`;
                audioUrl = await uploadBase64Audio(user.uid, response.audioContent, filename);
                duration = response.duration;
            }

            const updatePayload: Record<string, any> = {
                title: editTitle,
                category: editCategory,
                intervalSeconds: editInterval,
                voiceId: editVoiceId,
                audioUrl,
                duration
            };
            // Only include text for TTS loops — Firestore rejects undefined values
            if (editingLoop.sourceType === 'tts') {
                updatePayload.text = editText;
            }

            console.log('[Edit] Saving with payload:', JSON.stringify(updatePayload, null, 2));
            console.log('[Edit] intervalSeconds being saved:', editInterval);
            await updateLoop(user.uid, editingLoop.id, updatePayload);

            // Sync with active audio session if this loop is currently playing
            if (currentLoop?.id === editingLoop.id) {
                const updatedLoop = {
                    ...editingLoop,
                    title: editTitle,
                    category: editCategory,
                    intervalSeconds: editInterval,
                    voiceId: editVoiceId,
                    text: editingLoop.sourceType === 'tts' ? editText : editingLoop.text,
                    audioUrl,
                    duration
                };

                if (audioUrl !== editingLoop.audioUrl) {
                    // If audio changed (e.g. voice change), reload it completely
                    await loadAndPlay(updatedLoop);
                } else {
                    // If only metadata/interval changed, just update the session interval
                    const { setInterval: setSessionInterval } = useAudioStore.getState();
                    setSessionInterval(editInterval);
                }
            }

            setIsEditModalOpen(false);
            setEditingLoop(null);
        } catch (err: any) {
            setEditError(err.message || 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch loops on mount
    useEffect(() => {
        if (user?.uid) {
            fetchLoops(user.uid);
        }
    }, [user?.uid, fetchLoops]);

    const handlePlay = async (loop: Loop) => {
        try {
            await loadAndPlay(loop);
        } catch (err) {
            console.error('Failed to play loop:', err);
        }
    };

    const handleDelete = async (loop: Loop) => {
        if (!user?.uid) return;
        if (!confirm(`Delete "${loop.title}"? This cannot be undone.`)) return;

        try {
            // Passing audioUrl makes the backend operation much faster
            await removeLoop(user.uid, loop.id, loop.audioUrl);
            if (currentLoop?.id === loop.id) {
                stop();
            }
        } catch (err) {
            console.error('Failed to delete loop:', err);
        }
    };

    // Queue builder helpers
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleStartQueue = () => {
        const items: QueueItem[] = filteredLoops
            .filter((l) => selectedIds.has(l.id))
            .map((l) => ({
                loopId: l.id,
                title: l.title,
                audioUrl: l.audioUrl,
                sourceType: l.sourceType as 'tts' | 'recording' | 'document',
                intervalSeconds: l.intervalSeconds,
                loop: l,
            }));

        if (items.length === 0) return;

        setQueue(items);
        setQueueMode(true);
        startQueue();
        setQueueBuilderOn(false);
        setSelectedIds(new Set());
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Page Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    The Vault
                </h2>
                <p className="text-forest-500">
                    Your Saved Loops
                </p>
                <Link href="/app" className="inline-block mt-3 text-sm text-forest-500 hover:text-forest-700 font-medium">
                    ✍️ ← Create a New Loop
                </Link>
            </div>

            {/* Returning-user prompt — shown when user has loops but hasn't practiced today */}
            {!isLoading && filteredLoops.length > 0 && !morningDone && (
                <div className="bg-forest-50 border border-forest-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between gap-4">
                    <p className="text-sm text-forest-600">
                        Your loops are waiting — start a session or play one now.
                    </p>
                    <Link
                        href="/app/session"
                        className="flex-shrink-0 text-xs font-semibold bg-forest-700 text-parchment-100 hover:bg-forest-600 px-4 py-2 rounded-full transition-colors"
                    >
                        Start a Session →
                    </Link>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={queueBuilderOn}
                            onChange={(e) => {
                                setQueueBuilderOn(e.target.checked);
                                if (!e.target.checked) setSelectedIds(new Set());
                            }}
                            className="accent-forest-600"
                        />
                        <span className="text-sm font-medium text-forest-700">📋 Play Multiple</span>
                    </label>
                </div>

                {queueBuilderOn && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-forest-500">Dwell:</span>
                        {DWELL_PRESETS.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setDwellSec(p.value)}
                                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${dwellSec === p.value
                                        ? 'bg-forest-700 text-parchment-100'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id
                            ? 'bg-forest-600 text-parchment-100'
                            : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                            }`}
                    >
                        {cat.icon} {cat.label}
                    </button>
                ))}
            </div>

            {/* Loading State - Skeleton */}
            {isLoading && (
                <CardGridSkeleton count={6} />
            )}

            {/* Error State */}
            {error && (
                <div className="text-center py-12">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button onClick={() => user?.uid && fetchLoops(user.uid)} className="btn-secondary">
                        Try Again
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredLoops.length === 0 && (
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🗃️</div>
                    <h3 className="font-serif text-xl font-semibold text-forest-600 mb-2">
                        {selectedCategory === 'all' ? 'No loops yet' : `No ${selectedCategory} loops`}
                    </h3>
                    <p className="text-forest-400 mb-6">
                        Create your first loop to start engraving it in your mind.
                    </p>
                    <a href="/app/generate" className="btn-primary inline-block">
                        Create a Loop
                    </a>
                </div>
            )}

            {/* Loops Grid */}
            {!isLoading && filteredLoops.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLoops.map((loop) => (
                        <LoopCard
                            key={loop.id}
                            loop={loop}
                            isActive={currentLoop?.id === loop.id}
                            isPlaying={currentLoop?.id === loop.id && isPlaying}
                            onPlay={() => handlePlay(loop)}
                            onPause={toggle}
                            onEdit={() => handleEdit(loop)}
                            onDelete={() => handleDelete(loop)}
                            selectable={queueBuilderOn}
                            selected={selectedIds.has(loop.id)}
                            onToggleSelect={() => toggleSelect(loop.id)}
                        />
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => !isSaving && setIsEditModalOpen(false)}
                title="Edit Loop Settings"
            >
                <div className="space-y-5 pb-2">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-1.5">
                            Loop Title
                        </label>
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="input-field py-2"
                            placeholder="e.g., Morning Affirmation"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-1.5">
                            Category
                        </label>
                        <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as LoopCategory)}
                            className="input-field py-2"
                        >
                            <option value="faith">🙏 Faith</option>
                            <option value="study">📚 Study</option>
                            <option value="vision">🎯 Vision</option>
                            <option value="habits">⚡ Habits</option>
                            <option value="memory">🧠 Memory</option>
                        </select>
                    </div>

                    {/* Interval */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-1.5">
                            Repetition Interval: {editInterval}s
                        </label>
                        <input
                            type="range"
                            value={editInterval}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                console.log('[Edit] Slider onChange:', val);
                                setEditInterval(val);
                            }}
                            onInput={(e) => {
                                const val = Number((e.target as HTMLInputElement).value);
                                setEditInterval(val);
                            }}
                            min={0}
                            max={300}
                            step={5}
                            className="w-full accent-forest-600"
                        />
                        <div className="flex justify-between text-[10px] text-forest-400 mt-1">
                            <span>Continuous</span>
                            <span>2.5m</span>
                            <span>5m</span>
                        </div>
                    </div>

                    {/* Voice Select (Only for TTS) */}
                    {editingLoop?.sourceType === 'tts' && (
                        <div>
                            <label className="block text-sm font-medium text-forest-600 mb-1.5">
                                Voice Settings
                            </label>
                            <select
                                value={editVoiceId}
                                onChange={(e) => setEditVoiceId(e.target.value)}
                                className="input-field py-2"
                            >
                                {VOICE_OPTIONS.map((voice) => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.label} - {voice.description}
                                    </option>
                                ))}
                            </select>
                            {(editVoiceId !== editingLoop.voiceId) && (
                                <p className="text-[10px] text-amber-600 mt-2 italic font-medium">
                                    ⚠️ Changing the voice will regenerate the audio loop.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Text Editing (Only for TTS) */}
                    {editingLoop?.sourceType === 'tts' && (
                        <div>
                            <label className="block text-sm font-medium text-forest-600 mb-1.5">
                                Loop Text
                            </label>
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="input-field py-2 min-h-[100px] text-sm"
                                placeholder="Enter the text to be engraved..."
                            />
                            {editText !== editingLoop.text && (
                                <p className="text-[10px] text-amber-600 mt-2 italic font-medium">
                                    ⚠️ Changing the text will regenerate the audio loop.
                                </p>
                            )}
                        </div>
                    )}

                    {editError && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">
                            {editError}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-forest-100">
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={isSaving}
                            className="flex-1 py-2 text-forest-500 hover:text-forest-700 font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className="flex-[2] py-2 bg-forest-600 text-parchment-100 rounded-xl font-bold hover:bg-forest-700 transition-colors shadow-lg shadow-forest-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <span className="animate-spin text-lg">⏳</span>
                                    Saving...
                                </>
                            ) : (
                                (editingLoop?.sourceType === 'tts' && (editVoiceId !== editingLoop.voiceId || editText !== editingLoop.text))
                                    ? 'Regenerate & Save'
                                    : 'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Queue Builder Sticky Bar */}
            {queueBuilderOn && selectedIds.size > 0 && !isQueueMode && (
                <div className="fixed bottom-0 left-0 right-0 bg-forest-700 text-parchment-100 p-4 shadow-lg z-50">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <span className="text-sm font-medium">
                            📋 Selected: {selectedIds.size} loop{selectedIds.size !== 1 ? 's' : ''}
                            {dwellSec > 0 && <span className="text-parchment-300 ml-2">• {dwellSec >= 60 ? `${dwellSec / 60}m` : `${dwellSec}s`} per loop</span>}
                            {dwellSec === 0 && <span className="text-parchment-300 ml-2">• Manual advance</span>}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setSelectedIds(new Set()); }}
                                className="px-4 py-2 text-xs font-medium bg-parchment-300 text-forest-700 rounded-lg hover:bg-parchment-400"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleStartQueue}
                                className="px-4 py-2 text-xs font-bold bg-amber-500 text-forest-900 rounded-lg hover:bg-amber-400"
                            >
                                ▶️ Start Queue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Now Playing Bar */}
            {isQueueMode && queue.length > 0 ? (
                <QueueNowPlayingBar
                    queue={queue}
                    queueIndex={queueIndex}
                    isPlaying={isPlaying}
                    onToggle={toggle}
                    onStop={() => { stopQueue(); setQueueMode(false); }}
                    onNext={nextInQueue}
                    onPrev={prevInQueue}
                    dwellSec={dwellSec}
                />
            ) : currentLoop && !isQueueMode ? (
                <NowPlayingBar loop={currentLoop} isPlaying={isPlaying} onToggle={toggle} onStop={stop} />
            ) : null}
        </div>
    );
}

// Loop Card Component
function LoopCard({
    loop,
    isActive,
    isPlaying,
    onPlay,
    onPause,
    onEdit,
    onDelete,
    selectable = false,
    selected = false,
    onToggleSelect,
}: {
    loop: Loop;
    isActive: boolean;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onEdit: () => void;
    onDelete: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}) {
    const categoryIcons: Record<LoopCategory, string> = {
        faith: '🙏',
        study: '📖',
        vision: '🎯',
        habits: '⚡',
        memory: '🧠',
    };

    return (
        <div
            className={`card hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-amber-500' : ''
                } ${isPlaying ? 'glow-pulse' : ''} ${selected ? 'ring-2 ring-forest-600 bg-forest-50' : ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2">
                    {selectable && (
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelect}
                            className="mt-1.5 accent-forest-600"
                        />
                    )}
                    <div>
                        <span className="text-sm text-forest-400">
                            {categoryIcons[loop.category]} {loop.category}
                        </span>
                        <h3 className="font-serif text-lg font-semibold text-forest-700 mt-1 break-words">
                            {loop.title}
                        </h3>
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${loop.sourceType === 'tts'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                    }`}>
                    {loop.sourceType === 'tts' ? '✍️ TTS' : '🎙️ Voice'}
                </span>
            </div>

            {/* Text preview (if TTS) */}
            {loop.text && (
                <p className="text-sm text-forest-500 mb-4 line-clamp-2">
                    &quot;{loop.text}&quot;
                </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forest-400 mb-4">
                <span>🕐 {formatDuration(loop.duration)}</span>
                <span>🔁 {loop.intervalSeconds}s interval</span>
                <span>▶️ {loop.playCount} plays</span>
                {loop.voiceId && (
                    <span>🎙️ {getVoiceLabel(loop.voiceId)}</span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={isActive && isPlaying ? onPause : onPlay}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${isActive && isPlaying
                        ? 'bg-amber-500 text-forest-900'
                        : 'bg-forest-600 text-parchment-100 hover:bg-forest-700'
                        }`}
                >
                    {isActive && isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
                <div className="flex gap-1">
                    <button
                        onClick={onEdit}
                        className="p-2 text-forest-400 hover:text-forest-600 transition-colors"
                        title="Edit loop"
                    >
                        ✏️
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-forest-400 hover:text-red-500 transition-colors"
                        title="Delete loop"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
}

// Now Playing Bar Component (single loop)
function NowPlayingBar({
    loop,
    isPlaying,
    onToggle,
    onStop,
}: {
    loop: Loop;
    isPlaying: boolean;
    onToggle: () => void;
    onStop: () => void;
}) {
    const { currentTime, duration, intervalRemaining, repeatCount, currentRepeat } = useAudioStore();

    return (
        <div className={`fixed bottom-0 left-0 right-0 bg-parchment-100 border-t border-forest-200 p-4 shadow-lg ${isPlaying ? 'glow-pulse' : ''}`}>
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                {/* Track Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-forest-700 truncate">
                        {loop.title}
                    </p>
                    <p className="text-sm text-forest-500">
                        {formatDuration(currentTime)} / {formatDuration(duration)}
                        {intervalRemaining && (
                            <span className="ml-3 text-forest-400">
                                ⏱️ Next in {intervalRemaining}s
                            </span>
                        )}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                        {loop.voiceId && (
                            <span className="text-xs text-forest-400">🎙️ {getVoiceLabel(loop.voiceId)}</span>
                        )}
                        {repeatCount !== null && currentRepeat > 0 && (
                            <span className="text-xs text-amber-600 font-semibold">
                                Play {currentRepeat} of {repeatCount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggle}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl hover:scale-105 transition-transform ${isPlaying
                            ? 'bg-amber-500 text-forest-900'
                            : 'bg-forest-600 text-parchment-100'
                            }`}
                    >
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button
                        onClick={onStop}
                        className="p-2 text-forest-400 hover:text-forest-600"
                    >
                        ⏹️
                    </button>
                </div>
            </div>
        </div>
    );
}

// Queue Now Playing Bar Component
function QueueNowPlayingBar({
    queue,
    queueIndex,
    isPlaying,
    onToggle,
    onStop,
    onNext,
    onPrev,
    dwellSec,
}: {
    queue: QueueItem[];
    queueIndex: number;
    isPlaying: boolean;
    onToggle: () => void;
    onStop: () => void;
    onNext: () => void;
    onPrev: () => void;
    dwellSec: number;
}) {
    const { currentTime, duration } = useAudioStore();
    const current = queue[queueIndex];

    if (!current) return null;

    return (
        <div className={`fixed bottom-0 left-0 right-0 bg-forest-700 text-parchment-100 p-4 shadow-lg z-50 ${isPlaying ? 'glow-pulse' : ''}`}>
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                {/* Track Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                        📋 {queueIndex + 1} of {queue.length}: {current.title}
                    </p>
                    <p className="text-sm text-parchment-300">
                        {formatDuration(currentTime)} / {formatDuration(duration)}
                        {dwellSec > 0 && (
                            <span className="ml-3 text-parchment-400">
                                Auto-next: {dwellSec >= 60 ? `${dwellSec / 60}m` : `${dwellSec}s`}
                            </span>
                        )}
                        {dwellSec === 0 && (
                            <span className="ml-3 text-parchment-400">Manual advance</span>
                        )}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onPrev}
                        disabled={queueIndex <= 0}
                        className="p-2 text-parchment-300 hover:text-parchment-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous"
                    >
                        ⏮️
                    </button>
                    <button
                        onClick={onToggle}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl hover:scale-105 transition-transform ${isPlaying
                            ? 'bg-amber-500 text-forest-900'
                            : 'bg-parchment-100 text-forest-700'
                            }`}
                    >
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button
                        onClick={onNext}
                        disabled={queueIndex >= queue.length - 1}
                        className="p-2 text-parchment-300 hover:text-parchment-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next"
                    >
                        ⏭️
                    </button>
                    <button
                        onClick={onStop}
                        className="p-2 text-parchment-300 hover:text-parchment-100"
                        title="Stop queue"
                    >
                        ⏹️
                    </button>
                </div>
            </div>
        </div>
    );
}
