'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Onboarding content
const ONBOARDING_SCREENS = [
    {
        id: 1,
        icon: '🎯',
        title: 'Your Mind, Your Choice',
        description: 'Type, speak, or upload the specific Thought you want to master.',
        theme: 'capture',
    },
    {
        id: 2,
        icon: '🔁',
        title: 'Repeat to Retain',
        description: 'Choose how often your Thought plays. You control the rhythm of your growth.',
        theme: 'rhythm',
    },
    {
        id: 3,
        icon: '✨',
        title: 'Engrain It',
        description: 'Layer your audio with calming rain or focus-beats. Turn background noise into a tool for transformation.',
        theme: 'imprint',
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [currentScreen, setCurrentScreen] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const isLastScreen = currentScreen === ONBOARDING_SCREENS.length - 1;

    const handleNext = () => {
        if (isLastScreen) {
            completeOnboarding();
        } else {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentScreen((prev) => prev + 1);
                setIsTransitioning(false);
            }, 200);
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const completeOnboarding = () => {
        // Mark onboarding as complete
        localStorage.setItem('engrainit_onboarding_complete', 'true');
        router.push('/app');
    };

    const goToScreen = (index: number) => {
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentScreen(index);
            setIsTransitioning(false);
        }, 200);
    };

    const screen = ONBOARDING_SCREENS[currentScreen];

    return (
        <main className="min-h-screen flex flex-col bg-parchment-200">
            {/* Skip button - top right */}
            <div className="flex justify-end p-6">
                <button
                    onClick={handleSkip}
                    className="text-forest-500 hover:text-forest-700 font-medium transition-colors"
                >
                    Skip
                </button>
            </div>

            {/* Main content */}
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

                {/* Screen content with transition */}
                <div
                    className={`text-center max-w-md transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
                        }`}
                >
                    {/* Icon */}
                    <div className="text-6xl mb-6">
                        {screen.icon}
                    </div>

                    {/* Title */}
                    <h1 className="font-serif text-3xl font-bold text-forest-700 mb-4">
                        {screen.title}
                    </h1>

                    {/* Description */}
                    <p className="text-lg text-forest-600 leading-relaxed">
                        {screen.description}
                    </p>
                </div>
            </div>

            {/* Bottom navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-parchment-100/80 backdrop-blur-sm border-t border-forest-100 p-6">
                <div className="max-w-md mx-auto">
                    {/* Step indicator dots */}
                    <div className="flex justify-center gap-2 mb-6">
                        {ONBOARDING_SCREENS.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToScreen(index)}
                                className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentScreen
                                        ? 'bg-amber-500 w-8'
                                        : 'bg-forest-300 hover:bg-forest-400'
                                    }`}
                                aria-label={`Go to screen ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Next/Get Started button */}
                    <button
                        onClick={handleNext}
                        className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 bg-forest-600 text-parchment-100 hover:bg-forest-700 hover:shadow-lg"
                    >
                        {isLastScreen ? 'Get Started' : 'Next'}
                    </button>
                </div>
            </div>
        </main>
    );
}
