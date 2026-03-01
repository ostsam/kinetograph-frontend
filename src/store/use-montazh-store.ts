import { create } from "zustand";
import {
	Phase,
	RawAsset,
	PaperEdit,
	PipelineStatus,
	PipelineError,
	PaperEditClip,
} from "@/types/montazh";

interface MontazhState {
	// Core State
	phase: Phase;
	assets: RawAsset[];
	paperEdit: PaperEdit | null;
	pipelineStatus: PipelineStatus | null;
	errors: PipelineError[];

	// UI State
	selectedAssetId: string | null;
	selectedClipId: string | null;
	playheadMs: number;
	renderUrl: string | null;

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

	// Timeline Actions (Optimistic)
	updateClip: (clipId: string, updates: Partial<PaperEditClip>) => void;
	reorderClips: (clipIds: string[]) => void;
	deleteClip: (clipId: string) => void;

	// History (undo/redo)
	undoStack: PaperEdit[];
	redoStack: PaperEdit[];
	undo: () => void;
	redo: () => void;

	// Player Actions
	setPlayhead: (ms: number) => void;
	setSelectedAsset: (assetId: string | null) => void;
	setSelectedClip: (clipId: string | null) => void;
	addAssetToTimeline: (assetId: string) => string | null;
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

export const useMontazhStore = create<MontazhState>((set, get) => ({
	phase: Phase.IDLE,
	assets: [],
	paperEdit: null,
	pipelineStatus: null,
	errors: [],
	selectedAssetId: null,
	selectedClipId: null,
	playheadMs: 0,
	renderUrl: null,
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
	setPaperEdit: (paperEdit) => set({ paperEdit }),
	setPipelineStatus: (status) =>
		set({ pipelineStatus: status, phase: status?.phase ?? Phase.IDLE }),
	addError: (error) => set((state) => ({ errors: [...state.errors, error] })),
	clearErrors: () => set({ errors: [] }),

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
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(
					0,
					50,
				),
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
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(
					0,
					50,
				),
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
				undoStack: [structuredClone(state.paperEdit), ...state.undoStack].slice(
					0,
					50,
				),
				redoStack: [],
			};
		}),

	setPlayhead: (ms) => set({ playheadMs: ms }),
	setSelectedAsset: (assetId) => set({ selectedAssetId: assetId }),
	setSelectedClip: (clipId) => set({ selectedClipId: clipId }),
	addAssetToTimeline: (assetId) => {
		const state = get();
		const asset = state.assets.find((item) => item.id === assetId);
		if (!asset) return null;

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
					? [structuredClone(current.paperEdit), ...current.undoStack].slice(
							0,
							50,
						)
					: current.undoStack,
				redoStack: [],
			};
		});

		return clip.clip_id;
	},
}));
