/**
 * AffirmationAIService
 *
 * Client-safe wrapper around POST /api/affirmations/refine.
 * Used by React components (e.g. the forthcoming "Refine with AI" modal)
 * to obtain NLP-aligned affirmation options from a user's raw thought.
 *
 * No Node-only imports. No secret keys. No server-only provider code.
 */

import type {
    AffirmationRefineRequest,
    AffirmationRefineResponse,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────

/**
 * Attempt to parse a JSON string safely.
 * Returns `null` if the input is not valid JSON.
 */
function safeJsonParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * Type-guard: checks that `value` looks like a valid
 * AffirmationRefineResponse (i.e. `{ options: string[] }`).
 */
function isValidResponse(value: unknown): value is AffirmationRefineResponse {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (!Array.isArray(obj.options)) return false;
    return obj.options.every((item: unknown) => typeof item === 'string');
}

// ── Public API ────────────────────────────────────────────────

/**
 * Call the server endpoint to refine a raw thought into
 * 3–5 NLP-aligned affirmation options.
 *
 * @throws {Error} with the server's error message on 4xx/5xx,
 *   or a clear message when the response is malformed.
 */
export async function refineAffirmations(
    request: AffirmationRefineRequest,
): Promise<AffirmationRefineResponse> {
    const response = await fetch('/api/affirmations/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    const raw = await response.text();
    const parsed = safeJsonParse(raw);

    // Handle non-OK responses (400, 500, etc.)
    if (!response.ok) {
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            throw new Error((parsed as { error: string }).error);
        }
        throw new Error('Affirmation refinement failed');
    }

    // Validate the shape of a successful response
    if (!isValidResponse(parsed)) {
        throw new Error(
            'Unexpected response from affirmation service: expected { options: string[] }',
        );
    }

    return parsed;
}
