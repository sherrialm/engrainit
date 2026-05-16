'use client';

/**
 * Record Voice Loop — Microphone capture flow
 *
 * Uses the existing RecorderService (MediaRecorder API) to capture
 * user's voice, then saves it as a voice-type loop in the Vault.
 *
 * Flow:
 *   1. User enters a title and selects a category
 *   2. Tap Record → mic is activated, timer counts up
 *   3. Tap Stop → recording ends, preview plays
 *   4. Tap Save to Vault → audio is uploaded to Firebase Storage,
 *      loop document is created in Firestore, user is redirected to Vault
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useAudioStore } from '@/stores/audioStore';
import { getRecorderService, blobToDataUrl } from '@/services/RecorderService';
import { uploadAudio } from '@/services/LoopService';
import type { LoopCategory } from '@/types';

// ── Helpers ───────────────────────────────────────────────────

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const CATEGORY_OPTIONS: { id: LoopCategory; label: string; emoji: string }[] = [
    { id: 'vision', label: 'Vision', emoji: '🎯' },
    { id: 'faith', label: 'Faith', emoji: '🙏' },
    { id: 'study', label: 'Study', emoji: '📖' },
    { id: 'habits', label: 'Habits', emoji: '⚡' },
    { id: 'memory', label: 'Memory', emoji: '🧠' },
];

const MAX_RECORDING_SECONDS = 300; // 5 minutes max

// ── Record Page ───────────────────────────────────────────────

export default function RecordPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addLoop } = useVaultStore();
    const { loadAndPlay, stop: stopPlayback, isPlaying: audioIsPlaying } = useAudioStore();

    // Form state
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('vision');

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [permissionError, setPermissionError] = useState<string | null>(null);

    // Completed recording
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Preview playback
    const [isPreviewing, setIsPreviewing] = useState(false);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Recorder ref
    const recorderRef = useRef(getRecorderService());

    // ── Set up recorder callbacks ────────────────────────────

    useEffect(() => {
        const recorder = recorderRef.current;

        recorder.onRecordingStateChange = (recording: boolean) => {
            setIsRecording(recording);
        };

        recorder.onRecordingComplete = async (blob: Blob, duration: number) => {
            console.log('[RecordPage] Recording complete, blob size:', blob.size, 'duration:', duration);
            setAudioBlob(blob);
            setAudioDuration(duration);

            // Convert to data URL for preview
            try {
                const dataUrl = await blobToDataUrl(blob);
                setAudioDataUrl(dataUrl);
            } catch (err) {
                console.error('[RecordPage] Failed to convert blob:', err);
            }
        };

        recorder.onTimeUpdate = (seconds: number) => {
            setRecordingTime(seconds);
            // Auto-stop at max duration
            if (seconds >= MAX_RECORDING_SECONDS) {
                recorder.stop();
            }
        };

        recorder.onError = (errorMsg: string) => {
            setPermissionError(errorMsg);
            setIsRecording(false);
        };

        return () => {
            // Clean up on unmount
            if (recorder.getIsRecording()) {
                recorder.stop();
            }
            recorder.dispose();
        };
    }, []);

    // ── Actions ──────────────────────────────────────────────

    const handleStartRecording = useCallback(async () => {
        setPermissionError(null);
        setSaveError(null);

        // Stop any current playback
        stopPlayback();
        stopPreview();

        // Clear previous recording
        setAudioBlob(null);
        setAudioDataUrl(null);
        setAudioDuration(0);
        setRecordingTime(0);

        await recorderRef.current.start();
    }, [stopPlayback]);

    const handleStopRecording = useCallback(() => {
        recorderRef.current.stop();
    }, []);

    const handlePreview = useCallback(() => {
        if (!audioDataUrl) return;

        if (isPreviewing && previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current.currentTime = 0;
            setIsPreviewing(false);
            return;
        }

        const audio = new Audio(audioDataUrl);
        previewAudioRef.current = audio;
        audio.onended = () => setIsPreviewing(false);
        audio.play();
        setIsPreviewing(true);
    }, [audioDataUrl, isPreviewing]);

    const stopPreview = useCallback(() => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current.currentTime = 0;
            previewAudioRef.current = null;
        }
        setIsPreviewing(false);
    }, []);

    const handleDiscard = useCallback(() => {
        stopPreview();
        setAudioBlob(null);
        setAudioDataUrl(null);
        setAudioDuration(0);
        setRecordingTime(0);
    }, [stopPreview]);

    const handleSave = useCallback(async () => {
        if (!user?.uid || !audioBlob) return;
        if (!title.trim()) {
            setSaveError('Please enter a title for your loop.');
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        stopPreview();

        try {
            // 1. Upload audio blob to Firebase Storage
            const filename = `voice_${Date.now()}.webm`;
            console.log('[RecordPage] Uploading audio — blob size:', audioBlob.size, 'type:', audioBlob.type, 'filename:', filename);
            const audioUrl = await uploadAudio(user.uid, audioBlob, filename);
            console.log('[RecordPage] Upload complete, URL:', audioUrl.substring(0, 60) + '...');

            // 2. Create loop document in Firestore
            await addLoop(user.uid, {
                title: title.trim(),
                category,
                sourceType: 'recording',
                text: '', // Voice loops don't have text
                audioUrl,
                duration: Math.round(audioDuration),
                intervalSeconds: 0, // No spaced repetition for voice recordings
                tags: [],
            });

            console.log('[RecordPage] Loop saved successfully!');
            router.push('/app/vault');
        } catch (err: any) {
            console.error('[RecordPage] Save failed:', err);
            setSaveError(err.message || 'Failed to save recording. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [user?.uid, audioBlob, title, category, audioDuration, addLoop, router, stopPreview]);

    // ── Render ───────────────────────────────────────────────

    const hasRecording = audioBlob !== null;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-2xl">🎙️</span>
                <div>
                    <h1 className="font-serif text-2xl font-bold text-forest-700">
                        Record a Voice Loop
                    </h1>
                    <p className="text-xs text-forest-400">
                        Speak your truth, affirmation, or study material into a repeatable loop.
                    </p>
                </div>
            </div>

            {/* ── Step 1: Title & Category ─────────────────── */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-forest-600 mb-2">
                        Loop Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-field"
                        placeholder="e.g., Morning Affirmation, Bible Verse, Study Notes..."
                        maxLength={100}
                        disabled={isRecording}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-forest-600 mb-2">
                        Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setCategory(opt.id)}
                                disabled={isRecording}
                                className={`px-4 py-2 text-sm rounded-full transition-all ${
                                    category === opt.id
                                        ? 'bg-forest-700 text-parchment-100 shadow-md'
                                        : 'bg-parchment-100 text-forest-600 border border-forest-200 hover:bg-parchment-300'
                                } disabled:opacity-50`}
                            >
                                {opt.emoji} {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Step 2: Recording Area ───────────────────── */}
            <div className="bg-parchment-100 rounded-2xl border border-forest-100 p-6 text-center space-y-4">
                {/* Timer */}
                <div className={`text-4xl font-mono font-bold transition-colors ${
                    isRecording ? 'text-red-600' : hasRecording ? 'text-forest-700' : 'text-forest-300'
                }`}>
                    {hasRecording && !isRecording
                        ? formatTime(audioDuration)
                        : formatTime(recordingTime)}
                </div>

                {/* Recording indicator */}
                {isRecording && (
                    <div className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-600 font-medium">Recording...</span>
                    </div>
                )}

                {/* Max duration hint */}
                {isRecording && (
                    <p className="text-xs text-forest-400">
                        Max {MAX_RECORDING_SECONDS / 60} minutes
                    </p>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 pt-2">
                    {!isRecording && !hasRecording && (
                        <button
                            onClick={handleStartRecording}
                            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-xl active:scale-95"
                            title="Start recording"
                            id="start-record-btn"
                        >
                            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        </button>
                    )}

                    {isRecording && (
                        <button
                            onClick={handleStopRecording}
                            className="w-20 h-20 rounded-full bg-forest-700 hover:bg-forest-600 text-parchment-100 flex items-center justify-center transition-all shadow-lg hover:shadow-xl active:scale-95"
                            title="Stop recording"
                            id="stop-record-btn"
                        >
                            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        </button>
                    )}

                    {hasRecording && !isRecording && (
                        <>
                            {/* Preview */}
                            <button
                                onClick={handlePreview}
                                className={`p-4 rounded-full transition-all shadow-md ${
                                    isPreviewing
                                        ? 'bg-forest-600 text-parchment-100'
                                        : 'bg-forest-700 text-parchment-100 hover:bg-forest-600'
                                }`}
                                title={isPreviewing ? 'Stop preview' : 'Preview recording'}
                            >
                                {isPreviewing ? (
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>

                            {/* Re-record */}
                            <button
                                onClick={handleStartRecording}
                                className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-md"
                                title="Record again"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                </svg>
                            </button>

                            {/* Discard */}
                            <button
                                onClick={handleDiscard}
                                className="p-4 rounded-full bg-parchment-300 text-forest-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-md"
                                title="Discard recording"
                            >
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>

                {/* Status text */}
                {!isRecording && !hasRecording && (
                    <p className="text-sm text-forest-400">
                        Tap the microphone to start recording
                    </p>
                )}
                {hasRecording && !isRecording && (
                    <p className="text-sm text-forest-500">
                        Recording ready — preview, re-record, or save to your Vault
                    </p>
                )}
            </div>

            {/* Permission error */}
            {permissionError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-700">{permissionError}</p>
                    <p className="text-xs text-red-500 mt-1">
                        Make sure your browser has microphone access enabled for this site.
                    </p>
                </div>
            )}

            {/* ── Step 3: Save ────────────────────────────── */}
            {hasRecording && !isRecording && (
                <div className="space-y-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !title.trim()}
                        className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                        id="save-voice-loop-btn"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-parchment-100 border-t-transparent rounded-full animate-spin" />
                                Saving to Vault...
                            </>
                        ) : (
                            'Save to Vault'
                        )}
                    </button>

                    {!title.trim() && (
                        <p className="text-xs text-amber-600 text-center">
                            Enter a title above before saving.
                        </p>
                    )}
                </div>
            )}

            {/* Save error */}
            {saveError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {saveError}
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
