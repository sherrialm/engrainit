/**
 * Unified AI Service
 *
 * Single entry point for all AI-powered features:
 * - Loop generation (from mood/goal/problem selections)
 * - Memory aids (mnemonics, chunks, schedules)
 * - Daily briefings
 *
 * Architecture: UI → AIService → PromptTemplates → LLMProvider
 *
 * Provider chain:
 *   1. APIProvider (calls /api/ai/generate → Gemini on server)
 *   2. MockProvider (deterministic fallback for dev/testing)
 *
 * If APIProvider fails for any reason (missing key, timeout,
 * malformed response), MockProvider handles it seamlessly.
 */

import { APIProvider } from './llm/APIProvider';
import { MockProvider } from './llm/MockProvider';
import { LLMProvider } from './llm/LLMProvider';
import { buildIntentSummary, buildLoopGenerationPrompt } from './prompts/LoopPrompts';
import { buildMemoryAidsPrompt } from './prompts/MemoryPrompts';
import { buildBriefingPrompt } from './prompts/BriefingPrompts';
import {
    LoopGenerationInput,
    GeneratedLoopSuggestion,
    MemoryAidsResult,
    BriefingContext,
} from '@/types';

// ── Provider Chain ────────────────────────────────────────────
// Try APIProvider first (real AI), fall back to MockProvider.
const apiProvider: LLMProvider = new APIProvider();
const mockProvider: LLMProvider = new MockProvider();

// ── Timeout wrapper ───────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`AI response timed out after ${ms / 1000}s`)), ms)
        ),
    ]);
}

// ── Observability ─────────────────────────────────────────────

type AIEvent = 'success' | 'timeout' | 'parse_error' | 'provider_error' | 'fallback';

function logAI(action: string, event: AIEvent, detail?: string, elapsed?: number) {
    const tag = `[AI:${action}]`;
    const suffix = elapsed ? ` (${elapsed}ms)` : '';
    switch (event) {
        case 'success':
            console.log(`${tag} ✓ Success${suffix}`, detail || '');
            break;
        case 'timeout':
            console.warn(`${tag} ⏱ Timeout${suffix}`, detail || '');
            break;
        case 'parse_error':
            console.warn(`${tag} ⚠ Parse error:`, detail || '');
            break;
        case 'provider_error':
            console.warn(`${tag} ✗ Provider error:`, detail || '');
            break;
        case 'fallback':
            console.log(`${tag} ↩ Using fallback${suffix}`, detail || '');
            break;
    }
}

// ── Fallback defaults ─────────────────────────────────────────

const FALLBACK_LOOP: GeneratedLoopSuggestion = {
    name: 'Steady Focus',
    text: 'I am focused and present.\nMy mind is clear.\nI move forward with calm intention.',
    voiceId: 'calm-mentor',
    intervalSeconds: 240,
};

const FALLBACK_MEMORY: MemoryAidsResult = {
    mnemonic: 'Create a vivid mental picture connecting each key idea.',
    chunks: [
        { label: 'Core Concept', text: 'Start with the foundation. Repeat until natural.', intervalSeconds: 180 },
    ],
    schedule: 'Review after 1 hour, then 1 day, then 3 days, then 7 days.',
};

const FALLBACK_BRIEFING = 'Good morning. Today is a day of steady progress. Start with your most important task and let each small action build momentum. You are showing up, and that is what matters most.';

// ── Loop Generation ───────────────────────────────────────────

export function summarizeIntent(input: LoopGenerationInput): string {
    return buildIntentSummary(input);
}

/**
 * Generate an AI-powered mental alignment loop.
 * Tries real AI first, falls back to mock.
 */
export async function generateLoop(input: LoopGenerationInput): Promise<GeneratedLoopSuggestion> {
    const prompt = buildLoopGenerationPrompt(input);
    const start = Date.now();

    // Try real AI
    try {
        const result = await withTimeout(apiProvider.generateLoop({ prompt }));
        const elapsed = Date.now() - start;

        if (!result.name || typeof result.name !== 'string') throw new Error('Invalid loop name');
        if (!result.text || typeof result.text !== 'string') throw new Error('Invalid loop text');

        logAI('loop', 'success', `"${result.name}"`, elapsed);
        return {
            name: sanitizeLoopName(result.name),
            text: result.text.trim(),
            voiceId: result.voiceId || 'calm-mentor',
            intervalSeconds: typeof result.intervalSeconds === 'number' ? result.intervalSeconds : 240,
        };
    } catch (apiErr: any) {
        const elapsed = Date.now() - start;
        const isTimeout = apiErr.message?.includes('timed out');
        logAI('loop', isTimeout ? 'timeout' : 'provider_error', apiErr.message, elapsed);
    }

    // Fall back to mock
    try {
        const result = await mockProvider.generateLoop({ prompt });
        logAI('loop', 'fallback', `mock: "${result.name}"`);
        return {
            name: sanitizeLoopName(result.name),
            text: result.text.trim(),
            voiceId: result.voiceId || 'calm-mentor',
            intervalSeconds: result.intervalSeconds || 240,
        };
    } catch (mockErr) {
        logAI('loop', 'fallback', 'using static fallback');
        return FALLBACK_LOOP;
    }
}

// ── Memory Engine ─────────────────────────────────────────────

export async function generateMemoryAids(inputText: string): Promise<MemoryAidsResult> {
    const prompt = buildMemoryAidsPrompt(inputText);
    const start = Date.now();

    // Try real AI
    try {
        const result = await withTimeout(apiProvider.generateMemoryAids({ prompt }));
        const elapsed = Date.now() - start;

        if (!result.mnemonic || typeof result.mnemonic !== 'string') throw new Error('Invalid mnemonic');
        if (!Array.isArray(result.chunks) || result.chunks.length === 0) throw new Error('Invalid chunks');

        logAI('memory', 'success', `${result.chunks.length} chunks`, elapsed);
        return {
            mnemonic: result.mnemonic,
            chunks: result.chunks.map(c => ({
                label: c.label || 'Memory Chunk',
                text: c.text || '',
                intervalSeconds: typeof c.intervalSeconds === 'number' ? c.intervalSeconds : 180,
            })),
            schedule: result.schedule || 'Review after 1 hour, then 1 day, then 3 days, then 7 days.',
        };
    } catch (apiErr: any) {
        const elapsed = Date.now() - start;
        const isTimeout = apiErr.message?.includes('timed out');
        logAI('memory', isTimeout ? 'timeout' : 'provider_error', apiErr.message, elapsed);
    }

    // Fall back to mock
    try {
        const result = await mockProvider.generateMemoryAids({ prompt });
        logAI('memory', 'fallback', 'mock provider');
        return result;
    } catch {
        logAI('memory', 'fallback', 'using static fallback');
        return FALLBACK_MEMORY;
    }
}

// ── Daily Briefing ────────────────────────────────────────────

export async function generateBriefing(context: BriefingContext): Promise<string> {
    const prompt = buildBriefingPrompt(context);
    const start = Date.now();

    // Try real AI
    try {
        const result = await withTimeout(apiProvider.generateBriefing({ prompt }));
        const elapsed = Date.now() - start;

        if (!result || typeof result !== 'string' || result.trim().length < 20) {
            throw new Error('Briefing too short or invalid');
        }

        logAI('briefing', 'success', `${result.trim().split(' ').length} words`, elapsed);
        return result.trim();
    } catch (apiErr: any) {
        const elapsed = Date.now() - start;
        const isTimeout = apiErr.message?.includes('timed out');
        logAI('briefing', isTimeout ? 'timeout' : 'provider_error', apiErr.message, elapsed);
    }

    // Fall back to mock
    try {
        const result = await mockProvider.generateBriefing({ prompt });
        logAI('briefing', 'fallback', 'mock provider');
        return result;
    } catch {
        logAI('briefing', 'fallback', 'using static fallback');
        return FALLBACK_BRIEFING;
    }
}

// ── Helpers ───────────────────────────────────────────────────

function sanitizeLoopName(name: string): string {
    return name
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 4)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}
