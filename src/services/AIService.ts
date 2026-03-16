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
 * Uses MockProvider by default. Swap to a real provider by
 * changing the provider instantiation below.
 */

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

// ── Provider Instance ─────────────────────────────────────────
// Change this line to swap AI providers (e.g., new GeminiProvider())
const provider: LLMProvider = new MockProvider();

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

/**
 * Generate a human-readable summary of the user's selections
 * for the AI confirmation step.
 */
export function summarizeIntent(input: LoopGenerationInput): string {
    return buildIntentSummary(input);
}

/**
 * Generate an AI-powered mental alignment loop.
 * Wraps provider call with JSON validation and fallback.
 */
export async function generateLoop(input: LoopGenerationInput): Promise<GeneratedLoopSuggestion> {
    try {
        const prompt = buildLoopGenerationPrompt(input);
        const result = await provider.generateLoop({ prompt });

        // Validate required fields
        if (!result.name || typeof result.name !== 'string') throw new Error('Invalid loop name');
        if (!result.text || typeof result.text !== 'string') throw new Error('Invalid loop text');

        return {
            name: sanitizeLoopName(result.name),
            text: result.text.trim(),
            voiceId: result.voiceId || 'calm-mentor',
            intervalSeconds: typeof result.intervalSeconds === 'number' ? result.intervalSeconds : 240,
        };
    } catch (err) {
        console.error('[AIService] generateLoop failed, using fallback:', err);
        return FALLBACK_LOOP;
    }
}

// ── Memory Engine ─────────────────────────────────────────────

/**
 * Generate memory aids (mnemonic, chunks with intervals, schedule).
 * Wraps provider call with validation and fallback.
 */
export async function generateMemoryAids(inputText: string): Promise<MemoryAidsResult> {
    try {
        const prompt = buildMemoryAidsPrompt(inputText);
        const result = await provider.generateMemoryAids({ prompt });

        // Validate
        if (!result.mnemonic || typeof result.mnemonic !== 'string') throw new Error('Invalid mnemonic');
        if (!Array.isArray(result.chunks) || result.chunks.length === 0) throw new Error('Invalid chunks');

        return {
            mnemonic: result.mnemonic,
            chunks: result.chunks.map(c => ({
                label: c.label || 'Memory Chunk',
                text: c.text || '',
                intervalSeconds: typeof c.intervalSeconds === 'number' ? c.intervalSeconds : 180,
            })),
            schedule: result.schedule || 'Review after 1 hour, then 1 day, then 3 days, then 7 days.',
        };
    } catch (err) {
        console.error('[AIService] generateMemoryAids failed, using fallback:', err);
        return FALLBACK_MEMORY;
    }
}

// ── Daily Briefing ────────────────────────────────────────────

/**
 * Generate a personalized daily mental briefing.
 * Wraps provider call with fallback.
 */
export async function generateBriefing(context: BriefingContext): Promise<string> {
    try {
        const prompt = buildBriefingPrompt(context);
        const result = await provider.generateBriefing({ prompt });

        if (!result || typeof result !== 'string' || result.trim().length < 20) {
            throw new Error('Briefing too short or invalid');
        }

        return result.trim();
    } catch (err) {
        console.error('[AIService] generateBriefing failed, using fallback:', err);
        return FALLBACK_BRIEFING;
    }
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Clean up loop names to be concise and scannable.
 * Removes quotes, trims, and title-cases.
 */
function sanitizeLoopName(name: string): string {
    return name
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 4)  // Max 4 words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}
