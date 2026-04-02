'use client';

import { useEffect } from 'react';
import { useAIHealthStore } from '@/stores/aiHealthStore';

/**
 * AI Status Indicator — small dot + label in the app header.
 * Shows AI system health without being intrusive.
 *
 * - ok        → green dot, "AI Ready" (fades out after 3 seconds)
 * - no_key    → amber dot, "AI not configured"
 * - api_error → red dot, "AI unavailable"
 * - checking  → pulsing dot
 * - unknown   → hidden
 */
export default function AIStatusIndicator() {
    const { status, checkHealth, error } = useAIHealthStore();

    // Run health check once on mount
    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    if (status === 'unknown') return null;

    const config: Record<string, { dot: string; label: string; fade?: boolean }> = {
        checking: { dot: 'bg-forest-400 animate-pulse', label: 'Checking AI...' },
        ok:       { dot: 'bg-green-500', label: 'AI Ready', fade: true },
        no_key:   { dot: 'bg-amber-500', label: 'AI not configured' },
        api_error:{ dot: 'bg-red-500', label: 'AI unavailable' },
    };

    const c = config[status] || config.api_error;

    return (
        <div
            className={`flex items-center gap-1.5 text-[10px] text-forest-500 transition-opacity ${
                c.fade ? 'animate-fade-out' : ''
            }`}
            title={error || undefined}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </div>
    );
}
