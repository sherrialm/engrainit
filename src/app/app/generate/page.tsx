'use client';

/**
 * Generate Loop — AI-guided creation flow
 *
 * Step 1: Select mood, goal, problem
 * Step 2: Optional details text
 * Step 3: AI confirmation
 * Step 4: Generated loop result
 *
 * Also provides manual creation tabs (existing Text/Voice/Upload panels)
 * at the bottom for advanced users.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useTierStore } from '@/stores/tierStore';
import { LoopIcon, PlayIcon, CheckIcon } from '@/components/Icons';
import { summarizeIntent, generateLoop } from '@/services/AIService';
import { VOICE_OPTIONS, getVoiceLabel } from '@/config/voices';
import type { LoopMood, LoopGoal, LoopProblem, LoopGenerationInput, GeneratedLoopSuggestion } from '@/types';

// ── Option definitions ────────────────────────────────────────

const MOOD_OPTIONS: { id: LoopMood; label: string }[] = [
    { id: 'calm', label: 'Calm' },
    { id: 'focused', label: 'Focused' },
    { id: 'stressed', label: 'Stressed' },
    { id: 'motivated', label: 'Motivated' },
    { id: 'tired', label: 'Tired' },
];

const GOAL_OPTIONS: { id: LoopGoal; label: string }[] = [
    { id: 'start-day', label: 'Start the day right' },
    { id: 'improve-focus', label: 'Improve focus' },
    { id: 'build-confidence', label: 'Build confidence' },
    { id: 'stay-disciplined', label: 'Stay disciplined' },
    { id: 'reduce-stress', label: 'Reduce stress' },
];

const PROBLEM_OPTIONS: { id: LoopProblem; label: string }[] = [
    { id: 'overwhelmed', label: 'Overwhelmed' },
    { id: 'distracted', label: 'Distracted' },
    { id: 'low-motivation', label: 'Low motivation' },
    { id: 'negative-thinking', label: 'Negative thinking' },
];

// ── Generate Loop Page ────────────────────────────────────────

export default function GenerateLoopPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addLoop } = useVaultStore();
    const { canSaveLoop } = useTierStore();

    // Step state
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Selections
    const [selectedMoods, setSelectedMoods] = useState<LoopMood[]>([]);
    const [selectedGoals, setSelectedGoals] = useState<LoopGoal[]>([]);
    const [selectedProblems, setSelectedProblems] = useState<LoopProblem[]>([]);
    const [details, setDetails] = useState('');

    // AI results
    const [intentSummary, setIntentSummary] = useState('');
    const [generatedLoop, setGeneratedLoop] = useState<GeneratedLoopSuggestion | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Toggle helpers
    function toggleMood(m: LoopMood) {
        setSelectedMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    }
    function toggleGoal(g: LoopGoal) {
        setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
    }
    function toggleProblem(p: LoopProblem) {
        setSelectedProblems(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    }

    // Step handlers
    function handleProceedToDetails() {
        setStep(2);
    }

    async function handleConfirmStep() {
        const input: LoopGenerationInput = {
            moods: selectedMoods,
            goals: selectedGoals,
            problems: selectedProblems,
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
                goals: selectedGoals,
                problems: selectedProblems,
                details: details || undefined,
            };
            const result = await generateLoop(input);
            setGeneratedLoop(result);
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
        try {
            await addLoop(user.uid, {
                title: generatedLoop.name,
                category: 'vision',
                sourceType: 'tts',
                text: generatedLoop.text,
                audioUrl: '', // TTS generation would happen here
                voiceId: generatedLoop.voiceId,
                duration: 0,
                intervalSeconds: generatedLoop.intervalSeconds,
                tags: ['identity', 'focus'],
            });
            router.push('/app/vault');
        } catch (err: any) {
            setError(err.message || 'Failed to save loop');
        } finally {
            setIsSaving(false);
        }
    }

    function handleReset() {
        setStep(1);
        setSelectedMoods([]);
        setSelectedGoals([]);
        setSelectedProblems([]);
        setDetails('');
        setGeneratedLoop(null);
        setError(null);
    }

    const hasSelections = selectedMoods.length > 0 || selectedGoals.length > 0 || selectedProblems.length > 0;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <LoopIcon className="w-6 h-6 text-forest-700" />
                <div>
                    <h1 className="font-serif text-2xl font-bold text-forest-700">
                        Generate Loop
                    </h1>
                    <p className="text-xs text-forest-400">
                        Loops reinforce the thoughts you want to repeat.
                    </p>
                </div>
            </div>

            {/* Progress indicator */}
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

            {/* Step 1: Selection */}
            {step === 1 && (
                <div className="space-y-6">
                    <SelectionGroup
                        title="How are you feeling?"
                        options={MOOD_OPTIONS}
                        selected={selectedMoods}
                        onToggle={toggleMood}
                    />
                    <SelectionGroup
                        title="What's your goal?"
                        options={GOAL_OPTIONS}
                        selected={selectedGoals}
                        onToggle={toggleGoal}
                    />
                    <SelectionGroup
                        title="What are you dealing with?"
                        options={PROBLEM_OPTIONS}
                        selected={selectedProblems}
                        onToggle={toggleProblem}
                    />
                    <button
                        onClick={handleProceedToDetails}
                        disabled={!hasSelections}
                        className="btn-primary w-full disabled:opacity-50"
                    >
                        Continue
                    </button>
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
                            <p className="text-sm text-forest-500">Crafting your loop...</p>
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

            {/* Step 4: Result */}
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
                                Voice: {getVoiceLabel(generatedLoop.voiceId)}
                            </span>
                            <span className="bg-parchment-300 px-2 py-1 rounded-full">
                                Interval: {Math.floor(generatedLoop.intervalSeconds / 60)}m
                            </span>
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

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Link back to home */}
            <div className="pt-4 border-t border-parchment-300">
                <Link href="/app" className="text-sm text-forest-500 hover:text-forest-700 transition-colors">
                    ← Back to Home
                </Link>
            </div>
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
