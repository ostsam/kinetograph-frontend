# 🎬 Montazh — Backend API Reference

> **Version:** 0.1.0  
> **Base URL:** `http://localhost:8080`  
> **Docs (Swagger):** `http://localhost:8080/docs`  
> **Docs (ReDoc):** `http://localhost:8080/redoc`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [TypeScript Interfaces (Data Models)](#typescript-interfaces)
5. [API Endpoints](#api-endpoints)
   - [System](#system)
   - [Pipeline Control](#pipeline-control)
   - [Assets](#assets)
   - [Master Index](#master-index)
   - [Paper Edit (Timeline)](#paper-edit-timeline)
   - [Output Files](#output-files)
6. [WebSocket Protocol](#websocket-protocol)
7. [Frontend ↔ Backend Workflow](#frontend--backend-workflow)
8. [Error Handling](#error-handling)
9. [CORS](#cors)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                  TypeScript Frontend (React)                   │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐│
│  │   Preview Player     │  │   Timeline Editor                ││
│  │   (video.js / HTML5) │  │   (tracks, clips, transitions)  ││
│  └─────────────────────┘  └─────────────────────────────────┘│
│  ┌─────────────────────┐  ┌─────────────────────────────────┐│
│  │   Asset Browser      │  │   Pipeline Status Dashboard     ││
│  │   (thumbnails, drag) │  │   (real-time WebSocket)         ││
│  └─────────────────────┘  └─────────────────────────────────┘│
│                                                               │
│           REST API (fetch/axios)        WebSocket              │
│              │                             │                   │
└──────────────┼─────────────────────────────┼───────────────────┘
               │                             │
               ▼                             ▼
┌───────────────────────────────────────────────────────────────┐
│                  Python Backend (FastAPI)                      │
│                  http://localhost:8080                         │
│                                                               │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────────┐│
│  │ REST Endpoints│  │ WebSocket│  │ LangGraph Pipeline       ││
│  │              │  │ /ws      │  │ (Archivist → Scripter →  ││
│  │ /api/*      │  │          │  │  Producer → Synthesizer → ││
│  │              │  │          │  │  Director → SoundEng →   ││
│  │              │  │          │  │  Export)                  ││
│  └──────────────┘  └──────────┘  └──────────────────────────┘│
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Mistral  │  │ HF VLM   │  │ElevenLabs│  │ Pexels       │ │
│  │ Large    │  │ Qwen2.5  │  │ STT      │  │ Stock Video  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Frontend** is a standalone TypeScript/React app — zero coupling to the Python server
2. **Backend** is a headless REST + WebSocket API — it doesn't serve HTML
3. Communication: `fetch()`/`axios` for REST, native `WebSocket` for real-time events
4. The pipeline is fully async — the frontend starts a run, then listens on WebSocket for phase transitions
5. When the pipeline hits the **Producer** (human-in-the-loop gate), it pauses and sends an `awaiting_approval` event → the frontend renders the timeline editor → the user edits → frontend POSTs back `approve`/`reject`

---

## Getting Started

### Start the backend

```bash
cd /path/to/video-editor

# Install Python dependencies
pip install -e ".[dev]"

# Set your API keys in .env
cp .env.example .env

# Start the server
python -m Montazh serve
# → API at http://localhost:8080
# → Swagger docs at http://localhost:8080/docs
```

### Start the frontend (separate project)

```bash
cd /path/to/video-editor-frontend
npm run dev
# → Dev server at http://localhost:3000 (proxies API to :8080)
```

### Configure frontend proxy (vite.config.ts)

```typescript
export default defineConfig({
	server: {
		proxy: {
			"/api": "http://localhost:8080",
			"/ws": {
				target: "ws://localhost:8080",
				ws: true,
			},
		},
	},
});
```

---

## Authentication

Currently **none** (hackathon mode). The backend accepts all requests.

For production, add a Bearer token header:

```
Authorization: Bearer <token>
```

---

## TypeScript Interfaces

Copy these interfaces into your frontend project. They map 1:1 to the backend Pydantic models.

```typescript
// ═══════════════════════════════════════════════════════════
//  ENUMS
// ═══════════════════════════════════════════════════════════

export enum Phase {
	IDLE = "idle",
	INGESTING = "ingesting",
	INDEXED = "indexed",
	SCRIPTING = "scripting",
	SCRIPTED = "scripted",
	AWAITING_APPROVAL = "awaiting_approval",
	APPROVED = "approved",
	SYNTHESIZING = "synthesizing",
	SYNTHESIZED = "synthesized",
	NORMALIZING = "normalizing",
	NORMALIZED = "normalized",
	RENDERING = "rendering",
	RENDERED = "rendered",
	MASTERING = "mastering",
	MASTERED = "mastered",
	EXPORTING = "exporting",
	COMPLETE = "complete",
	ERROR = "error",
}

export type ClipType = "a-roll" | "b-roll" | "synth";

export type TransitionType = "cut" | "crossfade";

// ═══════════════════════════════════════════════════════════
//  ASSET MODELS
// ═══════════════════════════════════════════════════════════

export interface RawAsset {
	id: string;
	file_name: string;
	file_path: string;
	asset_type: "a-roll" | "b-roll" | "b-roll-synth";
	duration_ms: number;
	width: number;
	height: number;
	fps: number;
	has_audio: boolean;
	codec: string;
	thumbnail_url: string; // GET /api/assets/{type}/{id}/thumbnail
	waveform_url: string | null; // GET /api/assets/{type}/{id}/waveform
	stream_url: string; // GET /api/assets/{type}/{id}/stream
	error?: string; // present if file is corrupt
}

export interface AssetsResponse {
	assets: RawAsset[];
	total: number;
}

// ═══════════════════════════════════════════════════════════
//  TRANSCRIPT / INDEX MODELS
// ═══════════════════════════════════════════════════════════

export interface TranscriptWord {
	text: string;
	start_ms: number;
	end_ms: number;
	speaker_id: string | null;
}

export interface KeyframeAnalysis {
	timestamp_ms: number;
	frame_path: string;
	description: string;
}

export interface MasterIndexEntry {
	asset_file: string;
	start_ms: number;
	end_ms: number;
	transcript: string;
	words: TranscriptWord[];
	visual_descriptions: string[];
	speaker_id: string | null;
}

export interface MasterIndexResponse {
	entries: MasterIndexEntry[];
	total: number;
}

export interface MasterIndexSearchResponse {
	results: MasterIndexEntry[];
	total: number;
	query: string;
}

// ═══════════════════════════════════════════════════════════
//  PAPER EDIT (TIMELINE) MODELS
// ═══════════════════════════════════════════════════════════

export interface PaperEditClip {
	clip_id: string;
	source_file: string;
	in_ms: number; // source in-point (milliseconds)
	out_ms: number; // source out-point (milliseconds)
	clip_type: ClipType;
	overlay_text?: string; // text overlay (lower-thirds, etc.)
	transition?: TransitionType; // transition to NEXT clip
	search_query?: string; // Pexels search query (for synth clips)
	description: string;
}

export interface PaperEdit {
	title: string;
	total_duration_ms: number;
	clips: PaperEditClip[];
	music_prompt?: string;
}

// ═══════════════════════════════════════════════════════════
//  PIPELINE MODELS
// ═══════════════════════════════════════════════════════════

export interface PipelineStatus {
	phase: Phase;
	project_name: string;
	user_prompt: string;
	created_at: string; // ISO 8601
	asset_count: number;
	index_count: number;
	synth_count: number;
	render_path: string | null;
	timeline_path: string | null;
	errors: PipelineError[];
}

export interface PipelineError {
	agent: string;
	message: string;
	phase: string;
	recoverable: boolean;
	details?: string;
}

export interface RunRequest {
	prompt: string;
	project_name?: string; // default: "untitled"
}

export interface RunResponse {
	status: "awaiting_approval" | "complete";
	thread_id?: string;
	message?: string;
	phase?: string;
	render_path?: string;
	timeline_path?: string;
}

export interface ApprovalRequest {
	action: "approve" | "reject";
	paper_edit?: PaperEdit; // send modified edit if user changed clips
	reason?: string; // rejection reason
}

// ═══════════════════════════════════════════════════════════
//  OUTPUT MODELS
// ═══════════════════════════════════════════════════════════

export interface OutputFile {
	file_name: string;
	file_path: string;
	size_bytes: number;
	download_url: string; // GET /api/output/{filename}
	type: string; // "mp4", "fcpxml", "otio"
}

export interface OutputResponse {
	files: OutputFile[];
	total: number;
}

// ═══════════════════════════════════════════════════════════
//  WEBSOCKET EVENT TYPES
// ═══════════════════════════════════════════════════════════

export type WSEvent =
	| { type: "connected"; phase: Phase; version: string }
	| { type: "pipeline_started"; thread_id: string }
	| {
			type: "phase_update";
			node: string;
			phase: Phase;
			timestamp: string;
			errors: PipelineError[];
	  }
	| { type: "awaiting_approval"; paper_edit: PaperEdit }
	| { type: "pong" };
```

---

## API Endpoints

### System

#### `GET /api/health`

Health check.

**Response:**

```json
{
	"status": "ok",
	"version": "0.1.0",
	"phase": "idle"
}
```

#### `GET /api/config`

Get current project configuration.

**Response:**

```json
{
	"output_width": 1920,
	"output_height": 1080,
	"output_fps": 30,
	"output_audio_rate": 48000,
	"keyframe_interval": 1,
	"vlm_model": "Qwen/Qwen2.5-VL-7B-Instruct",
	"mistral_model": "mistral-large-latest"
}
```

---

### Pipeline Control

#### `GET /api/pipeline/status`

Get full pipeline status.

**Response:** `PipelineStatus`

```json
{
	"phase": "awaiting_approval",
	"project_name": "my-video",
	"user_prompt": "Create a 2-minute highlight reel...",
	"created_at": "2025-01-15T10:30:00Z",
	"asset_count": 5,
	"index_count": 42,
	"synth_count": 3,
	"render_path": null,
	"timeline_path": null,
	"errors": []
}
```

---

#### `POST /api/pipeline/run`

Start a new pipeline run.

**Request Body:** `RunRequest`

```json
{
	"prompt": "Create a 2-minute highlight reel from the interview footage. Focus on the key insights about AI safety. Use dramatic B-roll to emphasize important points.",
	"project_name": "ai-safety-reel"
}
```

**Response (paused at approval gate):**

```json
{
	"status": "awaiting_approval",
	"thread_id": "550e8400-e29b-41d4-a716-446655440000",
	"message": "Paper Edit ready for review. GET /api/paper-edit to retrieve it."
}
```

**Response (ran to completion — no synth clips needed):**

```json
{
	"status": "complete",
	"phase": "complete",
	"render_path": "/path/to/output/ai-safety-reel.mp4",
	"timeline_path": "/path/to/output/ai-safety-reel.fcpxml"
}
```

> ⚠️ **Important:** This is a long-running request. For production, you should trigger the pipeline and then use the WebSocket to track progress instead of waiting for the HTTP response.

---

#### `POST /api/pipeline/approve`

Approve or reject the Paper Edit and resume the pipeline.

**Request Body:** `ApprovalRequest`

Approve (with user modifications):

```json
{
	"action": "approve",
	"paper_edit": {
		"title": "AI Safety Highlights",
		"total_duration_ms": 120000,
		"clips": [
			{
				"clip_id": "c001",
				"source_file": "interview.mp4",
				"in_ms": 5000,
				"out_ms": 15000,
				"clip_type": "a-roll",
				"transition": "cut",
				"description": "Opening statement about AI risks"
			}
		]
	}
}
```

Reject:

```json
{
	"action": "reject",
	"reason": "Too long, needs to be under 90 seconds. Also remove the third clip."
}
```

**Response:**

```json
{
	"status": "complete",
	"phase": "complete",
	"render_path": "/path/to/output/ai-safety-reel.mp4"
}
```

---

### Assets

#### `GET /api/assets`

List all media assets with metadata.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `asset_type` | string | Optional. Filter by `"a-roll"`, `"b-roll"`, or `"b-roll-synth"` |

**Response:** `AssetsResponse`

```json
{
	"assets": [
		{
			"id": "interview_01",
			"file_name": "interview_01.mp4",
			"file_path": "/abs/path/media_drop/a-roll/interview_01.mp4",
			"asset_type": "a-roll",
			"duration_ms": 180000,
			"width": 1920,
			"height": 1080,
			"fps": 29.97,
			"has_audio": true,
			"codec": "h264",
			"thumbnail_url": "/api/assets/a-roll/interview_01/thumbnail",
			"waveform_url": "/api/assets/a-roll/interview_01/waveform",
			"stream_url": "/api/assets/a-roll/interview_01/stream"
		}
	],
	"total": 1
}
```

---

#### `GET /api/assets/{asset_type}/{asset_id}/thumbnail`

Get a JPEG thumbnail at a specific timestamp.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `asset_type` | string | `"a-roll"`, `"b-roll"`, or `"b-roll-synth"` |
| `asset_id` | string | The asset stem (filename without extension) |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `t` | float | `0.5` | Timestamp in seconds |

**Response:** Raw `image/jpeg` binary (320px wide, aspect ratio preserved)

**Usage in frontend:**

```tsx
<img
	src={`/api/assets/${clip.asset_type}/${clip.id}/thumbnail?t=${clip.in_ms / 1000}`}
/>
```

---

#### `GET /api/assets/{asset_type}/{asset_id}/waveform`

Get an audio waveform PNG visualization.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | int | `800` | Image width in pixels |
| `height` | int | `120` | Image height in pixels |

**Response:** Raw `image/png` binary

**Usage in frontend:**

```tsx
<img
	src={`/api/assets/${clip.asset_type}/${clip.id}/waveform?width=1200&height=60`}
	style={{ width: "100%", height: "60px" }}
/>
```

---

#### `GET /api/assets/{asset_type}/{asset_id}/stream`

Stream a video file for playback.

**Response:** Raw video file with proper MIME type. Supports range requests for seeking.

**Usage in frontend:**

```tsx
<video src={`/api/assets/${clip.asset_type}/${clip.id}/stream`} controls />
```

---

#### `POST /api/assets/upload`

Upload a new media asset.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `asset_type` | string | `"b-roll"` | `"a-roll"` or `"b-roll"` |

**Request:** `multipart/form-data` with `file` field

```typescript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const res = await fetch("/api/assets/upload?asset_type=a-roll", {
	method: "POST",
	body: formData,
});
```

**Response:**

```json
{
	"status": "uploaded",
	"file_name": "interview.mp4",
	"file_path": "/abs/path/media_drop/a-roll/interview.mp4",
	"asset_type": "a-roll",
	"duration_ms": 180000,
	"width": 1920,
	"height": 1080,
	"fps": 29.97,
	"has_audio": true,
	"codec": "h264"
}
```

---

### Master Index

#### `GET /api/master-index`

Get the full transcript + visual index.

**Response:** `MasterIndexResponse`

```json
{
	"entries": [
		{
			"asset_file": "interview_01.mp4",
			"start_ms": 0,
			"end_ms": 5000,
			"transcript": "Welcome everyone. Today we're going to talk about...",
			"words": [
				{
					"text": "Welcome",
					"start_ms": 100,
					"end_ms": 450,
					"speaker_id": "speaker_0"
				},
				{
					"text": "everyone",
					"start_ms": 460,
					"end_ms": 800,
					"speaker_id": "speaker_0"
				}
			],
			"visual_descriptions": [
				"Person seated at desk in a modern office, looking at camera, professional lighting"
			],
			"speaker_id": "speaker_0"
		}
	],
	"total": 42
}
```

---

#### `GET /api/master-index/search`

Search transcript and visual descriptions.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search term (case-insensitive substring match) |

**Example:** `GET /api/master-index/search?q=artificial+intelligence`

**Response:** `MasterIndexSearchResponse`

```json
{
	"results": [
		/* matching MasterIndexEntry objects */
	],
	"total": 7,
	"query": "artificial intelligence"
}
```

---

### Paper Edit (Timeline)

The Paper Edit is the central data structure the frontend timeline editor works with. It represents the AI-generated narrative timeline as a flat list of ordered clips.

#### `GET /api/paper-edit`

Get the current Paper Edit.

**Response:** `PaperEdit`

```json
{
	"title": "AI Safety Highlights",
	"total_duration_ms": 120000,
	"clips": [
		{
			"clip_id": "c001",
			"source_file": "interview_01.mp4",
			"in_ms": 5200,
			"out_ms": 12800,
			"clip_type": "a-roll",
			"overlay_text": null,
			"transition": "cut",
			"search_query": null,
			"description": "Host introduces the topic of AI alignment"
		},
		{
			"clip_id": "c002",
			"source_file": "__SYNTH__",
			"in_ms": 0,
			"out_ms": 4000,
			"clip_type": "synth",
			"overlay_text": null,
			"transition": "crossfade",
			"search_query": "futuristic AI neural network visualization",
			"description": "Transition B-roll: abstract AI imagery"
		}
	],
	"music_prompt": "Ambient electronic, subtle and professional"
}
```

> **Note:** Clips with `source_file: "__SYNTH__"` are synthetic B-roll. The Synthesizer agent will search Pexels using `search_query` and fill them in. After synthesis, `source_file` will be updated to the downloaded file path.

---

#### `PUT /api/paper-edit`

Replace the entire Paper Edit.

**Request Body:** `PaperEdit` (full object)

**Response:**

```json
{ "status": "saved" }
```

---

#### `POST /api/paper-edit/clips`

Add a new clip to the end of the timeline.

**Request Body:**

```json
{
	"clip_id": "c003",
	"source_file": "interview_01.mp4",
	"in_ms": 45000,
	"out_ms": 52000,
	"clip_type": "a-roll",
	"transition": "crossfade",
	"description": "Closing thoughts"
}
```

**Response:**

```json
{ "status": "added", "total_clips": 3 }
```

---

#### `PATCH /api/paper-edit/clips/{clip_id}`

Update a single clip (partial update).

**Request Body:** Only include fields you want to change:

```json
{
	"clip_id": "c001",
	"in_ms": 6000,
	"out_ms": 14000,
	"transition": "crossfade"
}
```

**Response:**

```json
{
	"status": "updated",
	"clip": {
		"clip_id": "c001",
		"source_file": "interview_01.mp4",
		"in_ms": 6000,
		"out_ms": 14000,
		"clip_type": "a-roll",
		"transition": "crossfade",
		"description": "Host introduces the topic of AI alignment"
	}
}
```

---

#### `DELETE /api/paper-edit/clips/{clip_id}`

Remove a clip from the timeline.

**Response:**

```json
{ "status": "deleted", "remaining_clips": 2 }
```

---

#### `POST /api/paper-edit/reorder`

Reorder clips by providing an ordered list of clip IDs.

**Request Body:**

```json
{
	"clip_ids": ["c002", "c001", "c003"]
}
```

> Any `clip_id` not included in the list will be **removed** from the timeline.

**Response:**

```json
{ "status": "reordered", "total_clips": 3 }
```

---

### Output Files

#### `GET /api/output`

List all rendered output files.

**Response:** `OutputResponse`

```json
{
	"files": [
		{
			"file_name": "ai-safety-reel.mp4",
			"file_path": "/abs/path/output/ai-safety-reel.mp4",
			"size_bytes": 52428800,
			"download_url": "/api/output/ai-safety-reel.mp4",
			"type": "mp4"
		},
		{
			"file_name": "ai-safety-reel.fcpxml",
			"file_path": "/abs/path/output/ai-safety-reel.fcpxml",
			"size_bytes": 4096,
			"download_url": "/api/output/ai-safety-reel.fcpxml",
			"type": "fcpxml"
		}
	],
	"total": 2
}
```

#### `GET /api/output/{filename}`

Download a specific output file.

**Response:** Raw file binary with proper MIME type.

---

## WebSocket Protocol

### Connection

```typescript
const ws = new WebSocket("ws://localhost:8080/ws");
```

### Events: Server → Client

On connect, the server immediately sends the current state:

```json
{
	"type": "connected",
	"phase": "idle",
	"version": "0.1.0"
}
```

During pipeline execution:

```json
{
	"type": "phase_update",
	"node": "archivist",
	"phase": "indexed",
	"timestamp": "2025-01-15T10:30:05Z",
	"errors": []
}
```

When the pipeline pauses for human approval:

```json
{
  "type": "awaiting_approval",
  "paper_edit": {
    "title": "...",
    "clips": [ ... ]
  }
}
```

### Events: Client → Server

Keepalive ping:

```json
{ "type": "ping" }
```

Server responds:

```json
{ "type": "pong" }
```

### Full WebSocket Hook (React Example)

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import type { WSEvent, Phase } from "@/types/Montazh";

export function useMontazhWS() {
	const ws = useRef<WebSocket | null>(null);
	const [phase, setPhase] = useState<Phase>("idle");
	const [events, setEvents] = useState<WSEvent[]>([]);

	const connect = useCallback(() => {
		const socket = new WebSocket(`ws://${window.location.host}/ws`);

		socket.onmessage = (event) => {
			const data: WSEvent = JSON.parse(event.data);
			setEvents((prev) => [...prev, data]);

			switch (data.type) {
				case "connected":
				case "phase_update":
					setPhase(data.phase);
					break;
				case "awaiting_approval":
					setPhase("awaiting_approval");
					break;
			}
		};

		socket.onclose = () => {
			// Reconnect after 2 seconds
			setTimeout(connect, 2000);
		};

		ws.current = socket;
	}, []);

	useEffect(() => {
		connect();
		return () => ws.current?.close();
	}, [connect]);

	// Keepalive
	useEffect(() => {
		const interval = setInterval(() => {
			if (ws.current?.readyState === WebSocket.OPEN) {
				ws.current.send(JSON.stringify({ type: "ping" }));
			}
		}, 30000);
		return () => clearInterval(interval);
	}, []);

	return { phase, events };
}
```

---

## Frontend ↔ Backend Workflow

### Complete Pipeline Flow

```
Frontend                              Backend
   │                                     │
   │  1. User drops video files          │
   │─────POST /api/assets/upload────────▶│  Saves to media_drop/
   │◀────200 { metadata }───────────────│
   │                                     │
   │  2. User writes creative brief      │
   │─────POST /api/pipeline/run─────────▶│  Starts LangGraph pipeline
   │                                     │
   │  3. Real-time updates (WebSocket)   │
   │◀════ phase_update: "ingesting" ════│  Archivist: STT + VLM
   │◀════ phase_update: "indexed" ══════│
   │◀════ phase_update: "scripting" ════│  Scripter: Mistral generates Paper Edit
   │◀════ phase_update: "scripted" ═════│
   │◀════ awaiting_approval ════════════│  Producer: interrupt()
   │                                     │
   │  4. User reviews Paper Edit         │
   │─────GET /api/paper-edit────────────▶│
   │◀────200 { PaperEdit }─────────────│
   │                                     │
   │  5. User edits in timeline UI       │
   │─────PATCH /api/paper-edit/clips/c01▶│  Adjust in/out points
   │─────DELETE /api/paper-edit/clips/c03▶│  Remove a clip
   │─────POST /api/paper-edit/reorder───▶│  Drag-and-drop reorder
   │                                     │
   │  6. User approves                   │
   │─────POST /api/pipeline/approve─────▶│  Resume pipeline
   │     { action: "approve",            │
   │       paper_edit: { ... } }         │
   │                                     │
   │  7. Pipeline continues              │
   │◀════ phase_update: "synthesizing" ═│  Pexels stock footage
   │◀════ phase_update: "rendering" ════│  MoviePy/FFmpeg render
   │◀════ phase_update: "mastering" ════│  Audio normalization
   │◀════ phase_update: "complete" ═════│  Done!
   │                                     │
   │  8. User downloads output           │
   │─────GET /api/output────────────────▶│
   │◀────200 { files: [...] }──────────│
   │─────GET /api/output/reel.mp4───────▶│
   │◀────200 binary video──────────────│
```

### Timeline Editor Data Flow

The timeline editor should maintain a local copy of the `PaperEdit` and sync with the backend:

```typescript
// 1. Load Paper Edit when entering review mode
const paperEdit = await fetch("/api/paper-edit").then((r) => r.json());

// 2. User drags a clip to reorder → update locally + sync
const reordered = reorderClips(paperEdit.clips, dragResult);
setPaperEdit({ ...paperEdit, clips: reordered });
await fetch("/api/paper-edit/reorder", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ clip_ids: reordered.map((c) => c.clip_id) }),
});

// 3. User adjusts a clip's in/out point → patch
await fetch(`/api/paper-edit/clips/${clipId}`, {
	method: "PATCH",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ in_ms: newInMs, out_ms: newOutMs }),
});

// 4. User clicks "Approve & Render"
await fetch("/api/pipeline/approve", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ action: "approve", paper_edit: paperEdit }),
});
```

### Mapping Clips to the Timeline UI

Each `PaperEditClip` maps to a **block on the timeline**:

| PaperEditClip field | Timeline UI mapping                                                               |
| ------------------- | --------------------------------------------------------------------------------- |
| `clip_id`           | Unique key for the clip block                                                     |
| `source_file`       | Label / thumbnail source                                                          |
| `in_ms` / `out_ms`  | Block width on timeline (proportional to duration)                                |
| `clip_type`         | Track assignment: `a-roll` → video track 1, `b-roll`/`synth` → video track 2      |
| `overlay_text`      | Text track overlay indicator                                                      |
| `transition`        | Transition icon between clips (`cut` = hard edge, `crossfade` = gradient overlap) |
| `description`       | Tooltip on hover                                                                  |

#### Timeline track layout suggestion:

```
┌─────────────────────────────────────────────────────────────┐
│  VIDEO TRACK 2 (B-Roll)                                     │
│    ┌────────┐     ┌──────────────┐                          │
│    │ synth  │     │  b-roll      │                          │
│    │ c002   │     │  c004        │                          │
│    └────────┘     └──────────────┘                          │
├─────────────────────────────────────────────────────────────┤
│  VIDEO TRACK 1 (A-Roll)                                     │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────┐ │
│  │  a-roll c001 │╳│  a-roll c003    │╳│  a-roll c005     │ │
│  └──────────────┘ └─────────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  AUDIO TRACK (waveform)                                     │
│  ▁▂▃▅▇▅▃▂▁ ▁▂▃▅▇██▇▅▃▂▁ ▁▂▃▅▇▅▃▂▁                        │
├─────────────────────────────────────────────────────────────┤
│  TEXT TRACK (overlays)                                       │
│         ┌───────────────┐                                   │
│         │ "AI Safety"   │                                   │
│         └───────────────┘                                   │
├─────────────────────────────────────────────────────────────┤
│  0:00    0:10    0:20    0:30    0:40    0:50    1:00       │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

All errors return standard JSON:

```json
{
	"detail": "Human-readable error message"
}
```

| HTTP Status | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| 400         | Bad request (missing fields, invalid asset_type, etc.)        |
| 404         | Resource not found (no Paper Edit, asset doesn't exist, etc.) |
| 409         | Conflict (duplicate clip_id)                                  |
| 500         | Server error (pipeline crash, FFmpeg failure, etc.)           |

Pipeline errors are also accumulated in `PipelineStatus.errors[]` and broadcast via WebSocket in `phase_update.errors[]`.

---

## CORS

The backend allows all origins in development:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
```

The following headers are exposed for the frontend to read:

```
X-Total-Count, X-Pipeline-Phase
```

---

## Appendix: Recommended Frontend Tech Stack

| Purpose            | Recommended                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Framework          | React 19 + Next.js 15 (App Router) or Vite + React                                       |
| State Management   | Zustand or Jotai (lightweight, good for timeline state)                                  |
| Timeline Rendering | Custom canvas/SVG component or [wavesurfer.js](https://wavesurfer-js.org/) for waveforms |
| Video Playback     | HTML5 `<video>` element + custom controls                                                |
| Drag & Drop        | [@dnd-kit/core](https://dndkit.com/) for timeline clip reordering                        |
| HTTP Client        | `fetch` (native) or [ky](https://github.com/sindresorhus/ky)                             |
| WebSocket          | Native `WebSocket` with reconnection wrapper                                             |
| Styling            | Tailwind CSS v4                                                                          |
| Icons              | Lucide React                                                                             |

### Key Frontend Components to Build

1. **`<AssetBrowser />`** — Grid/list of media files with thumbnails, drag-to-timeline
2. **`<TimelineEditor />`** — Multi-track timeline with clip blocks, drag-to-reorder, resize handles for in/out points
3. **`<PreviewPlayer />`** — Video player showing the currently selected clip or full preview
4. **`<TransitionPicker />`** — Dropdown/modal between clips (cut, crossfade)
5. **`<WaveformTrack />`** — Audio waveform rendered from the `/waveform` endpoint
6. **`<PipelinePanel />`** — Real-time pipeline status with progress indicators
7. **`<CreativeBriefModal />`** — Input form for the AI prompt
8. **`<ExportPanel />`** — Download rendered video + timeline files
