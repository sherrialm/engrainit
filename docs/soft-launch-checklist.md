# EngrainIt — Soft Launch Checklist

> Quick pre-launch verification for each deploy.
> Run through this list before sharing the app with real users.

---

## Build & Deploy

- [ ] `npm run build` passes locally with no errors
- [ ] All changes committed and pushed to GitHub
- [ ] Vercel deploy completed successfully (check build logs)

---

## Core User Flows

### Authentication
- [ ] Login works (email + password)
- [ ] New signup works (if signups are enabled)

### Loop Creation
- [ ] Create a loop via text prompt
- [ ] AI generation completes without error
- [ ] TTS audio is generated and playable

### Vault
- [ ] Save a loop to the Vault
- [ ] Loop appears in the Vault list
- [ ] Loop plays from the Vault

### Session Playback
- [ ] Start a session with saved loops
- [ ] Session plays loops in order
- [ ] Session repeats as expected
- [ ] Countdown timer displays between loops

### Player Controls
- [ ] Stop clears the player completely
- [ ] Pause/resume works
- [ ] Skip forward/back works

---

## AI & TTS

- [ ] AI generation returns real content (not mock/fallback)
- [ ] TTS synthesizes audio successfully
- [ ] AI health check: `GET /api/ai/health` returns `{"status":"ok"}`

---

## Mobile

- [ ] App loads on mobile browser
- [ ] Navigation menu works (hamburger)
- [ ] Loop creation works on mobile
- [ ] Playback works on mobile
- [ ] Layout is not broken or overlapping

---

## Phase 5 Items

- [ ] Onboarding card appears on dashboard (first visit)
- [ ] Onboarding card dismisses and stays dismissed
- [ ] Help/FAQ page loads at `/app/help`
- [ ] Help link is visible in navigation
- [ ] Safety disclaimer is visible on Help page
- [ ] Safety disclaimer is visible on landing page footer

---

## Results

| Area | Status | Notes |
|---|---|---|
| Build & Deploy | ⬜ | |
| Login | ⬜ | |
| Loop Creation | ⬜ | |
| Save to Vault | ⬜ | |
| Session Playback | ⬜ | |
| Countdown | ⬜ | |
| Stop Clears Player | ⬜ | |
| AI Generation | ⬜ | |
| TTS | ⬜ | |
| Mobile | ⬜ | |
| Onboarding Card | ⬜ | |
| Help/FAQ | ⬜ | |

**Overall:** ⬜ PASS / ⬜ FAIL

**Tested by:** _______________
**Date:** _______________
