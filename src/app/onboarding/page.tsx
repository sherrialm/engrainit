'use client';

/**
 * Onboarding — First-Time User Experience
 *
 * 3 screens explaining EngrainIt's mental training concept.
 * Skippable. Completion tracked in localStorage.
 * Final screen links directly to Generate Loop page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const SCREENS = [
    {
        icon: '🧠',
        title: 'What you repeat shapes who you become.',
        description: 'Your mind learns through repetition. EngrainIt helps you intentionally reinforce the thoughts that guide your focus, habits, and identity.',
    },
    {
        icon: '🔁',
        title: 'Train your mind through intelligent repetition.',
        description: 'Create mental loops for focus, confidence, learning, and daily alignment. Play them on repeat to engrain new patterns of thinking.',
    },
    {
        icon: '✨',
        title: 'Start Your First Loop',
        description: 'Generate a personalized loop in seconds. Choose how you feel, what you want to achieve, and let EngrainIt create a loop designed for you.',
        isCta: true,
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [current, setCurrent] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const isLast = current === SCREENS.length - 1;
    const screen = SCREENS[current];

    function advance() {
        if (isLast) {
            complete();
        } else {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrent(prev => prev + 1);
                setIsTransitioning(false);
            }, 200);
        }
    }

    function goTo(index: number) {
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrent(index);
            setIsTransitioning(false);
        }, 200);
    }

    function complete() {
        localStorage.setItem('engrainit_onboarding_complete', 'true');
        // Last screen = CTA → send to generate page
        router.push(isLast ? '/app/generate' : '/app');
    }

    return (
        <main className="min-h-screen flex flex-col bg-parchment-200">
            {/* Skip */}
            <div className="flex justify-end p-6">
                <button
                    onClick={() => {
                        localStorage.setItem('engrainit_onboarding_complete', 'true');
                        router.push('/app');
                    }}
                    className="text-forest-500 hover:text-forest-700 font-medium transition-colors"
                >
                    Skip
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
                {/* Logo */}
                <div className="mb-8">
                    <Image
                        src="/logo.png"
                        alt="EngrainIt"
                        width={80}
                        height={80}
                        className="rounded-full"
                    />
                </div>

                {/* Screen content */}
                <div
                    className={`text-center max-w-md transition-all duration-200 ${
                        isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                    }`}
                >
                    <div className="text-6xl mb-6">{screen.icon}</div>

                    <h1 className="font-serif text-2xl font-bold text-forest-700 mb-4 leading-tight">
                        {screen.title}
                    </h1>

                    <p className="text-base text-forest-600 leading-relaxed">
                        {screen.description}
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-parchment-100/80 backdrop-blur-sm border-t border-forest-100 p-6">
                <div className="max-w-md mx-auto">
                    {/* Dots */}
                    <div className="flex justify-center gap-2 mb-6">
                        {SCREENS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`h-3 rounded-full transition-all duration-300 ${
                                    i === current
                                        ? 'bg-amber-500 w-8'
                                        : 'bg-forest-300 hover:bg-forest-400 w-3'
                                }`}
                                aria-label={`Go to screen ${i + 1}`}
                            />
                        ))}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={advance}
                        className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 bg-forest-600 text-parchment-100 hover:bg-forest-700 hover:shadow-lg"
                    >
                        {isLast ? 'Create My First Loop' : 'Next'}
                    </button>
                </div>
            </div>
        </main>
    );
}
