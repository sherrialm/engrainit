'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
    onComplete: () => void;
    duration?: number; // milliseconds
}

export default function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
    const [showLogo, setShowLogo] = useState(false);
    const [showText, setShowText] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Sequence the animations
        const logoTimer = setTimeout(() => setShowLogo(true), 100);
        const textTimer = setTimeout(() => setShowText(true), 600);
        const fadeTimer = setTimeout(() => setFadeOut(true), duration - 500);
        const completeTimer = setTimeout(onComplete, duration);

        return () => {
            clearTimeout(logoTimer);
            clearTimeout(textTimer);
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete, duration]);

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-parchment-200 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'
                }`}
        >
            {/* Logo with fade-in animation */}
            <div
                className={`transition-all duration-700 ${showLogo
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-75'
                    }`}
            >
                <Image
                    src="/logo.png"
                    alt="EngrainIt"
                    width={140}
                    height={140}
                    priority
                />
            </div>

            {/* Title text */}
            <h1
                className={`mt-6 font-serif text-4xl font-bold text-forest-700 transition-all duration-700 ${showText
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                    }`}
            >
                EngrainIt
            </h1>

            {/* Tagline */}
            <p
                className={`mt-2 text-forest-500 transition-all duration-700 delay-200 ${showText
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                    }`}
            >
                Mental Engraving
            </p>
        </div>
    );
}
