import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tts
 * 
 * Converts text to speech using ElevenLabs API (primary) or Google Cloud TTS (fallback).
 * Returns base64-encoded audio.
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

        // Try ElevenLabs first, fall back to Google TTS
        const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

        if (elevenLabsKey) {
            console.log('Using ElevenLabs TTS...');
            return await elevenLabsTTS(text, voiceId, elevenLabsKey);
        }

        const googleKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
        if (googleKey) {
            console.log('Falling back to Google TTS...');
            return await googleTTS(text, voiceId, googleKey);
        }

        return NextResponse.json({
            audioContent: '',
            duration: 0,
            message: 'No TTS API key configured. Please add ELEVENLABS_API_KEY or GOOGLE_CLOUD_TTS_API_KEY to .env.local',
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
 * ElevenLabs voice mapping
 * Maps our app's voice IDs to ElevenLabs voice IDs
 */
const ELEVENLABS_VOICES: Record<string, string> = {
    sage: 'nPczCjzI2devNBz1zQrb',      // Brian - Deep, calm male
    mentor: 'IKne3meq5aSn9XLyUdCD',     // Charlie - Warm, clear male
    anchor: 'JBFqnCBsd6RMkjVDRZzb',     // George - Low, authoritative male
    parent: 'EXAVITQu4vr4xnSDxMaL',     // Sarah - Soft, nurturing female
};

/**
 * Generate speech using ElevenLabs API
 */
async function elevenLabsTTS(text: string, voiceId: string | undefined, apiKey: string) {
    const elVoiceId = ELEVENLABS_VOICES[voiceId || 'sage'] || ELEVENLABS_VOICES.sage;

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.6,        // Slightly varied for natural feel
                    similarity_boost: 0.8,  // Mostly consistent voice
                    style: 0.3,             // Subtle expressiveness
                    use_speaker_boost: true,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('ElevenLabs API error:', response.status, errorText);
        return NextResponse.json(
            { error: `ElevenLabs API Error: ${errorText}`, code: 'TTS_API_ERROR' },
            { status: 500 }
        );
    }

    // ElevenLabs returns raw audio bytes (MP3 format)
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    // Estimate duration
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return NextResponse.json({
        audioContent: `data:audio/mp3;base64,${base64Audio}`,
        duration: estimatedDuration,
    });
}

/**
 * Generate speech using Google Cloud TTS API (fallback)
 */
async function googleTTS(text: string, voiceId: string | undefined, apiKey: string) {
    const processedText = processTextForSpeech(text);

    const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { ssml: processedText },
                voice: getGoogleVoiceConfig(voiceId),
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 0.95,
                    pitch: 0,
                    effectsProfileId: ['handset-class-device'],
                },
            }),
        }
    );

    if (!ttsResponse.ok) {
        const errorData = await ttsResponse.json().catch(() => ({}));
        console.error('Google TTS API error:', ttsResponse.status, errorData);
        return NextResponse.json(
            { error: `TTS API Error: ${errorData.error?.message || 'Unknown error'}`, code: 'TTS_API_ERROR' },
            { status: 500 }
        );
    }

    const data = await ttsResponse.json();
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return NextResponse.json({
        audioContent: `data:audio/mp3;base64,${data.audioContent}`,
        duration: estimatedDuration,
    });
}

/**
 * Process text into SSML for Google TTS natural pauses
 */
function processTextForSpeech(text: string): string {
    let ssml = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/,\s*/g, ', <break time="200ms"/>')
        .replace(/\.\s*/g, '. <break time="500ms"/>')
        .replace(/!\s*/g, '! <break time="400ms"/>')
        .replace(/\?\s*/g, '? <break time="400ms"/>')
        .replace(/;\s*/g, '; <break time="300ms"/>')
        .replace(/:\s*/g, ': <break time="250ms"/>')
        .replace(/\n\n/g, ' <break time="800ms"/> ')
        .replace(/\n/g, ' <break time="400ms"/> ');

    return `<speak>${ssml}</speak>`;
}

/**
 * Google TTS voice config
 */
function getGoogleVoiceConfig(voiceId?: string): object {
    const voiceProfiles: Record<string, object> = {
        sage: { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
        mentor: { languageCode: 'en-US', name: 'en-US-Neural2-J', ssmlGender: 'MALE' },
        anchor: { languageCode: 'en-US', name: 'en-US-Neural2-A', ssmlGender: 'MALE' },
        parent: { languageCode: 'en-US', name: 'en-US-Neural2-C', ssmlGender: 'FEMALE' },
    };
    return voiceProfiles[voiceId || 'sage'] || voiceProfiles.sage;
}
