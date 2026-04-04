import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const TIMEOUT_MS = 5000;

export async function GET() {
    const start = Date.now();

    // 1. Check key presence
    if (!API_KEY) {
        console.log('[AI Health] No API key configured');
        return NextResponse.json({
            status: 'no_key',
            keyPresent: false,
            provider: 'gemini',
            latencyMs: Date.now() - start,
            timestamp: new Date().toISOString(),
        });
    }

    // 2. Minimal test call with timeout
    try {
        const result = await Promise.race([
            testGemini(),
            timeout(TIMEOUT_MS),
        ]);

        if (result === 'TIMEOUT') {
            console.error('[AI Health] Gemini call timed out after', TIMEOUT_MS, 'ms');
            return NextResponse.json({
                status: 'api_error',
                keyPresent: true,
                provider: 'gemini',
                latencyMs: Date.now() - start,
                error: 'timeout',
                timestamp: new Date().toISOString(),
            });
        }

        console.log('[AI Health] Gemini healthy, latency:', Date.now() - start, 'ms');
        return NextResponse.json({
            status: 'ok',
            keyPresent: true,
            provider: 'gemini',
            latencyMs: Date.now() - start,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        const errorType = msg.includes('429') ? 'quota_exceeded'
            : msg.includes('403') ? 'forbidden'
                : msg.includes('404') ? 'model_not_found'
                    : 'unknown';

        console.error('[AI Health] Gemini error:', errorType, msg.slice(0, 100));

        return NextResponse.json({
            status: 'api_error',
            keyPresent: true,
            provider: 'gemini',
            latencyMs: Date.now() - start,
            error: errorType,
            errorMessage: msg.slice(0, 200),
            timestamp: new Date().toISOString(),
        });
    }
}

async function testGemini(): Promise<string> {
    const genAI = new GoogleGenerativeAI(API_KEY);

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash'
        });

        const result = await model.generateContent('Reply with OK');
        console.log('[AI Health] Success with gemini-1.5-flash');
        return result.response.text();
    } catch (err: any) {
        console.log('[AI Health] failed:', err.message?.slice(0, 80));
        throw err;
    }
}

function timeout(ms: number): Promise<'TIMEOUT'> {
    return new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), ms));
}
