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
const MODEL_NAME = 'gemini-2.0-flash';

function isGeminiAvailable(): boolean {
    return API_KEY.length > 10;
}

// ── Gemini caller ─────────────────────────────────────────────

const MODELS_TO_TRY = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];

async function callGemini(prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(API_KEY);
    let lastError: any;

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`[AI Route] Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            console.log(`[AI Route] ✓ ${modelName} worked (${text.length} chars)`);
            return text;
        } catch (err: any) {
            lastError = err;
            const code = err.message?.includes('404') ? '404' : err.message?.includes('429') ? '429' : '?';
            console.log(`[AI Route] ✗ ${modelName}: ${code}`);
            if (!err.message?.includes('404')) throw err; // Only retry on 404
        }
    }

    throw lastError;
}

// ── JSON extraction ───────────────────────────────────────────

function extractJSON(text: string): any {
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

        // ── Status check ──────────────────────────────────
        if (action === 'status') {
            const keyPrefix = API_KEY ? `${API_KEY.slice(0, 8)}...` : '(empty)';
            const available = isGeminiAvailable();

            if (!available) {
                return NextResponse.json({
                    status: 'no_key',
                    keyPrefix,
                    model: MODEL_NAME,
                });
            }

            try {
                const testResult = await callGemini('Say "hello" in one word.');
                return NextResponse.json({
                    status: 'active',
                    keyPrefix,
                    model: MODEL_NAME,
                    provider: 'gemini',
                    testResponse: testResult.trim().slice(0, 50),
                });
            } catch (err: any) {
                return NextResponse.json({
                    status: 'error',
                    keyPrefix,
                    model: MODEL_NAME,
                    error: err.message,
                });
            }
        }

        // ── Normal generation ─────────────────────────────
        if (!action || !prompt) {
            return NextResponse.json(
                { error: 'Missing action or prompt' },
                { status: 400 }
            );
        }

        if (!isGeminiAvailable()) {
            console.log('[AI Route] GOOGLE_AI_API_KEY missing, returning mock signal');
            return NextResponse.json({ result: null, provider: 'mock' });
        }

        console.log(`[AI Route] Calling Gemini (${MODEL_NAME}) for action: ${action}`);
        const startTime = Date.now();

        try {
            const rawText = await callGemini(prompt);
            const elapsed = Date.now() - startTime;
            console.log(`[AI Route] ✓ Gemini responded in ${elapsed}ms (${rawText.length} chars)`);

            if (action === 'briefing') {
                return NextResponse.json({
                    result: rawText.trim(),
                    provider: 'gemini',
                });
            }

            const parsed = extractJSON(rawText);
            return NextResponse.json({
                result: parsed,
                provider: 'gemini',
            });
        } catch (aiErr: any) {
            console.error(`[AI Route] ✗ Gemini failed:`, aiErr.message);
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
