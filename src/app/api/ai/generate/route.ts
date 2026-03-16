/**
 * AI Generation API Route
 *
 * Server-side endpoint that calls Gemini (or returns mock fallback).
 * Keeps API keys secure — never exposed to the client.
 *
 * Accepts:
 *   POST { action: 'loop' | 'memory' | 'briefing', prompt: string }
 *
 * Returns:
 *   { result: object | string, provider: 'gemini' | 'mock' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Environment ───────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const MODEL_NAME = 'gemini-1.5-flash';

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

        if (!action || !prompt) {
            return NextResponse.json(
                { error: 'Missing action or prompt' },
                { status: 400 }
            );
        }

        // Check if Gemini is configured
        if (!isGeminiAvailable()) {
            console.log('[AI Route] Gemini not configured, returning mock signal');
            return NextResponse.json({ result: null, provider: 'mock' });
        }

        console.log(`[AI Route] Calling Gemini for action: ${action}`);
        const startTime = Date.now();

        try {
            const rawText = await callGemini(prompt);
            const elapsed = Date.now() - startTime;
            console.log(`[AI Route] Gemini responded in ${elapsed}ms (${rawText.length} chars)`);

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
            console.error(`[AI Route] Gemini call failed:`, aiErr.message);
            console.error(`[AI Route] Falling back to mock provider`);
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
