'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useAudioStore } from '@/stores/audioStore';
import { useVaultStore } from '@/stores/vaultStore';
import { generateSpeech } from '@/services/TTSService';
import { getRecorderService, blobToDataUrl } from '@/services/RecorderService';
import { uploadBase64Audio } from '@/services/LoopService';
import { LoopCategory } from '@/types';
import { AudioPlayerSkeleton } from '@/components/Skeleton';

export default function AppDashboard() {
    const [activeTab, setActiveTab] = useState<'text' | 'record' | 'upload'>('text');
    const { initializeAudio } = useAudioStore();

    // Initialize audio engine on mount
    useEffect(() => {
        initializeAudio();
    }, [initializeAudio]);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Page Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-ink-900 dark:text-paper-100 mb-2">
                    Create a New Loop
                </h2>
                <p className="text-ink-500 dark:text-paper-500">
                    Type, upload a document, or record your voice to create a mental imprint.
                </p>
            </div>

            {/* Tab Selector */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex bg-paper-200 dark:bg-ink-800 rounded-lg p-1 flex-wrap justify-center gap-1">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'text'
                            ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-paper-100 shadow-sm'
                            : 'text-ink-500 dark:text-paper-500 hover:text-ink-700 dark:hover:text-paper-300'
                            }`}
                    >
                        ✍️ Text
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'upload'
                            ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-paper-100 shadow-sm'
                            : 'text-ink-500 dark:text-paper-500 hover:text-ink-700 dark:hover:text-paper-300'
                            }`}
                    >
                        📄 Document
                    </button>
                    <button
                        onClick={() => setActiveTab('record')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'record'
                            ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-paper-100 shadow-sm'
                            : 'text-ink-500 dark:text-paper-500 hover:text-ink-700 dark:hover:text-paper-300'
                            }`}
                    >
                        🎙️ Voice
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="card max-w-2xl mx-auto">
                {activeTab === 'text' ? (
                    <TextToSpeechPanel />
                ) : activeTab === 'upload' ? (
                    <DocumentUploadPanel />
                ) : (
                    <VoiceRecordingPanel />
                )}
            </div>

            {/* Quick Access to Vault */}
            <div className="text-center mt-8">
                <Link href="/app/vault" className="text-ink-500 dark:text-paper-500 hover:text-ink-700 dark:hover:text-paper-300 text-sm">
                    View your saved loops in The Vault →
                </Link>
            </div>
        </div>
    );
}

// Document Upload Panel Component
function DocumentUploadPanel() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { loadFromBase64, currentLoop, isPlaying, toggle, stop, setInterval: setAudioInterval, startSpacedRepetition, stopSpacedRepetition } = useAudioStore();
    const { addLoop } = useVaultStore();

    const [file, setFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('study');
    const [voiceId, setVoiceId] = useState('sage');
    const [interval, setIntervalValue] = useState(30);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
    const [isSpacedActive, setIsSpacedActive] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setIsExtracting(true);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('/api/extract-text', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract text');
            }

            setExtractedText(data.text);
            setTitle(selectedFile.name.replace(/\.[^/.]+$/, '')); // Use filename without extension

            if (data.truncated) {
                setError('Document was truncated to 5000 characters for TTS processing.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to extract text from document');
            setFile(null);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleGenerate = async () => {
        if (!extractedText.trim()) return;

        setIsGenerating(true);
        setError(null);

        try {
            const response = await generateSpeech({ text: extractedText.substring(0, 500), voiceId }); // Limit for TTS

            if (!response.audioContent) {
                throw new Error('No audio content received. Check if TTS API key is configured.');
            }

            setGeneratedAudio(response.audioContent);

            await loadFromBase64(response.audioContent, {
                title: title || 'Document Loop',
                category,
                sourceType: 'tts',
                text: extractedText.substring(0, 500),
                intervalSeconds: interval,
            });

            setAudioInterval(interval);
        } catch (err: any) {
            setError(err.message || 'Failed to generate speech');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToVault = async () => {
        if (!generatedAudio || !user?.uid) return;

        try {
            setIsGenerating(true);

            const filename = `doc-${Date.now()}.mp3`;
            const audioUrl = await uploadBase64Audio(user.uid, generatedAudio, filename);

            await addLoop(user.uid, {
                title: title || 'Document Loop',
                category,
                sourceType: 'tts',
                text: extractedText.substring(0, 500),
                audioUrl,
                duration: currentLoop?.duration || 0,
                intervalSeconds: interval,
            });

            router.push('/app/vault');
        } catch (err: any) {
            setError(err.message || 'Failed to save loop');
        } finally {
            setIsGenerating(false);
        }
    };

    const resetForm = () => {
        setFile(null);
        setExtractedText('');
        setTitle('');
        setGeneratedAudio(null);
        setError(null);
    };

    return (
        <div className="space-y-6">
            {/* File Upload Area */}
            {!extractedText && (
                <div className="border-2 border-dashed border-ink-200 dark:border-ink-700 rounded-xl p-8 text-center">
                    <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="document-upload"
                    />
                    <label
                        htmlFor="document-upload"
                        className="cursor-pointer block"
                    >
                        {isExtracting ? (
                            <div className="space-y-3">
                                <div className="animate-spin h-12 w-12 border-4 border-ink-200 border-t-ink-900 dark:border-ink-700 dark:border-t-paper-100 rounded-full mx-auto"></div>
                                <p className="text-ink-500 dark:text-paper-500">Extracting text...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-5xl">📄</div>
                                <p className="font-medium text-ink-700 dark:text-paper-300">
                                    Upload a document
                                </p>
                                <p className="text-sm text-ink-400 dark:text-paper-600">
                                    PDF, DOCX, or TXT files supported
                                </p>
                                <p className="text-xs text-ink-300 dark:text-paper-700">
                                    Click or drag to upload
                                </p>
                            </div>
                        )}
                    </label>
                </div>
            )}

            {/* Extracted Text Preview */}
            {extractedText && !generatedAudio && (
                <>
                    <div className="bg-paper-200 dark:bg-ink-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-ink-600 dark:text-paper-400">
                                📄 {file?.name}
                            </span>
                            <button
                                onClick={resetForm}
                                className="text-xs text-ink-400 hover:text-ink-600 dark:text-paper-600 dark:hover:text-paper-400"
                            >
                                Change file
                            </button>
                        </div>
                        <p className="text-sm text-ink-500 dark:text-paper-500 line-clamp-4">
                            {extractedText}
                        </p>
                        <p className="text-xs text-ink-400 dark:text-paper-600 mt-2">
                            {extractedText.length} characters (first 500 will be converted to audio)
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Loop Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-field"
                            placeholder="e.g., Chapter Summary"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Category
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as LoopCategory)}
                            className="input-field"
                        >
                            <option value="faith">🙏 Faith</option>
                            <option value="study">📚 Study</option>
                            <option value="vision">🎯 Vision</option>
                            <option value="habits">⚡ Habits</option>
                        </select>
                    </div>

                    {/* Voice Select */}
                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Voice
                        </label>
                        <select
                            value={voiceId}
                            onChange={(e) => setVoiceId(e.target.value)}
                            className="input-field"
                        >
                            {VOICE_OPTIONS.map((voice) => (
                                <option key={voice.id} value={voice.id}>
                                    {voice.label} - {voice.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Interval */}
                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Repetition Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[15, 30, 60, 120, 300].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setIntervalValue(preset)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                        ? 'bg-ink-900 text-paper-100 dark:bg-paper-100 dark:text-ink-900'
                                        : 'bg-paper-200 text-ink-600 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-400'
                                        }`}
                                >
                                    {preset >= 60 ? `${preset / 60}m` : `${preset}s`}
                                </button>
                            ))}
                        </div>
                        <input
                            type="range"
                            value={interval}
                            onChange={(e) => setIntervalValue(Number(e.target.value))}
                            min={0}
                            max={300}
                            step={5}
                            className="w-full accent-ink-900 dark:accent-paper-100"
                        />
                    </div>
                </>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Actions */}
            {extractedText && !generatedAudio && (
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-primary w-full"
                >
                    {isGenerating ? 'Generating Audio...' : '🔊 Generate & Play'}
                </button>
            )}

            {generatedAudio && (
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <button onClick={toggle} className="btn-primary flex-1">
                            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                        </button>
                        <button
                            onClick={() => {
                                if (isSpacedActive) {
                                    stopSpacedRepetition();
                                    setIsSpacedActive(false);
                                } else {
                                    startSpacedRepetition();
                                    setIsSpacedActive(true);
                                }
                            }}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${isSpacedActive
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-paper-200 text-ink-700 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-300 dark:hover:bg-ink-600'
                                }`}
                        >
                            🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Spaced Loop'}
                        </button>
                        <button
                            onClick={() => {
                                stop();
                                setIsSpacedActive(false);
                            }}
                            className="p-2 rounded-lg bg-paper-200 text-ink-500 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-500 dark:hover:bg-ink-600 transition-colors"
                            title="Stop"
                        >
                            ⏹️
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveToVault}
                            disabled={isGenerating}
                            className="btn-primary flex-1"
                        >
                            💾 Save to Vault
                        </button>
                        <Link href="/app/focus" className="btn-secondary flex-1 text-center">
                            🧘 Focus Mode
                        </Link>
                    </div>
                    <button onClick={resetForm} className="btn-ghost w-full text-sm">
                        ← Upload Another Document
                    </button>
                </div>
            )}
        </div>
    );
}

// Voice options for TTS
const VOICE_OPTIONS = [
    { id: 'sage', label: '🧘 Sage', description: 'Deep, calm' },
    { id: 'mentor', label: '📖 Mentor', description: 'Bright, clear' },
    { id: 'anchor', label: '⚓ Anchor', description: 'Low, steady' },
    { id: 'parent', label: '💝 Parent', description: 'Soft, warm' },
];

// Text-to-Speech Panel Component
function TextToSpeechPanel() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { loadFromBase64, currentLoop, isPlaying, toggle, stop, setInterval: setAudioInterval, startSpacedRepetition, stopSpacedRepetition } = useAudioStore();
    const { addLoop } = useVaultStore();

    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('study');
    const [voiceId, setVoiceId] = useState('sage');
    const [interval, setInterval] = useState(30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
    const [isSpacedActive, setIsSpacedActive] = useState(false);

    const handleGenerate = async () => {
        if (!text.trim()) return;

        setIsGenerating(true);
        setError(null);

        try {
            const response = await generateSpeech({ text, voiceId });

            if (!response.audioContent) {
                throw new Error('No audio content received. Check if TTS API key is configured.');
            }

            setGeneratedAudio(response.audioContent);

            // Load and play immediately
            await loadFromBase64(response.audioContent, {
                title: title || 'Untitled Loop',
                category,
                sourceType: 'tts',
                text,
                intervalSeconds: interval,
            });

            setAudioInterval(interval);
        } catch (err: any) {
            setError(err.message || 'Failed to generate speech');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToVault = async () => {
        if (!generatedAudio || !user?.uid) return;

        try {
            setIsGenerating(true);

            // Upload to Firebase Storage
            const filename = `tts-${Date.now()}.mp3`;
            const audioUrl = await uploadBase64Audio(user.uid, generatedAudio, filename);

            // Save to Firestore
            await addLoop(user.uid, {
                title: title || 'Untitled Loop',
                category,
                sourceType: 'tts',
                text,
                audioUrl,
                duration: currentLoop?.duration || 0,
                intervalSeconds: interval,
            });

            // Navigate to vault
            router.push('/app/vault');
        } catch (err: any) {
            setError(err.message || 'Failed to save loop');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Title Input */}
            <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                    Loop Title
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Morning Affirmation"
                />
            </div>

            {/* Text Input */}
            <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                    Your Text
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="input-field min-h-[150px] resize-none"
                    placeholder="Enter the text you want to engrave in your mind..."
                    maxLength={500}
                />
                <p className={`text-xs mt-1 ${text.length >= 480 ? 'text-red-500 font-medium' : text.length >= 400 ? 'text-yellow-500' : 'text-ink-400 dark:text-paper-600'}`}>
                    {text.length}/500 characters{text.length >= 480 ? ' - Near limit!' : text.length >= 400 ? ' - Approaching limit' : ''}
                </p>
            </div>

            {/* Voice Select */}
            <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                    Voice
                </label>
                <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="input-field"
                >
                    {VOICE_OPTIONS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {voice.label} - {voice.description}
                        </option>
                    ))}
                </select>
            </div>

            {/* Category Select */}
            <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                    Category
                </label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LoopCategory)}
                    className="input-field"
                >
                    <option value="faith">🙏 Faith</option>
                    <option value="study">📚 Study</option>
                    <option value="vision">🎯 Vision</option>
                    <option value="habits">⚡ Habits</option>
                </select>
            </div>

            {/* Spaced Repetition Interval */}
            <div>
                <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                    Repetition Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {[15, 30, 60, 120, 300].map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setInterval(preset)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                ? 'bg-ink-900 text-paper-100 dark:bg-paper-100 dark:text-ink-900'
                                : 'bg-paper-200 text-ink-600 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-400'
                                }`}
                        >
                            {preset >= 60 ? `${preset / 60}m` : `${preset}s`}
                        </button>
                    ))}
                </div>
                <input
                    type="range"
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    min={0}
                    max={300}
                    step={5}
                    className="w-full accent-ink-900 dark:accent-paper-100"
                />
                <div className="flex justify-between text-xs text-ink-400 dark:text-paper-600">
                    <span>Continuous</span>
                    <span>2m 30s</span>
                    <span>5m</span>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
                {isGenerating ? (
                    <AudioPlayerSkeleton />
                ) : !generatedAudio ? (
                    <button
                        onClick={handleGenerate}
                        disabled={!text.trim() || isGenerating}
                        className="btn-primary w-full disabled:opacity-50"
                    >
                        🔊 Generate & Play
                    </button>
                ) : (
                    <>
                        {/* Playback Controls */}
                        <div className="flex gap-3">
                            <button
                                onClick={toggle}
                                className="btn-primary flex-1"
                            >
                                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                            </button>
                            <button
                                onClick={() => {
                                    if (isSpacedActive) {
                                        stopSpacedRepetition();
                                        setIsSpacedActive(false);
                                    } else {
                                        startSpacedRepetition();
                                        setIsSpacedActive(true);
                                    }
                                }}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${isSpacedActive
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-paper-200 text-ink-700 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-300 dark:hover:bg-ink-600'
                                    }`}
                            >
                                🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Start Spaced Loop'}
                            </button>
                            <button
                                onClick={() => {
                                    stop();
                                    setIsSpacedActive(false);
                                }}
                                className="p-2 rounded-lg bg-paper-200 text-ink-500 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-500 dark:hover:bg-ink-600 transition-colors"
                                title="Stop"
                            >
                                ⏹️
                            </button>
                        </div>

                        {/* Save & Navigate */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveToVault}
                                disabled={isGenerating}
                                className="btn-primary flex-1"
                            >
                                💾 Save to Vault
                            </button>
                            <Link href={`/app/focus`} className="btn-secondary flex-1 text-center">
                                🧘 Focus Mode
                            </Link>
                        </div>

                        {/* Reset */}
                        <button
                            onClick={() => {
                                setGeneratedAudio(null);
                                setText('');
                                setTitle('');
                            }}
                            className="btn-ghost w-full text-sm"
                        >
                            ← Create Another
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// Voice Recording Panel Component
function VoiceRecordingPanel() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { loadFromBase64, isPlaying, toggle, stop, startSpacedRepetition, stopSpacedRepetition } = useAudioStore();
    const { addLoop } = useVaultStore();

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('study');
    const [interval, setInterval] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [isSpacedActive, setIsSpacedActive] = useState(false);

    useEffect(() => {
        const recorder = getRecorderService();

        recorder.onRecordingStateChange = (recording) => {
            console.log('Recording state changed:', recording);
            setIsRecording(recording);
        };

        recorder.onTimeUpdate = (seconds) => {
            setRecordingTime(Math.floor(seconds));
        };

        recorder.onRecordingComplete = async (blob, duration) => {
            console.log('Recording complete, blob size:', blob.size, 'duration:', duration);
            try {
                const dataUrl = await blobToDataUrl(blob);
                setRecordedAudio(dataUrl);
                await loadFromBase64(dataUrl, {
                    sourceType: 'recording',
                    intervalSeconds: interval,
                });
            } catch (err: any) {
                console.error('Failed to process recording:', err);
                setError('Failed to process recording');
            }
        };

        recorder.onError = (err) => {
            console.error('Recorder error:', err);
            setError(err);
        };

        return () => {
            recorder.dispose();
        };
    }, [loadFromBase64, interval]);

    const startRecording = async () => {
        const recorder = getRecorderService();
        setError(null);
        setRecordedAudio(null);
        setRecordingTime(0);

        console.log('Requesting microphone permission...');

        try {
            // First request permission explicitly
            const hasPermission = await recorder.requestPermission();
            console.log('Permission result:', hasPermission);

            if (!hasPermission) {
                setError('Microphone permission denied. Please allow microphone access in your browser settings.');
                return;
            }

            setPermissionGranted(true);
            console.log('Starting recording...');
            await recorder.start();
            console.log('Recording started!');
        } catch (err: any) {
            console.error('Start recording error:', err);
            setError(err.message || 'Failed to start recording');
        }
    };

    const stopRecording = () => {
        console.log('Stopping recording...');
        const recorder = getRecorderService();
        recorder.stop();
    };

    const handleSaveToVault = async () => {
        if (!recordedAudio || !user?.uid) return;

        try {
            setIsSaving(true);

            // Upload to Firebase Storage
            const filename = `recording-${Date.now()}.webm`;
            const audioUrl = await uploadBase64Audio(user.uid, recordedAudio, filename);

            // Save to Firestore
            await addLoop(user.uid, {
                title: title || 'Voice Recording',
                category,
                sourceType: 'recording',
                audioUrl,
                duration: recordingTime,
                intervalSeconds: interval,
            });

            router.push('/app/vault');
        } catch (err: any) {
            setError(err.message || 'Failed to save recording');
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6">
            {/* Recording Area */}
            <div className="text-center py-8">
                {!isRecording && !recordedAudio && (
                    <>
                        <button
                            onClick={startRecording}
                            className="w-28 h-28 rounded-full bg-ink-900 dark:bg-paper-100 flex items-center justify-center transition-all mx-auto hover:scale-105"
                        >
                            <span className="text-5xl">🎙️</span>
                        </button>
                        <p className="mt-4 text-ink-600 dark:text-paper-400 font-medium">
                            Tap to start recording
                        </p>
                    </>
                )}

                {isRecording && (
                    <>
                        <div className="w-28 h-28 rounded-full bg-red-500 flex items-center justify-center mx-auto audio-pulse">
                            <span className="text-5xl">🎙️</span>
                        </div>
                        <p className="mt-4 text-red-600 dark:text-red-400 font-bold text-xl">
                            Recording... {formatTime(recordingTime)}
                        </p>
                        <button
                            onClick={stopRecording}
                            className="mt-4 btn-primary bg-red-600 hover:bg-red-700 px-8"
                        >
                            ⏹️ Stop Recording
                        </button>
                    </>
                )}

                {recordedAudio && !isRecording && (
                    <>
                        <div className="w-28 h-28 rounded-full bg-green-500 flex items-center justify-center mx-auto">
                            <span className="text-5xl">✅</span>
                        </div>
                        <p className="mt-4 text-green-600 dark:text-green-400 font-medium">
                            Recording complete! ({formatTime(recordingTime)})
                        </p>
                    </>
                )}
            </div>

            {/* Form fields (show after recording) */}
            {recordedAudio && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-field"
                            placeholder="e.g., My Affirmation"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Category
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as LoopCategory)}
                            className="input-field"
                        >
                            <option value="faith">🙏 Faith</option>
                            <option value="study">📚 Study</option>
                            <option value="vision">🎯 Vision</option>
                            <option value="habits">⚡ Habits</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-ink-700 dark:text-paper-300 mb-2">
                            Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[15, 30, 60, 120, 300].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setInterval(preset)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                        ? 'bg-ink-900 text-paper-100 dark:bg-paper-100 dark:text-ink-900'
                                        : 'bg-paper-200 text-ink-600 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-400'
                                        }`}
                                >
                                    {preset >= 60 ? `${preset / 60}m` : `${preset}s`}
                                </button>
                            ))}
                        </div>
                        <input
                            type="range"
                            value={interval}
                            onChange={(e) => setInterval(Number(e.target.value))}
                            min={0}
                            max={300}
                            step={5}
                            className="w-full accent-ink-900 dark:accent-paper-100"
                        />
                    </div>
                </>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Actions */}
            {recordedAudio && (
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <button onClick={toggle} className="btn-primary flex-1">
                            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                        </button>
                        <button
                            onClick={() => {
                                if (isSpacedActive) {
                                    stopSpacedRepetition();
                                    setIsSpacedActive(false);
                                } else {
                                    startSpacedRepetition();
                                    setIsSpacedActive(true);
                                }
                            }}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${isSpacedActive
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-paper-200 text-ink-700 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-300 dark:hover:bg-ink-600'
                                }`}
                        >
                            🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Spaced Loop'}
                        </button>
                        <button
                            onClick={() => {
                                stop();
                                setIsSpacedActive(false);
                            }}
                            className="p-2 rounded-lg bg-paper-200 text-ink-500 hover:bg-paper-300 dark:bg-ink-700 dark:text-paper-500 dark:hover:bg-ink-600 transition-colors"
                            title="Stop"
                        >
                            ⏹️
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveToVault}
                            disabled={isSaving}
                            className="btn-primary flex-1"
                        >
                            💾 Save to Vault
                        </button>
                        <Link href="/app/focus" className="btn-secondary flex-1 text-center">
                            🧘 Focus Mode
                        </Link>
                    </div>
                    <button
                        onClick={() => {
                            setRecordedAudio(null);
                            setRecordingTime(0);
                            setIsSpacedActive(false);
                        }}
                        className="btn-ghost w-full text-sm"
                    >
                        🔄 Record Again
                    </button>
                </div>
            )}
        </div>
    );
}

