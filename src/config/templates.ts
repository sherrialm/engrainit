/**
 * Template Library
 *
 * Pre-made affirmation scripts and faith-based loops.
 * Local-only for now — no Firestore.
 */

export type TemplateCategory = 'Faith' | 'Study' | 'Vision' | 'Habits';

export interface Template {
    id: string;
    title: string;
    category: TemplateCategory;
    modeId?: string;
    tags: string[];
    text: string;
    recommendedVoiceId?: string;
}

export const TEMPLATES: Template[] = [
    // ── Faith (6) ─────────────────────────────────────────────
    {
        id: 'faith-identity',
        title: 'I Am Chosen',
        category: 'Faith',
        modeId: 'faith',
        tags: ['identity', 'confidence', 'purpose'],
        text: 'I am chosen and called for a purpose. My life has meaning, and I walk in divine favor. I am not an accident — I was designed with intention.',
        recommendedVoiceId: 'sage',
    },
    {
        id: 'faith-peace',
        title: 'Peace Over Anxiety',
        category: 'Faith',
        modeId: 'faith',
        tags: ['anxiety', 'peace', 'calm', 'sleep'],
        text: 'I release every anxious thought. Peace guards my heart and my mind. I am not controlled by fear — I am held by something greater than my circumstances.',
        recommendedVoiceId: 'parent',
    },
    {
        id: 'faith-strength',
        title: 'Strength in Weakness',
        category: 'Faith',
        modeId: 'faith',
        tags: ['strength', 'perseverance', 'hard times'],
        text: 'When I am weak, I am made strong. My struggles are shaping me, not breaking me. I can endure because I am not doing this alone.',
        recommendedVoiceId: 'anchor',
    },
    {
        id: 'faith-provision',
        title: 'I Am Provided For',
        category: 'Faith',
        modeId: 'faith',
        tags: ['provision', 'trust', 'finances', 'worry'],
        text: 'My needs are met. I trust the process and believe in abundance. I am not defined by what I lack — I am grateful for what I have and expectant for what is coming.',
        recommendedVoiceId: 'mentor',
    },
    {
        id: 'faith-forgiveness',
        title: 'Letting Go and Moving Forward',
        category: 'Faith',
        modeId: 'faith',
        tags: ['forgiveness', 'healing', 'release'],
        text: 'I release bitterness and choose to forgive. Holding on only holds me back. I am free to move forward with a light heart and a clear conscience.',
        recommendedVoiceId: 'parent',
    },
    {
        id: 'faith-morning',
        title: 'Morning Surrender',
        category: 'Faith',
        modeId: 'morning',
        tags: ['morning', 'surrender', 'gratitude'],
        text: 'This is a new day, and I surrender it fully. I am grateful to be alive. My steps are ordered, my mind is clear, and my heart is open to receive.',
        recommendedVoiceId: 'sage',
    },

    // ── Confidence (4) ────────────────────────────────────────
    {
        id: 'conf-enough',
        title: 'I Am Enough',
        category: 'Habits',
        modeId: 'confidence',
        tags: ['confidence', 'self-worth', 'imposter syndrome'],
        text: 'I am enough exactly as I am. I do not need permission to take up space. My voice matters, my ideas are valid, and I bring value wherever I go.',
        recommendedVoiceId: 'anchor',
    },
    {
        id: 'conf-bold',
        title: 'Boldness Over Fear',
        category: 'Habits',
        modeId: 'confidence',
        tags: ['boldness', 'courage', 'fear', 'action'],
        text: 'I choose boldness over fear. I take action even when I feel uncertain. Courage is not the absence of fear — it is moving forward despite it.',
        recommendedVoiceId: 'mentor',
    },
    {
        id: 'conf-leader',
        title: 'I Lead with Conviction',
        category: 'Vision',
        modeId: 'confidence',
        tags: ['leadership', 'conviction', 'influence'],
        text: 'I am a leader. I lead with integrity, clarity, and compassion. People trust me because I am authentic, and I trust myself because I am growing every day.',
        recommendedVoiceId: 'anchor',
    },
    {
        id: 'conf-boundaries',
        title: 'Healthy Boundaries',
        category: 'Habits',
        modeId: 'confidence',
        tags: ['boundaries', 'self-care', 'relationships'],
        text: 'I set healthy boundaries without guilt. Saying no is not selfish — it is necessary. I protect my energy so I can give my best to what matters most.',
        recommendedVoiceId: 'sage',
    },

    // ── Focus / Study (4) ─────────────────────────────────────
    {
        id: 'focus-deep',
        title: 'Deep Focus Activation',
        category: 'Study',
        modeId: 'focus',
        tags: ['focus', 'concentration', 'productivity', 'study'],
        text: 'My mind is sharp and focused. Distractions have no power over me right now. I am fully present, fully engaged, and fully capable of mastering this material.',
        recommendedVoiceId: 'mentor',
    },
    {
        id: 'focus-retention',
        title: 'Memory and Retention',
        category: 'Study',
        modeId: 'focus',
        tags: ['memory', 'retention', 'learning', 'exam'],
        text: 'I absorb and retain information with ease. My brain is wired for learning. Every repetition deepens the neural pathway, and knowledge becomes permanent.',
        recommendedVoiceId: 'mentor',
    },
    {
        id: 'focus-discipline',
        title: 'Discipline Over Motivation',
        category: 'Study',
        modeId: 'focus',
        tags: ['discipline', 'routine', 'consistency'],
        text: 'I do not wait for motivation. I rely on discipline. I show up every day, even when it is hard, because consistency builds the results I want.',
        recommendedVoiceId: 'anchor',
    },
    {
        id: 'focus-creativity',
        title: 'Creative Flow State',
        category: 'Study',
        modeId: 'focus',
        tags: ['creativity', 'flow', 'ideas', 'inspiration'],
        text: 'I am a channel for creative energy. Ideas flow through me effortlessly. I trust the process and allow myself to create without judgment.',
        recommendedVoiceId: 'sage',
    },

    // ── Reset / Calm (4) ──────────────────────────────────────
    {
        id: 'reset-breath',
        title: 'Breathe and Reset',
        category: 'Habits',
        modeId: 'reset',
        tags: ['stress', 'breathe', 'calm', 'reset', 'anxiety'],
        text: 'I pause. I breathe deeply. I release tension from my body and my mind. This moment is all that exists right now, and in this moment, I am safe.',
        recommendedVoiceId: 'parent',
    },
    {
        id: 'reset-letgo',
        title: 'Release What I Cannot Control',
        category: 'Habits',
        modeId: 'reset',
        tags: ['control', 'surrender', 'stress', 'overwhelm'],
        text: 'I release what I cannot control. I focus only on what is within my reach. Worrying about the rest drains me — letting go empowers me.',
        recommendedVoiceId: 'sage',
    },
    {
        id: 'reset-night',
        title: 'Night Wind-Down',
        category: 'Habits',
        modeId: 'night',
        tags: ['sleep', 'rest', 'night', 'wind-down'],
        text: 'Today is complete. I did my best, and my best is enough. I release the day and welcome rest. My body is safe, my mind is quiet, and sleep comes easily.',
        recommendedVoiceId: 'parent',
    },
    {
        id: 'reset-gratitude',
        title: 'Gratitude Reset',
        category: 'Habits',
        modeId: 'reset',
        tags: ['gratitude', 'perspective', 'mindset'],
        text: 'I am grateful for this life. I choose to see the good in my circumstances. Gratitude shifts my perspective and opens my heart to more blessings.',
        recommendedVoiceId: 'sage',
    },
];
