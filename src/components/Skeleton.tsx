/**
 * Skeleton Loading Components
 * Provides visual feedback during content loading
 */

'use client';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

// Base skeleton with pulse animation
export function Skeleton({ className = '', style }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-parchment-300 rounded ${className}`}
            style={style}
        />
    );
}

// Card skeleton for loop cards in vault
export function CardSkeleton() {
    return (
        <div className="card p-6 space-y-4">
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />

            {/* Description */}
            <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Tags */}
            <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
            </div>
        </div>
    );
}

// Grid of card skeletons
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}

// Text input area skeleton
export function TextAreaSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <div className="flex gap-3">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
}

// Audio player skeleton
export function AudioPlayerSkeleton() {
    return (
        <div className="space-y-4 p-6 bg-parchment-100 rounded-xl">
            {/* Waveform placeholder */}
            <div className="flex items-center justify-center gap-1 h-16">
                {Array.from({ length: 20 }).map((_, i) => (
                    <Skeleton
                        key={i}
                        className="w-1"
                        style={{ height: `${Math.random() * 40 + 20}px` }}
                    />
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-12 w-12 rounded-full" />
            </div>
        </div>
    );
}

// Full page loading skeleton
export function PageSkeleton() {
    return (
        <div className="space-y-6 p-6 animate-pulse">
            {/* Header */}
            <Skeleton className="h-8 w-48" />

            {/* Content */}
            <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
            </div>
        </div>
    );
}
