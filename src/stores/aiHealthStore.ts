import { create } from 'zustand';

export type AIStatus = 'checking' | 'ok' | 'no_key' | 'api_error' | 'unknown';

interface AIHealthState {
    status: AIStatus;
    keyPresent: boolean;
    latencyMs: number | null;
    error: string | null;
    lastChecked: string | null;
    isChecking: boolean;

    checkHealth: () => Promise<void>;
    isHealthy: () => boolean;
}

export const useAIHealthStore = create<AIHealthState>((set, get) => ({
    status: 'unknown',
    keyPresent: false,
    latencyMs: null,
    error: null,
    lastChecked: null,
    isChecking: false,

    checkHealth: async () => {
        // Don't re-check if already checking
        if (get().isChecking) return;

        set({ isChecking: true, status: 'checking' });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch('/api/ai/health', { signal: controller.signal });
            clearTimeout(timeoutId);

            const data = await res.json();

            console.log('[AI Health]', data.status, data.latencyMs ? `${data.latencyMs}ms` : '', data.error || '');

            set({
                status: data.status || 'unknown',
                keyPresent: data.keyPresent ?? false,
                latencyMs: data.latencyMs ?? null,
                error: data.error || data.errorMessage || null,
                lastChecked: data.timestamp || new Date().toISOString(),
                isChecking: false,
            });
        } catch (err: any) {
            console.error('[AI Health] Check failed:', err.message);
            set({
                status: 'api_error',
                error: err.name === 'AbortError' ? 'Health check timed out' : err.message,
                isChecking: false,
                lastChecked: new Date().toISOString(),
            });
        }
    },

    isHealthy: () => get().status === 'ok',
}));
