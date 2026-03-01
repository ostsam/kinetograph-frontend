"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	KeyboardSensor,
	useSensor,
	useSensors,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { TimelineClip } from "./timeline-clip";
import { KinetographAPI } from "@/lib/api";
import { PaperEditClip, TransitionType } from "@/types/kinetograph";
import {
	Save,
	Trash2,
	Loader2,
	ZoomIn,
	ZoomOut,
	Scissors,
	XCircle,
	MousePointerClick,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const FPS = 30;
const BASE_PIXELS_PER_SECOND = 14;
const MIN_ZOOM_LEVEL = 0.25;
const MAX_ZOOM_LEVEL = 6;
const MIN_LABEL_SPACING_PX = 90;
const MIN_TIMELINE_SECONDS = 60;
const TRAILING_PADDING_SECONDS = 30;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function formatTimecode(ms: number) {
	const totalFrames = Math.max(0, Math.floor((ms / 1000) * FPS));
	const frames = totalFrames % FPS;
	const totalSeconds = Math.floor(totalFrames / FPS);
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);
	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

function getTickStepSeconds(pxPerSecond: number) {
	const options = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
	return options.find((s) => s * pxPerSecond >= MIN_LABEL_SPACING_PX) ?? options[options.length - 1];
}

interface TimeRulerProps {
	timelineWidthPx: number;
	pxPerSecond: number;
	tickStepSeconds: number;
	onSeek?: (ms: number) => void;
}

function TimeRuler({ timelineWidthPx, pxPerSecond, tickStepSeconds, onSeek }: TimeRulerProps) {
	const ticks = useMemo(() => {
		const totalSeconds = timelineWidthPx / pxPerSecond;
		const count = Math.floor(totalSeconds / tickStepSeconds) + 1;
		return Array.from({ length: count }, (_, i) => i * tickStepSeconds);
	}, [pxPerSecond, tickStepSeconds, timelineWidthPx]);

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!onSeek) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		onSeek(Math.max(0, (x / pxPerSecond) * 1000));
	};

	return (
		<div
			className="relative h-6 border-b border-zinc-800 bg-zinc-900/30 min-w-full cursor-pointer"
			style={{ width: `${timelineWidthPx}px` }}
			onClick={handleClick}
		>
			{ticks.map((seconds) => (
				<div
					key={seconds}
					className="absolute top-0 bottom-0 border-l border-zinc-800/50 pl-1"
					style={{ left: `${seconds * pxPerSecond}px` }}
				>
					<span className="text-[8px] font-mono text-zinc-600">
						{formatTimecode(seconds * 1000)}
					</span>
				</div>
			))}
		</div>
	);
}

interface TimelineEditorProps {
	onSeek?: (ms: number) => void;
}

export function TimelineEditor({ onSeek }: TimelineEditorProps) {
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const reorderClips = useKinetographStore((s) => s.reorderClips);
	const addAssetToTimeline = useKinetographStore((s) => s.addAssetToTimeline);
	const selectedClipId = useKinetographStore((s) => s.selectedClipId);
	const setSelectedClip = useKinetographStore((s) => s.setSelectedClip);
	const deleteClip = useKinetographStore((s) => s.deleteClip);
	const updateClip = useKinetographStore((s) => s.updateClip);
	const playheadMs = useKinetographStore((s) => s.playheadMs);
	const [isAssetDropActive, setIsAssetDropActive] = useState(false);
	const [zoomLevel, setZoomLevel] = useState(1);
	const trackViewportRef = useRef<HTMLDivElement>(null);
	const [trackViewportWidth, setTrackViewportWidth] = useState(0);
	const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
	const [activeDragId, setActiveDragId] = useState<string | null>(null);

	// Inspector
	const [inspectorDescription, setInspectorDescription] = useState("");
	const [inspectorTransition, setInspectorTransition] = useState<TransitionType>("cut");
	const [isSavingInspector, setIsSavingInspector] = useState(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const selectedClip = paperEdit?.clips.find((c) => c.clip_id === selectedClipId);

	useEffect(() => {
		if (selectedClip) {
			setInspectorDescription(selectedClip.description || "");
			setInspectorTransition(selectedClip.transition || "cut");
		}
	}, [selectedClip?.clip_id]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleDragStart = (event: DragStartEvent) => {
		setActiveDragId(event.active.id as string);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		setActiveDragId(null);
		if (!paperEdit) return;
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = paperEdit.clips.findIndex((c) => c.clip_id === active.id);
			const newIndex = paperEdit.clips.findIndex((c) => c.clip_id === over.id);
			const newClips = arrayMove(paperEdit.clips, oldIndex, newIndex);
			const newIds = newClips.map((c) => c.clip_id);
			reorderClips(newIds);
			KinetographAPI.reorderClips(newIds).catch(() => {});
		}
	};

	const handleApplyEdits = useCallback(async () => {
		if (!selectedClipId) return;
		setIsSavingInspector(true);
		const updates: Partial<PaperEditClip> = {
			description: inspectorDescription,
			transition: inspectorTransition,
		};
		updateClip(selectedClipId, updates);
		try {
			await KinetographAPI.updateClip(selectedClipId, updates);
		} catch { /* ignore */ } finally {
			setIsSavingInspector(false);
		}
	}, [selectedClipId, inspectorDescription, inspectorTransition, updateClip]);

	const handleTransitionToggle = useCallback(
		(t: TransitionType) => {
			setInspectorTransition(t);
			if (selectedClipId) {
				updateClip(selectedClipId, { transition: t });
				KinetographAPI.updateClip(selectedClipId, { transition: t }).catch(() => {});
			}
		},
		[selectedClipId, updateClip],
	);

	const handleTrimClip = useCallback(
		(clipId: string, edge: "in" | "out", deltaMs: number) => {
			const clip = paperEdit?.clips.find((c) => c.clip_id === clipId);
			if (!clip) return;
			const MIN_CLIP_MS = 200;
			let newIn = clip.in_ms;
			let newOut = clip.out_ms;
			if (edge === "in") {
				newIn = Math.max(0, clip.in_ms + deltaMs);
				if (newOut - newIn < MIN_CLIP_MS) newIn = newOut - MIN_CLIP_MS;
			} else {
				newOut = Math.max(newIn + MIN_CLIP_MS, clip.out_ms + deltaMs);
			}
			updateClip(clipId, { in_ms: newIn, out_ms: newOut });
			KinetographAPI.updateClip(clipId, { in_ms: newIn, out_ms: newOut }).catch(() => {});
		},
		[paperEdit?.clips, updateClip],
	);

	// ── Razor / split tool ──────────────────────────────────────────
	const handleSplitAtPlayhead = useCallback(() => {
		if (!paperEdit || !selectedClipId) return;
		const clip = paperEdit.clips.find((c) => c.clip_id === selectedClipId);
		if (!clip) return;

		// Find where playhead is within this clip
		let clipStart = 0;
		for (const c of paperEdit.clips) {
			if (c.clip_id === selectedClipId) break;
			clipStart += c.out_ms - c.in_ms;
		}
		const clipEnd = clipStart + (clip.out_ms - clip.in_ms);
		if (playheadMs <= clipStart || playheadMs >= clipEnd) return;

		const splitPoint = clip.in_ms + (playheadMs - clipStart);
		const MIN_SPLIT = 100;
		if (splitPoint - clip.in_ms < MIN_SPLIT || clip.out_ms - splitPoint < MIN_SPLIT) return;

		// Create two clips from the original
		const clipA: PaperEditClip = { ...clip, out_ms: splitPoint };
		const clipB: PaperEditClip = {
			...clip,
			clip_id: `clip-${crypto.randomUUID()}`,
			in_ms: splitPoint,
			description: clip.description + " (split)",
		};

		const newClips = paperEdit.clips.flatMap((c) =>
			c.clip_id === selectedClipId ? [clipA, clipB] : [c],
		);
		const totalDurationMs = newClips.reduce((s, c) => s + (c.out_ms - c.in_ms), 0);

		useKinetographStore.setState({
			paperEdit: { ...paperEdit, clips: newClips, total_duration_ms: totalDurationMs },
			selectedClipId: clipB.clip_id,
		});
	}, [paperEdit, selectedClipId, playheadMs]);

	const applyZoom = useCallback(
		(nextZoomLevel: number, focusClientX?: number) => {
			const clampedZoom = clamp(nextZoomLevel, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
			if (clampedZoom === zoomLevel) return;
			const viewport = trackViewportRef.current;
			if (!viewport) { setZoomLevel(clampedZoom); return; }
			const previousPPS = BASE_PIXELS_PER_SECOND * zoomLevel;
			const rect = viewport.getBoundingClientRect();
			const focusX = focusClientX !== undefined ? focusClientX - rect.left : viewport.clientWidth / 2;
			const focusTime = (viewport.scrollLeft + focusX) / previousPPS;
			setZoomLevel(clampedZoom);
			requestAnimationFrame(() => {
				const nextPPS = BASE_PIXELS_PER_SECOND * clampedZoom;
				viewport.scrollLeft = Math.max(0, focusTime * nextPPS - focusX);
			});
		},
		[zoomLevel],
	);

	const zoomIn = useCallback(() => applyZoom(zoomLevel * 1.25), [applyZoom, zoomLevel]);
	const zoomOut = useCallback(() => applyZoom(zoomLevel / 1.25), [applyZoom, zoomLevel]);

	const handleAssetDragOver = (event: React.DragEvent) => {
		if (!event.dataTransfer.types.includes("application/x-kinetograph-asset-id")) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setIsAssetDropActive(true);
	};

	const handleAssetDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsAssetDropActive(false);
		const assetId = event.dataTransfer.getData("application/x-kinetograph-asset-id");
		if (!assetId) return;
		const clipId = addAssetToTimeline(assetId);
		if (clipId) setSelectedClip(clipId);
	};

	const handleTrackWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		applyZoom(zoomLevel * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX);
	};

	const handlePlayheadPointerDown = (e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDraggingPlayhead(true);
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};

	const handlePlayheadPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isDraggingPlayhead || !trackViewportRef.current) return;
			const rect = trackViewportRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left + trackViewportRef.current.scrollLeft;
			const ms = Math.max(0, (x / (BASE_PIXELS_PER_SECOND * zoomLevel)) * 1000);
			onSeek?.(ms);
		},
		[isDraggingPlayhead, zoomLevel, onSeek],
	);

	const handlePlayheadPointerUp = useCallback(() => {
		setIsDraggingPlayhead(false);
	}, []);

	useEffect(() => {
		const viewport = trackViewportRef.current;
		if (!viewport) return;
		const obs = new ResizeObserver((entries) => {
			setTrackViewportWidth(entries[0]?.contentRect.width ?? 0);
		});
		obs.observe(viewport);
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!selectedClipId) return;
			const target = event.target as HTMLElement | null;
			if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				deleteClip(selectedClipId);
			}
			// S = split at playhead
			if (event.key === "s" && !event.metaKey && !event.ctrlKey) {
				handleSplitAtPlayhead();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [deleteClip, selectedClipId, handleSplitAtPlayhead]);

	const sequenceDurationMs = useMemo(() => {
		if (!paperEdit) return 0;
		return paperEdit.clips.reduce((t, c) => t + (c.out_ms - c.in_ms), 0);
	}, [paperEdit]);

	const effectiveDurationMs = Math.max(paperEdit?.total_duration_ms ?? 0, sequenceDurationMs);
	const pxPerSecond = BASE_PIXELS_PER_SECOND * zoomLevel;

	const timelineDurationSeconds = useMemo(() => {
		const fromClips = effectiveDurationMs / 1000 + TRAILING_PADDING_SECONDS;
		const fromViewport = trackViewportWidth > 0 ? trackViewportWidth / pxPerSecond : 0;
		return Math.max(MIN_TIMELINE_SECONDS, fromClips, fromViewport);
	}, [effectiveDurationMs, pxPerSecond, trackViewportWidth]);

	const timelineWidthPx = Math.max(trackViewportWidth, Math.ceil(timelineDurationSeconds * pxPerSecond));
	const tickStepSeconds = getTickStepSeconds(pxPerSecond);
	const playheadLeftPx = (playheadMs / 1000) * pxPerSecond;

	const activeDragClip = activeDragId ? paperEdit?.clips.find((c) => c.clip_id === activeDragId) : null;

	return (
		<div className="flex w-full flex-col gap-3">
			{/* Toolbar */}
			<div className="flex items-center justify-between h-8">
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-medium text-zinc-400">
						{paperEdit?.title || "Untitled Sequence"}
					</span>
					{paperEdit && (
						<span className="text-[9px] font-mono text-zinc-600">
							{(sequenceDurationMs / 1000).toFixed(1)}s · {paperEdit.clips.length} clips
						</span>
					)}
				</div>

				<div className="flex items-center gap-1">
					{selectedClipId && (
						<>
							<button
								onClick={handleSplitAtPlayhead}
								className="flex h-6 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/50 px-2 text-[9px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
								title="Split at playhead (S)"
							>
								<Scissors className="h-3 w-3" />
								Split
							</button>
							<button
								onClick={() => deleteClip(selectedClipId)}
								className="flex h-6 items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/50 px-2 text-[9px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
								title="Delete clip (Del)"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</>
					)}
					<div className="flex h-6 items-center gap-0.5 rounded border border-zinc-800 bg-zinc-900/50 px-0.5 ml-2">
						<button onClick={zoomOut} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
							disabled={zoomLevel <= MIN_ZOOM_LEVEL}>
							<ZoomOut className="h-3 w-3" />
						</button>
						<span className="text-[9px] font-mono text-zinc-500 px-1 min-w-[32px] text-center">
							{Math.round(zoomLevel * 100)}%
						</span>
						<button onClick={zoomIn} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
							disabled={zoomLevel >= MAX_ZOOM_LEVEL}>
							<ZoomIn className="h-3 w-3" />
						</button>
					</div>
				</div>
			</div>

			{/* Track view */}
			<div
				ref={trackViewportRef}
				onDragOver={handleAssetDragOver}
				onDragEnter={handleAssetDragOver}
				onDragLeave={() => setIsAssetDropActive(false)}
				onDrop={handleAssetDrop}
				onWheel={handleTrackWheel}
				onPointerMove={handlePlayheadPointerMove}
				onPointerUp={handlePlayheadPointerUp}
				className={cn(
					"relative w-full rounded border overflow-x-auto custom-scrollbar min-h-[120px] transition-colors",
					isAssetDropActive ? "border-blue-500/50 bg-blue-500/5" : "border-zinc-800 bg-zinc-950/50",
				)}
			>
				<TimeRuler
					timelineWidthPx={timelineWidthPx}
					pxPerSecond={pxPerSecond}
					tickStepSeconds={tickStepSeconds}
					onSeek={onSeek}
				/>

				{/* Playhead */}
				<div
					className={cn(
						"absolute top-0 bottom-0 w-px z-30",
						isDraggingPlayhead ? "bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.4)]",
					)}
					style={{ left: `${playheadLeftPx}px` }}
				>
					<div
						onPointerDown={handlePlayheadPointerDown}
						className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rotate-45 -translate-y-1/2 border border-black/20 cursor-grab active:cursor-grabbing hover:bg-blue-400 z-40"
					/>
				</div>

				{/* Track content */}
				<div className="px-0 pt-2 pb-3 relative flex flex-col gap-1 min-w-full" style={{ width: `${timelineWidthPx}px` }}>
					{/* V1 Track */}
					<div className="flex items-center">
						<div className="w-8 shrink-0 text-[7px] font-bold text-zinc-600 text-center">V1</div>
						<div className="flex-1">
							{paperEdit && paperEdit.clips.length > 0 ? (
								<DndContext
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragStart={handleDragStart}
									onDragEnd={handleDragEnd}
								>
									<SortableContext
										items={paperEdit.clips.map((c) => c.clip_id)}
										strategy={horizontalListSortingStrategy}
									>
										<div className="flex items-center">
											{paperEdit.clips.map((clip) => (
												<TimelineClip
													key={clip.clip_id}
													clip={clip}
													isSelected={selectedClipId === clip.clip_id}
													pxPerSecond={pxPerSecond}
													onClick={() => setSelectedClip(clip.clip_id)}
													onDelete={() => deleteClip(clip.clip_id)}
													onTrim={(edge, deltaMs) => handleTrimClip(clip.clip_id, edge, deltaMs)}
												/>
											))}
										</div>
									</SortableContext>
									<DragOverlay dropAnimation={null}>
										{activeDragClip && (
											<div className="h-16 bg-blue-500/20 border border-blue-500/40 rounded opacity-80"
												style={{ width: `${Math.max(40, ((activeDragClip.out_ms - activeDragClip.in_ms) / 1000) * pxPerSecond)}px` }}>
												<div className="p-1 text-[8px] text-blue-300 truncate">
													{activeDragClip.source_file}
												</div>
											</div>
										)}
									</DragOverlay>
								</DndContext>
							) : (
								<div className="flex h-16 w-full items-center justify-center rounded border border-dashed border-zinc-800 bg-zinc-900/20">
									<div className="flex items-center gap-2 text-zinc-600">
										<MousePointerClick className="h-3.5 w-3.5" />
										<span className="text-[9px] font-medium">
											Drag media from the bin to start editing
										</span>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* A1 Track */}
					<div className="flex items-center">
						<div className="w-8 shrink-0 text-[7px] font-bold text-zinc-600 text-center">A1</div>
						<div className="h-8 flex-1 border border-zinc-900/50 bg-zinc-900/10 rounded flex items-center px-4">
							<span className="text-[7px] font-medium text-zinc-800">Audio</span>
						</div>
					</div>
				</div>
			</div>

			{/* Clip Inspector */}
			<AnimatePresence>
				{selectedClipId && selectedClip && (
					<motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 6 }}
						className="rounded border border-zinc-800 bg-zinc-900 p-3"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-3">
								<h3 className="text-[10px] font-semibold text-zinc-200">
									{selectedClip.source_file}
								</h3>
								<div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500">
									<span>IN: {(selectedClip.in_ms / 1000).toFixed(2)}s</span>
									<span className="opacity-30">→</span>
									<span>OUT: {(selectedClip.out_ms / 1000).toFixed(2)}s</span>
									<span className="opacity-30">|</span>
									<span className="text-blue-400/70">
										{((selectedClip.out_ms - selectedClip.in_ms) / 1000).toFixed(2)}s
									</span>
								</div>
							</div>
							<button onClick={() => setSelectedClip(null)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
								<XCircle className="h-3.5 w-3.5" />
							</button>
						</div>

						<div className="grid grid-cols-4 gap-4">
							<div className="col-span-2 flex flex-col gap-1.5">
								<label className="text-[9px] font-medium text-zinc-500">Description</label>
								<textarea
									className="bg-black/30 border border-zinc-800 rounded p-2 text-xs text-zinc-300 min-h-[48px] focus:border-blue-500/50 outline-none transition-colors resize-none"
									value={inspectorDescription}
									onChange={(e) => setInspectorDescription(e.target.value)}
									onBlur={() => {
										if (selectedClipId && inspectorDescription !== selectedClip.description) {
											updateClip(selectedClipId, { description: inspectorDescription });
											KinetographAPI.updateClip(selectedClipId, { description: inspectorDescription }).catch(() => {});
										}
									}}
								/>
							</div>

							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1.5">
									<label className="text-[9px] font-medium text-zinc-500">Transition</label>
									<div className="flex gap-px bg-zinc-800 p-0.5 rounded overflow-hidden">
										<button
											onClick={() => handleTransitionToggle("cut")}
											className={cn(
												"flex-1 py-1 text-[9px] font-medium rounded transition-all",
												inspectorTransition === "cut" ? "bg-zinc-600 text-white" : "hover:bg-zinc-700 text-zinc-500",
											)}
										>Cut</button>
										<button
											onClick={() => handleTransitionToggle("crossfade")}
											className={cn(
												"flex-1 py-1 text-[9px] font-medium rounded transition-all",
												inspectorTransition === "crossfade" ? "bg-zinc-600 text-white" : "hover:bg-zinc-700 text-zinc-500",
											)}
										>Crossfade</button>
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<label className="text-[9px] font-medium text-zinc-500">Source</label>
									<span className="text-[9px] font-mono text-zinc-500 truncate">{selectedClip.source_file}</span>
								</div>
							</div>

							<div className="flex flex-col justify-end items-end gap-2">
								<button
									onClick={() => deleteClip(selectedClipId)}
									className="flex items-center gap-1.5 text-zinc-600 hover:text-red-400 transition-colors text-[10px] font-medium"
								>
									<Trash2 className="h-3 w-3" />
									Remove
								</button>
								<button
									onClick={handleApplyEdits}
									disabled={isSavingInspector}
									className="flex items-center gap-1.5 rounded bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold text-black hover:bg-white transition-all disabled:opacity-50"
								>
									{isSavingInspector ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
									Apply
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
