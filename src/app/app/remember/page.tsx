'use client';

/**
 * Remember Something — Memory Engine
 *
 * User enters text to memorize. AI generates:
 * - Mnemonic phrase
 * - Chunked learning segments
 * - Suggested repetition intervals
 *
 * Each chunk can be saved directly as a loop (auto-generation).
 * Loops are named: {Topic} – Part 1, {Topic} – Part 2, etc.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { MemoryIcon, CheckIcon } from '@/components/Icons';
import { generateMemoryAids } from '@/services/AIService';
import type { MemoryAidsResult, MemoryChunk } from '@/types';

export default function RememberPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { addLoop } = useVaultStore();

    const [inputText, setInputText] = useState('');
    const [topicName, setTopicName] = useState('');
    const [result, setResult] = useState<MemoryAidsResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedChunks, setSavedChunks] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Derive topic label — used for loop naming
    const topic = useMemo(() => {
        if (topicName.trim()) return topicName.trim();
        // Auto-derive from first ~30 chars of input
        const fallback = inputText.trim().substring(0, 30).replace(/\s+/g, ' ');
        return fallback ? fallback + (inputText.trim().length > 30 ? '...' : '') : 'Untitled';
    }, [topicName, inputText]);

    async function handleGenerate() {
        if (!inputText.trim()) return;
        setIsGenerating(true);
        setError(null);
        setSavedChunks(new Set());

        try {
            const aids = await generateMemoryAids(inputText);
            setResult(aids);
        } catch (err: any) {
            setError(err.message || 'Failed to generate memory aids');
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleSaveChunkAsLoop(chunk: MemoryChunk, index: number) {
        if (!user?.uid || savedChunks.has(index)) return;
        setIsSaving(true);

        try {
            await addLoop(user.uid, {
                title: `${topic} – Part ${index + 1}`,
                category: 'memory',
                sourceType: 'tts',
                text: chunk.text,
                audioUrl: '',
                voiceId: 'calm-mentor',
                duration: 0,
                intervalSeconds: chunk.intervalSeconds,
                tags: ['memory'],
            });
            setSavedChunks(prev => new Set(prev).add(index));
        } catch (err: any) {
            setError(err.message || 'Failed to save chunk');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSaveAllAsLoops() {
        if (!user?.uid || !result) return;
        setIsSaving(true);

        try {
            // Save mnemonic as a loop
            await addLoop(user.uid, {
                title: `${topic} – Mnemonic`,
                category: 'memory',
                sourceType: 'tts',
                text: result.mnemonic,
                audioUrl: '',
                voiceId: 'calm-mentor',
                duration: 0,
                intervalSeconds: 180,
                tags: ['memory'],
            });

            // Save each chunk as a loop
            for (let i = 0; i < result.chunks.length; i++) {
                if (!savedChunks.has(i)) {
                    const chunk = result.chunks[i];
                    await addLoop(user.uid, {
                        title: `${topic} – Part ${i + 1}`,
                        category: 'memory',
                        sourceType: 'tts',
                        text: chunk.text,
                        audioUrl: '',
                        voiceId: 'calm-mentor',
                        duration: 0,
                        intervalSeconds: chunk.intervalSeconds,
                        tags: ['memory'],
                    });
                }
            }

            router.push('/app/vault');
        } catch (err: any) {
            setError(err.message || 'Failed to save loops');
        } finally {
            setIsSaving(false);
        }
    }

    function handleReset() {
        setInputText('');
        setTopicName('');
        setResult(null);
        setError(null);
        setSavedChunks(new Set());
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <MemoryIcon className="w-6 h-6 text-forest-700" />
                <h1 className="font-serif text-2xl font-bold text-forest-700">
                    Remember Something
                </h1>
            </div>

            {/* Input */}
            {!result && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            Topic Name
                        </label>
                        <input
                            type="text"
                            value={topicName}
                            onChange={(e) => setTopicName(e.target.value)}
                            className="input-field"
                            placeholder="e.g., Biology Terms, Spanish Vocab, Key Dates..."
                            maxLength={80}
                        />
                        <p className="text-xs text-forest-400 mt-1">Used for naming your loops in the vault</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-forest-600 mb-2">
                            What do you want to memorize?
                        </label>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="input-field min-h-[150px] resize-none"
                            placeholder="Paste text, facts, definitions, quotes, or anything you want to remember..."
                            maxLength={2000}
                        />
                        <p className="text-xs text-forest-400 mt-1">{inputText.length}/2000</p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={!inputText.trim() || isGenerating}
                        className="btn-primary w-full disabled:opacity-50"
                    >
                        {isGenerating ? 'Generating memory aids...' : 'Generate Memory Aids'}
                    </button>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Topic badge */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-forest-400 bg-parchment-300 px-2 py-1 rounded-full">
                            Topic: {topic}
                        </span>
                    </div>

                    {/* Mnemonic */}
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 space-y-2">
                        <h3 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                            Mnemonic Device
                        </h3>
                        <p className="text-sm text-forest-600 leading-relaxed italic">
                            {result.mnemonic}
                        </p>
                    </div>

                    {/* Chunks */}
                    <div className="space-y-3">
                        <h3 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                            Learning Chunks
                        </h3>
                        {result.chunks.map((chunk, i) => (
                            <div key={i} className="bg-parchment-100 rounded-lg border border-forest-100 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-forest-700">
                                        {topic} – Part {i + 1}
                                    </h4>
                                    <span className="text-xs text-forest-400">
                                        Interval: {chunk.intervalSeconds >= 60 ? `${Math.floor(chunk.intervalSeconds / 60)}m` : `${chunk.intervalSeconds}s`}
                                    </span>
                                </div>
                                <p className="text-sm text-forest-600">{chunk.text}</p>
                                <button
                                    onClick={() => handleSaveChunkAsLoop(chunk, i)}
                                    disabled={savedChunks.has(i) || isSaving}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                                        savedChunks.has(i)
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-parchment-300 text-forest-600 hover:bg-forest-700 hover:text-parchment-100'
                                    }`}
                                >
                                    {savedChunks.has(i) ? (
                                        <span className="flex items-center gap-1">
                                            <CheckIcon className="w-3 h-3" /> Saved
                                        </span>
                                    ) : (
                                        'Save as Loop'
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Schedule */}
                    <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 space-y-2">
                        <h3 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                            Repetition Schedule
                        </h3>
                        <p className="text-sm text-forest-600">{result.schedule}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveAllAsLoops}
                            disabled={isSaving}
                            className="btn-primary flex-1 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save All as Loops'}
                        </button>
                    </div>
                    <button onClick={handleReset} className="btn-ghost w-full text-sm">
                        Remember Something Else
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {error}
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
