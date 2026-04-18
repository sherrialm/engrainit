/**
 * Lightweight structured logger
 *
 * Consistent `[Tag] message` formatting for critical runtime flows.
 * Wraps console.* — no external dependencies, no platform integration.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Stripe', 'Checkout session created', { uid, plan });
 *   logger.error('TTS', 'All providers failed', { chars: text.length });
 */

type LogData = Record<string, unknown> | string | undefined;

function fmt(tag: string, message: string, data?: LogData): string {
    const base = `[${tag}] ${message}`;
    if (!data) return base;
    if (typeof data === 'string') return `${base} — ${data}`;
    try {
        return `${base} ${JSON.stringify(data)}`;
    } catch {
        return base;
    }
}

export const logger = {
    info(tag: string, message: string, data?: LogData) {
        console.log(fmt(tag, message, data));
    },
    warn(tag: string, message: string, data?: LogData) {
        console.warn(fmt(tag, message, data));
    },
    error(tag: string, message: string, data?: LogData) {
        console.error(fmt(tag, message, data));
    },
};
