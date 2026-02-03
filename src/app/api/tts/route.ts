import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tts
 * 
 * Converts text to speech using Google Cloud Text-to-Speech API.
 * Returns base64-encoded MP3 audio.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { text, voiceId } = body;

        // Validate input
        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required', code: 'MISSING_TEXT' },
                { status: 400 }
            );
        }

        if (text.length > 500) {
            return NextResponse.json(
                { error: 'Text must be 500 characters or less', code: 'TEXT_TOO_LONG' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

        console.log('TTS API Request:', { textLength: text.length, voiceId, hasApiKey: !!apiKey });

        if (!apiKey) {
            console.error('GOOGLE_CLOUD_TTS_API_KEY not configured');
            // Fallback: Return a placeholder response for development
            return NextResponse.json({
                audioContent: '', // Empty - will trigger fallback in client
                duration: 0,
                message: 'TTS API key not configured. Please add GOOGLE_CLOUD_TTS_API_KEY to .env.local',
            });
        }

        // Process text for natural pauses
        const processedText = processTextForSpeech(text);

        console.log('Calling Google TTS API...');

        // Google Cloud TTS API request
        const ttsResponse = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: {
                        ssml: processedText,
                    },
                    voice: getVoiceConfig(voiceId),
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 0.95, // Slightly slower for memorization
                        pitch: 0,
                        effectsProfileId: ['handset-class-device'], // Optimized for clarity
                    },
                }),
            }
        );

        if (!ttsResponse.ok) {
            const errorData = await ttsResponse.json().catch(() => ({}));
            console.error('Google TTS API error:', ttsResponse.status, errorData);
            return NextResponse.json(
                {
                    error: `TTS API Error: ${errorData.error?.message || 'Unknown error'}`,
                    code: 'TTS_API_ERROR',
                    details: errorData
                },
                { status: 500 }
            );
        }

        console.log('TTS API Success!');

        const data = await ttsResponse.json();

        // Estimate duration (rough calculation: ~150 words per minute)
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = (wordCount / 150) * 60;

        return NextResponse.json({
            audioContent: `data:audio/mp3;base64,${data.audioContent}`,
            duration: estimatedDuration,
        });
    } catch (error) {
        console.error('TTS error:', error);
        return NextResponse.json(
            { error: 'Internal server error', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

/**
 * Process text into SSML for natural speech pauses
 * - Commas = short pause (200ms)
 * - Periods = long pause (500ms)
 * - New lines = paragraph break
 */
function processTextForSpeech(text: string): string {
    let ssml = text
        // Escape special characters
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Add pauses
        .replace(/,\s*/g, ', <break time="200ms"/>')
        .replace(/\.\s*/g, '. <break time="500ms"/>')
        .replace(/!\s*/g, '! <break time="400ms"/>')
        .replace(/\?\s*/g, '? <break time="400ms"/>')
        .replace(/;\s*/g, '; <break time="300ms"/>')
        .replace(/:\s*/g, ': <break time="250ms"/>')
        // Handle new lines as paragraph breaks
        .replace(/\n\n/g, ' <break time="800ms"/> ')
        .replace(/\n/g, ' <break time="400ms"/> ');

    return `<speak>${ssml}</speak>`;
}

/**
 * Get voice configuration based on voice ID
 * Future: Map to different voice profiles (Sage, Mentor, Anchor, Parent)
 */
function getVoiceConfig(voiceId?: string): object {
    // Default voice configuration
    const defaultVoice = {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D', // Deep, calm male voice
        ssmlGender: 'MALE',
    };

    // Voice profiles for future implementation
    const voiceProfiles: Record<string, object> = {
        sage: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-D', // Deep, calm
            ssmlGender: 'MALE',
        },
        mentor: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-J', // Bright, clear
            ssmlGender: 'MALE',
        },
        anchor: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-A', // Low-register, steady
            ssmlGender: 'MALE',
        },
        parent: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-C', // Soft, warm
            ssmlGender: 'FEMALE',
        },
    };

    return voiceProfiles[voiceId || ''] || defaultVoice;
}
