'use client';

import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { startProCheckout, BillingPlan } from '@/services/BillingService';

// ── Props ─────────────────────────────────────────────────────

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultPlan?: BillingPlan;
}

// ── Component ─────────────────────────────────────────────────

export default function PricingModal({
    isOpen,
    onClose,
    defaultPlan = 'monthly',
}: PricingModalProps) {
    const [selected, setSelected] = useState<BillingPlan>(defaultPlan);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleContinue = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await startProCheckout(selected);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to start checkout';
            setError(message);
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="text-center mb-5">
                <h3 className="font-serif text-xl font-bold text-forest-700 mb-1">
                    Choose your Pro plan
                </h3>
                <p className="text-sm text-forest-500">
                    Protect your reinforcement momentum.
                </p>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Monthly */}
                <button
                    type="button"
                    onClick={() => setSelected('monthly')}
                    className={`relative rounded-xl p-4 border-2 text-left transition-all ${selected === 'monthly'
                            ? 'border-forest-600 bg-forest-50 shadow-md'
                            : 'border-forest-100 bg-parchment-100 hover:border-forest-200'
                        }`}
                >
                    <p className="font-serif font-bold text-forest-700 text-sm mb-0.5">
                        Pro Monthly
                    </p>
                    <p className="text-xs text-forest-500">
                        Cancel anytime
                    </p>
                    {selected === 'monthly' && (
                        <span className="absolute top-2 right-2 text-forest-600 text-sm">✓</span>
                    )}
                </button>

                {/* Yearly */}
                <button
                    type="button"
                    onClick={() => setSelected('yearly')}
                    className={`relative rounded-xl p-4 border-2 text-left transition-all ${selected === 'yearly'
                            ? 'border-forest-600 bg-forest-50 shadow-md'
                            : 'border-forest-100 bg-parchment-100 hover:border-forest-200'
                        }`}
                >
                    <span className="absolute -top-2.5 right-3 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Best value
                    </span>
                    <p className="font-serif font-bold text-forest-700 text-sm mb-0.5">
                        Pro Yearly
                    </p>
                    <p className="text-xs text-forest-500">
                        Best value
                    </p>
                    {selected === 'yearly' && (
                        <span className="absolute top-2 right-2 text-forest-600 text-sm">✓</span>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <p className="text-red-500 text-xs text-center mb-3">{error}</p>
            )}

            {/* CTA */}
            <button
                type="button"
                onClick={handleContinue}
                disabled={isLoading}
                className="w-full py-3 bg-forest-600 text-parchment-100 rounded-xl font-bold text-base hover:bg-forest-700 transition-colors shadow-lg shadow-forest-200 disabled:opacity-50"
            >
                {isLoading ? 'Redirecting to checkout…' : 'Continue to checkout'}
            </button>
            <p className="text-[11px] text-forest-400 text-center mt-2">
                Secure checkout powered by Stripe.
            </p>
        </Modal>
    );
}
