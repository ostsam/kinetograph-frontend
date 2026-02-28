// 🎬 Kinetograph TypeScript Interfaces
// Based on API.md and the "Hollywood Swarm" 8-agent architecture

export enum Phase {
  IDLE = 'idle',
  INGESTING = 'ingesting',
  INDEXED = 'indexed',
  SCRIPTING = 'scripting',
  SCRIPTED = 'scripted',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVED = 'approved',
  SYNTHESIZING = 'synthesizing',
  SYNTHESIZED = 'synthesized',
  NORMALIZING = 'normalizing',
  NORMALIZED = 'normalized',
  RENDERING = 'rendering',
  RENDERED = 'rendered',
  MASTERING = 'mastering',
  MASTERED = 'mastered',
  EXPORTING = 'exporting',
  COMPLETE = 'complete',
  ERROR = 'error',
}

// Map of phases to the agent currently "waking up"
export const AgentMap: Record<Phase, string | null> = {
  [Phase.IDLE]: null,
  [Phase.INGESTING]: 'Archivist',
  [Phase.INDEXED]: 'Archivist',
  [Phase.SCRIPTING]: 'Scripter',
  [Phase.SCRIPTED]: 'Scripter',
  [Phase.AWAITING_APPROVAL]: 'Producer (Human)',
  [Phase.APPROVED]: 'Producer (Human)',
  [Phase.SYNTHESIZING]: 'Synthesizer',
  [Phase.SYNTHESIZED]: 'Synthesizer',
  [Phase.NORMALIZING]: 'Director',
  [Phase.NORMALIZED]: 'Director',
  [Phase.RENDERING]: 'Director',
  [Phase.RENDERED]: 'Motion Grapher',
  [Phase.MASTERING]: 'Sound Engineer',
  [Phase.MASTERED]: 'Sound Engineer',
  [Phase.EXPORTING]: 'QA Lead',
  [Phase.COMPLETE]: 'QA Lead',
  [Phase.ERROR]: 'QA Lead',
};

export type ClipType = 'a-roll' | 'b-roll' | 'synth';
export type TransitionType = 'cut' | 'crossfade';

export interface RawAsset {
  id: string;
  file_name: string;
  file_path: string;
  asset_type: 'a-roll' | 'b-roll' | 'b-roll-synth';
  duration_ms: number;
  width: number;
  height: number;
  fps: number;
  has_audio: boolean;
  codec: string;
  thumbnail_url: string;
  waveform_url: string | null;
  stream_url: string;
  error?: string;
}

export interface AssetsResponse {
  assets: RawAsset[];
  total: number;
}

export interface TranscriptWord {
  text: string;
  start_ms: number;
  end_ms: number;
  speaker_id: string | null;
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

export interface PaperEditClip {
  clip_id: string;
  source_file: string;
  in_ms: number;
  out_ms: number;
  clip_type: ClipType;
  overlay_text?: string;
  transition?: TransitionType;
  search_query?: string;
  description: string;
}

export interface PaperEdit {
  title: string;
  total_duration_ms: number;
  clips: PaperEditClip[];
  music_prompt?: string;
}

export interface PipelineError {
  agent: string;
  message: string;
  phase: string;
  recoverable: boolean;
  details?: string;
}

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

export interface RunRequest {
  prompt: string;
  project_name?: string;
}

export interface RunResponse {
  status: 'awaiting_approval' | 'complete';
  thread_id?: string;
  message?: string;
  phase?: string;
  render_path?: string;
  timeline_path?: string;
}

export interface ApprovalRequest {
  action: 'approve' | 'reject';
  paper_edit?: PaperEdit;
  reason?: string;
}

export interface OutputFile {
  file_name: string;
  file_path: string;
  size_bytes: number;
  download_url: string;
  type: string;
}

export interface OutputResponse {
  files: OutputFile[];
  total: number;
}

export type WSEvent =
  | { type: 'connected'; phase: Phase; version: string }
  | { type: 'pipeline_started'; thread_id: string }
  | { type: 'phase_update'; node: string; phase: Phase; timestamp: string; errors: PipelineError[] }
  | { type: 'awaiting_approval'; paper_edit: PaperEdit }
  | { type: 'pong' };
