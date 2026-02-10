import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About EngrainIt - Mental Engraving through Intentional Repetition',
    description: 'Learn how EngrainIt helps you memorize, build habits, and center yourself through the power of audio repetition.',
};

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-parchment-100">
            {/* Header */}
            <header className="border-b border-forest-100">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="font-serif text-2xl font-bold text-forest-700">
                        EngrainIt
                    </Link>
                    <Link href="/login" className="btn-primary">
                        Get Started
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="max-w-4xl mx-auto px-6 py-16 text-center">
                <h1 className="font-serif text-4xl md:text-5xl font-bold text-forest-700 mb-6">
                    Why EngrainIt?
                </h1>
                <p className="text-xl text-forest-600 max-w-2xl mx-auto">
                    Your mind learns through repetition. EngrainIt transforms any text, document, or recording
                    into rhythmic audio loops that embed deep in your memory.
                </p>
            </section>

            {/* How It Works */}
            <section className="bg-white py-16">
                <div className="max-w-5xl mx-auto px-6">
                    <h2 className="font-serif text-3xl font-bold text-center text-forest-700 mb-12">
                        How It Works
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-parchment-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">1️⃣</span>
                            </div>
                            <h3 className="font-serif text-xl font-semibold mb-3 text-ink-800">Create</h3>
                            <p className="text-forest-500">
                                Type text, upload a document (PDF, DOCX, TXT), or record your own voice.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-parchment-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">2️⃣</span>
                            </div>
                            <h3 className="font-serif text-xl font-semibold mb-3 text-ink-800">Loop</h3>
                            <p className="text-forest-500">
                                Your content becomes seamless audio that repeats with gapless precision.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-parchment-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">3️⃣</span>
                            </div>
                            <h3 className="font-serif text-xl font-semibold mb-3 text-ink-800">Engrain</h3>
                            <p className="text-forest-500">
                                With spaced repetition intervals, the content becomes part of your mental fabric.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="max-w-5xl mx-auto px-6 py-16">
                <h2 className="font-serif text-3xl font-bold text-center text-forest-700 mb-12">
                    Built For
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="card">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">🙏</span>
                            <div>
                                <h3 className="font-serif text-lg font-semibold mb-2 text-ink-800">Faith</h3>
                                <p className="text-forest-500">
                                    Memorize scripture, prayers, and spiritual affirmations. Let sacred words sink deep into your heart.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">📖</span>
                            <div>
                                <h3 className="font-serif text-lg font-semibold mb-2 text-ink-800">Study</h3>
                                <p className="text-forest-500">
                                    Master vocabulary, definitions, formulas, and key concepts through audio repetition.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">🎯</span>
                            <div>
                                <h3 className="font-serif text-lg font-semibold mb-2 text-ink-800">Vision</h3>
                                <p className="text-forest-500">
                                    Reinforce your goals, mission statements, and vision boards through daily listening.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">⚡</span>
                            <div>
                                <h3 className="font-serif text-lg font-semibold mb-2 text-ink-800">Habits</h3>
                                <p className="text-forest-500">
                                    Build new neural pathways with positive affirmations and habit-reinforcing mantras.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="bg-white py-16">
                <div className="max-w-5xl mx-auto px-6">
                    <h2 className="font-serif text-3xl font-bold text-center text-forest-700 mb-12">
                        Key Features
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">✍️</span>
                            <h3 className="font-semibold mb-2 text-ink-800">Text-to-Speech</h3>
                            <p className="text-sm text-forest-500">Natural voices with perfect pacing and pauses.</p>
                        </div>

                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">📄</span>
                            <h3 className="font-semibold mb-2 text-ink-800">Document Upload</h3>
                            <p className="text-sm text-forest-500">Import PDF, DOCX, or TXT files instantly.</p>
                        </div>

                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">🎙️</span>
                            <h3 className="font-semibold mb-2 text-ink-800">Voice Recording</h3>
                            <p className="text-sm text-forest-500">Record and loop your own voice for personal impact.</p>
                        </div>

                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">🔁</span>
                            <h3 className="font-semibold mb-2 text-ink-800">Gapless Looping</h3>
                            <p className="text-sm text-forest-500">Seamless repetition with under 50ms gaps.</p>
                        </div>

                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">⏱️</span>
                            <h3 className="font-semibold mb-2 text-ink-800">Spaced Repetition</h3>
                            <p className="text-sm text-forest-500">Configurable intervals for optimal memory encoding.</p>
                        </div>

                        <div className="p-6 bg-parchment-100 rounded-xl">
                            <span className="text-2xl mb-3 block">🗃️</span>
                            <h3 className="font-semibold mb-2 text-ink-800">The Vault</h3>
                            <p className="text-sm text-forest-500">Organize loops by category and access anytime.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-4xl mx-auto px-6 py-16 text-center">
                <h2 className="font-serif text-3xl font-bold text-forest-700 mb-4">
                    Ready to Start Engraining?
                </h2>
                <p className="text-forest-500 mb-8 max-w-lg mx-auto">
                    Join thousands who are transforming their minds through intentional repetition.
                </p>
                <Link href="/login" className="btn-primary text-lg px-8 py-3">
                    Get Started Free
                </Link>
            </section>

            {/* Footer */}
            <footer className="border-t border-forest-100 py-8">
                <div className="max-w-5xl mx-auto px-6 text-center text-sm text-forest-400">
                    © 2026 EngrainIt. All rights reserved.
                </div>
            </footer>
        </main>
    );
}
