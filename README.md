# EngrainIt

**Mental Engraving through Intentional Repetition**

EngrainIt is a web application for mental training through structured audio repetition. It combines AI-generated content, text-to-speech synthesis, spaced repetition, and daily ritual sessions to help users memorize, reinforce beliefs, and build cognitive habits over time.

---

## Features

### Core
- ✍️ **Text-to-Loop** — Type text and convert it to spoken audio loops with natural pacing
- 🎙️ **Voice Recording** — Record your own voice and loop it for personal reinforcement
- 📄 **Document Upload** — Import PDF, DOCX, or TXT files and turn them into audio loops *(Core/Pro)*
- 🔁 **Gapless Looping** — Seamless audio repetition with spaced repetition intervals
- 🗃️ **The Vault** — Organize and access saved loops by category

### AI-Powered
- 🤖 **AI Loop Generation** — Generate affirmations, mantras, or study loops from a prompt (Gemini)
- 🧠 **Memory Aid Generation** — AI-created memory aids for study topics
- ☀️ **Daily Briefing** — AI-generated personalized morning summary

### Sessions & Habits
- 🌅 **Morning Ritual** — Structured daily mental alignment session
- 🎯 **Session Types** — Focus, study, confidence, calm, and night sessions *(Core/Pro)*
- 📈 **Habit & Progress Tracking** — Set habits and track daily check-ins

### Billing
- 💳 **Subscription Tiers** — Free, Core ($4.99/mo), and Pro ($9.99/mo) tiers
- 🔐 **Stripe Checkout** — Secure subscription management via Stripe
- ⚙️ **Billing Portal** — Self-service subscription management

> **Note:** Billing infrastructure is implemented. Paid tier availability may depend on launch status. See the [`src/config/tiers.ts`](src/config/tiers.ts) for current tier limits.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| State | Zustand |
| Auth & Database | Firebase (Auth, Firestore, Storage) |
| AI | Google Gemini (`@google/generative-ai`) |
| TTS | ElevenLabs (primary) / Google Cloud TTS (fallback) |
| Billing | Stripe |
| Document Parsing | `mammoth` (DOCX), `pdf-parse` (PDF) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project (Auth + Firestore + Storage enabled)
- At least one TTS API key (ElevenLabs or Google Cloud TTS)
- Google AI (Gemini) API key for AI features
- Stripe account for billing features

### Installation

```bash
git clone https://github.com/sherrialm/engrainit.git
cd engrainit
npm install
cp .env.example .env.local
# Fill in .env.local with your credentials (see Environment Variables below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Copy `.env.example` to `.env.local` and populate with your values. Below is a summary of all required and optional variables.

### Firebase – Client (public)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

### Firebase Admin – Server-only

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Optional | JSON service account credential. Not needed when using Application Default Credentials (e.g., on Google Cloud). |

### AI (Gemini)

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_AI_API_KEY` | Required | Gemini API key for AI generation and health checks |

### TTS – Server-only

At least one TTS key is required for audio synthesis. ElevenLabs is tried first; Google Cloud TTS is the automatic fallback.

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | Optional | Primary TTS provider (higher quality) |
| `GOOGLE_CLOUD_TTS_API_KEY` | Optional | Fallback TTS provider (requires Cloud TTS API enabled) |

### Stripe – Server-only

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Required for billing | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_PRICE_PRO_MONTHLY` | Required for billing | Stripe Price ID for Pro monthly plan |
| `STRIPE_PRICE_PRO_YEARLY` | Required for billing | Stripe Price ID for Pro yearly plan |
| `STRIPE_WEBHOOK_SECRET` | Required for billing | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PORTAL_RETURN_URL` | Optional | Override return URL from Stripe billing portal |

### App / Feature Flags

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL of the deployed app (used in Stripe redirect URLs) |
| `NEXT_PUBLIC_ALLOW_SIGNUPS` | Optional | Set to `false` to disable new user sign-ups. Defaults to `true`. |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── ai/             # AI generation (POST /api/ai/generate, GET /api/ai/health)
│   │   ├── tts/            # Text-to-Speech synthesis (POST /api/tts)
│   │   └── stripe/         # Billing: checkout, webhook, portal
│   ├── app/                # Protected app shell (post-login)
│   ├── login/              # Auth page
│   ├── onboarding/         # New user onboarding
│   └── about/              # Marketing/about page
├── components/             # Shared UI components
├── config/
│   └── tiers.ts            # Tier limits and pricing display config
├── lib/
│   ├── firebase.ts         # Firebase client initialization
│   ├── firebaseAdmin.ts    # Firebase Admin SDK (server-only)
│   └── stripe.ts           # Stripe client (server-only)
├── services/               # Business logic (audio, TTS, recording)
├── stores/                 # Zustand state stores
└── types/                  # Shared TypeScript types
```

---

## Local Development

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Build production bundle
npm run lint      # Run ESLint
npm test          # Run Jest tests
```

For Stripe webhooks during local development, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the printed webhook secret into STRIPE_WEBHOOK_SECRET in .env.local
```

---

## Deployment

EngrainIt is a standard Next.js application and can be deployed to any compatible platform (Vercel, Cloud Run, etc.).

**Required configuration at deploy time:**
- All environment variables from `.env.example` (populated with production values)
- Firebase project with Auth, Firestore, and Storage enabled
- Stripe webhook endpoint registered at `https://yourdomain.com/api/stripe/webhook`

**Firebase Admin credentials in production:**
- If deploying to Google Cloud (Cloud Run, Firebase App Hosting), Application Default Credentials work automatically — `FIREBASE_SERVICE_ACCOUNT_KEY` is not needed.
- For other platforms (Vercel, etc.), set `FIREBASE_SERVICE_ACCOUNT_KEY` to the full service account JSON as a single-line environment variable.

---

## Tier Summary

| Feature | Free | Core | Pro |
|---|---|---|---|
| Saved loops | 3 | 25 | Unlimited |
| AI generations/month | 5 | 30 | Unlimited |
| Voices | 1 | 4 | 4 |
| Document upload | ✗ | ✓ | ✓ |
| Background sounds | ✗ | ✗ | ✓ |
| Habits tracked | 2 | 10 | Unlimited |
| Session types | Morning only | All | All |
| Smart resurfacing | ✗ | ✓ | ✓ |

> **Note:** Core tier limits are defined in `src/config/tiers.ts` but the Stripe checkout currently supports only **Free → Pro** upgrades. Core tier has no purchase flow yet.

---

## License

Private — All rights reserved.

---

Built with ❤️ for intentional living.
