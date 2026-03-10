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
 */
export function buildLoopGenerationPrompt(input: LoopGenerationInput): string {
    const moods = input.moods.map(m => MOOD_LABELS[m] || m).join(', ');
    const goals = input.goals.map(g => GOAL_LABELS[g] || g).join(', ');
    const problems = input.problems.map(p => PROBLEM_LABELS[p] || p).join(', ');

    return `You are a personal mental alignment coach. Generate a concise, powerful mental loop for the user.

CONTEXT:
- Current mood: ${moods || 'Not specified'}
- Goals: ${goals || 'General improvement'}
- Challenges: ${problems || 'None specified'}
${input.details ? `- Additional context: "${input.details}"` : ''}

REQUIREMENTS:
- Write in first person ("I am...", "I choose...", "I practice...")
- Present tense, positive framing only
- Strong cadence suitable for repetition
- 3-5 sentences, 50-120 words total
- Include identity reinforcement
- End with an empowering statement

Also suggest:
- A short, descriptive loop name (2-4 words)
- A recommended voice (david, rachel, calm-mentor, or focused-coach)
- A repetition interval in seconds (180-600 based on length)`;
}
