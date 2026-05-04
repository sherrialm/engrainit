# EngrainIt — Production Launch Checklist

> Last updated: 2026-04-14
> Deployment target: **Vercel** (Next.js 14, App Router)

---

## 1. Environment Variables

All variables must be set in the Vercel project settings (or `.env.local` for local testing).
Reference: [`.env.example`](../.env.example)

### 1a. Firebase — Client (public)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | e.g. `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Must match the Firestore project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | e.g. `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | From Firebase console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | From Firebase console |

### 1b. Firebase Admin — Server-side

| Variable | Required | Notes |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ on Vercel | Full JSON service account as a single-line string. Not needed on Google Cloud with ADC. |

### 1c. AI (Gemini)

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_AI_API_KEY` | ✅ | Gemini API key. Used by `/api/ai/generate` and `/api/ai/health`. Get from [AI Studio](https://aistudio.google.com/app/apikey). |

### 1d. TTS — Text-to-Speech

At least one key is required. ElevenLabs is tried first; Google Cloud TTS is the automatic fallback.

| Variable | Required | Notes |
|---|---|---|
| `ELEVENLABS_API_KEY` | Recommended | Primary TTS (higher quality). Get from [elevenlabs.io](https://elevenlabs.io). |
| `GOOGLE_CLOUD_TTS_API_KEY` | Recommended | Fallback TTS. Requires Cloud TTS API enabled on the GCP project. |

> **Warning:** If neither key is set, all audio loop generation will fail with a 503 error.

### 1e. Stripe — Billing

| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | **Must be `sk_live_...` for production.** |
| `STRIPE_PRICE_PRO_MONTHLY` | ✅ | Stripe Price ID for Pro monthly plan. |
| `STRIPE_PRICE_PRO_YEARLY` | ✅ | Stripe Price ID for Pro yearly plan. |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook signing secret (`whsec_...`). |
| `STRIPE_PORTAL_RETURN_URL` | Optional | Override return URL from billing portal. Defaults to `NEXT_PUBLIC_APP_URL/app`. |

### 1f. App / Feature Flags

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | Production URL (e.g. `https://engrainit.com`). Used in Stripe redirect URLs. |
| `NEXT_PUBLIC_ALLOW_SIGNUPS` | Optional | Set to `false` for closed beta. Defaults to `true`. |

---

## 2. Provider / Config Prerequisites

### Firebase
- [ ] Firebase Auth: **Email/Password** sign-in method enabled
- [ ] Firestore: Database created in production mode
- [ ] Firestore Rules: Deploy `firestore.rules` (`firebase deploy --only firestore:rules`)
- [ ] Storage: Bucket created and accessible
- [ ] Storage Rules: Deploy `storage.rules` (`firebase deploy --only storage`)
- [ ] Service account key generated and added to Vercel env vars

### Stripe
- [ ] Stripe account is in **live mode** (not test mode)
- [ ] Pro monthly product/price created → copy Price ID to `STRIPE_PRICE_PRO_MONTHLY`
- [ ] Pro yearly product/price created → copy Price ID to `STRIPE_PRICE_PRO_YEARLY`
- [ ] Webhook endpoint registered: `https://yourdomain.com/api/stripe/webhook`
- [ ] Webhook events enabled: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- [ ] Customer Portal configured in Stripe Dashboard (branding, cancellation, etc.)
- [ ] `STRIPE_SECRET_KEY` is `sk_live_...` (not `sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` is the live webhook secret (not the CLI test secret)

### Google AI (Gemini)
- [ ] API key created in [AI Studio](https://aistudio.google.com/app/apikey)
- [ ] Verify key works: after deploy, hit `GET /api/ai/health` — expect `{"status":"ok"}`

### TTS Providers
- [ ] ElevenLabs: API key active, account has sufficient character credits
- [ ] Google Cloud TTS: API enabled on the GCP project, API key valid

### Domain / DNS
- [ ] Custom domain configured in Vercel (if applicable)
- [ ] SSL certificate active (Vercel handles this automatically)
- [ ] `NEXT_PUBLIC_APP_URL` set to the final production URL

---

## 3. Deployment Steps

### Pre-deploy
1. Ensure all env vars are populated in Vercel project settings
2. Run `npm run build` locally to confirm no build failures
3. Commit and push all changes to the deploy branch

### Deploy
4. Vercel auto-deploys on push (or trigger manual deploy)
5. Monitor Vercel build logs for errors

### Post-deploy verification (immediate)
6. **Landing page loads:** Visit `https://yourdomain.com`
7. **Login page loads:** Visit `https://yourdomain.com/login`
8. **AI health check:** `GET https://yourdomain.com/api/ai/health` → `{"status":"ok"}`
9. **Sign up a test user** (or sign in with an owner email)
10. **Create a loop** (verifies both AI and TTS are working)
11. **Test Stripe:** Start checkout, verify redirect to Stripe
12. **Run the full smoke-test checklist** (see `docs/smoke-test-checklist.md`)

---

## 4. Webhook Setup Verification

Stripe webhooks are critical for subscription lifecycle management.

1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel
5. **Test:** Send a test event from Stripe Dashboard → check Vercel function logs for `[Stripe Webhook]` entries
6. **Verify end-to-end:** Complete a real test checkout, then check Firestore for `users/{uid}/billing/status` document

---

## 5. Firebase Rules Deployment

Firestore and Storage rules must be deployed separately from the Vercel app.

```bash
# Install Firebase CLI if not already
npm install -g firebase-tools

# Login and select project
firebase login
firebase use inkloop-41e11    # or your project ID

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

> **Note:** The `.firebaserc` references `inkloop-41e11` — this is the actual Firebase project ID. The project was originally created under the InkLoop name but is used by EngrainIt.

---

## 6. Owner Emails

The following emails automatically receive Pro access (defined in `src/config/tiers.ts`):

- `sherrialmurray@gmail.com`
- `sherrialmurray@icloud.com`
- `vialabs.ai@gmail.com`
- `sherrial@gmail.com`

Verify these are correct before launch. Owner accounts bypass billing checks entirely.

---

## 7. PWA Assets

The app includes PWA support (`public/manifest.webmanifest`, `public/sw.js`).

- [ ] `public/icons/icon-192.png` exists
- [ ] `public/icons/icon-512.png` exists
- [ ] `public/logo.png` exists (used across login, onboarding, app header)

---

## 8. Post-Launch Monitoring

After launching, monitor these:

- **Vercel function logs** — watch for `[Stripe Webhook]`, `[TTS]`, `[AI Route]` errors
- **Stripe Dashboard** — monitor for failed payments, webhook failures
- **Firebase Console** — check Firestore usage, Auth user count, Storage usage
- **AI Studio** — monitor Gemini API quota usage
- **ElevenLabs Dashboard** — monitor character credit consumption
