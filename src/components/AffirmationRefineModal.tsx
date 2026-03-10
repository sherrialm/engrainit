'use client';

import { useAffirmationStore } from '@/stores/affirmationStore';
import { Modal } from '@/components/Modal';
import type { AffirmationCategory, AffirmationTone } from '@/types';

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES: { value: AffirmationCategory; label: string; emoji: string }[] = [
    { value: 'Faith', label: 'Faith', emoji: '🙏' },
    { value: 'Study', label: 'Study', emoji: '📚' },
    { value: 'Vision', label: 'Vision', emoji: '🎯' },
    { value: 'Habits', label: 'Habits', emoji: '⚡' },
];

const TONES: { value: AffirmationTone; label: string }[] = [
    { value: 'Gentle', label: '🌿 Gentle' },
    { value: 'Mentor', label: '🧭 Mentor' },
    { value: 'Bold', label: '🔥 Bold' },
    { value: 'Calm', label: '🕊️ Calm' },
];

// ── Props ─────────────────────────────────────────────────────

interface AffirmationRefineModalProps {
    /** Called when the user picks an option — typically sets the text input. */
    onUseOption: (option: string) => void;
}

// ── Component ─────────────────────────────────────────────────

export default function AffirmationRefineModal({ onUseOption }: AffirmationRefineModalProps) {
    const {
        isOpen,
        isLoading,
        error,
        sourceText,
        category,
        tone,
        believability,
        faithStyle,
        options,
        selectedOption,
        closeModal,
        setCategory,
        setTone,
        setBelievability,
        setFaithStyle,
        refine,
        selectOption,
    } = useAffirmationStore();

    const handleUseOption = (option: string) => {
        selectOption(option);
        onUseOption(option);
        closeModal();
    };

    return (
        <Modal isOpen={isOpen} onClose={closeModal} title="✨ Refine with AI">
            <div className="space-y-5">
                {/* Helper text */}
                <p className="text-sm text-forest-500">
                    Turn raw thoughts into believable, repeatable affirmations.
                </p>

                {/* Source text preview */}
                <div className="bg-parchment-200 border border-forest-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-forest-500 mb-1">Your text</p>
                    <p className="text-sm text-forest-700 leading-relaxed line-clamp-3">
                        {sourceText || <span className="italic text-forest-400">No text entered yet.</span>}
                    </p>
                    <p className="text-xs text-forest-400 mt-2">
                        Edit the text in the main field for full control.
                    </p>
                </div>

                {/* Category selector */}
                <div>
                    <label className="block text-sm font-medium text-forest-600 mb-2">Category</label>
                    <div className="grid grid-cols-4 gap-2">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => setCategory(c.value)}
                                className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${category === c.value
                                        ? 'bg-forest-700 text-parchment-100 shadow-sm'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                    }`}
                            >
                                {c.emoji} {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tone selector */}
                <div>
                    <label className="block text-sm font-medium text-forest-600 mb-2">Tone</label>
                    <div className="grid grid-cols-4 gap-2">
                        {TONES.map((t) => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setTone(t.value)}
                                className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${tone === t.value
                                        ? 'bg-forest-700 text-parchment-100 shadow-sm'
                                        : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Believability slider */}
                <div>
                    <label className="block text-sm font-medium text-forest-600 mb-2">
                        Believability: <span className="text-forest-500">{believability}%</span>
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={believability}
                        onChange={(e) => setBelievability(Number(e.target.value))}
                        className="w-full accent-forest-600"
                    />
                    <div className="flex justify-between text-xs text-forest-400 mt-1">
                        <span>Grounded</span>
                        <span>Confident</span>
                    </div>
                </div>

                {/* Faith-style toggle (only visible for Faith category) */}
                {category === 'Faith' && (
                    <label className="flex items-start gap-3 cursor-pointer bg-parchment-200 rounded-lg p-3 border border-forest-100">
                        <input
                            type="checkbox"
                            checked={faithStyle}
                            onChange={(e) => setFaithStyle(e.target.checked)}
                            className="mt-0.5 accent-forest-600"
                        />
                        <span className="text-sm text-forest-600 leading-snug">
                            Faith-centered phrasing (e.g., &ldquo;With God&rsquo;s help…&rdquo;)
                        </span>
                    </label>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Generate button */}
                <button
                    type="button"
                    onClick={refine}
                    disabled={isLoading || !sourceText.trim()}
                    className="btn-primary w-full disabled:opacity-50"
                >
                    {isLoading ? 'Generating…' : '✨ Generate Options'}
                </button>

                {/* Loading skeletons */}
                {isLoading && (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="bg-parchment-200 rounded-lg p-4 animate-pulse"
                            >
                                <div className="h-4 bg-parchment-400/40 rounded w-full mb-2" />
                                <div className="h-4 bg-parchment-400/40 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Options list */}
                {!isLoading && options.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-forest-500 uppercase tracking-wide">
                            Choose an affirmation
                        </p>
                        {options.map((option, idx) => (
                            <div
                                key={idx}
                                className={`border rounded-xl p-4 transition-all cursor-pointer ${selectedOption === option
                                        ? 'border-forest-600 bg-forest-50 shadow-sm'
                                        : 'border-forest-100 bg-parchment-100 hover:border-forest-300 hover:shadow-sm'
                                    }`}
                                onClick={() => selectOption(option)}
                            >
                                <p className="text-sm text-forest-700 leading-relaxed mb-3">
                                    &ldquo;{option}&rdquo;
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUseOption(option);
                                    }}
                                    className="text-xs font-medium text-forest-600 bg-parchment-300 hover:bg-forest-700 hover:text-parchment-100 px-3 py-1.5 rounded-full transition-all"
                                >
                                    Use this →
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}
