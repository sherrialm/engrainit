# EngrainIt

**Mental Engraving through Intentional Repetition**

EngrainIt is a web application that transforms spoken, typed, or recorded content into rhythmic mental imprints. Perfect for memorization, habit-shifting, affirmations, and spiritual centering.

## Features

- ✍️ **Text-to-Speech** — Type any text and hear it spoken with natural pauses
- 📄 **Document Upload** — Upload PDF, DOCX, or TXT files and convert to audio
- 🎙️ **Voice Recording** — Record your own voice with auto-gain control
- 🔁 **Gapless Looping** — Seamless audio repetition for deep imprinting
- ⏱️ **Spaced Repetition** — Configurable intervals (5s to 120s) for optimal learning
- 🗃️ **The Vault** — Organize loops into categories (Faith, Study, Vision, Habits)
- 🧘 **Focus Mode** — Distraction-free playback with breathing animations

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Storage)
- **Audio:** Web Audio API, MediaRecorder API
- **TTS:** Google Cloud Text-to-Speech
- **State:** Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project
- Google Cloud project with Text-to-Speech API enabled

### Installation

```bash
cd "InkLoop APP"
npm install
cp .env.example .env.local
# Edit .env.local with your Firebase credentials
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (TTS, document extraction)
│   ├── app/               # Protected app routes
│   └── login/             # Auth page
├── services/              # Business logic (Audio, TTS, Recording)
├── stores/                # Zustand state stores
└── types/                 # TypeScript definitions
```

## Deployment

```bash
npm run build
firebase deploy --only hosting
```

## License

Private — All rights reserved.

---

Built with ❤️ for intentional living.
