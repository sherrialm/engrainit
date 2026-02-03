'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioStore } from '@/stores/audioStore';
import { formatDuration } from '@/lib/utils';

export default function FocusPage() {
    const router = useRouter();
    const {
        currentLoop,
        isPlaying,
        currentTime,
        duration,
        intervalRemaining,
        toggle,
        stop,
        startSpacedRepetition,
        stopSpacedRepetition,
        initializeAudio
    } = useAudioStore();

    const [isSpacedMode, setIsSpacedMode] = useState(false);

    useEffect(() => {
        initializeAudio();
    }, [initializeAudio]);

    // Redirect if no loop is loaded
    useEffect(() => {
        if (!currentLoop) {
            router.push('/app');
        }
    }, [currentLoop, router]);

    if (!currentLoop) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-ink-500 dark:text-paper-500">Loading...</p>
            </div>
        );
    }

    const handleToggleSpaced = () => {
        if (isSpacedMode) {
            stopSpacedRepetition();
            setIsSpacedMode(false);
        } else {
            startSpacedRepetition();
            setIsSpacedMode(true);
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-8 bg-paper-100 dark:bg-ink-900">
            {/* Breathing Text Display */}
            <div className={`max-w-3xl text-center mb-12 ${isPlaying ? 'breathing' : ''}`}>
                {currentLoop.text ? (
                    <p className="focus-text">
                        "{currentLoop.text}"
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div className="text-8xl">🎙️</div>
                        <p className="font-serif text-2xl text-ink-700 dark:text-paper-300">
                            {currentLoop.title}
                        </p>
                    </div>
                )}
            </div>

            {/* Loop Counter Badge */}
            <div className="mb-8">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-paper-200 dark:bg-ink-800 text-sm text-ink-600 dark:text-paper-400">
                    🔁 {currentLoop.playCount || 0} plays
                    {intervalRemaining !== null && (
                        <span className="ml-2 text-ink-400 dark:text-paper-600">
                            • Next in {intervalRemaining}s
                        </span>
                    )}
                </span>
            </div>

            {/* Progress Ring */}
            <div className="relative w-48 h-48 mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-paper-300 dark:text-ink-700"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 2.83} 283`}
                        className="text-ink-900 dark:text-paper-100 transition-all duration-100"
                    />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl mb-1">
                        {isPlaying ? '🔊' : '⏸️'}
                    </span>
                    <span className="text-sm text-ink-500 dark:text-paper-500">
                        {formatDuration(currentTime)}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                    onClick={toggle}
                    className="w-16 h-16 rounded-full bg-ink-900 dark:bg-paper-100 text-paper-100 dark:text-ink-900 flex items-center justify-center text-2xl hover:scale-105 transition-transform shadow-lg"
                >
                    {isPlaying ? '⏸️' : '▶️'}
                </button>

                {/* Spaced Repetition Toggle */}
                <button
                    onClick={handleToggleSpaced}
                    className={`px-5 py-3 rounded-full font-medium transition-all ${isSpacedMode
                            ? 'bg-green-500 text-white'
                            : 'bg-paper-200 dark:bg-ink-800 text-ink-600 dark:text-paper-400 hover:bg-paper-300 dark:hover:bg-ink-700'
                        }`}
                >
                    {isSpacedMode ? '🔁 Spaced: ON' : '🔁 Spaced: OFF'}
                </button>

                {/* Stop */}
                <button
                    onClick={() => {
                        stop();
                        setIsSpacedMode(false);
                    }}
                    className="w-12 h-12 rounded-full bg-paper-200 dark:bg-ink-800 text-ink-500 dark:text-paper-500 flex items-center justify-center text-xl hover:bg-paper-300 dark:hover:bg-ink-700 transition-colors"
                >
                    ⏹️
                </button>
            </div>

            {/* Info */}
            <div className="mt-8 text-center text-sm text-ink-400 dark:text-paper-600">
                <p>
                    <span className="font-medium">{currentLoop.title}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDuration(duration)} total</span>
                    <span className="mx-2">•</span>
                    <span>{currentLoop.intervalSeconds}s interval</span>
                </p>
            </div>

            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="mt-8 text-ink-400 dark:text-paper-600 hover:text-ink-600 dark:hover:text-paper-400 text-sm"
            >
                ← Back
            </button>
        </div>
    );
}
