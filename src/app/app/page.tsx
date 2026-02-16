'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useAudioStore } from '@/stores/audioStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useTierStore } from '@/stores/tierStore';
import { generateSpeech } from '@/services/TTSService';
import { getRecorderService, blobToDataUrl } from '@/services/RecorderService';
import { uploadBase64Audio } from '@/services/LoopService';
import { LoopCategory } from '@/types';
import { AudioPlayerSkeleton } from '@/components/Skeleton';
import UpgradePrompt from '@/components/UpgradePrompt';
import { VOICE_OPTIONS } from '@/config/voices';

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
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    Create a New Loop
                </h2>
                <p className="text-forest-500">
                    Type, upload a document, or record your voice to create a mental imprint.
                </p>
            </div>

            {/* Tab Selector */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex bg-parchment-300 rounded-lg p-1 flex-wrap justify-center gap-1">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'text'
                            ? 'bg-white text-forest-700 shadow-sm'
                            : 'text-forest-500 hover:text-forest-600'
                            }`}
                    >
                        ✍️ Text
                    </button>
                    <UploadTabButton activeTab={activeTab} setActiveTab={setActiveTab} />
                    <button
                        onClick={() => setActiveTab('record')}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'record'
                            ? 'bg-white text-forest-700 shadow-sm'
                            : 'text-forest-500 hover:text-forest-600'
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
                <Link href="/app/vault" className="text-forest-500 hover:text-forest-600 text-sm">
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
    const { addLoop, loops } = useVaultStore();
    const { canGenerate, canSaveLoop, getMaxTextLength, incrementGenerations, tier } = useTierStore();

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
    const [showUpgrade, setShowUpgrade] = useState<string | null>(null);

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

    // Reactively sync interval with audio store
    useEffect(() => {
        if (generatedAudio) {
            console.log('[DocumentUploadPanel] Syncing interval to audio store:', interval);
            setAudioInterval(interval);
        }
    }, [interval, generatedAudio, setAudioInterval]);

    const handleGenerate = async () => {
        if (!extractedText.trim()) return;

        // Tier check
        if (!canGenerate()) {
            setShowUpgrade('generations');
            return;
        }

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

            // Increment generation counter
            if (user?.uid) {
                await incrementGenerations(user.uid);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate speech');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToVault = async () => {
        console.log('[DocSave] Starting save...', { hasAudio: !!generatedAudio, userId: user?.uid });

        if (!generatedAudio) {
            console.error('[DocSave] No generated audio to save');
            setError('No audio to save. Please generate audio first.');
            return;
        }

        if (!user?.uid) {
            console.error('[DocSave] User not authenticated');
            setError('Please sign in to save loops to your vault.');
            return;
        }

        // Tier check: vault limit
        if (!canSaveLoop(loops.length)) {
            setShowUpgrade('loops');
            return;
        }

        try {
            setIsGenerating(true);
            console.log('[DocSave] Uploading audio to Firebase Storage...');

            const filename = `doc-${Date.now()}.mp3`;
            const audioUrl = await uploadBase64Audio(user.uid, generatedAudio, filename);
            console.log('[DocSave] Audio uploaded successfully:', audioUrl);

            console.log('[DocSave] Saving loop to Firestore...');
            await addLoop(user.uid, {
                title: title || 'Document Loop',
                category,
                sourceType: 'tts',
                text: extractedText.substring(0, 500),
                audioUrl,
                voiceId,
                duration: currentLoop?.duration || 0,
                intervalSeconds: interval,
            });
            console.log('[DocSave] Loop saved successfully!');

            router.push('/app/vault');
        } catch (err: any) {
            console.error('[DocSave] Error:', err);
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
            {/* Upgrade Prompt */}
            {showUpgrade && (
                <UpgradePrompt
                    reason={showUpgrade as any}
                    onDismiss={() => setShowUpgrade(null)}
                />
            )}
            {/* File Upload Area */}
            {!extractedText && (
                <div className="border-2 border-dashed border-forest-200 rounded-xl p-8 text-center">
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
                                <div className="animate-spin h-12 w-12 border-4 border-forest-200 border-t-forest-600 rounded-full mx-auto"></div>
                                <p className="text-forest-500">Extracting text...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-5xl">📄</div>
                                <p className="font-medium text-forest-600">
                                    Upload a document
                                </p>
                                <p className="text-sm text-forest-400">
                                    PDF, DOCX, or TXT files supported
                                </p>
                                <p className="text-xs text-forest-300">
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
                    <div className="bg-parchment-300 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-forest-600">
                                📄 {file?.name}
                            </span>
                            <button
                                onClick={resetForm}
                                className="text-xs text-forest-400 hover:text-forest-600"
                            >
                                Change file
                            </button>
                        </div>
                        <p className="text-sm text-forest-500 line-clamp-4">
                            {extractedText}
                        </p>
                        <p className="text-xs text-forest-400 mt-2">
                            {extractedText.length} characters (first 500 will be converted to audio)
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
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
                        <label className="block text-sm font-medium text-forest-600 mb-2">
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
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Voice
                        </label>
                        <select
                            value={voiceId}
                            onChange={(e) => {
                                setVoiceId(e.target.value);
                                if (generatedAudio) {
                                    setGeneratedAudio(null);
                                    stop();
                                }
                            }}
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
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Repetition Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[15, 30, 60, 120, 300].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setIntervalValue(preset)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                        ? 'bg-forest-700 text-parchment-100'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
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
                            className="w-full accent-forest-600"
                        />
                    </div>
                </>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
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
                                : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                }`}
                        >
                            🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Spaced Loop'}
                        </button>
                        <button
                            onClick={() => {
                                stop();
                                setIsSpacedActive(false);
                            }}
                            className="p-2 rounded-lg bg-parchment-300 text-forest-500 hover:bg-parchment-400 transition-colors"
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

// Upload tab button with tier lock
function UploadTabButton({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: 'text' | 'record' | 'upload') => void }) {
    const { canUploadDocument } = useTierStore();
    const allowed = canUploadDocument();

    return (
        <button
            onClick={() => allowed ? setActiveTab('upload') : alert('Document upload is available on the Core plan and above.')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'upload'
                ? 'bg-white text-forest-700 shadow-sm'
                : 'text-forest-500 hover:text-forest-600'
                } ${!allowed ? 'opacity-50' : ''}`}
        >
            📄 Document {!allowed && '🔒'}
        </button>
    );
}

// Text-to-Speech Panel Component
function TextToSpeechPanel() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { loadFromBase64, currentLoop, isPlaying, toggle, stop, setInterval: setAudioInterval, startSpacedRepetition, stopSpacedRepetition } = useAudioStore();
    const { addLoop, loops } = useVaultStore();
    const { canGenerate, canSaveLoop, canUseVoice, getMaxTextLength, getRemainingGenerations, incrementGenerations, tier } = useTierStore();

    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('study');
    const [voiceId, setVoiceId] = useState('sage');
    const [interval, setIntervalValue] = useState(30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
    const [isSpacedActive, setIsSpacedActive] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState<string | null>(null);

    // Track what was used for the last generation to detect stale audio
    const [lastGeneratedText, setLastGeneratedText] = useState('');
    const [lastGeneratedVoiceId, setLastGeneratedVoiceId] = useState('');

    // Audio is stale when text or voice changed since last generation
    const needsRegeneration = generatedAudio !== null && (
        text !== lastGeneratedText || voiceId !== lastGeneratedVoiceId
    );

    // Reactively sync interval with audio store
    useEffect(() => {
        if (generatedAudio) {
            console.log('[TextToSpeechPanel] Syncing interval to audio store:', interval);
            setAudioInterval(interval);
        }
    }, [interval, generatedAudio, setAudioInterval]);

    const handleGenerate = async () => {
        if (!text.trim()) return;

        // Tier checks
        if (!canGenerate()) {
            setShowUpgrade('generations');
            return;
        }
        if (text.length > getMaxTextLength()) {
            setError(`Your plan supports up to ${getMaxTextLength()} characters. You have ${text.length}.`);
            return;
        }
        if (!canUseVoice(voiceId)) {
            setShowUpgrade('voice');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await generateSpeech({ text, voiceId });

            if (!response.audioContent) {
                throw new Error('No audio content received. Check if TTS API key is configured.');
            }

            setGeneratedAudio(response.audioContent);
            setLastGeneratedText(text);
            setLastGeneratedVoiceId(voiceId);

            // Load and play immediately
            await loadFromBase64(response.audioContent, {
                title: title || 'Untitled Loop',
                category,
                sourceType: 'tts',
                text,
                intervalSeconds: interval,
            });

            setAudioInterval(interval);

            // Increment generation counter
            if (user?.uid) {
                await incrementGenerations(user.uid);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate speech');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToVault = async () => {
        console.log('[SaveToVault] Starting save...', { hasAudio: !!generatedAudio, userId: user?.uid });

        if (!generatedAudio) {
            console.error('[SaveToVault] No generated audio to save');
            setError('No audio to save. Please generate audio first.');
            return;
        }

        if (!user?.uid) {
            console.error('[SaveToVault] User not authenticated');
            setError('Please sign in to save loops to your vault.');
            return;
        }

        // Tier check: vault limit
        if (!canSaveLoop(loops.length)) {
            setShowUpgrade('loops');
            return;
        }

        try {
            setIsGenerating(true);
            console.log('[SaveToVault] Uploading audio to Firebase Storage...');

            // Upload to Firebase Storage
            const filename = `tts-${Date.now()}.mp3`;
            const audioUrl = await uploadBase64Audio(user.uid, generatedAudio, filename);
            console.log('[SaveToVault] Audio uploaded successfully:', audioUrl);

            // Save to Firestore
            console.log('[SaveToVault] Saving loop to Firestore...');
            await addLoop(user.uid, {
                title: title || 'Untitled Loop',
                category,
                sourceType: 'tts',
                text,
                audioUrl,
                voiceId,
                duration: currentLoop?.duration || 0,
                intervalSeconds: interval,
            });
            console.log('[SaveToVault] Loop saved successfully!');

            // Navigate to vault
            router.push('/app/vault');
        } catch (err: any) {
            console.error('[SaveToVault] Error:', err);
            setError(err.message || 'Failed to save loop');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Upgrade Prompt */}
            {showUpgrade && (
                <UpgradePrompt
                    reason={showUpgrade as any}
                    onDismiss={() => setShowUpgrade(null)}
                />
            )}

            {/* Remaining generations info */}
            {tier !== 'pro' && (
                <p className="text-xs text-forest-400 text-center">
                    {getRemainingGenerations()} generations remaining this month
                </p>
            )}
            {/* Title Input */}
            <div>
                <label className="block text-sm font-medium text-forest-600 mb-2">
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
                <label className="block text-sm font-medium text-forest-600 mb-2">
                    Your Text
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="input-field min-h-[150px] resize-none"
                    placeholder="Enter the text you want to engrave in your mind..."
                    maxLength={getMaxTextLength()}
                />
                <p className={`text-xs mt-1 ${text.length >= getMaxTextLength() * 0.95 ? 'text-red-500 font-medium' : text.length >= getMaxTextLength() * 0.8 ? 'text-yellow-500' : 'text-forest-400'}`}>
                    {text.length}/{getMaxTextLength() === Infinity ? '∞' : getMaxTextLength()} characters{text.length >= getMaxTextLength() * 0.95 ? ' - Near limit!' : text.length >= getMaxTextLength() * 0.8 ? ' - Approaching limit' : ''}
                </p>
            </div>

            {/* Voice Select */}
            <div>
                <label className="block text-sm font-medium text-forest-600 mb-2">
                    Voice
                </label>
                <select
                    value={voiceId}
                    onChange={(e) => {
                        setVoiceId(e.target.value);
                    }}
                    className="input-field"
                >
                    {VOICE_OPTIONS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {voice.label} - {voice.description}
                        </option>
                    ))}
                </select>
                {needsRegeneration && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Settings changed — click Regenerate below to update audio</p>
                )}
            </div>

            {/* Category Select */}
            <div>
                <label className="block text-sm font-medium text-forest-600 mb-2">
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
                <label className="block text-sm font-medium text-forest-600 mb-2">
                    Repetition Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {[15, 30, 60, 120, 300].map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setIntervalValue(preset)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                ? 'bg-forest-700 text-parchment-100'
                                : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
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
                    className="w-full accent-forest-600"
                />
                <div className="flex justify-between text-xs text-forest-400">
                    <span>Continuous</span>
                    <span>2m 30s</span>
                    <span>5m</span>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
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
                ) : needsRegeneration ? (
                    <button
                        onClick={handleGenerate}
                        disabled={!text.trim() || isGenerating}
                        className="w-full py-2 px-4 rounded-lg font-medium bg-amber-500 text-forest-900 hover:bg-amber-400 transition-colors"
                    >
                        🔄 Regenerate with New Settings
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
                                    : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                    }`}
                            >
                                🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Start Spaced Loop'}
                            </button>
                            <button
                                onClick={() => {
                                    stop();
                                    setIsSpacedActive(false);
                                }}
                                className="p-2 rounded-lg bg-parchment-300 text-forest-500 hover:bg-parchment-400 transition-colors"
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
    const { loadFromBase64, isPlaying, toggle, stop, setInterval: setAudioInterval, startSpacedRepetition, stopSpacedRepetition } = useAudioStore();
    const { canSaveLoop } = useTierStore();
    const { addLoop } = useVaultStore();

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<LoopCategory>('study');
    const [interval, setIntervalValue] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [isSpacedActive, setIsSpacedActive] = useState(false);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);

    // Reactively sync interval with audio store
    useEffect(() => {
        if (recordedAudio) {
            console.log('[VoiceRecordingPanel] Syncing interval to audio store:', interval);
            setAudioInterval(interval);
        }
    }, [interval, recordedAudio, setAudioInterval]);

    useEffect(() => {
        const recorder = getRecorderService();

        recorder.onRecordingStateChange = (recording) => {
            console.log('Recording state changed:', recording);
            setIsRecording(recording);
            if (recording) {
                setIsRequestingPermission(false);
                setPermissionDenied(false);
            }
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
        setPermissionDenied(false);
        setRecordedAudio(null);
        setRecordingTime(0);
        setIsRequestingPermission(true);

        console.log('Requesting microphone permission...');

        try {
            // First request permission explicitly
            const hasPermission = await recorder.requestPermission();
            console.log('Permission result:', hasPermission);

            if (!hasPermission) {
                setIsRequestingPermission(false);
                setPermissionDenied(true);
                setError('Microphone permission denied. Please allow microphone access in your browser settings.');
                return;
            }

            setPermissionGranted(true);
            setIsRequestingPermission(false);
            console.log('Starting recording...');
            await recorder.start();
            console.log('Recording started!');
        } catch (err: any) {
            console.error('Start recording error:', err);
            setError(err.message || 'Failed to start recording');
            setIsRequestingPermission(false);
            setPermissionDenied(true);
        }
    };

    const stopRecording = () => {
        console.log('Stopping recording...');
        const recorder = getRecorderService();
        recorder.stop();
    };

    const handleSaveToVault = async () => {
        console.log('[VoiceSave] Starting save...', { hasAudio: !!recordedAudio, userId: user?.uid });

        if (!recordedAudio) {
            console.error('[VoiceSave] No recorded audio to save');
            setError('No recording to save. Please record audio first.');
            return;
        }

        if (!user?.uid) {
            console.error('[VoiceSave] User not authenticated');
            setError('Please sign in to save loops to your vault.');
            return;
        }

        // Tier check: vault limit
        const { loops } = useVaultStore.getState();
        if (!canSaveLoop(loops.length)) {
            setError('You\'ve reached the max saved loops for your plan. Upgrade to save more!');
            return;
        }

        try {
            setIsSaving(true);
            console.log('[VoiceSave] Uploading audio to Firebase Storage...');

            // Upload to Firebase Storage
            const filename = `recording-${Date.now()}.webm`;
            const audioUrl = await uploadBase64Audio(user.uid, recordedAudio, filename);
            console.log('[VoiceSave] Audio uploaded successfully:', audioUrl);

            // Save to Firestore
            console.log('[VoiceSave] Saving loop to Firestore...');
            await addLoop(user.uid, {
                title: title || 'Voice Recording',
                category,
                sourceType: 'recording',
                audioUrl,
                duration: recordingTime,
                intervalSeconds: interval,
            });
            console.log('[VoiceSave] Loop saved successfully!');

            router.push('/app/vault');
        } catch (err: any) {
            console.error('[VoiceSave] Error:', err);
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
                            disabled={isRequestingPermission}
                            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all mx-auto ${isRequestingPermission ? 'bg-forest-300 cursor-wait' : 'bg-forest-700 hover:scale-105'
                                }`}
                        >
                            <span className={`text-5xl ${isRequestingPermission ? 'animate-pulse' : ''}`}>
                                {isRequestingPermission ? '⏳' : '🎙️'}
                            </span>
                        </button>

                        {isRequestingPermission ? (
                            <div className="mt-4 space-y-2">
                                <p className="text-forest-600 font-bold animate-pulse">
                                    Waiting for microphone access...
                                </p>
                                <p className="text-xs text-forest-400 max-w-xs mx-auto">
                                    Please click "Allow" in the browser prompt to start recording.
                                </p>
                            </div>
                        ) : permissionDenied ? (
                            <div className="mt-4 space-y-3">
                                <p className="text-amber-600 font-bold">
                                    Microphone access denied
                                </p>
                                <p className="text-xs text-forest-500 max-w-xs mx-auto">
                                    We need your microphone to record your voice. Please enable it in your browser settings.
                                </p>
                                <button
                                    onClick={startRecording}
                                    className="text-sm font-medium text-forest-700 underline hover:text-forest-900"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            <p className="mt-4 text-forest-600 font-medium">
                                Tap to start recording
                            </p>
                        )}
                    </>
                )}

                {isRecording && (
                    <>
                        <div className="w-28 h-28 rounded-full bg-red-500 flex items-center justify-center mx-auto audio-pulse">
                            <span className="text-5xl">🎙️</span>
                        </div>
                        <p className="mt-4 text-red-600 font-bold text-xl">
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
                        <p className="mt-4 text-green-600 font-medium">
                            Recording complete! ({formatTime(recordingTime)})
                        </p>
                    </>
                )}
            </div>

            {/* Form fields (show after recording) */}
            {recordedAudio && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
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
                        <label className="block text-sm font-medium text-forest-600 mb-2">
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
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Interval: {interval === 0 ? 'Continuous' : interval >= 60 ? `${Math.floor(interval / 60)}m ${interval % 60}s` : `${interval}s`}
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[15, 30, 60, 120, 300].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setIntervalValue(preset)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${interval === preset
                                        ? 'bg-forest-700 text-parchment-100'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
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
                            className="w-full accent-forest-600"
                        />
                    </div>
                </>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
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
                                : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                }`}
                        >
                            🔁 {isSpacedActive ? 'Spaced Loop ON' : 'Spaced Loop'}
                        </button>
                        <button
                            onClick={() => {
                                stop();
                                setIsSpacedActive(false);
                            }}
                            className="p-2 rounded-lg bg-parchment-300 text-forest-500 hover:bg-parchment-400 transition-colors"
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

