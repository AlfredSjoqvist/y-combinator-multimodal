# Storybox

**Upload one photo, get back a cinematic visual story — with voice, music, and AI-generated art — in under 90 seconds.**

Storybox is a multimodal storytelling engine built at the YC x Google DeepMind Multimodal Frontier Hackathon (March 2026). It combines four AI systems into a single seamless pipeline: a real-time voice agent that helps you shape your story concept, a vision model that analyzes your photo, an image generator that creates character-consistent panels, and a music model that scores the whole thing.

---

## How It Works

### 1. Connect Your Phone Camera via LiveKit

Storybox uses **LiveKit** as its real-time communication backbone. When you open the app, a LiveKit room is created that connects three participants:

- **Your phone** — streams live camera video and microphone audio into the room
- **The Sage** (AI voice agent) — a Python agent running the Gemini Realtime API through LiveKit's Agents SDK, listening to your voice and helping you brainstorm
- **The display** (web frontend) — shows the live camera feed, captures frames, and runs the generation pipeline

This architecture means your phone becomes a wireless camera and microphone. The LiveKit room handles all the WebRTC plumbing — audio/video tracks, data channels for JSON commands, participant management, and track subscription. The Sage agent uses LiveKit's data channel to push story concept updates to the frontend in real time as you talk.

### 2. Talk to The Sage

The Sage is a conversational AI companion powered by **Google's Gemini Realtime API** running through **LiveKit's Agents SDK**. It listens to your voice, reacts naturally, and builds a running summary of your story concept — genre, mood, characters, setting, visual style. Every time you speak, the Sage calls its `update_story_summary` tool, which publishes the updated concept to all room participants via LiveKit's data channel.

You can also type or edit the story concept directly. The Sage and the text field stay in sync.

### 3. Snap a Photo

Press **J** on your keyboard or click **Snap Photo** to capture a frame from the live camera feed. You can also upload any image. This photo becomes the seed for your story — the characters and setting are extracted from it.

### 4. Create Adventure

Hit **Create Adventure** and the pipeline runs:

| Step | Model | What Happens |
|------|-------|-------------|
| Scene Analysis | Gemini 3.1 Pro | Analyzes the photo: identifies characters (hair, clothing, build, features), setting, mood, objects. Outputs structured JSON. |
| Storyboard | Gemini 3.1 Pro | Writes a 6-panel narrative arc with scene descriptions, dialogue, narration, and emotional beats. Panel 1 uses the original photo. |
| Panel Generation | NanoBanana 2 (Gemini 3.1 Flash Image) | Generates photorealistic images for panels 2–6. Character descriptions are embedded verbatim in every prompt for consistency. Panels are generated sequentially so each can reference the previous. |
| Script Polish | Gemini 3.1 Pro | Refines dialogue for impact and consistency. |
| Voice Acting | Gemini TTS | Each dialogue line gets a unique voice (7 available voices, mapped per speaker). Generated as audio data URLs. |
| Soundtrack | Lyria 3 | Composes an original background track with lyrics matching the story's mood and genre. |

### 5. Cinematic Playback

The result plays back as a cinematic comic experience:
- Panels appear one at a time with Ken Burns zoom animation
- Dialogue audio plays sequentially with speech bubbles
- Narration appears as text overlays
- Background music scores the entire sequence
- Each panel holds for ~20 seconds

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LiveKit Room ("storybox")                │
│                                                             │
│  ┌──────────┐    audio/video    ┌──────────────────────┐   │
│  │  Phone   │ ───────────────── │   Web Frontend       │   │
│  │ (camera  │    WebRTC tracks  │   (React + Vite)     │   │
│  │  + mic)  │                   │                      │   │
│  └──────────┘                   │  ┌────────────────┐  │   │
│       │                         │  │ Live video     │  │   │
│       │ audio track             │  │ frame capture  │  │   │
│       │                         │  │ story concept  │  │   │
│       ▼                         │  └───────┬────────┘  │   │
│  ┌──────────────────┐           │          │           │   │
│  │  The Sage         │  data    │          ▼           │   │
│  │  (Python Agent)   │ channel  │  ┌────────────────┐  │   │
│  │                   │ ◄──────► │  │ Pipeline       │  │   │
│  │  Gemini Realtime  │ commands │  │                │  │   │
│  │  + Agents SDK     │          │  │ Gemini 3.1 Pro │  │   │
│  │                   │          │  │ NanoBanana 2   │  │   │
│  │  Tools:           │          │  │ Lyria 3        │  │   │
│  │  - update_summary │          │  │ Gemini TTS     │  │   │
│  └──────────────────┘           │  └────────────────┘  │   │
│                                 └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**LiveKit is the connective tissue.** It handles:
- WebRTC audio/video between phone and frontend (camera feed, microphone)
- The Sage agent's real-time voice connection (bidirectional audio with Gemini Realtime)
- JSON data channel for commands (`wizard_status`, `say_hi`, `capture_taken`, `navigate`)
- Participant lifecycle (join/leave detection, track subscription/unsubscription)
- Room-level state management across all three participants

The agent connects using LiveKit's Python Agents SDK (`livekit-agents`), which provides `AgentSession`, `RoomInputOptions`, and `RoomOutputOptions` for clean integration with Google's Realtime API. The frontend uses `livekit-client` for room connection, track management, and data messaging.

---

## Setup & Running

### Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+**
- API keys for Google AI (Gemini) and LiveKit Cloud

### 1. Clone and Install

```bash
git clone <repo-url>
cd y-combinator-multimodal

# Frontend
cd storybox
npm install

# Agent
cd ../agent
pip install -r requirements.txt
```

### 2. Configure Environment

Create `agent/.env`:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_google_api_key
```

Create `storybox/.env.local`:
```env
VITE_GEMINI_API_KEY=your_google_api_key
VITE_GEMINI_MODEL=gemini-3.1-pro-preview
VITE_NANOBANANA_MODEL=gemini-3.1-flash-image-preview
VITE_LYRIA_MODEL=lyria-002
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_TOKEN=<display_token>
VITE_PHONE_TOKEN=<phone_token>
```

You can generate tokens automatically:
```bash
cd agent
python start.py
```

This generates LiveKit tokens (cached for 24h), prints all the URLs you need, and starts the agent.

### 3. Start the Frontend

```bash
cd storybox
npm run dev
```

Opens at `http://localhost:5173`.

### 4. Start the Agent

```bash
cd agent
python start.py
```

Or run the agent directly:
```bash
cd agent
python -u agent_direct.py
```

### 5. Connect Your Phone

The app shows a **phone URL** in the story concept panel. Copy it and open it on your phone — it connects your phone's camera and microphone to the LiveKit room. You'll see the live feed appear on the display.

Alternatively, the `start.py` script prints the phone URL in the terminal.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Animations | Framer Motion |
| Audio Playback | Howler.js (with native Audio fallback) |
| Real-time Comms | **LiveKit** (livekit-client + livekit-agents) |
| Voice Agent | LiveKit Agents SDK + Gemini Realtime API |
| Scene Analysis | Gemini 3.1 Pro |
| Image Generation | NanoBanana 2 (Gemini 3.1 Flash Image) |
| Voice Acting | Gemini TTS (7 distinct voices) |
| Music | Lyria 3 |
| Styling | Inline CSS with Space Grotesk + Cinzel fonts |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **J** | Snap photo from live camera feed |
| **G** | Load demo image + run hardcoded storyboard (demo mode) |
| **K** | Skip to next panel during playback |

---

## Project Structure

```
y-combinator-multimodal/
├── storybox/                    # React frontend
│   └── src/
│       ├── App.tsx              # Screen manager, LiveKit setup
│       ├── pipeline.ts          # Gemini/NanoBanana/Lyria generation
│       ├── useLiveKit.ts        # LiveKit room connection & data channel
│       ├── types.ts             # StoryResult, StoryPanel, DialogueLine
│       └── screens/
│           ├── CoverScreen.tsx  # Welcome screen
│           ├── UploadScreen.tsx # Camera + upload + story concept
│           ├── GeneratingScreen.tsx  # Pipeline progress UI
│           ├── PlaybackScreen.tsx    # Cinematic playback
│           └── GalleryScreen.tsx     # Results grid
├── agent/                       # Python voice agent
│   ├── agent_direct.py          # Direct LiveKit room connection
│   ├── start.py                 # Token generation + agent launcher
│   └── .env                     # API keys
└── IDEA.md                      # Original project design doc
```

---

## Built By

Alfred Sjoqvist — CS/Engineering master's student at Stanford (exchange from Sweden). Built solo in 6.5 hours at the YC x Google DeepMind Multimodal Frontier Hackathon, San Francisco, March 2026.
