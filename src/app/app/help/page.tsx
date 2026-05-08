'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
    question: string;
    answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
    {
        question: 'What is a loop?',
        answer:
            'A loop is a short, repeatable audio message designed to train your thinking. You create one by typing or speaking a thought, goal, or truth — then EngrainIt turns it into audio you can listen to on repeat. The more you hear it, the deeper it sinks.',
    },
    {
        question: 'What is a session?',
        answer:
            'A session is a playlist of your saved loops that plays in order and repeats. Think of it as your personal mental training routine — you choose the loops, set the order, and press play. Sessions help you build consistency by grouping your most important loops together.',
    },
    {
        question: 'What is the Vault?',
        answer:
            'The Vault is your personal library of saved loops. Every loop you create and save goes here. You can browse, play, organize, and add loops from the Vault into your sessions.',
    },
    {
        question: 'What is Daily Alignment?',
        answer:
            'Daily Alignment is your daily mental check-in. It\'s a short practice — usually just a few minutes — where you listen to your loops or a session to start your day with intention. Completing it builds your streak and helps you stay consistent.',
    },
    {
        question: 'How often should I use EngrainIt?',
        answer:
            'For best results, use EngrainIt daily — even just 2–5 minutes in the morning. Repetition is the key to mental training. The more consistently you show up, the more natural your new thought patterns become. That said, any amount of practice is better than none.',
    },
    {
        question: 'Does EngrainIt replace prayer, therapy, coaching, or medical care?',
        answer:
            'No. EngrainIt is a support tool for repetition, reflection, and mental training. It is not a substitute for professional therapy, counseling, medical treatment, or any form of licensed care. If you are experiencing a mental health crisis, please reach out to a qualified professional.',
    },
];

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
    return (
        <svg
            className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

export default function HelpPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    function toggle(index: number) {
        setOpenIndex(openIndex === index ? null : index);
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <section className="text-center space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-800">
                    Help &amp; FAQ
                </h2>
                <p className="text-sm text-forest-500">
                    Everything you need to know about using EngrainIt.
                </p>
            </section>

            {/* FAQ Accordion */}
            <section className="space-y-2" id="faq-list">
                {FAQ_ITEMS.map((item, index) => {
                    const isOpen = openIndex === index;
                    return (
                        <div
                            key={index}
                            className="bg-parchment-100 rounded-xl border border-forest-100 overflow-hidden transition-colors"
                        >
                            <button
                                onClick={() => toggle(index)}
                                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-parchment-200/50 transition-colors"
                                id={`faq-toggle-${index}`}
                                aria-expanded={isOpen}
                            >
                                <span className="font-serif text-base font-semibold text-forest-700">
                                    {item.question}
                                </span>
                                <ChevronIcon open={isOpen} className="w-5 h-5 text-forest-400 flex-shrink-0" />
                            </button>
                            {isOpen && (
                                <div className="px-5 pb-4">
                                    <p className="text-sm text-forest-600 leading-relaxed">
                                        {item.answer}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>

            {/* Getting Started Reminder */}
            <section className="bg-gradient-to-br from-forest-700 to-forest-800 rounded-2xl p-6 text-parchment-100 space-y-3">
                <h3 className="font-serif text-lg font-bold">Quick Start</h3>
                <ol className="list-decimal list-inside text-sm text-parchment-200 space-y-1.5">
                    <li>Create a loop from a thought, goal, or truth</li>
                    <li>Save it to your Vault</li>
                    <li>Build or start a Session</li>
                    <li>Repeat daily to build your practice</li>
                </ol>
                <Link
                    href="/app/generate"
                    className="inline-flex items-center gap-2 text-sm font-semibold bg-parchment-100/20 hover:bg-parchment-100/30 transition-colors px-4 py-2 rounded-full mt-2"
                >
                    Create Your First Loop →
                </Link>
            </section>

            {/* Trust + Safety Disclaimer */}
            <section className="border-t border-forest-100 pt-6 space-y-3" id="safety-disclaimer">
                <div className="bg-parchment-100 rounded-xl border border-forest-100 p-5 space-y-2">
                    <h3 className="font-serif text-sm font-bold text-forest-700 uppercase tracking-wide">
                        Important Notice
                    </h3>
                    <p className="text-sm text-forest-600 leading-relaxed">
                        EngrainIt is a mental training and repetition tool. It does not diagnose, treat, or replace professional care.
                        If you are experiencing a mental health crisis, please contact a licensed professional or crisis helpline.
                    </p>
                    <p className="text-xs text-forest-400">
                        EngrainIt is designed to support your personal growth through intentional repetition and reflection.
                        It is not a substitute for therapy, counseling, medical treatment, or any form of licensed care.
                    </p>
                </div>
            </section>

            {/* Back to Dashboard */}
            <div className="text-center">
                <Link
                    href="/app"
                    className="inline-flex items-center gap-1 text-sm font-medium text-forest-500 hover:text-forest-700 transition-colors"
                >
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
