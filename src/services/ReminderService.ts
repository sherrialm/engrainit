/**
 * ReminderService
 *
 * Client-side "best effort" gentle reminders.
 * Uses Notification API when available, localStorage for scheduling,
 * and provides an in-app fallback check.
 */

const LS_NEXT_REMINDER = 'engrainit_next_reminder';

// ── Permission ────────────────────────────────────────────────

export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export async function requestNotificationPermission(): Promise<NotificationStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }

    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const result = await Notification.requestPermission();
    return result as NotificationStatus;
}

export function getNotificationStatus(): NotificationStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission as NotificationStatus;
}

// ── Scheduling ────────────────────────────────────────────────

/**
 * Set when the next reminder should fire (stored in localStorage).
 * Call this after each reminder is shown, or when user sets/changes time.
 */
export function scheduleNextReminder(timeLocal: string): void {
    if (typeof window === 'undefined') return;

    const [hours, minutes] = timeLocal.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    // If time already passed today, schedule for tomorrow
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    localStorage.setItem(LS_NEXT_REMINDER, next.toISOString());
}

/**
 * Check if a reminder is due (i.e., current time >= scheduled time).
 * Returns true once, then reschedules for the next day.
 */
export function checkAndConsumeReminder(timeLocal: string): boolean {
    if (typeof window === 'undefined') return false;

    const stored = localStorage.getItem(LS_NEXT_REMINDER);
    if (!stored) {
        // First time — schedule from now
        scheduleNextReminder(timeLocal);
        return false;
    }

    const scheduledAt = new Date(stored);
    const now = new Date();

    if (now >= scheduledAt) {
        // Due! Reschedule for next occurrence
        scheduleNextReminder(timeLocal);
        return true;
    }

    return false;
}

// ── Show notification ─────────────────────────────────────────

export function showReminderNotification(modeLabel = 'Night'): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        new Notification('Time to Engrain', {
            body: `Ready for a few minutes of ${modeLabel.toLowerCase()} reinforcement? Tap to begin.`,
            icon: '/icons/icon-192.png',
            tag: 'engrainit-reminder', // prevents duplicates
        });
    } catch (err) {
        console.warn('[Reminder] Failed to show notification:', err);
    }
}

// ── Same-session timer (best effort) ──────────────────────────

let sessionTimer: NodeJS.Timeout | null = null;

/**
 * Set a same-session setTimeout for when the reminder should fire.
 * If the app stays open past the reminder time, it will trigger.
 */
export function setSameSessionTimer(timeLocal: string, modeLabel = 'Night'): void {
    clearSameSessionTimer();

    if (typeof window === 'undefined') return;

    const [hours, minutes] = timeLocal.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If already past, target tomorrow
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    const ms = target.getTime() - now.getTime();

    sessionTimer = setTimeout(() => {
        showReminderNotification(modeLabel);
        // Reschedule for next day
        scheduleNextReminder(timeLocal);
    }, ms);
}

export function clearSameSessionTimer(): void {
    if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
    }
}
