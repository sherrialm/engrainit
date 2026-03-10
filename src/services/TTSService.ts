/**
 * TTS Service - Client-side wrapper for TTS API
 *
 * Features:
 * - 15-second request timeout (AbortController)
 * - Debug logging (console only, no sensitive data)
 * - Proper error propagation (no silent failures)
 */

import { TTSRequest, TTSResponse } from '@/types';

const TTS_TIMEOUT_MS = 15_000;

/**
 * Generate speech from text using server-side TTS API
 */
export async function generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    console.log('[TTS] Request start:', { chars: request.text.length, voiceId: request.voiceId });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn('[TTS] Request timed out after', TTS_TIMEOUT_MS, 'ms');
        controller.abort();
    }, TTS_TIMEOUT_MS);

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[TTS] API error:', response.status, error);
            throw new Error(error.error || 'Failed to generate speech');
        }

        const data: TTSResponse = await response.json();
        console.log('[TTS] Request success:', { haAudio: !!data.audioContent, duration: data.duration });
        return data;
    } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('Audio generation timed out. Please try again with shorter text.');
        }

        // Re-throw with friendly message if not already a meaningful error
        if (err instanceof Error) {
            throw err;
        }

        throw new Error('Audio generation failed. Please try again.');
    }
}

