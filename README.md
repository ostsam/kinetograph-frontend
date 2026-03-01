# 🎬 Montazh

**Autonomous Multi-Agent Video Orchestration Engine**

Montazh is a full-stack AI-powered video editing platform that combines a **LangGraph multi-agent pipeline** (Python) with a professional **non-linear editor** (NLE) frontend (Next.js / React). Drop in your raw footage, describe your vision in plain English, and let 8 specialised AI agents produce a broadcast-ready video — complete with B-roll synthesis, captions, sound design, and an OTIO timeline — all reviewable and editable through a Cursor-like chat interface.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Pipeline Flow](#pipeline-flow)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [1. Clone & Enter the Repo](#1-clone--enter-the-repo)
  - [2. Set Up the Python Backend](#2-set-up-the-python-backend)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Add Your Media](#4-add-your-media)
  - [5. Set Up the Frontend](#5-set-up-the-frontend)
- [Running the Project](#running-the-project)
  - [Option A — Web UI (Recommended)](#option-a--web-ui-recommended)
  - [Option B — CLI Mode](#option-b--cli-mode)
- [Using the Editor](#using-the-editor)
  - [Chat Interface](#chat-interface)
  - [Timeline Editor](#timeline-editor)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
  - [REST Endpoints](#rest-endpoints)
  - [WebSocket Protocol](#websocket-protocol)
- [Agent Reference](#agent-reference)
- [Configuration Reference](#configuration-reference)
- [Development](#development)
- [License](#license)

---

## Features

- **8 Specialised AI Agents** — each handles one stage of the video pipeline
- **Human-in-the-Loop** — the Producer agent pauses for your approval before rendering
- **Cursor-like Chat UI** — describe edits in natural language; watch agents work in real time
- **Professional NLE** — resizable panel layout, drag-and-drop timeline, dual-video transitions, zoom, trim handles
- **B-Roll Synthesis** — automatically fetches stock footage from Pexels to fill gaps
- **Auto-Captioning** — ElevenLabs speech-to-text → burned-in captions
- **Sound Design** — background music selection and audio mastering
- **OTIO Export** — industry-standard OpenTimelineIO timeline alongside the rendered MP4
- **Undo / Redo** — 50-level history stack for every timeline mutation
- **Resume from Any Stage** — skip earlier agents with `--resume <agent>`

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│              Next.js Frontend  (localhost:3000)                │
│                                                               │
│  ┌───────────────────┐  ┌───────────────────────────────────┐│
│  │   Video Viewer     │  │   Timeline Editor                 ││
│  │   (dual <video>)   │  │   (DnD clips, transitions, trim) ││
│  └───────────────────┘  └───────────────────────────────────┘│
│  ┌───────────────────┐  ┌───────────────────────────────────┐│
│  │   Asset Browser    │  │   AI Chat Panel  (⌘L)            ││
│  │   (media bin)      │  │   (Cursor-style agent chat)      ││
│  └───────────────────┘  └───────────────────────────────────┘│
│                                                               │
│         REST  /api/*  (proxied)           WebSocket /ws       │
│              │                                │               │
└──────────────┼────────────────────────────────┼───────────────┘
               │                                │
               ▼                                ▼
┌───────────────────────────────────────────────────────────────┐
│              FastAPI Backend  (localhost:8080)                 │
│                                                               │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────────┐│
│  │ REST /api/*  │  │ WS /ws   │  │ LangGraph Pipeline       ││
│  │              │  │          │  │ Archivist → Scripter →    ││
│  │ assets,      │  │ phase    │  │ Producer ⏸ → Synthesizer  ││
│  │ timeline,    │  │ updates, │  │ → Director → Captioner → ││
│  │ pipeline     │  │ approval │  │ Sound Eng → Export       ││
│  └──────────────┘  └──────────┘  └──────────────────────────┘│
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Mistral  │  │ NVIDIA   │  │ElevenLabs│  │ Pexels       │ │
│  │ Large    │  │ VLM      │  │ STT      │  │ Stock Video  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

The **frontend** is a standalone Next.js app that proxies `/api/*` requests to the Python backend. Real-time pipeline events stream over a WebSocket at `/ws`.

---

## Pipeline Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────┐
│ Archivist│───▶│ Scripter │───▶│ Producer │───▶│ Synthesizer │
│ (ingest) │    │ (script) │    │  ⏸ HITL  │    │ (stock B)   │
└──────────┘    └──────────┘    └──────────┘    └─────────────┘
                                                       │
                                                       ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Export  │◀───│ Sound Eng│◀───│ Captioner│◀───│ Director │
│ (OTIO)   │    │ (music)  │    │ (subs)   │    │ (render) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

| #   | Agent              | Phase                            | What It Does                                                                                                                                                      |
| --- | ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Archivist**      | `ingesting` → `indexed`          | Scans `media_drop/`, probes every file with FFmpeg, extracts keyframes, runs VLM visual descriptions, transcribes audio via ElevenLabs STT, builds a master index |
| 2   | **Scripter**       | `scripting` → `scripted`         | Takes the user prompt + master index, calls Mistral Large to generate a Paper Edit (clip sequence with timecodes, transitions, rationale)                         |
| 3   | **Producer**       | `awaiting_approval` → `approved` | **Human-in-the-loop gate** — pauses the pipeline, presents the Paper Edit for review. User can approve, edit, or reject (re-scripts)                              |
| 4   | **Synthesizer**    | `synthesizing` → `synthesized`   | Fetches stock B-roll from Pexels for any `synth` clips in the Paper Edit, downloads and catalogues them                                                           |
| 5   | **Director**       | `normalizing` → `rendered`       | Normalises all clips to target resolution/FPS, assembles the timeline, renders the MP4 with MoviePy                                                               |
| 6   | **Captioner**      | `mastering`                      | Transcribes the rendered video, burns subtitles into the video                                                                                                    |
| 7   | **Sound Engineer** | `mastering` → `mastered`         | Selects and mixes background music, masters final audio levels                                                                                                    |
| 8   | **Export**         | `exporting` → `complete`         | Writes an OpenTimelineIO (.otio) timeline file alongside the final MP4                                                                                            |

Every node has **conditional error routing** — if any agent fails, the pipeline routes to an error handler. The Producer supports rejection → re-scripting loops.

---

## Tech Stack

### Backend (Python)

| Category         | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Orchestration    | LangGraph (StateGraph), LangChain Core         |
| LLM              | Mistral Large (scripting, logic)               |
| Vision LM        | NVIDIA Nemotron / Qwen2.5-VL (visual analysis) |
| Speech-to-Text   | ElevenLabs Scribe v2                           |
| Stock Footage    | Pexels API                                     |
| Media Processing | MoviePy 2, FFmpeg, OpenCV                      |
| Timeline Export  | OpenTimelineIO                                 |
| Web Server       | FastAPI, Uvicorn, WebSockets                   |
| HTTP Client      | httpx                                          |
| Configuration    | Pydantic Settings, python-dotenv               |
| CLI              | argparse, Rich                                 |

### Frontend (TypeScript)

| Category    | Technology               |
| ----------- | ------------------------ |
| Framework   | Next.js 16, React 19     |
| Language    | TypeScript 5             |
| Styling     | Tailwind CSS v4          |
| State       | Zustand 5                |
| Drag & Drop | @dnd-kit/core + sortable |
| Animation   | Framer Motion            |
| HTTP        | ky                       |
| Icons       | Lucide React             |
| Layout      | react-resizable-panels   |
| Testing     | Playwright               |

---

## Prerequisites

Before you begin, make sure you have:

| Requirement | Version    | Check               |
| ----------- | ---------- | ------------------- |
| **Python**  | ≥ 3.11     | `python3 --version` |
| **Node.js** | ≥ 18       | `node --version`    |
| **npm**     | ≥ 9        | `npm --version`     |
| **FFmpeg**  | any recent | `ffmpeg -version`   |

You will also need API keys for the external services (see [Configure Environment Variables](#3-configure-environment-variables)).

---

## Project Structure

```
video-editor/
├── .env.example                  # Template for environment variables
├── .env                          # Your actual env vars (git-ignored)
├── pyproject.toml                # Python project config & dependencies
├── README.md                     # This file
│
├── src/Montazh/              # ── Python Backend ──
│   ├── __init__.py
│   ├── __main__.py               # `python -m Montazh` entry
│   ├── cli.py                    # CLI: `run` and `serve` commands
│   ├── config.py                 # Pydantic Settings (all config)
│   ├── server.py                 # FastAPI app (REST + WebSocket)
│   ├── orchestrator.py           # LangGraph StateGraph wiring
│   ├── state.py                  # Phase enum + GraphState TypedDict
│   │
│   ├── agents/                   # ── 8 Pipeline Agents ──
│   │   ├── archivist.py          # Media ingestion & indexing
│   │   ├── scripter.py           # LLM-powered Paper Edit generation
│   │   ├── producer.py           # Human-in-the-loop approval gate
│   │   ├── synthesizer.py        # Stock B-roll fetching (Pexels)
│   │   ├── director.py           # Normalisation & MP4 rendering
│   │   ├── captioner.py          # Speech-to-text & subtitle burn-in
│   │   ├── sound_engineer.py     # Music selection & audio mastering
│   │   └── export.py             # OTIO timeline export
│   │
│   └── core/                     # ── Shared Utilities ──
│       ├── media.py              # FFprobe, thumbnails, format utils
│       ├── timeline.py           # Timeline data structures
│       ├── captions.py           # Caption rendering helpers
│       └── music.py              # Music selection logic
│
├── Montazh-frontend/         # ── Next.js Frontend ──
│   ├── package.json
│   ├── next.config.ts            # API proxy: /api/* → localhost:8080
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx          # Landing page
│       │   ├── globals.css       # Theme variables, scrollbar, keyframes
│       │   └── editor/
│       │       └── page.tsx      # Main NLE editor view
│       │
│       ├── components/
│       │   ├── chat-panel.tsx        # Cursor-like AI chat interface
│       │   ├── timeline-editor.tsx   # Timeline: ruler, tracks, DnD, zoom
│       │   ├── timeline-clip.tsx     # Individual clip: thumbnails, trim
│       │   ├── asset-dropzone.tsx    # Media bin with upload
│       │   ├── export-panel.tsx      # Export settings & render controls
│       │   ├── creative-prompt.tsx   # Initial prompt input
│       │   ├── pipeline-banner.tsx   # Pipeline status banner
│       │   ├── error-toast.tsx       # Error notifications
│       │   └── landing/             # Landing page sections
│       │
│       ├── hooks/
│       │   ├── use-Montazh-ws.ts # WebSocket connection & events
│       │   └── use-video-player.ts   # Dual-video player with transitions
│       │
│       ├── store/
│       │   ├── use-Montazh-store.ts  # Main Zustand store (timeline, undo/redo)
│       │   └── use-chat-store.ts         # Chat messages & AI state
│       │
│       ├── lib/
│       │   └── api.ts            # ky-based API client
│       │
│       └── types/
│           ├── Montazh.ts    # Phase, Asset, PaperEdit, Clip types
│           └── chat.ts           # Chat message types, agent maps
│
├── media_drop/                   # ── Source Media (git-ignored) ──
│   ├── a-roll/                   # Primary footage (talking head, etc.)
│   ├── b-roll/                   # Supplementary footage
│   └── b-roll-synth/             # AI-sourced stock footage (auto-filled)
│
├── output/                       # Rendered videos & timelines (git-ignored)
├── state/                        # Pipeline state JSON files (git-ignored)
├── models/                       # Downloaded model weights (git-ignored)
├── docs/
│   └── API.md                    # Detailed API reference
└── tests/                        # Test suite
```

---

## Getting Started

### 1. Clone & Enter the Repo

```bash
git clone <your-repo-url> video-editor
cd video-editor
```

### 2. Set Up the Python Backend

```bash
# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install the package in editable mode (includes all dependencies)
pip install -e ".[dev]"
```

This installs:

- **LangGraph**, LangChain Core — agent orchestration
- **Mistral AI**, HuggingFace Hub, ElevenLabs — AI model SDKs
- **MoviePy**, FFmpeg-python, OpenCV — media processing
- **FastAPI**, Uvicorn, WebSockets — web server
- **OpenTimelineIO** — timeline export
- **Rich** — CLI formatting
- Plus: httpx, pydantic-settings, python-dotenv, aiofiles, watchfiles

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:

```dotenv
# ── Required API Keys ──────────────────────────────────
MISTRAL_API_KEY=your_mistral_api_key        # https://console.mistral.ai
HF_TOKEN=your_huggingface_token             # https://huggingface.co/settings/tokens
ELEVENLABS_API_KEY=your_elevenlabs_key      # https://elevenlabs.io
PEXELS_API_KEY=your_pexels_key              # https://www.pexels.com/api

# ── Optional ───────────────────────────────────────────
SOUNDSTRIPE_API_KEY=                         # Background music service

# ── Model Configuration (defaults are fine) ────────────
MISTRAL_MODEL=mistral-large-2512             # Scripting & logic
VLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct      # Vision-language model
VLM_BASE_URL=                                # Leave empty for default
ELEVENLABS_STT_MODEL=scribe_v2              # Speech-to-text

# ── Media Output Settings ─────────────────────────────
OUTPUT_WIDTH=1920
OUTPUT_HEIGHT=1080
OUTPUT_FPS=30
OUTPUT_AUDIO_RATE=48000
KEYFRAME_INTERVAL=1                          # Seconds between sampled keyframes

# ── Server ─────────────────────────────────────────────
API_HOST=0.0.0.0
API_PORT=8080
```

#### Where to Get API Keys

| Service      | URL                                                                      | Purpose                          |
| ------------ | ------------------------------------------------------------------------ | -------------------------------- |
| Mistral AI   | [console.mistral.ai](https://console.mistral.ai)                         | LLM for scripting and edit logic |
| Hugging Face | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Vision-language model inference  |
| ElevenLabs   | [elevenlabs.io](https://elevenlabs.io)                                   | Speech-to-text transcription     |
| Pexels       | [pexels.com/api](https://www.pexels.com/api)                             | Free stock video footage         |

### 4. Add Your Media

Drop your source footage into the `media_drop/` directories:

```
media_drop/
├── a-roll/       ← Your primary footage (interviews, main content)
│   ├── interview_part1.mp4
│   └── interview_part2.mov
│
├── b-roll/       ← Your supplementary footage (cutaways, overlays)
│   ├── office_shots.mp4
│   └── product_demo.mp4
│
└── b-roll-synth/ ← (Auto-populated) Stock footage fetched by Synthesizer
```

**Supported formats:** `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`, `.flv`, `.wmv`

### 5. Set Up the Frontend

```bash
cd kinetograph-frontend

# Install Node.js dependencies
npm install

cd ..
```

---

## Running the Project

### Option A — Web UI (Recommended)

Open **two terminals** (or use split panes):

**Terminal 1 — Start the Backend:**

```bash
cd video-editor
source .venv/bin/activate
python -m kinetograph serve
```

You should see:

```
🎬 Kinetograph v0.1.0
Autonomous Multi-Agent Video Orchestration Engine

Starting web UI on http://0.0.0.0:8080
```

> **API Docs:** [http://localhost:8080/docs](http://localhost:8080/docs) (Swagger) or [http://localhost:8080/redoc](http://localhost:8080/redoc)

**Terminal 2 — Start the Frontend:**

```bash
cd video-editor/kinetograph-frontend
npm run dev
```

You should see:

```
▲ Next.js 16.1.6
- Local: http://localhost:3000
```

**Open [http://localhost:3000](http://localhost:3000)** in your browser.

### Option B — CLI Mode

Run the full pipeline from the command line without the web UI:

```bash
source .venv/bin/activate

# Run with a prompt
python -m kinetograph run --prompt "Create a 60-second highlight reel of the interview"

# Or with a project name
python -m kinetograph run --prompt "Make a product demo video" --name "product-launch"

# Interactive mode (prompts you for input)
python -m kinetograph run
```

The CLI will show rich-formatted progress and pause at the Producer gate for your approval:

```
⏸  PIPELINE PAUSED — Human Review Required

Options:
  approve — Accept the Paper Edit as-is
  edit    — Edit the Paper Edit (opens JSON file)
  reject  — Reject and re-generate
```

#### Resuming from a Specific Agent

If a pipeline run fails partway through, or you want to re-run from a specific stage:

```bash
# Resume from the Scripter (skips Archivist, uses saved master index)
python -m kinetograph run --prompt "..." --resume scripter

# Resume from the Director (skips indexing, scripting, approval, synthesis)
python -m kinetograph run --prompt "..." --resume director

# Available resume points:
#   scripter, producer, synthesizer, director, captioner, sound_engineer, export
```

This loads previously saved state from the `state/` directory (`master_index.json`, `paper_edit.json`, `approved_edit.json`).

---

## Using the Editor

### Chat Interface

Press **⌘L** (or click the AI button in the header) to toggle the chat panel.

1. **Start a pipeline** — Type your creative brief (e.g. "Create a 2-minute highlight reel focusing on the product demo") and hit Enter
2. **Watch agents work** — Each agent's progress appears as real-time status messages with spinners
3. **Approve the edit** — When the Producer pauses, an approval card appears with the clip list. Click **Approve** or **Request Changes**
4. **Post-edit** — After the pipeline completes, send follow-up messages to make changes (e.g. "Remove the third clip and add a crossfade between clips 1 and 2")

### Timeline Editor

- **Drag & drop** clips to reorder
- **Trim handles** on clip edges to adjust in/out points
- **Click between clips** to add transitions (cut, crossfade, dissolve, wipe, etc.)
- **Zoom** with the slider or scroll wheel on the ruler
- **Select a clip** to see its properties in the inspector

### Keyboard Shortcuts

| Shortcut      | Action               |
| ------------- | -------------------- |
| `Space` / `K` | Play / Pause         |
| `J`           | Shuttle backward     |
| `L`           | Shuttle forward      |
| `←`           | Previous frame       |
| `→`           | Next frame           |
| `⌘Z`          | Undo                 |
| `⌘⇧Z`         | Redo                 |
| `⌘L`          | Toggle AI chat panel |
| `⌘S`          | Open export panel    |

---

## API Reference

The backend exposes a full REST API plus WebSocket. For the complete reference with TypeScript interfaces, see [docs/API.md](docs/API.md).

### REST Endpoints

| Method         | Endpoint                            | Description                          |
| -------------- | ----------------------------------- | ------------------------------------ |
| `GET`          | `/api/health`                       | Health check                         |
| `GET`          | `/api/config`                       | Server configuration                 |
| **Pipeline**   |                                     |                                      |
| `POST`         | `/api/pipeline/run`                 | Start a new pipeline run             |
| `GET`          | `/api/pipeline/status`              | Current pipeline phase & state       |
| `POST`         | `/api/pipeline/approve`             | Approve or reject the Paper Edit     |
| `POST`         | `/api/pipeline/edit`                | Send a natural-language edit request |
| **Assets**     |                                     |                                      |
| `GET`          | `/api/assets`                       | List all media assets                |
| `POST`         | `/api/assets/upload`                | Upload a new media file              |
| `GET`          | `/api/assets/{type}/{id}/thumbnail` | Asset thumbnail image                |
| `GET`          | `/api/assets/{type}/{id}/waveform`  | Audio waveform image                 |
| `GET`          | `/api/assets/{type}/{id}/stream`    | Stream the video file                |
| **Paper Edit** |                                     |                                      |
| `GET`          | `/api/paper-edit`                   | Get the current Paper Edit           |
| `POST`         | `/api/paper-edit`                   | Create / overwrite Paper Edit        |
| `PUT`          | `/api/paper-edit`                   | Update the Paper Edit                |
| `PATCH`        | `/api/paper-edit/clips/{id}`        | Update a specific clip               |
| `DELETE`       | `/api/paper-edit/clips/{id}`        | Delete a clip                        |
| `POST`         | `/api/paper-edit/clips`             | Add a new clip                       |
| `PUT`          | `/api/paper-edit/reorder`           | Reorder clips                        |
| **Output**     |                                     |                                      |
| `GET`          | `/api/output`                       | List rendered output files           |
| `GET`          | `/api/output/{filename}`            | Download a specific output file      |

### WebSocket Protocol

Connect to `ws://localhost:8080/ws` to receive real-time pipeline events.

**Event Types:**

```jsonc
// Pipeline phase changed
{ "type": "phase_update", "phase": "scripting", "agent": "scripter", "message": "..." }

// Pipeline started
{ "type": "pipeline_started", "thread_id": "abc-123", "prompt": "..." }

// Awaiting human approval
{ "type": "awaiting_approval", "paper_edit": { ... } }

// Pipeline finished
{ "type": "pipeline_complete", "output": { "render_path": "...", "timeline_path": "..." } }

// Error occurred
{ "type": "error", "agent": "director", "message": "..." }
```

The frontend sends `{ "type": "ping" }` every 20 seconds as a keepalive.

---

## Agent Reference

### 🗃️ Archivist (`archivist.py`)

- **Scans** `media_drop/a-roll/` and `media_drop/b-roll/` for video files
- **Probes** each file with FFprobe (duration, resolution, FPS, codec, audio tracks)
- **Extracts keyframes** at configurable intervals
- **Runs VLM analysis** on keyframes to generate visual descriptions
- **Transcribes** audio tracks using ElevenLabs Scribe v2
- **Outputs** a comprehensive master index (`state/master_index.json`)

### ✍️ Scripter (`scripter.py`)

- **Takes** the user's creative prompt + the master index
- **Calls** Mistral Large to generate a structured Paper Edit
- **Outputs** an ordered list of clips with source file, in/out timecodes, clip type (a-roll/b-roll/synth), transition type, and creative rationale

### 🎬 Producer (`producer.py`)

- **Pauses** the pipeline (LangGraph interrupt)
- **Presents** the Paper Edit for human review
- **Accepts** approve / reject / edit decisions
- On rejection, routes back to the Scripter for re-generation

### 🔍 Synthesizer (`synthesizer.py`)

- **Scans** the Paper Edit for `synth`-type clips
- **Searches** Pexels for matching stock footage using clip descriptions
- **Downloads** and catalogues stock clips into `media_drop/b-roll-synth/`
- **Updates** the Paper Edit with resolved file paths

### 🎥 Director (`director.py`)

- **Normalises** all clips to the target resolution and FPS
- **Assembles** the timeline according to the Paper Edit
- **Applies** transitions (crossfades, cuts)
- **Renders** the final MP4 using MoviePy

### 💬 Captioner (`captioner.py`)

- **Transcribes** the rendered video's audio
- **Generates** timed captions
- **Burns** subtitles into the video

### 🎵 Sound Engineer (`sound_engineer.py`)

- **Selects** appropriate background music
- **Mixes** music with the video's original audio
- **Masters** final audio levels for broadcast quality

### 📦 Export (`export.py`)

- **Generates** an OpenTimelineIO (`.otio`) timeline file
- **Writes** the final output to the `output/` directory
- **Marks** the pipeline as `complete`

---

## Configuration Reference

All configuration is managed via environment variables (loaded from `.env`) through Pydantic Settings.

### Settings Class (`config.py`)

| Setting                | Default                          | Description                       |
| ---------------------- | -------------------------------- | --------------------------------- |
| `MISTRAL_API_KEY`      | —                                | Mistral AI API key                |
| `HF_TOKEN`             | —                                | Hugging Face access token         |
| `ELEVENLABS_API_KEY`   | —                                | ElevenLabs API key                |
| `PEXELS_API_KEY`       | —                                | Pexels API key                    |
| `SOUNDSTRIPE_API_KEY`  | `""`                             | Soundstripe API key (optional)    |
| `MISTRAL_MODEL`        | `mistral-large-latest`           | Mistral model for scripting       |
| `VLM_MODEL`            | `nvidia/nemotron-nano-12b-v2-vl` | Vision-language model             |
| `VLM_BASE_URL`         | NVIDIA API URL                   | VLM inference endpoint            |
| `ELEVENLABS_STT_MODEL` | `scribe_v2`                      | Speech-to-text model              |
| `OUTPUT_WIDTH`         | `1920`                           | Output video width (px)           |
| `OUTPUT_HEIGHT`        | `1080`                           | Output video height (px)          |
| `OUTPUT_FPS`           | `30`                             | Output video frame rate           |
| `OUTPUT_AUDIO_RATE`    | `48000`                          | Audio sample rate (Hz)            |
| `KEYFRAME_INTERVAL`    | `1`                              | Seconds between sampled keyframes |
| `API_HOST`             | `0.0.0.0`                        | Server bind address               |
| `API_PORT`             | `8080`                           | Server bind port                  |

### VLM Tuning Parameters

| Setting           | Default | Description                         |
| ----------------- | ------- | ----------------------------------- |
| `VLM_CONCURRENCY` | `5`     | Max parallel VLM inference requests |
| `VLM_SEGMENT_SEC` | `4.0`   | Segment duration for VLM analysis   |
| `VLM_SEGMENT_FPS` | `2.0`   | Frame rate within each VLM segment  |
| `VLM_MAX_FRAMES`  | `8`     | Max frames per VLM request          |

### Derived Paths

The `Settings` class automatically derives all project paths from the project root:

| Property           | Path                       |
| ------------------ | -------------------------- |
| `root_dir`         | Project root directory     |
| `media_drop_dir`   | `media_drop/`              |
| `a_roll_dir`       | `media_drop/a-roll/`       |
| `b_roll_dir`       | `media_drop/b-roll/`       |
| `b_roll_synth_dir` | `media_drop/b-roll-synth/` |
| `output_dir`       | `output/`                  |
| `state_dir`        | `state/`                   |

---

## Development

### Running Tests

```bash
source .venv/bin/activate
pytest
```

### Linting

```bash
ruff check src/
ruff format src/
```

### Frontend Type Checking

```bash
cd kinetograph-frontend
npx tsc --noEmit
```

### Frontend Linting

```bash
cd kinetograph-frontend
npm run lint
```

### Building for Production

**Backend** — the Python package is already installable:

```bash
pip install .
kinetograph serve
```

**Frontend** — create an optimised build:

```bash
cd kinetograph-frontend
npm run build
npm run start  # Serve the production build on port 3000
```

---

## License

MIT

---

<p align="center">
  <strong>🎬 Montazh</strong> — Autonomous Multi-Agent Video Orchestration Engine
</p>

Create a 20 second video based on the a roll attached. You are going to focus on videos available rather than the a roll video. Make sure that what you produce really highlights the feel of New York City as well as the hackathon atmosphere. Cut out stutters, awkward moments, and anything else that would detract from the video. Make sure that the transitions are natural. Use the transcripts generated to choose the best content to highlight the best of NYC and the hackathon. Be sure to make the reel punchy and worthy of millions of views on youtube
