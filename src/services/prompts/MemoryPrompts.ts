/**
 * Memory Engine Prompt Templates
 *
 * Templates for mnemonic generation, chunking, and
 * spaced repetition scheduling.
 */

/**
 * System prompt for generating memory aids from user input.
 */
export function buildMemoryAidsPrompt(inputText: string): string {
    return `You are a memory optimization expert. The user wants to memorize the following content:

"${inputText}"

Generate the following:

1. MNEMONIC: A memorable mnemonic device (acronym, story, rhyme, or visual association)
2. CHUNKS: Break the content into 2-5 digestible learning segments. Each chunk should be:
   - Self-contained and meaningful
   - Short enough to repeat aloud (1-2 sentences)
   - Labeled with a descriptive name
3. SCHEDULE: A human-readable spaced repetition schedule (e.g., "Review after 1 hour, then 1 day, then 3 days, then 7 days")

TECHNIQUES TO APPLY:
- Spaced repetition intervals
- Chunking for working memory
- Dual coding (suggest visual associations)
- Retrieval practice prompts

Output as structured JSON with: mnemonic (string), chunks (array of {label, text, intervalSeconds}), schedule (string).`;
}
