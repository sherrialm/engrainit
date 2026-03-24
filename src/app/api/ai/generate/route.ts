/**
 * AI Generation API Route
 *
 * Server-side endpoint that calls Gemini (or returns mock fallback).
 * Keeps API keys secure — never exposed to the client.
 *
 * Accepts:
 *   POST { action: 'loop' | 'memory' | 'briefing' | 'status', prompt?: string }
 *
 * Returns:
 *   { result: object | string, provider: 'gemini' | 'mock' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Environment ───────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

function isGeminiAvailable(): boolean {
    return API_KEY.length > 10;
}

// ── Gemini caller ─────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}

// ── JSON extraction ───────────────────────────────────────────

function extractJSON(text: string): any {
    // Try to find JSON in the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
    }

    try {
        return JSON.parse(jsonMatch[1].trim());
    } catch {
        throw new Error('Failed to parse JSON from AI response');
    }
}

// ── Route Handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, prompt } = body;

        // ── Status check endpoint ─────────────────────────
        if (action === 'status') {
            const keyPrefix = API_KEY ? `${API_KEY.slice(0, 8)}...` : '(empty)';
            const available = isGeminiAvailable();

            console.log(`[AI Route] Status check — key: ${keyPrefix}, available: ${available}, model: ${MODEL_NAME}`);

            if (!available) {
                return NextResponse.json({
                    status: 'no_key',
                    keyPrefix,
                    model: MODEL_NAME,
                    message: 'GOOGLE_AI_API_KEY is not set or too short',
                });
            }

            // Try multiple models to find one that works
            const modelsToTry = [
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite',
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest',
                'gemini-1.5-pro',
                'gemini-pro',
            ];

            const genAI = new GoogleGenerativeAI(API_KEY);
            const results: Record<string, string> = {};

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const testResult = await model.generateContent('Say hello in one word.');
                    const text = testResult.response.text().trim().slice(0, 30);
                    results[modelName] = `✓ works: "${text}"`;
                } catch (err: any) {
                    const msg = err.message || '';
                    if (msg.includes('429')) results[modelName] = '✗ quota exceeded';
                    else if (msg.includes('404')) results[modelName] = '✗ not available';
                    else if (msg.includes('403')) results[modelName] = '✗ permission denied';
                    else results[modelName] = `✗ ${msg.slice(0, 60)}`;
                }
            }

            // Find first working model
            const workingModel = Object.entries(results).find(([, v]) => v.startsWith('✓'));

            return NextResponse.json({
                status: workingModel ? 'active' : 'error',
                keyPrefix,
                configuredModel: MODEL_NAME,
                workingModel: workingModel ? workingModel[0] : null,
                modelResults: results,
            });
        }

        // ── Normal generation ─────────────────────────────
        if (!action || !prompt) {
            return NextResponse.json(
                { error: 'Missing action or prompt' },
                { status: 400 }
            );
        }

        // Check if Gemini is configured
        if (!isGeminiAvailable()) {
            console.log('[AI Route] Gemini not configured (GOOGLE_AI_API_KEY missing), returning mock signal');
            return NextResponse.json({ result: null, provider: 'mock' });
        }

        console.log(`[AI Route] Calling Gemini (${MODEL_NAME}) for action: ${action}`);
        const startTime = Date.now();

        try {
            const rawText = await callGemini(prompt);
            const elapsed = Date.now() - startTime;
            console.log(`[AI Route] ✓ Gemini responded in ${elapsed}ms (${rawText.length} chars)`);

            if (action === 'briefing') {
                // Briefing returns plain text, not JSON
                return NextResponse.json({
                    result: rawText.trim(),
                    provider: 'gemini',
                });
            }

            // Loop and memory return structured JSON
            const parsed = extractJSON(rawText);
            return NextResponse.json({
                result: parsed,
                provider: 'gemini',
            });
        } catch (aiErr: any) {
            console.error(`[AI Route] ✗ Gemini call FAILED:`, aiErr.message);
            console.error(`[AI Route] Key prefix: ${API_KEY.slice(0, 8)}..., Model: ${MODEL_NAME}`);
            return NextResponse.json({
                result: null,
                provider: 'mock',
                error: aiErr.message,
            });
        }
    } catch (err: any) {
        console.error('[AI Route] Request error:', err.message);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
