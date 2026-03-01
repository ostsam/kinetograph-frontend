// 💬 Chat system types for the AI agent interface

import { Phase, PaperEdit, PipelineError, TransitionType, CaptionStylePreset } from "./kinetograph";

// ─── Message Roles ─────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

// ─── Agent Activity ────────────────────────────────────────────────────────────

export interface AgentActivity {
  agent: string;          // e.g. "Archivist", "Scripter", "Synthesizer"
  phase: Phase;
  description: string;    // e.g. "Indexing footage with STT + VLM..."
  startedAt: number;      // Date.now()
  isActive: boolean;
}

// ─── Chat Message Variants ─────────────────────────────────────────────────────

export type ChatMessageType =
  | "text"
  | "agent-update"
  | "approval-request"
  | "approval-response"
  | "caption-style-request"
  | "pipeline-complete"
  | "pipeline-error"
  | "edit-request"
  | "edit-response"
  | "loading";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  type: ChatMessageType;
  content: string;
  timestamp: number;

  // Agent update metadata
  agent?: string;
  phase?: Phase;

  // Approval request payload
  paperEdit?: PaperEdit;

  // Caption style picker payload
  captionStyles?: CaptionStylePreset[];

  // Error payload
  errors?: PipelineError[];

  // Pipeline completion
  renderPath?: string;
  timelinePath?: string;

  // Edit request/response
  editInstruction?: string;
  editType?: EditType;
}

// ─── Edit Types (post-pipeline) ────────────────────────────────────────────────

export type EditType =
  | "rescript"       // Re-run scripter → new paper edit
  | "resynthesize"   // Re-run synthesizer → new B-roll
  | "rerender"       // Re-run director → new render
  | "audio"          // Re-run sound engineer → new audio/music
  | "general";       // LLM decides which agents to invoke

export interface EditRequest {
  instruction: string;
  edit_type?: EditType;
}

export interface EditResponse {
  status: "processing" | "complete" | "error";
  message: string;
  phase?: Phase;
  paper_edit?: PaperEdit;
  render_path?: string;
}

// ─── Phase → Human-readable descriptions ──────────────────────────────────────

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  [Phase.IDLE]: "Waiting for input...",
  [Phase.INGESTING]: "📦 Archivist is ingesting your footage — running speech-to-text & visual analysis...",
  [Phase.INDEXED]: "✅ Footage indexed! Master index built with transcripts & scene descriptions.",
  [Phase.SCRIPTING]: "✍️ Scripter is crafting your paper edit with Mistral AI...",
  [Phase.SCRIPTED]: "📝 Script complete! Paper edit generated.",
  [Phase.AWAITING_APPROVAL]: "⏸️ Ready for your review! Check the timeline below and approve or request changes.",
  [Phase.APPROVED]: "👍 Approved! Continuing pipeline...",
  [Phase.SYNTHESIZING]: "🎬 Synthesizer is sourcing B-roll from Pexels stock footage...",
  [Phase.SYNTHESIZED]: "✅ B-roll sourced and downloaded.",
  [Phase.NORMALIZING]: "🎞️ Director is normalizing clip formats for assembly...",
  [Phase.NORMALIZED]: "✅ All clips normalized.",
  [Phase.RENDERING]: "🖥️ Director is rendering the final cut with MoviePy...",
  [Phase.RENDERED]: "✅ Render complete!",
  [Phase.CAPTIONING]: "📝 Captioner is burning captions into the video...",
  [Phase.MASTERING]: "🔊 Sound Engineer is mastering audio — music, levels, normalization...",
  [Phase.MASTERED]: "✅ Audio mastered.",
  [Phase.EXPORTING]: "📤 Exporting timeline files (FCPXML, OTIO)...",
  [Phase.COMPLETE]: "🎉 Your video is ready! It's been loaded into the timeline.",
  [Phase.ERROR]: "❌ An error occurred during processing.",
};

// ─── Agent names mapped from pipeline node names ──────────────────────────────

export const NODE_TO_AGENT: Record<string, string> = {
  archivist: "Archivist",
  scripter: "Scripter",
  producer: "Producer",
  synthesizer: "Synthesizer",
  director: "Director",
  captioner: "Captioner",
  sound_engineer: "Sound Engineer",
  export: "Export",
  error_handler: "Error Handler",
  edit_agent: "Edit Agent",
};
