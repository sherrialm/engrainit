import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
    title: 'EngrainIt - Mental Engraving through Intentional Repetition',
    description: 'Transform spoken, typed, or uploaded content into rhythmic mental imprints for memorization, habit-shifting, and spiritual centering.',
    keywords: ['memorization', 'audio loop', 'spaced repetition', 'mental engraving', 'affirmations'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="min-h-screen bg-paper-100 dark:bg-ink-900 antialiased">
                <ToastProvider>
                    {children}
                </ToastProvider>
            </body>
        </html>
    );
}
