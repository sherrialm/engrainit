import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy - EngrainIt',
    description: 'How EngrainIt protects your data and privacy.',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-parchment-200 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <Link href="/" className="text-forest-400 hover:text-forest-600 text-sm">
                        ← Back to Home
                    </Link>
                    <h1 className="font-serif text-4xl font-bold text-forest-700 mt-4 mb-2">
                        Privacy & Data Safety
                    </h1>
                    <p className="text-forest-500">
                        Last updated: February 2026
                    </p>
                </div>

                {/* Content */}
                <div className="card space-y-8">
                    {/* What we collect */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            🔒 What We Collect
                        </h2>
                        <ul className="space-y-2 text-forest-600">
                            <li className="flex gap-2">
                                <span>•</span>
                                <span><strong>Email address</strong> — Used only for account authentication</span>
                            </li>
                            <li className="flex gap-2">
                                <span>•</span>
                                <span><strong>Audio loops</strong> — Your generated or recorded audio files</span>
                            </li>
                            <li className="flex gap-2">
                                <span>•</span>
                                <span><strong>Text content</strong> — The text you type or upload for speech generation</span>
                            </li>
                        </ul>
                    </section>

                    {/* Where data goes */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            📍 Where Your Data Goes
                        </h2>
                        <p className="text-forest-600 mb-3">
                            Your data is stored securely in <strong>Google Firebase</strong>,
                            a trusted cloud platform used by millions of applications worldwide.
                        </p>
                        <ul className="space-y-2 text-forest-600">
                            <li className="flex gap-2">
                                <span>✅</span>
                                <span>Data is <strong>encrypted in transit</strong> (HTTPS) and <strong>at rest</strong></span>
                            </li>
                            <li className="flex gap-2">
                                <span>✅</span>
                                <span>Only <strong>you</strong> can access your loops and recordings</span>
                            </li>
                            <li className="flex gap-2">
                                <span>✅</span>
                                <span>Firebase security rules restrict access to authenticated users only</span>
                            </li>
                        </ul>
                    </section>

                    {/* Will data be sold */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            🚫 Will Your Data Be Sold?
                        </h2>
                        <div className="bg-forest-50 border border-forest-200 rounded-lg p-4">
                            <p className="text-forest-700 font-semibold text-lg">
                                Absolutely not.
                            </p>
                            <p className="text-forest-600 mt-2">
                                We will <strong>never</strong> sell, share, or distribute your personal data,
                                recordings, or text content to any third party. Your thoughts are yours alone.
                            </p>
                        </div>
                    </section>

                    {/* Security */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            🛡️ Security Measures
                        </h2>
                        <ul className="space-y-2 text-forest-600">
                            <li className="flex gap-2">
                                <span>•</span>
                                <span>Firebase Authentication with secure password hashing</span>
                            </li>
                            <li className="flex gap-2">
                                <span>•</span>
                                <span>Firestore security rules enforce user-level data isolation</span>
                            </li>
                            <li className="flex gap-2">
                                <span>•</span>
                                <span>No sensitive data stored in browser local storage</span>
                            </li>
                            <li className="flex gap-2">
                                <span>•</span>
                                <span>API keys are server-side only — never exposed to the client</span>
                            </li>
                        </ul>
                    </section>

                    {/* Is it free */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            💰 Is EngrainIt Free?
                        </h2>
                        <p className="text-forest-600">
                            EngrainIt offers a <strong>free tier</strong> that includes core functionality —
                            create loops, listen, and build your reinforcement practice at no cost.
                        </p>
                        <p className="text-forest-500 mt-2 text-sm">
                            A paid <strong>Pro</strong> subscription is available for users who want expanded
                            limits, additional voices, and advanced features. Core functionality
                            will always remain accessible on the free tier.
                        </p>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="font-serif text-2xl font-semibold text-forest-700 mb-3">
                            📧 Questions?
                        </h2>
                        <p className="text-forest-600">
                            If you have any concerns about your data or privacy,
                            please reach out to the EngrainIt team.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <Link href="/" className="text-forest-500 hover:text-forest-700 text-sm">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
