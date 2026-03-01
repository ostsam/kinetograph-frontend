import { create } from "zustand";
import {
	Phase,
	RawAsset,
	PaperEdit,
	PipelineStatus,
	PipelineError,
	PaperEditClip,
	Track,
	OverlayClip,
	OverlayTransform,
	OverlayPreset,
	OVERLAY_PRESETS,
	PreviewResolution,
} from "@/types/kinetograph";

// ─── Default tracks ───────────────────────────────────────────────────────────

const DEFAULT_TRACKS: Track[] = [
	{ id: "V1", label: "V1", type: "video", muted: false, volume: 1, locked: false },
	{ id: "V2", label: "V2", type: "video", muted: false, volume: 1, locked: false },
	{ id: "A1", label: "A1", type: "audio", muted: false, volume: 1, locked: false },
	{ id: "A2", label: "A2", type: "audio", muted: false, volume: 0.35, locked: false },
];

interface KinetographState {
	// Core State
	phase: Phase;
	assets: RawAsset[];
	paperEdit: PaperEdit | null;
	pipelineStatus: PipelineStatus | null;
	errors: PipelineError[];

	// Multi-track
	tracks: Track[];
	musicPath: string | null;      // background music file path from sound engineer
	v2Clips: OverlayClip[];        // overlay clips on V2 track
	a2Clips: { id: string; sourceAssetId: string; sourceFile: string; inMs: number; outMs: number; timelineStartMs: number }[]; // independent A2 clips

	// UI State
	selectedAssetId: string | null;
	selectedAssetIds: Set<string>;
	selectedClipId: string | null;
	selectedV2ClipId: string | null;
	playheadMs: number;
	renderUrl: string | null;
	previewResolution: PreviewResolution;

	// Actions
	setPhase: (phase: Phase) => void;
	setRenderUrl: (url: string | null) => void;
	setAssets: (assets: RawAsset[]) => void;
	addAssets: (assets: RawAsset[]) => void;
	renameAsset: (assetId: string, fileName: string) => void;
	deleteAsset: (assetId: string) => void;
	setPaperEdit: (paperEdit: PaperEdit | null) => void;
	setPipelineStatus: (status: PipelineStatus | null) => void;
	addError: (error: PipelineError) => void;
	clearErrors: () => void;

	// Asset Selection
	toggleAssetSelected: (assetId: string, multi: boolean) => void;
	selectAllByType: (type: RawAsset['asset_type']) => void;
	clearAssetSelection: () => void;
	toggleAssetType: (assetId: string) => void;

	// Timeline Actions (Optimistic)
	updateClip: (clipId: string, updates: Partial<PaperEditClip>) => void;
	reorderClips: (clipIds: string[]) => void;
	deleteClip: (clipId: string) => void;

	// Track Actions
	setTrackVolume: (trackId: string, volume: number) => void;
	toggleTrackMute: (trackId: string) => void;
	setMusicPath: (path: string | null) => void;

	// V2 Overlay Actions
	addV2Clip: (assetId: string, timelineStartMs: number) => string | null;
	removeV2Clip: (clipId: string) => void;
	updateV2ClipTransform: (clipId: string, transform: Partial<OverlayTransform>) => void;
	setV2ClipPreset: (clipId: string, preset: OverlayPreset) => void;
	reorderV2Clips: (clipIds: string[]) => void;
	setSelectedV2Clip: (clipId: string | null) => void;
	trimV2Clip: (clipId: string, edge: 'in' | 'out', deltaMs: number) => void;

	// A2 Audio Actions
	addA2Clip: (assetId: string, timelineStartMs: number) => string | null;
	removeA2Clip: (clipId: string) => void;

	// History (undo/redo)
	undoStack: PaperEdit[];
	redoStack: PaperEdit[];
	undo: () => void;
	redo: () => void;

	// Player Actions
	setPlayhead: (ms: number) => void;
	setSelectedAsset: (assetId: string | null) => void;
	setSelectedClip: (clipId: string | null) => void;
	setPreviewResolution: (res: PreviewResolution) => void;
	addAssetToTimeline: (assetId: string, targetTrack?: 'V1' | 'V2' | 'A2') => string | null;
	addAssetsToTimeline: (assetIds: string[], targetTrack?: 'V1' | 'V2' | 'A2') => string[];
}

function createClipId() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return `clip-${crypto.randomUUID()}`;
	}
	return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useKinetographStore = create<KinetographState>((set, get) => ({
	phase: Phase.IDLE,
	assets: [],
	paperEdit: null,
	pipelineStatus: null,
	errors: [],
	tracks: DEFAULT_TRACKS,
	musicPath: null,
	v2Clips: [],
	a2Clips: [],
	selectedAssetId: null,
	selectedAssetIds: new Set<string>(),
	selectedClipId: null,
	selectedV2ClipId: null,
	playheadMs: 0,
	renderUrl: null,
	previewResolution: '16:9' as PreviewResolution,
	undoStack: [],
	redoStack: [],

	setPhase: (phase) => set({ phase }),
	setRenderUrl: (url) => set({ renderUrl: url }),
	setAssets: (assets) =>
		set((state) => ({
			assets,
			selectedAssetId:
				state.selectedAssetId &&
				!assets.some((asset) => asset.id === state.selectedAssetId)
					? null
					: state.selectedAssetId,
		})),
	addAssets: (newAssets) =>
		set((state) => ({
			assets: [...state.assets, ...newAssets],
		})),
	renameAsset: (assetId, fileName) =>
		set((state) => ({
			assets: state.assets.map((asset) =>
				asset.id === assetId
					? {
							...asset,
							file_name: fileName,
							file_path: fileName,
						}
					: asset,
			),
		})),
	deleteAsset: (assetId) =>
		set((state) => {
			const assetToDelete = state.assets.find((asset) => asset.id === assetId);
			if (assetToDelete?.stream_url.startsWith("blob:")) {
				URL.revokeObjectURL(assetToDelete.stream_url);
			}

			const remainingAssets = state.assets.filter(
				(asset) => asset.id !== assetId,
			);
			return {
				assets: remainingAssets,
				selectedAssetId:
					state.selectedAssetId === assetId ? null : state.selectedAssetId,
			};
		}),
	setPaperEdit: (paperEdit) => set({
		paperEdit,
		musicPath: paperEdit?.music_path ?? get().musicPath,
	}),
	setPipelineStatus: (status) =>
		set({ pipelineStatus: status, phase: status?.phase ?? Phase.IDLE }),
	addError: (error) => set((state) => ({ errors: [...state.errors, error] })),
	clearErrors: () => set({ errors: [] }),

	// ─── Track Actions ─────────────────────────────────────────────
	setTrackVolume: (trackId, volume) =>
		set((state) => ({
			tracks: state.tracks.map((t) =>
				t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t,
			),
		})),

	toggleTrackMute: (trackId) =>
		set((state) => ({
			tracks: state.tracks.map((t) =>
				t.id === trackId ? { ...t, muted: !t.muted } : t,
			),
		})),

	setMusicPath: (path) => set({ musicPath: path }),

	// ─── V2 Overlay Actions ────────────────────────────────────────
	addV2Clip: (assetId, timelineStartMs) => {
		const state = get();
		const asset = state.assets.find((a) => a.id === assetId);
		if (!asset) return null;
		const id = `v2-${createClipId()}`;
		const clip: OverlayClip = {
			id,
			sourceAssetId: assetId,
			sourceFile: asset.file_name,
			inMs: 0,
			outMs: asset.duration_ms,
			timelineStartMs,
			transform: { ...OVERLAY_PRESETS['pip-br'] },
			preset: 'pip-br',
		};
		set((s) => ({ v2Clips: [...s.v2Clips, clip], selectedV2ClipId: id }));
		return id;
	},

	removeV2Clip: (clipId) =>
		set((s) => ({
			v2Clips: s.v2Clips.filter((c) => c.id !== clipId),
			selectedV2ClipId: s.selectedV2ClipId === clipId ? null : s.selectedV2ClipId,
		})),

	updateV2ClipTransform: (clipId, transform) =>
		set((s) => ({
			v2Clips: s.v2Clips.map((c) =>
				c.id === clipId ? { ...c, transform: { ...c.transform, ...transform }, preset: 'custom' as const } : c,
			),
		})),

	setV2ClipPreset: (clipId, preset) =>
		set((s) => ({
			v2Clips: s.v2Clips.map((c) =>
				c.id === clipId ? { ...c, preset, transform: { ...OVERLAY_PRESETS[preset] } } : c,
			),
		})),

	reorderV2Clips: (clipIds) =>
		set((s) => {
			const clipMap = new Map(s.v2Clips.map((c) => [c.id, c]));
			const ordered = clipIds.map((id) => clipMap.get(id)).filter((c): c is OverlayClip => !!c);
			return { v2Clips: ordered };
		}),

	setSelectedV2Clip: (clipId) => set({ selectedV2ClipId: clipId }),

	trimV2Clip: (clipId, edge, deltaMs) =>
		set((s) => ({
			v2Clips: s.v2Clips.map((c) => {
				if (c.id !== clipId) return c;
				const MIN = 200;
				if (edge === 'in') {
					const newIn = Math.max(0, c.inMs + deltaMs);
					return { ...c, inMs: c.outMs - newIn < MIN ? c.outMs - MIN : newIn };
				} else {
					const newOut = Math.max(c.inMs + MIN, c.outMs + deltaMs);
					return { ...c, outMs: newOut };
				}
			}),
		})),

	// ─── A2 Audio Actions ─────────────────────────────────────────
	addA2Clip: (assetId, timelineStartMs) => {
		const state = get();
		const asset = state.assets.find((a) => a.id === assetId);
		if (!asset) return null;
		const id = `a2-${createClipId()}`;
		const clip = {
			id,
			sourceAssetId: assetId,
			sourceFile: asset.file_name,
			inMs: 0,
			outMs: asset.duration_ms,
			timelineStartMs,
		};
		set((s) => ({ a2Clips: [...s.a2Clips, clip] }));
		return id;
	},

	removeA2Clip: (clipId) =>
		set((s) => ({ a2Clips: s.a2Clips.filter((c) => c.id !== clipId) })),

	undo: () =>
		set((state) => {
			if (state.undoStack.length === 0) return state;
			const [prev, ...rest] = state.undoStack;
			return {
				paperEdit: prev,
				undoStack: rest,
				redoStack: state.paperEdit
					? [state.paperEdit, ...state.redoStack].slice(0, 50)
					: state.redoStack,
			};
		}),
	redo: () =>
		set((state) => {
			if (state.redoStack.length === 0) return state;
			const [next, ...rest] = state.redoStack;
			return {
				paperEdit: next,
				redoStack: rest,
				undoStack: state.paperEdit
					? [state.paperEdit, ...state.undoStack].slice(0, 50)
					: state.undoStack,
			};
		}),

	updateClip: (clipId, updates) =>
		set((state) => {
			if (!state.paperEdit) return state;
			const newClips = state.paperEdit.clips.map((clip) =>
				clip.clip_id === clipId ? { ...clip, ...updates } : clip,
			);
			const totalDurationMs = newClips.reduce(
				(sum, clip) => sum + (clip.out_ms - clip.in_ms),
				0,
			);
			return {
				paperEdit: {
					...state.paperEdit,
					clips: newClips,
					total_duration_ms: totalDurationMs,
				},
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(0, 50),
				redoStack: [],
			};
		}),

	reorderClips: (clipIds) =>
		set((state) => {
			if (!state.paperEdit) return state;
			const clipMap = new Map(state.paperEdit.clips.map((c) => [c.clip_id, c]));
			const newClips = clipIds
				.map((id) => clipMap.get(id))
				.filter((c): c is PaperEditClip => !!c);
			return {
				paperEdit: { ...state.paperEdit, clips: newClips },
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(0, 50),
				redoStack: [],
			};
		}),

	deleteClip: (clipId) =>
		set((state) => {
			if (!state.paperEdit) return state;
			const newClips = state.paperEdit.clips.filter(
				(c) => c.clip_id !== clipId,
			);
			const totalDurationMs = newClips.reduce(
				(sum, clip) => sum + (clip.out_ms - clip.in_ms),
				0,
			);
			return {
				paperEdit: {
					...state.paperEdit,
					clips: newClips,
					total_duration_ms: totalDurationMs,
				},
				selectedClipId:
					state.selectedClipId === clipId ? null : state.selectedClipId,
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(0, 50),
				redoStack: [],
			};
		}),

	setPlayhead: (ms) => set({ playheadMs: ms }),
	setSelectedAsset: (assetId) => set({ selectedAssetId: assetId, selectedAssetIds: assetId ? new Set([assetId]) : new Set() }),
	setSelectedClip: (clipId) => set({ selectedClipId: clipId }),
	setPreviewResolution: (res) => set({ previewResolution: res }),

	toggleAssetSelected: (assetId, multi) =>
		set((s) => {
			if (!multi) return { selectedAssetId: assetId, selectedAssetIds: new Set([assetId]) };
			const next = new Set(s.selectedAssetIds);
			if (next.has(assetId)) { next.delete(assetId); } else { next.add(assetId); }
			return { selectedAssetId: assetId, selectedAssetIds: next };
		}),
	selectAllByType: (type) =>
		set((s) => {
			const ids = new Set(s.assets.filter((a) => a.asset_type === type).map((a) => a.id));
			return { selectedAssetIds: ids, selectedAssetId: [...ids][0] ?? null };
		}),
	clearAssetSelection: () => set({ selectedAssetIds: new Set(), selectedAssetId: null }),
	toggleAssetType: (assetId) =>
		set((s) => ({
			assets: s.assets.map((a) =>
				a.id === assetId
					? { ...a, asset_type: a.asset_type === 'a-roll' ? 'b-roll' as const : 'a-roll' as const }
					: a,
			),
		})),
	addAssetToTimeline: (assetId, targetTrack) => {
		const state = get();
		const asset = state.assets.find((item) => item.id === assetId);
		if (!asset) return null;

		// Route to V2 overlay track
		if (targetTrack === 'V2') {
			const totalMs = state.paperEdit?.clips.reduce((s, c) => s + (c.out_ms - c.in_ms), 0) ?? 0;
			return get().addV2Clip(assetId, 0);
		}

		// Route to A2 audio track
		if (targetTrack === 'A2') {
			return get().addA2Clip(assetId, 0);
		}

		const clipType: PaperEditClip["clip_type"] =
			asset.asset_type === "a-roll"
				? "a-roll"
				: asset.asset_type === "b-roll-synth"
					? "synth"
					: "b-roll";

		const clip: PaperEditClip = {
			clip_id: createClipId(),
			source_file: asset.file_name,
			in_ms: 0,
			out_ms: asset.duration_ms,
			clip_type: clipType,
			description: asset.file_name,
			transition: "cut" as const,
		};

		set((current) => {
			const currentClips = current.paperEdit?.clips ?? [];
			const clips = [...currentClips, clip];
			const totalDurationMs = clips.reduce(
				(sum, item) => sum + (item.out_ms - item.in_ms),
				0,
			);

			return {
				paperEdit: {
					title: current.paperEdit?.title ?? "Untitled Sequence",
					total_duration_ms: totalDurationMs,
					clips,
					music_prompt: current.paperEdit?.music_prompt,
				},
				undoStack: current.paperEdit
					? [structuredClone(current.paperEdit), ...current.undoStack].slice(0, 50)
					: current.undoStack,
				redoStack: [],
			};
		});

		return clip.clip_id;
	},

	addAssetsToTimeline: (assetIds, targetTrack) => {
		const results: string[] = [];
		for (const assetId of assetIds) {
			const id = get().addAssetToTimeline(assetId, targetTrack);
			if (id) results.push(id);
		}
		return results;
	},
}));
