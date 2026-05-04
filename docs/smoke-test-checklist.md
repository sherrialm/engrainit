# EngrainIt — Smoke Test Checklist

> Run this checklist after every production deploy.
> Tests should be performed on the live production URL.
> Estimated time: 15–20 minutes.

---

## Prerequisites

- A fresh test account (or use an owner email for Pro features)
- The production URL is live and responding
- A credit card (real or Stripe test card, depending on mode)

---

## 1. Authentication

### 1.1 Sign Up
- [ ] Navigate to `/login`
- [ ] Toggle to "Create Account" mode
- [ ] Create a new account with email + password
- [ ] Verify redirect to `/onboarding`
- [ ] Verify no console errors in browser DevTools

### 1.2 Sign In
- [ ] Sign out, then sign back in with the same credentials
- [ ] Verify redirect to `/app` (returning user skips onboarding)
- [ ] Verify the header shows the correct tier badge (🌱 Free)

### 1.3 Sign Out
- [ ] Click "Sign Out" in the header
- [ ] Verify redirect to `/login`
- [ ] Verify navigating to `/app` redirects back to `/login`

### 1.4 Forgot Password
- [ ] On login page, enter an email and click "Forgot password?"
- [ ] Verify the "Reset email sent" confirmation appears
- [ ] (Optional) Check inbox for the reset email

### 1.5 Closed Beta Gate *(if `NEXT_PUBLIC_ALLOW_SIGNUPS=false`)*
- [ ] Verify the "Create Account" toggle is hidden
- [ ] Verify existing users can still sign in

---

## 2. Onboarding

- [ ] Sign up with a fresh account (or clear `localStorage` key `engrainit_onboarding_complete`)
- [ ] Verify 3 onboarding screens appear with proper content
- [ ] Navigate through all 3 screens using "Next"
- [ ] Click "Begin My First Practice" on the final screen
- [ ] Verify redirect to `/app/generate`
- [ ] **Skip test:** Sign up again, click "Skip" immediately → verify redirect to `/app`

---

## 3. First Loop Generation (AI + TTS)

- [ ] On `/app/generate`, enter a prompt (e.g. "I am confident and focused")
- [ ] Click generate
- [ ] Verify AI generates affirmation text (not a fallback/mock)
- [ ] Verify audio is synthesized (TTS) — audio player appears
- [ ] Play the audio — verify sound plays correctly
- [ ] Verify the loop can be saved to the Vault

### 3a. Quick Start Templates
- [ ] On the Generate page, verify Quick Start templates are visible
- [ ] Click a template — verify it pre-fills the prompt field

---

## 4. Save + Playback

- [ ] Save a generated loop
- [ ] Navigate to `/app/vault`
- [ ] Verify the saved loop appears
- [ ] Click to play the saved loop
- [ ] Verify audio plays back with proper looping behavior
- [ ] Verify loop can be deleted

---

## 5. Morning Ritual

- [ ] Navigate to `/app/morning`
- [ ] Start a morning session
- [ ] Verify audio plays (affirmation or briefing)
- [ ] Complete the session
- [ ] Verify the dashboard updates to show completion
- [ ] Verify the streak counter increments

---

## 6. Progress / Streak Behavior

- [ ] Navigate to `/app/progress`
- [ ] Verify the streak counter shows accurate data
- [ ] Verify the 7-day calendar view displays correctly
- [ ] Verify total completions count is accurate
- [ ] After completing a morning ritual, verify the streak message updates

---

## 7. Billing — Upgrade Flow

> **Important:** Use a Stripe test card (`4242 4242 4242 4242`) if the Stripe account is in test mode.

### 7.1 Checkout
- [ ] Navigate to `/app/upgrade`
- [ ] Verify Free and Pro plan cards display correctly
- [ ] Verify the current plan badge appears on the correct card
- [ ] Click "Upgrade to Pro"
- [ ] Verify the pricing modal opens
- [ ] Select monthly or yearly
- [ ] Verify redirect to Stripe Checkout
- [ ] Complete checkout with a test card
- [ ] Verify redirect back to `/app?upgrade=success`
- [ ] Verify the tier badge in the header changes to 🌳 Pro

### 7.2 Webhook Verification
- [ ] After successful checkout, check Firestore: `users/{uid}/billing/status`
- [ ] Verify `tier: "pro"` and `stripeCustomerId` are set
- [ ] Check Vercel function logs for `[Stripe Webhook] User ... upgraded to Pro`

---

## 8. Billing Portal

- [ ] As a Pro user, navigate to `/app/upgrade`
- [ ] (Or trigger portal from wherever the "Manage Billing" button is)
- [ ] Verify redirect to Stripe Customer Portal
- [ ] Verify you can see the active subscription
- [ ] (Optional) Cancel the subscription in the portal
- [ ] Return to the app and verify tier reverts to Free

---

## 9. AI Fallback Behavior

### 9.1 AI Health Check
- [ ] Hit `GET /api/ai/health` in the browser
- [ ] Verify response: `{"status":"ok","keyPresent":true,"provider":"gemini",...}`

### 9.2 AI Service Down (simulated)
- [ ] If `GOOGLE_AI_API_KEY` were removed, the generate route returns `{"result":null,"provider":"mock"}`
- [ ] Verify the UI handles mock/fallback responses gracefully (shows local fallback content, not a crash)

### 9.3 AI Status Indicator
- [ ] In the app header (desktop), verify the AI status indicator shows a green dot when healthy
- [ ] Verify it shows a warning state if the health check fails

---

## 10. TTS Failure / No-Provider Behavior

### 10.1 Normal TTS
- [ ] Generate a loop — verify audio plays (ElevenLabs primary)
- [ ] Verify audio quality is good (not robotic/glitchy)

### 10.2 No TTS Key Configured (simulated)
- [ ] If both TTS keys were removed, the `/api/tts` route returns:
  ```json
  {"error":"Voice generation is temporarily unavailable.","code":"NO_TTS_PROVIDER"}
  ```
- [ ] Verify the UI shows a user-friendly error message, not a raw error or blank state

### 10.3 TTS Fallback
- [ ] If ElevenLabs fails, Google Cloud TTS should be used automatically
- [ ] Check Vercel logs for `[TTS] ElevenLabs failed, falling back to Google`

---

## 11. Dashboard Error-State Sanity Checks

- [ ] Load the dashboard (`/app`) — verify no JavaScript errors in console
- [ ] Verify the "Today's Practice" guidance section renders for returning users
- [ ] Verify the Quick Start CTA appears for users with no loops
- [ ] Verify the streak section renders even with zero streak data
- [ ] Verify the page handles missing Firestore data gracefully (no blank screen)
- [ ] On mobile: verify the hamburger menu works and all nav items are accessible
- [ ] On mobile: verify the bottom navigation bar (if present) works correctly

---

## 12. Additional Flow Checks

### 12.1 Landing Page
- [ ] Visit `/` — verify the marketing page loads with correct EngrainIt positioning
- [ ] Verify the "Get Started" / "Sign In" CTA links work

### 12.2 About Page
- [ ] Visit `/about` — verify it loads

### 12.3 Privacy Page
- [ ] Visit `/privacy` — verify it loads

### 12.4 404 Page
- [ ] Visit a non-existent route (e.g. `/nonexistent`) — verify a 404 page renders

### 12.5 Document Upload *(Core/Pro only)*
- [ ] Upload a `.txt` file → verify text extraction
- [ ] Upload a `.pdf` file → verify text extraction
- [ ] Upload a `.docx` file → verify text extraction

### 12.6 PWA Install
- [ ] On Chrome, verify the app can be installed as a PWA
- [ ] Verify the PWA opens to `/app` with the correct theme colors

---

## Results Template

| Section | Status | Notes |
|---|---|---|
| 1. Auth | ⬜ | |
| 2. Onboarding | ⬜ | |
| 3. Loop Generation | ⬜ | |
| 4. Save + Playback | ⬜ | |
| 5. Morning Ritual | ⬜ | |
| 6. Progress / Streak | ⬜ | |
| 7. Billing Upgrade | ⬜ | |
| 8. Billing Portal | ⬜ | |
| 9. AI Fallback | ⬜ | |
| 10. TTS Fallback | ⬜ | |
| 11. Dashboard States | ⬜ | |
| 12. Additional Flows | ⬜ | |

**Overall:** ⬜ PASS / ⬜ FAIL

**Tested by:** _______________
**Date:** _______________
**Environment:** _______________
