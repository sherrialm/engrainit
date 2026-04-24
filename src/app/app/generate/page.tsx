'use client';

/**
 * Generate Loop — AI-guided creation flow
 *
 * Step 1: Select mood (10 options) and intent (10 options)
 * Step 2: Optional details text
 * Step 3: AI confirmation
 * Step 4: Generated loop result with voice selector + playback controls
 * Step 5: First-loop celebration (only shown when it's the user's very first saved loop)
 *
 * Quick Start cards appear on step 1 when the vault is loaded and empty,
 * so there's no flash of first-run UI before data arrives.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useTierStore } from '@/stores/tierStore';
import { useAudioStore } from '@/stores/audioStore';
import { LoopIcon, PlayIcon, CheckIcon } from '@/components/Icons';
import PlaybackControls from '@/components/PlaybackControls';
import { summarizeIntent, generateLoop } from '@/services/AIService';
import { VOICE_OPTIONS, getVoiceLabel } from '@/config/voices';
import type { LoopMood, LoopIntent, LoopGenerationInput, GeneratedLoopSuggestion } from '@/types';

// ── Option definitions ────────────────────────────────────────

const MOOD_OPTIONS: { id: LoopMood; label: string }[] = [
    { id: 'calm', label: 'Calm' },
    { id: 'anxious', label: 'Anxious' },
    { id: 'overwhelmed', label: 'Overwhelmed' },
    { id: 'sad', label: 'Sad' },
    { id: 'low-energy', label: 'Low Energy' },
    { id: 'stuck', label: 'Stuck' },
    { id: 'focused', label: 'Focused' },
    { id: 'hopeful', label: 'Hopeful' },
    { id: 'excited', label: 'Excited' },
    { id: 'unmotivated', label: 'Unmotivated' },
];

const INTENT_OPTIONS: { id: LoopIntent; label: string }[] = [
    { id: 'memorize', label: 'Memorize' },
    { id: 'learn', label: 'Learn' },
    { id: 'gain-clarity', label: 'Gain Clarity' },
    { id: 'calm-down', label: 'Calm Down' },
    { id: 'build-confidence', label: 'Build Confidence' },
    { id: 'improve-focus', label: 'Improve Focus' },
    { id: 'reset-thinking', label: 'Reset My Thinking' },
    { id: 'stay-encouraged', label: 'Stay Encouraged' },
    { id: 'prepare-for-day', label: 'Prepare for the Day' },
    { id: 'wind-down', label: 'Wind Down' },
];

// ── Quick Start presets (for first-run users) ─────────────────

interface QuickStartPreset {
    emoji: string;
    label: string;
    tagline: string;
    moods: LoopMood[];
    intents: LoopIntent[];
}

const QUICK_START_PRESETS: QuickStartPreset[] = [
    {
        emoji: '🌅',
        label: 'Start My Day Right',
        tagline: 'Morning alignment & intention',
        moods: ['focused'],
        intents: ['prepare-for-day'],
    },
    {
        emoji: '💪',
        label: 'Build Confidence',
        tagline: 'Strengthen belief in yourself',
        moods: ['hopeful'],
        intents: ['build-confidence'],
    },
    {
        emoji: '🧘',
        label: 'Calm My Mind',
        tagline: 'Release stress & find stillness',
        moods: ['overwhelmed'],
        intents: ['calm-down'],
    },
];

// ── Generate Loop Page ────────────────────────────────────────

export default function GenerateLoopPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addLoop, loops, isLoading: vaultLoading, fetchLoops } = useVaultStore();
    const { canSaveLoop } = useTierStore();
    const { loadAndPlay } = useAudioStore();

    // Step state
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Selections
    const [selectedMoods, setSelectedMoods] = useState<LoopMood[]>([]);
    const [selectedIntents, setSelectedIntents] = useState<LoopIntent[]>([]);
    const [details, setDetails] = useState('');

    // AI results
    const [intentSummary, setIntentSummary] = useState('');
    const [generatedLoop, setGeneratedLoop] = useState<GeneratedLoopSuggestion | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Voice override (user can change before saving)
    const [selectedVoice, setSelectedVoice] = useState<string>('');

    // Track whether this save is the user's very first loop — determined at save-time
    const [savedFirstLoop, setSavedFirstLoop] = useState(false);

    // Fetch loops if not yet loaded (e.g. arriving directly at this page)
    useEffect(() => {
        if (user?.uid && !vaultLoading && loops.length === 0) {
            fetchLoops(user.uid);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    // First-run: vault is loaded and truly empty (no loops exist yet)
    const isFirstRun = !vaultLoading && loops.length === 0;

    // Toggle helpers
    function toggleMood(m: LoopMood) {
        setSelectedMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    }
    function toggleIntent(i: LoopIntent) {
        setSelectedIntents(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
    }

    // Quick Start — apply preset and jump straight to step 2
    function applyQuickStart(preset: QuickStartPreset) {
        setSelectedMoods(preset.moods);
        setSelectedIntents(preset.intents);
        setStep(2);
    }

    // Step handlers
    function handleProceedToDetails() {
        setStep(2);
    }

    async function handleConfirmStep() {
        const input: LoopGenerationInput = {
            moods: selectedMoods,
            intents: selectedIntents,
            details: details || undefined,
        };
        const summary = summarizeIntent(input);
        setIntentSummary(summary);
        setStep(3);
    }

    async function handleGenerate() {
        setIsGenerating(true);
        setError(null);
        try {
            const input: LoopGenerationInput = {
                moods: selectedMoods,
                intents: selectedIntents,
                details: details || undefined,
            };
            const result = await generateLoop(input);
            setGeneratedLoop(result);
            setSelectedVoice(result.voiceId);
            setStep(4);
        } catch (err: any) {
            setError(err.message || 'Failed to generate loop');
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleSaveToVault() {
        if (!generatedLoop || !user?.uid) return;
        setIsSaving(true);

        // Capture first-run state before saving (loops.length will be 0 if this is the first)
        const isFirstLoop = loops.length === 0;

        // Use the selected voice (may have been changed by user)
        const voiceToSave = selectedVoice || generatedLoop.voiceId;

        try {
            await addLoop(user.uid, {
                title: generatedLoop.name,
                category: 'vision',
                sourceType: 'tts',
                text: generatedLoop.text,
                audioUrl: '',
                voiceId: voiceToSave,
                duration: 0,
                intervalSeconds: generatedLoop.intervalSeconds,
                tags: ['identity', 'focus'],
            });

            if (isFirstLoop) {
                setSavedFirstLoop(true);
                setStep(5);
            } else {
                router.push('/app/vault');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save loop');
        } finally {
            setIsSaving(false);
        }
    }

    function handleReset() {
        setStep(1);
        setSelectedMoods([]);
        setSelectedIntents([]);
        setDetails('');
        setGeneratedLoop(null);
        setError(null);
        setSavedFirstLoop(false);
        setSelectedVoice('');
    }

    const hasSelections = selectedMoods.length > 0 || selectedIntents.length > 0;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <LoopIcon className="w-6 h-6 text-forest-700" />
                <div>
                    <h1 className="font-serif text-2xl font-bold text-forest-700">
                        {isFirstRun ? 'Build Your First Training Loop' : 'Create a Training Loop'}
                    </h1>
                    <p className="text-xs text-forest-400">
                        {isFirstRun
                            ? 'Pick a starting point below — we\'ll craft a personalized loop in seconds.'
                            : 'Tell us where you are and where you want to be. We\'ll build a loop designed to move you closer.'}
                    </p>
                </div>
            </div>

            {/* Progress indicator — only show on steps 1–4 */}
            {step <= 4 && (
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                                s <= step ? 'bg-forest-600' : 'bg-parchment-300'
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* Step 1: Selection */}
            {step === 1 && (
                <div className="space-y-6">
                    {/* Quick Start cards — only shown once vault is loaded and truly empty */}
                    {isFirstRun && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-forest-700">
                                ✨ Quick Start — choose a starting point:
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                {QUICK_START_PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyQuickStart(preset)}
                                        className="flex items-center gap-4 w-full text-left px-5 py-4 bg-parchment-100 border border-forest-200 rounded-xl hover:border-forest-500 hover:bg-forest-50 transition-all shadow-sm group"
                                    >
                                        <span className="text-3xl">{preset.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-forest-700 group-hover:text-forest-800">
                                                {preset.label}
                                            </p>
                                            <p className="text-xs text-forest-400 mt-0.5">{preset.tagline}</p>
                                        </div>
                                        <span className="text-forest-400 group-hover:text-forest-700 transition-colors">→</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-forest-400 text-center">
                                Or customize below ↓
                            </p>
                        </div>
                    )}

                    {/* Section A: How do you feel? */}
                    <SelectionGroup
                        title="How do you feel?"
                        options={MOOD_OPTIONS}
                        selected={selectedMoods}
                        onToggle={toggleMood}
                    />

                    {/* Section B: What do you want help with? */}
                    <SelectionGroup
                        title="What do you want help with?"
                        options={INTENT_OPTIONS}
                        selected={selectedIntents}
                        onToggle={toggleIntent}
                    />

                    <div className="space-y-2">
                        <button
                            onClick={handleProceedToDetails}
                            disabled={!hasSelections}
                            className="btn-primary w-full disabled:opacity-50"
                        >
                            Continue
                        </button>
                        {!hasSelections && (
                            <p className="text-xs text-forest-400 text-center">
                                Choose at least one option to continue.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Any additional thoughts or details? (optional)
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="input-field min-h-[120px] resize-none"
                            placeholder="Share anything else on your mind..."
                            maxLength={500}
                        />
                        <p className="text-xs text-forest-400 mt-1">{details.length}/500</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="btn-ghost flex-1">
                            Back
                        </button>
                        <button onClick={handleConfirmStep} className="btn-primary flex-1">
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: AI Confirmation */}
            {step === 3 && (
                <div className="space-y-4">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-10 h-10 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin" />
                            <p className="text-sm text-forest-500">Building your training loop...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5">
                                <p className="text-sm text-forest-700 leading-relaxed">
                                    {intentSummary}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(2)} className="btn-ghost flex-1">
                                    Adjust
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    className="btn-primary flex-1"
                                >
                                    Confirm &amp; Generate
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Step 4: Result with voice selector + playback controls */}
            {step === 4 && generatedLoop && (
                <div className="space-y-4">
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 space-y-3">
                        <h3 className="font-serif text-lg font-bold text-forest-700">
                            {generatedLoop.name}
                        </h3>
                        <p className="text-sm text-forest-600 leading-relaxed italic">
                            &ldquo;{generatedLoop.text}&rdquo;
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-forest-400">
                            <span className="bg-parchment-300 px-2 py-1 rounded-full">
                                Voice: {getVoiceLabel(selectedVoice || generatedLoop.voiceId)}
                            </span>
                            <span className="bg-parchment-300 px-2 py-1 rounded-full">
                                Interval: {Math.floor(generatedLoop.intervalSeconds / 60)}m
                            </span>
                        </div>
                    </div>

                    {/* Voice Selector + Playback Controls */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-forest-500 mb-1.5">
                                Voice
                            </label>
                            <select
                                value={selectedVoice || generatedLoop.voiceId}
                                onChange={(e) => setSelectedVoice(e.target.value)}
                                className="input-field py-2 text-sm"
                            >
                                {VOICE_OPTIONS.map((voice) => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.label} — {voice.description}
                                    </option>
                                ))}
                            </select>
                            {selectedVoice && selectedVoice !== generatedLoop.voiceId && (
                                <p className="text-[10px] text-amber-600 mt-1 italic">
                                    Voice will be applied when loop is played.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveToVault}
                            disabled={isSaving}
                            className="btn-primary flex-1 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save to Vault'}
                        </button>
                    </div>
                    <button onClick={handleReset} className="btn-ghost w-full text-sm">
                        Generate Another
                    </button>
                </div>
            )}

            {/* Step 5: First-Loop Celebration */}
            {step === 5 && savedFirstLoop && (
                <div className="space-y-6 text-center py-6">
                    <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-4xl">
                        🎉
                    </div>
                    <div>
                        <h2 className="font-serif text-2xl font-bold text-forest-700 mb-2">
                            Your first loop is saved.
                        </h2>
                        <p className="text-sm text-forest-500 max-w-xs mx-auto leading-relaxed">
                            This is the start of your daily mental training practice. The most powerful step is the first one — now use it.
                        </p>
                    </div>

                    <div className="space-y-3 max-w-xs mx-auto">
                        <Link
                            href="/app/morning"
                            className="block w-full py-4 rounded-xl font-semibold text-base bg-forest-600 text-parchment-100 hover:bg-forest-700 hover:shadow-lg transition-all"
                        >
                            Start My Morning Practice →
                        </Link>
                        <button
                            onClick={handleReset}
                            className="block w-full py-3 rounded-xl text-sm font-medium text-forest-600 bg-parchment-100 border border-forest-200 hover:bg-parchment-300 transition-colors"
                        >
                            Create Another Loop
                        </button>
                        <Link
                            href="/app/vault"
                            className="block text-xs text-forest-400 hover:text-forest-600 transition-colors pt-1"
                        >
                            Go to My Vault
                        </Link>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Link back to home — hide on celebration step */}
            {step !== 5 && (
                <div className="pt-4 border-t border-parchment-300">
                    <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            )}
        </div>
    );
}

// ── Selection Group Component ─────────────────────────────────

function SelectionGroup<T extends string>({
    title,
    options,
    selected,
    onToggle,
}: {
    title: string;
    options: { id: T; label: string }[];
    selected: T[];
    onToggle: (id: T) => void;
}) {
    return (
        <div>
            <h3 className="text-sm font-medium text-forest-600 mb-2">{title}</h3>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onToggle(opt.id)}
                        className={`px-4 py-2 text-sm rounded-full transition-all ${
                            selected.includes(opt.id)
                                ? 'bg-forest-700 text-parchment-100 shadow-md'
                                : 'bg-parchment-100 text-forest-600 border border-forest-200 hover:bg-parchment-300'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
