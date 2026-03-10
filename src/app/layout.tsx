import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import ConsentBanner from '@/components/ConsentBanner';
import PWARegister from '@/components/PWARegister';

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
            <head>
                <link rel="manifest" href="/manifest.webmanifest" />
                <meta name="theme-color" content="#2d5016" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
            </head>
            <body className="min-h-screen bg-parchment-200 antialiased">
                <ToastProvider>
                    {children}
                    <ConsentBanner />
                    <PWARegister />
                </ToastProvider>
            </body>
        </html>
    );
}
