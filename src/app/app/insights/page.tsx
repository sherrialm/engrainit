'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getReinforcementStats, ReinforcementStats } from '@/services/InsightsService';
import { getCoachInsights, generateCoachMessage, getActionBadge, CoachInsight } from '@/services/CoachService';
import { generateRoutine, Routine } from '@/services/RoutineService';
import { useRoutineStore } from '@/stores/routineStore';
import { TEMPLATES } from '@/config/templates';
import { IDENTITY_MODES } from '@/config/identityModes';
import { generateShareData, ShareData } from '@/services/ShareService';
import ShareProgressModal from '@/components/ShareProgressModal';

// ── Day labels ────────────────────────────────────────────────

function getLast7DayLabels(): string[] {
    const labels: string[] = [];
    const d = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
        const day = new Date(d);
        day.setDate(day.getDate() - i);
        labels.push(i === 0 ? 'Today' : dayNames[day.getDay()]);
    }
    return labels;
}

// ── Encouragement ─────────────────────────────────────────────

function getEncouragement(stats: ReinforcementStats): string {
    if (stats.currentStreak >= 7) return 'Your identity practice is strong. Keep building.';
    if (stats.currentStreak >= 3) return 'Consistency builds identity. You\'re on a roll.';
    if (stats.completedSessions > 0 && stats.currentStreak === 0)
        return 'Welcome back. Every session counts.';
    if (stats.completedSessions > 0) return 'Every repetition deepens the path. Keep going.';
    return 'Start your first session to begin tracking your journey.';
}

// ── Page ──────────────────────────────────────────────────────

export default function InsightsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<ReinforcementStats | null>(null);
    const [coach, setCoach] = useState<CoachInsight | null>(null);
    const [routine, setRoutine] = useState<Routine | null>(null);
    const [loading, setLoading] = useState(true);
    const [shareData, setShareData] = useState<ShareData | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const { activeRoutine, currentDay, completedDays, setRoutine: saveRoutine, completeDay } = useRoutineStore();

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }
        Promise.all([
            getReinforcementStats(user.uid),
            getCoachInsights(user.uid),
        ])
            .then(([s, c]) => {
                setStats(s);
                setCoach(c);
                setRoutine(generateRoutine(c));
            })
            .catch((err) => console.warn('[Insights] Failed to load:', err))
            .finally(() => setLoading(false));

        // Fetch share data
        generateShareData(user.uid)
            .then(setShareData)
            .catch(() => { });
    }, [user?.uid]);

    // Use active routine if one is saved, otherwise the freshly generated one
    const displayRoutine = activeRoutine || routine;
    const displayDay = activeRoutine ? currentDay : 1;
    const displayCompleted = activeRoutine ? completedDays : [];

    const handleStartSession = () => {
        if (!displayRoutine) return;
        const session = displayRoutine.sessions.find((s) => s.day === displayDay);
        if (!session) return;

        // Save routine if not already active
        if (!activeRoutine && routine) {
            saveRoutine(routine);
        }

        // Build query params to pass to /app
        const params = new URLSearchParams();
        params.set('mode', session.modeId);
        params.set('interval', '0'); // continuous

        if (session.templateId) {
            const template = TEMPLATES.find((t) => t.id === session.templateId);
            if (template) {
                params.set('templateText', template.text);
                if (template.recommendedVoiceId) {
                    params.set('voiceId', template.recommendedVoiceId);
                }
            }
        }

        // Mark day as completed
        completeDay(displayDay);

        router.push(`/app?${params.toString()}`);
    };

    const dayLabels = getLast7DayLabels();
    const maxDayCount = stats ? Math.max(...stats.sessionsLast7Days, 1) : 1;

    const favoriteMode = stats?.favoriteModeId
        ? IDENTITY_MODES.find((m) => m.id === stats.favoriteModeId)
        : undefined;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-2">
                    📈 Your Reinforcement Journey
                </h2>
                <p className="text-forest-500">
                    Track your progress and reinforce your identity.
                </p>
                <Link href="/app" className="inline-block mt-3 text-sm text-forest-500 hover:text-forest-700 font-medium">
                    ← Back to Dashboard
                </Link>
                {shareData && (
                    <button
                        type="button"
                        onClick={() => setIsShareOpen(true)}
                        className="block mx-auto mt-2 text-xs font-medium text-forest-600 bg-parchment-300 hover:bg-forest-700 hover:text-parchment-100 px-4 py-1.5 rounded-full transition-all"
                    >
                        📤 Share Progress
                    </button>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-parchment-300 rounded-xl p-5 animate-pulse h-28" />
                    ))}
                </div>
            )}

            {/* No user */}
            {!loading && !user && (
                <div className="text-center py-16">
                    <p className="text-forest-500 mb-4">Sign in to see your insights.</p>
                    <Link href="/login" className="btn-primary inline-block">
                        Sign In
                    </Link>
                </div>
            )}

            {/* Stats */}
            {!loading && stats && (
                <>
                    {/* Identity Coach Card */}
                    {coach && (
                        <div className="bg-forest-50 rounded-xl p-5 border border-forest-200 mb-8">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🧭</span>
                                <div className="flex-1">
                                    <h3 className="font-serif text-lg font-semibold text-forest-700 mb-1">
                                        Identity Coach
                                    </h3>
                                    <p className="text-sm text-forest-600 leading-relaxed">
                                        &ldquo;{generateCoachMessage(coach)}&rdquo;
                                    </p>
                                    <span className="inline-block mt-2 text-xs font-medium bg-forest-100 text-forest-700 px-3 py-1 rounded-full">
                                        {getActionBadge(coach.suggestedAction)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Guided Routine Card */}
                    {displayRoutine && (
                        <div className="bg-parchment-200 rounded-xl p-5 border border-forest-100 mb-8">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-serif text-lg font-semibold text-forest-700">
                                        🗓 {displayRoutine.title}
                                    </h3>
                                    <p className="text-xs text-forest-500 mt-0.5">
                                        {displayRoutine.days}-Day Routine
                                        {displayCompleted.length > 0 && (
                                            <span className="ml-2 text-forest-400">
                                                • {displayCompleted.length}/{displayRoutine.days} completed
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {activeRoutine && (
                                    <button
                                        type="button"
                                        onClick={() => useRoutineStore.getState().clearRoutine()}
                                        className="text-xs text-forest-400 hover:text-red-500"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            <div className="space-y-1.5 mb-4">
                                {displayRoutine.sessions.map((s) => {
                                    const mode = IDENTITY_MODES.find((m) => m.id === s.modeId);
                                    const isDone = displayCompleted.includes(s.day);
                                    const isCurrent = s.day === displayDay && !isDone;

                                    return (
                                        <div
                                            key={s.day}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isCurrent
                                                ? 'bg-forest-100 border border-forest-200 font-medium'
                                                : isDone
                                                    ? 'text-forest-400 line-through'
                                                    : 'text-forest-600'
                                                }`}
                                        >
                                            <span className="text-xs w-5">
                                                {isDone ? '✅' : isCurrent ? '▶️' : `${s.day}`}
                                            </span>
                                            <span>{mode?.icon} {mode?.label}</span>
                                            <span className="text-xs text-forest-400 ml-auto">
                                                {s.recommendedDurationMin}m
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={handleStartSession}
                                className="w-full py-2.5 bg-forest-600 text-parchment-100 rounded-xl font-bold hover:bg-forest-700 transition-colors shadow-lg shadow-forest-200"
                            >
                                ▶️ Start Day {displayDay} Session
                            </button>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            icon="🔥"
                            label="Reinforcement Days"
                            value={stats.currentStreak}
                            sub={`Longest: ${stats.longestStreak}`}
                        />
                        <StatCard
                            icon="🧠"
                            label="Minutes Engrained"
                            value={stats.totalMinutesEngrained}
                        />
                        <StatCard
                            icon="✅"
                            label="Sessions Completed"
                            value={stats.completedSessions}
                            sub={`${stats.totalSessions} total`}
                        />
                        <StatCard
                            icon={favoriteMode?.icon || '⭐'}
                            label="Favorite Mode"
                            value={favoriteMode?.label || '—'}
                        />
                    </div>

                    {/* Weekly Activity */}
                    <div className="bg-parchment-200 rounded-xl p-6 border border-forest-100 mb-8">
                        <h3 className="font-serif text-lg font-semibold text-forest-700 mb-4">
                            Last 7 Days
                        </h3>
                        <div className="flex items-end justify-between gap-2 h-32">
                            {stats.sessionsLast7Days.map((count, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-forest-500 font-medium">
                                        {count > 0 ? count : ''}
                                    </span>
                                    <div
                                        className="w-full rounded-t-md transition-all duration-500"
                                        style={{
                                            height: `${Math.max((count / maxDayCount) * 100, count > 0 ? 8 : 3)}%`,
                                            backgroundColor: count > 0 ? '#2d5016' : '#e8e0d4',
                                        }}
                                    />
                                    <span className="text-[10px] text-forest-400 mt-0.5">
                                        {dayLabels[i]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Encouragement */}
                    <div className="bg-forest-50 rounded-xl p-5 border border-forest-100 text-center">
                        <p className="text-sm text-forest-600 italic">
                            &ldquo;{getEncouragement(stats)}&rdquo;
                        </p>
                    </div>
                </>
            )}

            {/* Share Modal */}
            <ShareProgressModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                data={shareData}
            />
        </div>
    );
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
    sub,
}: {
    icon: string;
    label: string;
    value: string | number;
    sub?: string;
}) {
    return (
        <div className="bg-parchment-200 rounded-xl p-5 border border-forest-100 text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-2xl font-bold text-forest-700">{value}</p>
            <p className="text-xs text-forest-500 mt-1">{label}</p>
            {sub && <p className="text-[10px] text-forest-400 mt-0.5">{sub}</p>}
        </div>
    );
}
