/**
 * Loop Generation Prompt Templates
 *
 * Separated from AIService so prompts are easily editable
 * and swappable without touching service logic.
 */

import { LoopGenerationInput } from '@/types';

const MOOD_LABELS: Record<string, string> = {
    calm: 'Calm',
    focused: 'Focused',
    stressed: 'Stressed',
    motivated: 'Motivated',
    tired: 'Tired',
};

const GOAL_LABELS: Record<string, string> = {
    'start-day': 'Start the day right',
    'improve-focus': 'Improve focus',
    'build-confidence': 'Build confidence',
    'stay-disciplined': 'Stay disciplined',
    'reduce-stress': 'Reduce stress',
};

const PROBLEM_LABELS: Record<string, string> = {
    overwhelmed: 'Overwhelmed',
    distracted: 'Distracted',
    'low-motivation': 'Low motivation',
    'negative-thinking': 'Negative thinking',
};

/**
 * Build a human-readable summary of the user's selections
 * for the AI confirmation step.
 */
export function buildIntentSummary(input: LoopGenerationInput): string {
    const moods = input.moods.map(m => MOOD_LABELS[m] || m).join(', ');
    const goals = input.goals.map(g => GOAL_LABELS[g] || g).join(', ');
    const problems = input.problems.map(p => PROBLEM_LABELS[p] || p).join(', ');

    let summary = `It sounds like your goal is to create a loop`;

    if (goals) summary += ` to help you ${goals.toLowerCase()}`;
    if (moods) summary += `. You're feeling ${moods.toLowerCase()}`;
    if (problems) summary += ` and dealing with ${problems.toLowerCase()}`;

    summary += '. Is that correct?';

    return summary;
}

/**
 * System prompt for AI loop generation.
 * Real LLM providers will use this as the system message.
 *
 * TUNING NOTES (for real LLM integration):
 * - Sentence length variation is critical for natural cadence
 * - Identity reinforcement should appear in first and last sentences
 * - Avoid generic affirmations ("I am great") — be specific to user context
 * - Target 60-90 seconds when read aloud at natural pace
 */
export function buildLoopGenerationPrompt(input: LoopGenerationInput): string {
    const moods = input.moods.map(m => MOOD_LABELS[m] || m).join(', ');
    const goals = input.goals.map(g => GOAL_LABELS[g] || g).join(', ');
    const problems = input.problems.map(p => PROBLEM_LABELS[p] || p).join(', ');

    return `You are a personal mental alignment coach creating a mental loop for audio repetition.

CONTEXT:
- Current mood: ${moods || 'Not specified'}
- Goals: ${goals || 'General improvement'}
- Challenges: ${problems || 'None specified'}
${input.details ? `- Additional context: "${input.details}"` : ''}

REQUIREMENTS:
- Write in first person ("I am...", "I choose...", "I practice...")
- Present tense, positive framing only
- Strong cadence suitable for repetition — vary sentence lengths (short punchy + longer flowing)
- 3-5 sentences, 50-120 words total
- Begin with identity reinforcement ("I am...")
- End with an empowering action statement
- Be SPECIFIC to the user's mood, goals, and challenges — avoid generic affirmations
- The text should feel powerful when read aloud repeatedly

OUTPUT FORMAT (respond in valid JSON):
{
  "name": "2-4 word descriptive title",
  "text": "The loop text, 50-120 words",
  "voiceId": "one of: david, rachel, calm-mentor, focused-coach",
  "intervalSeconds": 180-600 (based on complexity)
}

EXAMPLE OF STRONG OUTPUT:
{
  "name": "Focused Clarity",
  "text": "I am clear. I am focused. Every challenge I face sharpens my ability to think, decide, and act with precision. Distractions do not own me — I choose where my energy flows. When my mind wanders, I return. When doubt surfaces, I breathe and recommit. I am building something meaningful, and every focused minute compounds into mastery.",
  "voiceId": "focused-coach",
  "intervalSeconds": 300
}

EXAMPLE OF WEAK OUTPUT (avoid this):
{
  "name": "Positive Vibes",
  "text": "I am great. I am amazing. Everything is wonderful. I believe in myself. Today will be a good day.",
  "voiceId": "calm-mentor",
  "intervalSeconds": 180
}`;
}
