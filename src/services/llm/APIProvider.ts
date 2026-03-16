/**
 * API-backed LLM Provider
 *
 * Calls the server-side /api/ai/generate route, which handles
 * the actual Gemini SDK call. This keeps API keys server-side.
 *
 * If the server signals 'mock' provider, throws so AIService
 * falls through to MockProvider logic.
 */

import {
    LLMProvider,
    RefineAffirmationInput,
    GenerateLoopInput,
    GenerateLoopOutput,
    GenerateMemoryAidsInput,
    GenerateMemoryAidsOutput,
    GenerateBriefingInput,
} from './LLMProvider';

async function callAIRoute(action: string, prompt: string): Promise<any> {
    const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt }),
    });

    if (!res.ok) {
        throw new Error(`AI API returned ${res.status}`);
    }

    const data = await res.json();

    // If server signals mock fallback, throw to trigger AIService fallback
    if (data.provider === 'mock' || data.result === null) {
        throw new Error(data.error || 'AI provider unavailable, using fallback');
    }

    return data.result;
}

export class APIProvider implements LLMProvider {
    async refineAffirmations(_input: RefineAffirmationInput): Promise<string[]> {
        // Not used in current flow — delegate to mock
        throw new Error('refineAffirmations not supported via API provider');
    }

    async generateLoop(input: GenerateLoopInput): Promise<GenerateLoopOutput> {
        const result = await callAIRoute('loop', input.prompt);

        // Validate structure
        if (!result.name || !result.text) {
            throw new Error('Invalid loop structure from AI');
        }

        return {
            name: result.name,
            text: result.text,
            voiceId: result.voiceId || 'calm-mentor',
            intervalSeconds: typeof result.intervalSeconds === 'number' ? result.intervalSeconds : 240,
        };
    }

    async generateMemoryAids(input: GenerateMemoryAidsInput): Promise<GenerateMemoryAidsOutput> {
        const result = await callAIRoute('memory', input.prompt);

        if (!result.mnemonic || !Array.isArray(result.chunks)) {
            throw new Error('Invalid memory aids structure from AI');
        }

        return {
            mnemonic: result.mnemonic,
            chunks: result.chunks.map((c: any) => ({
                label: c.label || 'Memory Chunk',
                text: c.text || '',
                intervalSeconds: typeof c.intervalSeconds === 'number' ? c.intervalSeconds : 180,
            })),
            schedule: result.schedule || 'Review after 1 hour, then 1 day, then 3 days, then 7 days.',
        };
    }

    async generateBriefing(input: GenerateBriefingInput): Promise<string> {
        const result = await callAIRoute('briefing', input.prompt);

        if (typeof result !== 'string' || result.trim().length < 20) {
            throw new Error('Invalid briefing from AI');
        }

        return result.trim();
    }
}
