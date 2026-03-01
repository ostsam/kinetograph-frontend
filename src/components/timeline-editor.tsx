"use client";

import {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback,
	type DragEvent,
} from "react";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	type DragEndEvent,
	type UniqueIdentifier,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	horizontalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI, normalizeAPIError } from "@/lib/api";
import {
	buildTimelineSegments,
	cloneSegments,
	flattenSegmentsToClips,
	flattenSegmentsToClipIds,
	findBrollPosition,
} from "@/lib/timeline-segments";
import {
	type PaperEdit,
	type PaperEditClip,
	type TimelineSegment,
	type ClipUpdateRequest,
} from "@/types/kinetograph";
import {
	CheckCircle2,
	AlertCircle,
	Loader2,
	Trash2,
	ZoomIn,
	ZoomOut,
	MoveHorizontal,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const BASE_PIXELS_PER_SECOND = 14;
const MIN_ZOOM_LEVEL = 0.25;
const MAX_ZOOM_LEVEL = 6;
const PATCH_DEBOUNCE_MS = 300;
const MIN_CLIP_DURATION_MS = 500;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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

function clipDurationMs(clip: Pick<PaperEditClip, "in_ms" | "out_ms">) {
	return Math.max(0, clip.out_ms - clip.in_ms);
}

function calculateTotalDurationMs(clips: PaperEditClip[]) {
	return clips.reduce((sum, clip) => sum + clipDurationMs(clip), 0);
}

function toSegmentSortableId(segmentId: string) {
	return `segment:${segmentId}`;
}

function toBrollSortableId(clipId: string) {
	return `broll:${clipId}`;
}

function toBrollContainerId(segmentId: string) {
	return `broll-container:${segmentId}`;
}

function parseSegmentId(id: UniqueIdentifier) {
	const value = String(id);
	if (!value.startsWith("segment:")) return null;
	return value.slice("segment:".length);
}

function parseBrollId(id: UniqueIdentifier) {
	const value = String(id);
	if (!value.startsWith("broll:")) return null;
	return value.slice("broll:".length);
}

function parseBrollContainerSegmentId(id: UniqueIdentifier) {
	const value = String(id);
	if (!value.startsWith("broll-container:")) return null;
	return value.slice("broll-container:".length);
}

function createPaperEditFromClips(
	base: PaperEdit,
	clips: PaperEditClip[],
): PaperEdit {
	return {
		...base,
		clips,
		total_duration_ms: calculateTotalDurationMs(clips),
	};
}

interface SortableClipCardProps {
	sortableId: string;
	clip: PaperEditClip;
	isSelected: boolean;
	pxPerSecond: number;
	label: string;
	onClick: () => void;
	onDelete: () => void;
}

function SortableClipCard({
	sortableId,
	clip,
	isSelected,
	pxPerSecond,
	label,
	onClick,
	onDelete,
}: SortableClipCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: sortableId });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const width = Math.max(120, (clipDurationMs(clip) / 1000) * pxPerSecond);

	return (
		<div
			ref={setNodeRef}
			style={{ ...style, width: `${width}px` }}
			onClick={onClick}
			className={cn(
				"relative shrink-0 select-none overflow-hidden rounded-sm border border-zinc-700 bg-zinc-900/70 shadow-sm transition-colors",
				isSelected && "border-amber-500/60 bg-amber-500/10",
				isDragging && "opacity-60",
			)}
		>
			<div
				{...attributes}
				{...listeners}
				className="flex h-6 cursor-grab items-center justify-between border-b border-zinc-800 bg-black/20 px-2 text-[9px] uppercase tracking-wide text-zinc-400 active:cursor-grabbing"
			>
				<span>{label}</span>
				<MoveHorizontal className="h-3 w-3" />
			</div>
			<div className="space-y-1 p-2">
				<p className="truncate text-[10px] font-bold uppercase tracking-tight text-zinc-200">
					{clip.description || clip.source_file}
				</p>
				<p className="text-[9px] font-mono text-zinc-500">
					{clip.in_ms}ms → {clip.out_ms}ms
				</p>
				<div className="mt-2 flex items-center justify-end">
					<button
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							onDelete();
						}}
						className="rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
						title="Delete clip"
					>
						<Trash2 className="h-3 w-3" />
					</button>
				</div>
			</div>
		</div>
	);
}

interface BrollLaneProps {
	segment: TimelineSegment;
	selectedClipId: string | null;
	pxPerSecond: number;
	onSelectClip: (clipId: string) => void;
	onDeleteClip: (clipId: string) => void;
	onDropAsset: (event: DragEvent<HTMLDivElement>, segmentId: string) => void;
}

function BrollLane({
	segment,
	selectedClipId,
	pxPerSecond,
	onSelectClip,
	onDeleteClip,
	onDropAsset,
}: BrollLaneProps) {
	const droppableId = toBrollContainerId(segment.id);
	const { isOver, setNodeRef } = useDroppable({ id: droppableId });

	return (
		<div
			ref={setNodeRef}
			onDragOver={(event) => {
				if (
					event.dataTransfer.types.includes("application/x-kinetograph-asset-id")
				) {
					event.preventDefault();
					event.stopPropagation();
				}
			}}
			onDrop={(event) => {
				event.stopPropagation();
				onDropAsset(event, segment.id);
			}}
			className={cn(
				"flex min-h-24 items-center gap-2 rounded-sm border border-dashed border-zinc-800 bg-zinc-950/40 px-2 py-2 transition-colors",
				isOver && "border-amber-500/70 bg-amber-500/10",
			)}
		>
			<SortableContext
				items={segment.bRolls.map((clip) => toBrollSortableId(clip.clip_id))}
				strategy={horizontalListSortingStrategy}
			>
				{segment.bRolls.length === 0 && (
					<div className="px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
						Drop B-roll here
					</div>
				)}
				{segment.bRolls.map((clip) => (
					<SortableClipCard
						key={clip.clip_id}
						sortableId={toBrollSortableId(clip.clip_id)}
						clip={clip}
						label={clip.clip_type === "synth" ? "Synth" : "B-roll"}
						isSelected={selectedClipId === clip.clip_id}
						pxPerSecond={pxPerSecond}
						onClick={() => onSelectClip(clip.clip_id)}
						onDelete={() => onDeleteClip(clip.clip_id)}
					/>
				))}
			</SortableContext>
		</div>
	);
}

export function TimelineEditor() {
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const assets = useKinetographStore((s) => s.assets);
	const selectedClipId = useKinetographStore((s) => s.selectedClipId);
	const setSelectedClip = useKinetographStore((s) => s.setSelectedClip);
	const updateClip = useKinetographStore((s) => s.updateClip);
	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);
	const [zoomLevel, setZoomLevel] = useState(1);
	const [syncError, setSyncError] = useState<string | null>(null);
	const [queuedPatchCount, setQueuedPatchCount] = useState(0);
	const [inFlightMutationCount, setInFlightMutationCount] = useState(0);
	const [isApproving, setIsApproving] = useState(false);

	const patchQueueRef = useRef<
		Map<
			string,
			{
				updates: Partial<Omit<ClipUpdateRequest, "clip_id">>;
				timer: ReturnType<typeof setTimeout>;
			}
		>
	>(new Map());

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const segments = useMemo(
		() => buildTimelineSegments(paperEdit?.clips ?? []),
		[paperEdit],
	);
	const aRollSegments = useMemo(
		() => segments.filter((segment) => !!segment.anchor),
		[segments],
	);
	const preludeSegment = useMemo(
		() => segments.find((segment) => segment.anchor === null) ?? null,
		[segments],
	);

	const pxPerSecond = BASE_PIXELS_PER_SECOND * zoomLevel;
	const hasUnsyncedMutations =
		queuedPatchCount > 0 || inFlightMutationCount > 0 || isApproving;

	const selectedClip = useMemo(
		() =>
			paperEdit?.clips.find((clip) => clip.clip_id === selectedClipId) ?? null,
		[paperEdit, selectedClipId],
	);

	useEffect(() => {
		if (
			selectedClipId &&
			paperEdit &&
			!paperEdit.clips.some((clip) => clip.clip_id === selectedClipId)
		) {
			setSelectedClip(null);
		}
	}, [paperEdit, selectedClipId, setSelectedClip]);

	const refetchPaperEdit = useCallback(async () => {
		try {
			const refreshed = await KinetographAPI.getPaperEdit();
			setPaperEdit(refreshed);
		} catch {
			// Keep optimistic local state if refetch fails as well.
		}
	}, [setPaperEdit]);

	const flushClipPatchNow = useCallback(
		async (clipId: string) => {
			const queued = patchQueueRef.current.get(clipId);
			if (!queued) return;

			clearTimeout(queued.timer);
			patchQueueRef.current.delete(clipId);
			setQueuedPatchCount(patchQueueRef.current.size);
			setInFlightMutationCount((count) => count + 1);

			try {
				await KinetographAPI.updateClip(clipId, queued.updates);
			} catch (err) {
				const normalized = await normalizeAPIError(
					err,
					"Failed to sync clip edits.",
				);
				setSyncError(normalized.detail);
				await refetchPaperEdit();
			} finally {
				setInFlightMutationCount((count) => Math.max(0, count - 1));
			}
		},
		[refetchPaperEdit],
	);

	const flushQueuedPatches = useCallback(async () => {
		const clipIds = [...patchQueueRef.current.keys()];
		for (const clipId of clipIds) {
			await flushClipPatchNow(clipId);
		}
	}, [flushClipPatchNow]);

	useEffect(() => {
		const patchQueue = patchQueueRef.current;
		return () => {
			for (const queued of patchQueue.values()) {
				clearTimeout(queued.timer);
			}
			patchQueue.clear();
		};
	}, []);

	const queueClipPatch = useCallback(
		(clipId: string, updates: Partial<Omit<ClipUpdateRequest, "clip_id">>) => {
			const existing = patchQueueRef.current.get(clipId);
			if (existing) {
				clearTimeout(existing.timer);
			}
			const mergedUpdates = { ...(existing?.updates ?? {}), ...updates };
			const timer = setTimeout(() => {
				void flushClipPatchNow(clipId);
			}, PATCH_DEBOUNCE_MS);
			patchQueueRef.current.set(clipId, { updates: mergedUpdates, timer });
			setQueuedPatchCount(patchQueueRef.current.size);
		},
		[flushClipPatchNow],
	);

	const applySegmentReorder = useCallback(
		async (nextSegments: TimelineSegment[]) => {
			const current = useKinetographStore.getState().paperEdit;
			if (!current) return;

			const previous = current;
			const nextClips = flattenSegmentsToClips(nextSegments);
			const nextEdit = createPaperEditFromClips(current, nextClips);
			setPaperEdit(nextEdit);
			setInFlightMutationCount((count) => count + 1);
			setSyncError(null);

			try {
				await KinetographAPI.reorderClips(flattenSegmentsToClipIds(nextSegments));
			} catch (err) {
				const normalized = await normalizeAPIError(
					err,
					"Failed to persist timeline reorder.",
				);
				setSyncError(normalized.detail);
				setPaperEdit(previous);
				await refetchPaperEdit();
			} finally {
				setInFlightMutationCount((count) => Math.max(0, count - 1));
			}
		},
		[refetchPaperEdit, setPaperEdit],
	);

	const sourceDurationForClip = useCallback(
		(clip: PaperEditClip) => {
			const asset = assets.find(
				(candidate) =>
					candidate.file_path === clip.source_file ||
					candidate.file_name === clip.source_file,
			);
			return asset?.duration_ms ?? null;
		},
		[assets],
	);

	const sanitizeClipUpdate = useCallback(
		(
			clip: PaperEditClip,
			updates: Partial<Omit<ClipUpdateRequest, "clip_id">>,
		): Partial<Omit<ClipUpdateRequest, "clip_id">> => {
			const maxDuration = sourceDurationForClip(clip);
			const nextIn =
				typeof updates.in_ms === "number" ? updates.in_ms : clip.in_ms;
			const nextOut =
				typeof updates.out_ms === "number" ? updates.out_ms : clip.out_ms;

			let clampedIn = Math.max(0, Math.floor(nextIn));
			let clampedOut = Math.max(clampedIn + MIN_CLIP_DURATION_MS, Math.floor(nextOut));

			if (maxDuration !== null) {
				clampedOut = Math.min(maxDuration, clampedOut);
				if (clampedOut - clampedIn < MIN_CLIP_DURATION_MS) {
					clampedIn = Math.max(0, clampedOut - MIN_CLIP_DURATION_MS);
				}
			}

			const sanitized: Partial<Omit<ClipUpdateRequest, "clip_id">> = {
				...updates,
			};
			if ("in_ms" in updates) sanitized.in_ms = clampedIn;
			if ("out_ms" in updates) sanitized.out_ms = clampedOut;
			return sanitized;
		},
		[sourceDurationForClip],
	);

	const applyClipPatch = useCallback(
		(
			clipId: string,
			updates: Partial<Omit<ClipUpdateRequest, "clip_id">>,
		) => {
			const current = useKinetographStore
				.getState()
				.paperEdit?.clips.find((clip) => clip.clip_id === clipId);
			if (!current) return;

			const sanitized = sanitizeClipUpdate(current, updates);
			updateClip(clipId, sanitized);
			queueClipPatch(clipId, sanitized);
			setSyncError(null);
		},
		[queueClipPatch, sanitizeClipUpdate, updateClip],
	);

	const handleDeleteClip = useCallback(
		async (clipId: string) => {
			const current = useKinetographStore.getState().paperEdit;
			if (!current) return;

			const nextClips = current.clips.filter((clip) => clip.clip_id !== clipId);
			if (nextClips.length === current.clips.length) return;

			const previous = current;
			setPaperEdit(createPaperEditFromClips(current, nextClips));
			if (selectedClipId === clipId) {
				setSelectedClip(null);
			}
			setInFlightMutationCount((count) => count + 1);
			setSyncError(null);

			try {
				await KinetographAPI.deleteClip(clipId);
			} catch (err) {
				const normalized = await normalizeAPIError(
					err,
					"Failed to delete clip.",
				);
				setSyncError(normalized.detail);
				setPaperEdit(previous);
				await refetchPaperEdit();
			} finally {
				setInFlightMutationCount((count) => Math.max(0, count - 1));
			}
		},
		[refetchPaperEdit, selectedClipId, setPaperEdit, setSelectedClip],
	);

	const ensurePaperEdit = useCallback(async (): Promise<PaperEdit | null> => {
		const existing = useKinetographStore.getState().paperEdit;
		if (existing) return existing;

		const initial: PaperEdit = {
			title: "Untitled Sequence",
			total_duration_ms: 0,
			clips: [],
			music_prompt: undefined,
		};

		try {
			await KinetographAPI.savePaperEdit(initial);
			setPaperEdit(initial);
			return initial;
		} catch (err) {
			const normalized = await normalizeAPIError(
				err,
				"No paper edit is available yet. Run the pipeline first.",
			);
			setSyncError(normalized.detail);
			return null;
		}
	}, [setPaperEdit]);

	const handleAssetDrop = useCallback(
		async (
			event: DragEvent<HTMLDivElement>,
			targetTrack: "a-roll" | "b-roll",
			targetSegmentId?: string,
		) => {
			if (
				!event.dataTransfer.types.includes("application/x-kinetograph-asset-id")
			) {
				return;
			}
			event.preventDefault();

			const assetId = event.dataTransfer.getData(
				"application/x-kinetograph-asset-id",
			);
			const asset = assets.find((candidate) => candidate.id === assetId);
			if (!asset) return;

			if (targetTrack === "a-roll" && asset.asset_type !== "a-roll") {
				setSyncError("Only A-roll assets can be dropped on the A-roll track.");
				return;
			}
			if (targetTrack === "b-roll" && asset.asset_type === "a-roll") {
				setSyncError("Only B-roll or synth assets can be dropped on the B-roll track.");
				return;
			}

			const baseEdit = await ensurePaperEdit();
			if (!baseEdit) return;

			const nextClip: PaperEditClip = {
				clip_id: createClipId(),
				source_file: asset.file_path,
				in_ms: 0,
				out_ms: Math.max(MIN_CLIP_DURATION_MS, asset.duration_ms),
				clip_type:
					asset.asset_type === "a-roll"
						? "a-roll"
						: asset.asset_type === "b-roll-synth"
							? "synth"
							: "b-roll",
				description: asset.file_name,
				transition: "cut",
			};

			const currentSegments = buildTimelineSegments(baseEdit.clips);
			const previous = baseEdit;
			const nextSegments = cloneSegments(currentSegments);

			if (targetTrack === "a-roll") {
				nextSegments.push({
					id: `segment-${nextClip.clip_id}`,
					anchor: nextClip,
					bRolls: [],
				});
			} else {
				if (!nextSegments.some((segment) => segment.anchor)) {
					setSyncError("Add at least one A-roll segment before placing B-roll.");
					return;
				}
				let targetIndex = targetSegmentId
					? nextSegments.findIndex((segment) => segment.id === targetSegmentId)
					: -1;
				if (targetIndex < 0) {
					for (let i = nextSegments.length - 1; i >= 0; i -= 1) {
						if (nextSegments[i].anchor) {
							targetIndex = i;
							break;
						}
					}
					if (targetIndex < 0) targetIndex = nextSegments.length - 1;
				}
				nextSegments[targetIndex].bRolls.push(nextClip);
			}

			const nextClips = flattenSegmentsToClips(nextSegments);
			const nextEdit = createPaperEditFromClips(baseEdit, nextClips);
			setPaperEdit(nextEdit);
			setSelectedClip(nextClip.clip_id);
			setInFlightMutationCount((count) => count + 1);
			setSyncError(null);

			try {
				await KinetographAPI.addClip(nextClip);
				await KinetographAPI.reorderClips(nextClips.map((clip) => clip.clip_id));
			} catch (err) {
				const normalized = await normalizeAPIError(
					err,
					"Failed to add clip to timeline.",
				);
				setSyncError(normalized.detail);
				setPaperEdit(previous);
				setSelectedClip(null);
				await refetchPaperEdit();
			} finally {
				setInFlightMutationCount((count) => Math.max(0, count - 1));
			}
		},
		[assets, ensurePaperEdit, refetchPaperEdit, setPaperEdit, setSelectedClip],
	);

	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			if (!paperEdit) return;
			const { active, over } = event;
			if (!over || active.id === over.id) return;

			const activeSegmentId = parseSegmentId(active.id);
			const overSegmentId = parseSegmentId(over.id);
			if (activeSegmentId && overSegmentId) {
				const oldIndex = aRollSegments.findIndex(
					(segment) => segment.id === activeSegmentId,
				);
				const newIndex = aRollSegments.findIndex(
					(segment) => segment.id === overSegmentId,
				);
				if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

				const reordered = arrayMove(aRollSegments, oldIndex, newIndex);
				const nextSegments = preludeSegment
					? [preludeSegment, ...reordered]
					: reordered;
				void applySegmentReorder(nextSegments);
				return;
			}

			const activeBrollId = parseBrollId(active.id);
			if (!activeBrollId) return;

			const sourcePos = findBrollPosition(segments, activeBrollId);
			if (!sourcePos) return;

			let targetSegmentIndex = -1;
			let targetClipIndex = 0;

			const overBrollId = parseBrollId(over.id);
			if (overBrollId) {
				const targetPos = findBrollPosition(segments, overBrollId);
				if (!targetPos) return;
				targetSegmentIndex = targetPos.segmentIndex;
				targetClipIndex = targetPos.clipIndex;
			} else {
				const overContainerSegmentId = parseBrollContainerSegmentId(over.id);
				const overSegmentSortableId = parseSegmentId(over.id);
				const destinationSegmentId = overContainerSegmentId || overSegmentSortableId;
				if (!destinationSegmentId) return;
				targetSegmentIndex = segments.findIndex(
					(segment) => segment.id === destinationSegmentId,
				);
				if (targetSegmentIndex < 0) return;
				targetClipIndex = segments[targetSegmentIndex].bRolls.length;
			}

			if (targetSegmentIndex < 0) return;

			const nextSegments = cloneSegments(segments);
			const sourceSegment = nextSegments[sourcePos.segmentIndex];
			const [moving] = sourceSegment.bRolls.splice(sourcePos.clipIndex, 1);
			if (!moving) return;

			if (
				sourcePos.segmentIndex === targetSegmentIndex &&
				sourcePos.clipIndex < targetClipIndex
			) {
				targetClipIndex -= 1;
			}

			nextSegments[targetSegmentIndex].bRolls.splice(targetClipIndex, 0, moving);
			void applySegmentReorder(nextSegments);
		},
		[
			aRollSegments,
			applySegmentReorder,
			paperEdit,
			preludeSegment,
			segments,
		],
	);

	const handleApprove = useCallback(async () => {
		if (!paperEdit || hasUnsyncedMutations) return;

		setIsApproving(true);
		setSyncError(null);
		try {
			await flushQueuedPatches();
			await KinetographAPI.approvePipeline({
				action: "approve",
				paper_edit: useKinetographStore.getState().paperEdit ?? paperEdit,
			});
		} catch (err) {
			const normalized = await normalizeAPIError(
				err,
				"Failed to commit sequence.",
			);
			setSyncError(normalized.detail);
		} finally {
			setIsApproving(false);
		}
	}, [flushQueuedPatches, hasUnsyncedMutations, paperEdit]);

	const zoomIn = useCallback(() => {
		setZoomLevel((level) => clamp(level * 1.25, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL));
	}, []);

	const zoomOut = useCallback(() => {
		setZoomLevel((level) => clamp(level / 1.25, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL));
	}, []);

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex items-end justify-between border-b border-zinc-800 pb-2 h-12">
				<div className="flex flex-col">
					<span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">
						Sequence Metadata
					</span>
					<div className="flex items-center gap-4">
						<h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
							{paperEdit?.title || "Untitled Sequence"}
						</h2>
						{paperEdit && (
							<div className="flex items-center gap-2 text-[10px] font-mono text-amber-500/60 bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded-sm">
								<span className="opacity-50">DUR:</span>
								<span className="tabular">
									{(paperEdit.total_duration_ms / 1000).toFixed(3)}s
								</span>
							</div>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<div className="flex h-7 items-center gap-1 rounded-sm border border-zinc-800 bg-zinc-900/50 px-1">
						<button
							onClick={zoomOut}
							className="rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
							disabled={zoomLevel <= MIN_ZOOM_LEVEL}
							title="Zoom Out Timeline"
						>
							<ZoomOut className="h-3 w-3" />
						</button>
						<span className="text-[10px] font-mono tabular text-zinc-400 px-1">
							{Math.round(zoomLevel * 100)}%
						</span>
						<button
							onClick={zoomIn}
							className="rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
							disabled={zoomLevel >= MAX_ZOOM_LEVEL}
							title="Zoom In Timeline"
						>
							<ZoomIn className="h-3 w-3" />
						</button>
					</div>
					<button
						onClick={handleApprove}
						disabled={!paperEdit || hasUnsyncedMutations}
						className="flex h-7 items-center gap-2 rounded-sm bg-amber-600 px-4 text-[10px] font-black text-black shadow-[0_2px_10px_rgba(217,119,6,0.2)] hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all uppercase tracking-wider"
					>
						{isApproving ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<CheckCircle2 className="h-3 w-3" />
						)}
						Commit Sequence
					</button>
				</div>
			</div>

			{syncError && (
				<div className="flex items-center gap-2 rounded-sm border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-200">
					<AlertCircle className="h-3.5 w-3.5" />
					<span>{syncError}</span>
				</div>
			)}
			{hasUnsyncedMutations && (
				<div className="rounded-sm border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-[10px] text-zinc-400 uppercase tracking-wider">
					Syncing timeline mutations… Commit is locked until sync completes.
				</div>
			)}

			<div className="rounded-sm border border-zinc-800 bg-zinc-950/50 p-3">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={onDragEnd}
				>
					<div className="space-y-3">
						<div className="space-y-1">
							<div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
								B-roll Overlay Track (V2)
							</div>
							{preludeSegment && (
								<BrollLane
									segment={preludeSegment}
									selectedClipId={selectedClipId}
									pxPerSecond={pxPerSecond}
									onSelectClip={setSelectedClip}
									onDeleteClip={(clipId) => void handleDeleteClip(clipId)}
									onDropAsset={(event, segmentId) =>
										void handleAssetDrop(event, "b-roll", segmentId)
									}
								/>
							)}
						</div>

						<div
							onDragOver={(event) => {
								if (
									event.dataTransfer.types.includes(
										"application/x-kinetograph-asset-id",
									)
								) {
									event.preventDefault();
								}
							}}
							onDrop={(event) => void handleAssetDrop(event, "a-roll")}
							className="space-y-2"
						>
							<div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
								A-roll Narrative Track (V1)
							</div>
							{aRollSegments.length === 0 && (
								<div className="rounded-sm border border-dashed border-zinc-800 bg-zinc-900/20 px-3 py-6 text-center text-[10px] uppercase tracking-widest text-zinc-600">
									Drop A-roll assets to create timeline segments
								</div>
							)}
							<SortableContext
								items={aRollSegments.map((segment) =>
									toSegmentSortableId(segment.id),
								)}
								strategy={horizontalListSortingStrategy}
							>
								<div className="flex gap-3 overflow-x-auto pb-2">
									{aRollSegments.map((segment) =>
										segment.anchor ? (
											<div
												key={segment.id}
												className="flex min-w-[220px] flex-col gap-2"
											>
												<BrollLane
													segment={segment}
													selectedClipId={selectedClipId}
													pxPerSecond={pxPerSecond}
													onSelectClip={setSelectedClip}
													onDeleteClip={(clipId) =>
														void handleDeleteClip(clipId)
													}
													onDropAsset={(event, segmentId) =>
														void handleAssetDrop(event, "b-roll", segmentId)
													}
												/>
												<SortableClipCard
													sortableId={toSegmentSortableId(segment.id)}
													clip={segment.anchor}
													label="A-roll"
													isSelected={selectedClipId === segment.anchor.clip_id}
													pxPerSecond={pxPerSecond}
													onClick={() =>
														setSelectedClip(segment.anchor?.clip_id ?? null)
													}
													onDelete={() =>
														void handleDeleteClip(segment.anchor!.clip_id)
													}
												/>
											</div>
										) : null,
									)}
								</div>
							</SortableContext>
						</div>

						<div className="space-y-1">
							<div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
								Master Audio Track (A1)
							</div>
							<div className="h-12 w-full rounded-sm border border-zinc-900/50 bg-zinc-900/10 px-4 py-3">
								<div className="h-full w-full bg-gradient-to-r from-zinc-800/20 via-zinc-700/20 to-zinc-800/20" />
							</div>
						</div>
					</div>
				</DndContext>
			</div>

			{selectedClip && (
				<div className="rounded-sm border border-zinc-800 bg-[#16161a] p-4 shadow-2xl">
					<div className="mb-4 border-b border-zinc-800 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100">
						Clip Inspector:{" "}
						<span className="font-mono text-zinc-500">{selectedClip.clip_id}</span>
					</div>
					<div className="grid grid-cols-4 gap-4">
						<div className="flex flex-col gap-1">
							<label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
								In (ms)
							</label>
							<input
								type="number"
								value={selectedClip.in_ms}
								onChange={(event) =>
									applyClipPatch(selectedClip.clip_id, {
										in_ms: Number.parseInt(event.target.value, 10) || 0,
									})
								}
								className="rounded-sm border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
								Out (ms)
							</label>
							<input
								type="number"
								value={selectedClip.out_ms}
								onChange={(event) =>
									applyClipPatch(selectedClip.clip_id, {
										out_ms: Number.parseInt(event.target.value, 10) || 0,
									})
								}
								className="rounded-sm border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
								Transition
							</label>
							<select
								value={selectedClip.transition ?? "cut"}
								onChange={(event) =>
									applyClipPatch(selectedClip.clip_id, {
										transition:
											event.target.value === "crossfade" ? "crossfade" : "cut",
									})
								}
								className="rounded-sm border border-zinc-800 bg-black/40 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
							>
								<option value="cut">Cut</option>
								<option value="crossfade">Crossfade</option>
							</select>
						</div>
						<div className="flex items-end justify-end">
							<button
								onClick={() => void handleDeleteClip(selectedClip.clip_id)}
								className="flex items-center gap-2 rounded-sm border border-red-900/60 bg-red-600/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-200 hover:bg-red-600/30"
							>
								<Trash2 className="h-3 w-3" />
								Delete Clip
							</button>
						</div>
					</div>
					<div className="mt-4">
						<label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
							Description
						</label>
						<textarea
							value={selectedClip.description}
							onChange={(event) =>
								applyClipPatch(selectedClip.clip_id, {
									description: event.target.value,
								})
							}
							className="mt-1 min-h-[64px] w-full rounded-sm border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
