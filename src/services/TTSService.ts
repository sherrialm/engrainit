/**
 * TTS Service - Client-side wrapper for TTS API
 */

import { TTSRequest, TTSResponse } from '@/types';

/**
 * Generate speech from text using Google Cloud TTS
 */
export async function generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to generate speech');
    }

    return response.json();
}

/**
 * Fallback to browser's built-in speech synthesis
 * Used when Google Cloud TTS is not configured
 */
export function useBrowserTTS(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
            reject(new Error('Speech synthesis not supported'));
            return;
        }

        // Create audio context to record the speech
        const audioContext = new AudioContext();
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        };

        // Note: This is a simplified fallback. Full browser TTS recording
        // requires more complex setup with Web Audio API.
        // For now, we'll use a simpler approach.

        reject(new Error('Browser TTS fallback not fully implemented. Please configure Google Cloud TTS.'));
    });
}
