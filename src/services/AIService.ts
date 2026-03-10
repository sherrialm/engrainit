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
 */
export async function generateLoop(input: LoopGenerationInput): Promise<GeneratedLoopSuggestion> {
    const prompt = buildLoopGenerationPrompt(input);
    const result = await provider.generateLoop({ prompt });
    return {
        name: result.name,
        text: result.text,
        voiceId: result.voiceId,
        intervalSeconds: result.intervalSeconds,
    };
}

// ── Memory Engine ─────────────────────────────────────────────

/**
 * Generate memory aids (mnemonic, chunks with intervals, schedule).
 */
export async function generateMemoryAids(inputText: string): Promise<MemoryAidsResult> {
    const prompt = buildMemoryAidsPrompt(inputText);
    const result = await provider.generateMemoryAids({ prompt });
    return {
        mnemonic: result.mnemonic,
        chunks: result.chunks,
        schedule: result.schedule,
    };
}

// ── Daily Briefing ────────────────────────────────────────────

/**
 * Generate a personalized daily mental briefing.
 */
export async function generateBriefing(context: BriefingContext): Promise<string> {
    const prompt = buildBriefingPrompt(context);
    return provider.generateBriefing({ prompt });
}
