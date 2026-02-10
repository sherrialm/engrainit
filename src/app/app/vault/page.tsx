'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore, useFilteredLoops } from '@/stores/vaultStore';
import { useAudioStore } from '@/stores/audioStore';
import { Loop, LoopCategory } from '@/types';
import { formatDuration } from '@/lib/utils';
import { CardGridSkeleton } from '@/components/Skeleton';

const CATEGORIES: { id: LoopCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '📚' },
    { id: 'faith', label: 'Faith', icon: '🙏' },
    { id: 'study', label: 'Study', icon: '📖' },
    { id: 'vision', label: 'Vision', icon: '🎯' },
    { id: 'habits', label: 'Habits', icon: '⚡' },
];

export default function VaultPage() {
    const { user } = useAuthStore();
    const { fetchLoops, isLoading, error, selectedCategory, setCategory, removeLoop } = useVaultStore();
    const filteredLoops = useFilteredLoops();
    const { loadAndPlay, currentLoop, isPlaying, toggle, stop } = useAudioStore();

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
            await removeLoop(user.uid, loop.id);
            if (currentLoop?.id === loop.id) {
                stop();
            }
        } catch (err) {
            console.error('Failed to delete loop:', err);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Page Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    The Vault
                </h2>
                <p className="text-forest-500">
                    Your library of mental imprints
                </p>
                <Link href="/app" className="inline-block mt-3 text-sm text-forest-500 hover:text-forest-700 font-medium">
                    ✍️ ← Create a New Loop
                </Link>
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
                    <a href="/app" className="btn-primary inline-block">
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
                            onDelete={() => handleDelete(loop)}
                        />
                    ))}
                </div>
            )}

            {/* Now Playing Bar (if something is playing) */}
            {currentLoop && (
                <NowPlayingBar loop={currentLoop} isPlaying={isPlaying} onToggle={toggle} onStop={stop} />
            )}
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
    onDelete,
}: {
    loop: Loop;
    isActive: boolean;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onDelete: () => void;
}) {
    const categoryIcons: Record<LoopCategory, string> = {
        faith: '🙏',
        study: '📖',
        vision: '🎯',
        habits: '⚡',
    };

    return (
        <div
            className={`card hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-amber-500' : ''
                } ${isPlaying ? 'glow-pulse' : ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div>
                    <span className="text-sm text-forest-400">
                        {categoryIcons[loop.category]} {loop.category}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-forest-700 mt-1">
                        {loop.title}
                    </h3>
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
                    "{loop.text}"
                </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-forest-400 mb-4">
                <span>🕐 {formatDuration(loop.duration)}</span>
                <span>🔁 {loop.intervalSeconds}s interval</span>
                <span>▶️ {loop.playCount} plays</span>
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
                <button
                    onClick={onDelete}
                    className="p-2 text-forest-400 hover:text-red-500 transition-colors"
                    title="Delete loop"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}

// Now Playing Bar Component
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
    const { currentTime, duration, intervalRemaining } = useAudioStore();

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
