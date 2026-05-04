import Stripe from 'stripe';
import { logger } from '@/lib/logger';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            logger.error('Stripe', 'STRIPE_SECRET_KEY is not set — billing routes will fail');
            throw new Error('Billing is not configured. Please contact support.');
        }
        _stripe = new Stripe(key);
    }
    return _stripe;
}
