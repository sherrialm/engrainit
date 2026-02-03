import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center space-y-8">
                {/* Logo / Title */}
                <h1 className="font-serif text-5xl md:text-6xl font-bold text-ink-900 dark:text-paper-100">
                    EngrainIt
                </h1>

                {/* Tagline */}
                <p className="text-xl md:text-2xl text-ink-600 dark:text-paper-400 font-light">
                    Mental Engraving through Intentional Repetition
                </p>

                {/* Description */}
                <p className="text-ink-500 dark:text-paper-500 max-w-md mx-auto">
                    Transform your words into rhythmic mental imprints.
                    Type, speak, or upload — then loop until it becomes part of you.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <Link href="/login" className="btn-primary text-center">
                        Get Started
                    </Link>
                    <Link href="/about" className="btn-secondary text-center">
                        Learn More
                    </Link>
                </div>

                {/* Features Preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                    <div className="card text-center">
                        <div className="text-3xl mb-3">✍️</div>
                        <h3 className="font-serif text-lg font-semibold mb-2">Text to Loop</h3>
                        <p className="text-sm text-ink-500 dark:text-paper-500">
                            Type your affirmation, verse, or concept and hear it spoken.
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="text-3xl mb-3">🎙️</div>
                        <h3 className="font-serif text-lg font-semibold mb-2">Voice Capture</h3>
                        <p className="text-sm text-ink-500 dark:text-paper-500">
                            Record your own voice for a personal touch.
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="text-3xl mb-3">🔁</div>
                        <h3 className="font-serif text-lg font-semibold mb-2">Smart Repetition</h3>
                        <p className="text-sm text-ink-500 dark:text-paper-500">
                            Spaced intervals for deeper mental engraving.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-8 text-center text-sm text-ink-400 dark:text-paper-600">
                © 2026 EngrainIt. All rights reserved.
            </footer>
        </main>
    );
}
