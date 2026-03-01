"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
	Group,
	Panel,
	Separator,
	PanelImperativeHandle,
} from "react-resizable-panels";
import { useMontazhStore } from "@/store/use-montazh-store";
import { useChatStore } from "@/store/use-chat-store";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { useMontazhWS } from "@/hooks/use-montazh-ws";
import { MontazhAPI } from "@/lib/api";
import { AssetDropzone } from "@/components/asset-dropzone";
import { TimelineEditor } from "@/components/timeline-editor";
import { ExportPanel } from "@/components/export-panel";
import { ChatPanel } from "@/components/chat-panel";
import {
	Film,
	Layout,
	PanelLeftClose,
	PanelLeftOpen,
	Play,
	Pause,
	Square,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	FolderOpen,
	Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const FPS = 30;

function formatTimecode(ms: number) {
	const totalFrames = Math.max(0, Math.floor((ms / 1000) * FPS));
	const frames = totalFrames % FPS;
	const totalSeconds = Math.floor(totalFrames / FPS);
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);
	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames
		.toString()
		.padStart(2, "0")}`;
}

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2, 4];

export default function EditorPage() {
	const router = useRouter();
	const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [showExportPanel, setShowExportPanel] = useState(false);
	const leftPanelRef = useRef<PanelImperativeHandle>(null);
	const chatPanelRef = useRef<PanelImperativeHandle>(null);

	const setAssets = useMontazhStore((s) => s.setAssets);
	const assets = useMontazhStore((s) => s.assets);
	const undo = useMontazhStore((s) => s.undo);
	const redo = useMontazhStore((s) => s.redo);
	const renderUrl = useMontazhStore((s) => s.renderUrl);
	const setPlayhead = useMontazhStore((s) => s.setPlayhead);
	const paperEdit = useMontazhStore((s) => s.paperEdit);

	const isChatOpen = useChatStore((s) => s.isOpen);
	const setChatOpen = useChatStore((s) => s.setOpen);
	const toggleChat = useChatStore((s) => s.toggleOpen);
	const pipelineActive = useChatStore((s) => s.pipelineActive);

	// Connect WebSocket for real-time pipeline updates
	const { isConnected } = useMontazhWS();

	const {
		videoARef,
		videoBRef,
		activeSlot,
		transitionState,
		playbackState,
		currentTimeDisplay,
		totalDurationMs,
		volume,
		playbackRate,
		togglePlayPause,
		stop,
		seekTo,
		setVolume,
		setPlaybackRate,
	} = useVideoPlayer();

	// ── Rendered video mode (plays final _captioned_mastered.mp4) ──
	const renderedVideoRef = useRef<HTMLVideoElement>(null);
	const isRenderedMode = !!renderUrl;
	const [rvTime, setRvTime] = useState(0);
	const [rvDuration, setRvDuration] = useState(0);
	const [rvPlaying, setRvPlaying] = useState(false);

	useEffect(() => {
		const v = renderedVideoRef.current;
		if (!v || !renderUrl) return;
		// Reset state and ensure video loads new source
		setRvTime(0);
		setRvDuration(0);
		setRvPlaying(false);
		v.load();
		const onTime = () => setRvTime(v.currentTime * 1000);
		const onDur = () => {
			if (v.duration && isFinite(v.duration)) setRvDuration(v.duration * 1000);
		};
		const onPlay = () => setRvPlaying(true);
		const onPause = () => setRvPlaying(false);
		v.addEventListener("timeupdate", onTime);
		v.addEventListener("loadedmetadata", onDur);
		v.addEventListener("play", onPlay);
		v.addEventListener("pause", onPause);
		return () => {
			v.removeEventListener("timeupdate", onTime);
			v.removeEventListener("loadedmetadata", onDur);
			v.removeEventListener("play", onPlay);
			v.removeEventListener("pause", onPause);
		};
	}, [renderUrl]);

	// Sync rendered-video time → store playhead so timeline cursor moves
	// Map proportionally: rendered video duration may differ from paper edit duration
	const sequenceDurationMs = useMemo(() => {
		if (!paperEdit) return 0;
		return paperEdit.clips.reduce((s, c) => s + (c.out_ms - c.in_ms), 0);
	}, [paperEdit]);

	useEffect(() => {
		if (isRenderedMode && rvDuration > 0) {
			const progress = rvTime / rvDuration;
			const mappedMs = progress * (sequenceDurationMs || rvDuration);
			setPlayhead(mappedMs);
		}
	}, [isRenderedMode, rvTime, rvDuration, sequenceDurationMs, setPlayhead]);

	// Effective transport values — switch between rendered mode and clip mode
	const effTime = isRenderedMode ? rvTime : currentTimeDisplay;
	const effDuration = isRenderedMode ? rvDuration : totalDurationMs;
	const effPlaying = isRenderedMode ? rvPlaying : playbackState === "playing";

	const handlePlayPause = useCallback(() => {
		if (isRenderedMode && renderedVideoRef.current) {
			const v = renderedVideoRef.current;
			if (v.paused) v.play().catch(() => {});
			else v.pause();
		} else {
			togglePlayPause();
		}
	}, [isRenderedMode, togglePlayPause]);

	const handleStop = useCallback(() => {
		if (isRenderedMode && renderedVideoRef.current) {
			const v = renderedVideoRef.current;
			v.pause();
			v.currentTime = 0;
			setRvTime(0);
		} else {
			stop();
		}
	}, [isRenderedMode, stop]);

	const handleSeekTo = useCallback(
		(ms: number) => {
			if (isRenderedMode && renderedVideoRef.current) {
				const v = renderedVideoRef.current;
				// Reverse proportional mapping: paper-edit ms → rendered video ms
				const totalClipMs = sequenceDurationMs || rvDuration;
				const progress = totalClipMs > 0 ? ms / totalClipMs : 0;
				const videoSec = (progress * rvDuration) / 1000;
				v.currentTime = Math.max(0, Math.min(videoSec, v.duration || 0));
			} else {
				seekTo(ms);
			}
		},
		[isRenderedMode, seekTo, sequenceDurationMs, rvDuration],
	);

	const handleSetVolume = useCallback(
		(v: number) => {
			setVolume(v);
			if (renderedVideoRef.current) renderedVideoRef.current.volume = v;
		},
		[setVolume],
	);

	const handleSetPlaybackRate = useCallback(
		(rate: number) => {
			setPlaybackRate(rate);
			if (renderedVideoRef.current)
				renderedVideoRef.current.playbackRate = rate;
		},
		[setPlaybackRate],
	);

	useEffect(() => {
		MontazhAPI.getAssets()
			.then((res) => setAssets(res.assets))
			.catch(() => undefined);
	}, [setAssets]);

	// Keyboard shortcuts
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;

			// Meta shortcuts
			if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
				e.preventDefault();
				redo();
			} else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				setShowExportPanel(true);
			} else if ((e.metaKey || e.ctrlKey) && e.key === "l") {
				e.preventDefault();
				toggleChat();
			} else if (e.key === " ") {
				e.preventDefault();
				handlePlayPause();
			} else if (e.key === "Escape") {
				handleStop();
				setShowExportPanel(false);
			}
			// J/K/L shuttle
			else if (e.key === "j") {
				handleSeekTo(Math.max(0, effTime - 5000));
			} else if (e.key === "k") {
				handlePlayPause();
			} else if (e.key === "l") {
				handleSeekTo(effTime + 5000);
			}
			// Arrow keys: frame step
			else if (e.key === "ArrowLeft") {
				e.preventDefault();
				handleSeekTo(Math.max(0, effTime - (e.shiftKey ? 1000 : 1000 / FPS)));
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				handleSeekTo(effTime + (e.shiftKey ? 1000 : 1000 / FPS));
			}
			// Home / End
			else if (e.key === "Home") {
				handleSeekTo(0);
			} else if (e.key === "End") {
				handleSeekTo(effDuration);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		handlePlayPause,
		handleStop,
		handleSeekTo,
		effTime,
		effDuration,
		undo,
		redo,
		toggleChat,
	]);

	const toggleSidebar = () => {
		const panel = leftPanelRef.current;
		if (panel) {
			if (isSidebarCollapsed) panel.expand();
			else panel.collapse();
			setSidebarCollapsed(!isSidebarCollapsed);
		}
	};

	const handleMenuClick = useCallback((item: string) => {
		if (item === "File") setShowExportPanel((v) => !v);
	}, []);

	return (
		<div className="flex h-screen w-full flex-col bg-[#0c0c0e] text-[#d1d1d1] overflow-hidden selection:bg-blue-500/30">
			{showExportPanel && (
				<ExportPanel onClose={() => setShowExportPanel(false)} />
			)}

			{/* Top Bar */}
			<header className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#1a1a1e] px-3 z-30">
				<div className="flex items-center gap-4">
					<div
						className="flex items-center gap-2 cursor-pointer"
						onClick={() => router.push("/")}
					>
						<Film className="h-3.5 w-3.5 text-blue-500" />
						<span className="text-[11px] font-semibold tracking-wide text-zinc-200">
							Editor
						</span>
					</div>

					<nav className="flex items-center gap-0.5 ml-2">
						{["File", "Edit", "View", "Clip", "Sequence", "Help"].map(
							(item) => (
								<button
									key={item}
									onClick={() => handleMenuClick(item)}
									className={cn(
										"px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded transition-colors",
										item === "File" &&
											showExportPanel &&
											"bg-zinc-800 text-zinc-200",
									)}
								>
									{item}
								</button>
							),
						)}
					</nav>
				</div>

				<div className="flex items-center gap-2">
					{/* Connection indicator */}
					<div
						className="flex items-center gap-1 px-1.5"
						title={isConnected ? "Backend connected" : "Backend disconnected"}
					>
						<div
							className={cn(
								"w-1.5 h-1.5 rounded-full",
								isConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse",
							)}
						/>
						<span className="text-[9px] text-zinc-600">
							{isConnected ? "Live" : "Offline"}
						</span>
					</div>

					{/* Transport */}
					<div className="flex items-center gap-0.5 border-x border-zinc-800 px-2 h-9">
						<button
							onClick={() => handleSeekTo(0)}
							className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
							title="Go to start (Home)"
						>
							<SkipBack className="h-3 w-3" />
						</button>
						<button
							onClick={handlePlayPause}
							className={cn(
								"p-1 rounded transition-colors",
								effPlaying
									? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
									: "hover:bg-zinc-800 text-zinc-400 hover:text-white",
							)}
							title={effPlaying ? "Pause (K/Space)" : "Play (K/Space)"}
						>
							{effPlaying ? (
								<Pause className="h-3 w-3" />
							) : (
								<Play className="h-3 w-3 fill-current" />
							)}
						</button>
						<button
							onClick={handleStop}
							className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
							title="Stop (Esc)"
						>
							<Square className="h-2.5 w-2.5" />
						</button>
						<button
							onClick={() => handleSeekTo(effDuration)}
							className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
							title="Go to end (End)"
						>
							<SkipForward className="h-3 w-3" />
						</button>
					</div>

					{/* Timecode */}
					<div className="flex items-center gap-1.5 px-2">
						<span className="text-[11px] font-mono tabular text-blue-400/90">
							{formatTimecode(effTime)}
						</span>
						<span className="text-[9px] font-mono tabular text-zinc-600">
							/ {formatTimecode(effDuration)}
						</span>
					</div>

					{/* Volume */}
					<div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
						<button
							onClick={() => handleSetVolume(volume > 0 ? 0 : 1)}
							className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
						>
							{volume > 0 ? (
								<Volume2 className="h-3 w-3" />
							) : (
								<VolumeX className="h-3 w-3" />
							)}
						</button>
						<input
							type="range"
							min={0}
							max={1}
							step={0.05}
							value={volume}
							onChange={(e) => handleSetVolume(Number(e.target.value))}
							className="w-14 h-1 accent-blue-500 cursor-pointer"
						/>
					</div>

					{/* Speed */}
					<select
						value={playbackRate}
						onChange={(e) => handleSetPlaybackRate(Number(e.target.value))}
						className="bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 px-1 py-0.5 cursor-pointer outline-none"
					>
						{PLAYBACK_RATES.map((r) => (
							<option key={r} value={r}>
								{r}×
							</option>
						))}
					</select>

					{/* AI Chat Toggle */}
					<div className="border-l border-zinc-800 pl-2">
						<button
							onClick={toggleChat}
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
								isChatOpen
									? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
									: "hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent",
								pipelineActive &&
									!isChatOpen &&
									"text-purple-400 animate-pulse",
							)}
							title="AI Assistant (⌘L)"
						>
							<Sparkles className="h-3 w-3" />
							<span>AI</span>
							{pipelineActive && (
								<span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
							)}
						</button>
					</div>
				</div>
			</header>

			{/* Main workspace */}
			<main className="flex-1 flex overflow-hidden">
				{/* Editor area (media + viewer + timeline) */}
				<div className="flex-1 min-w-0">
					<Group orientation="horizontal" className="h-full">
						{/* Left sidebar: Media bin */}
						<Panel
							panelRef={leftPanelRef}
							defaultSize={20}
							minSize={12}
							collapsible
							className={cn(
								"flex flex-col border-r border-zinc-800 bg-[#121215]",
								isSidebarCollapsed && "hidden",
							)}
						>
							<div className="flex items-center justify-between h-7 border-b border-zinc-800 bg-zinc-900/50 px-3">
								<div className="flex items-center gap-1.5">
									<FolderOpen className="h-3 w-3 text-zinc-500" />
									<span className="text-[10px] font-medium text-zinc-400">
										Media
									</span>
								</div>
								<span className="text-[9px] font-mono text-zinc-600">
									{assets.length}
								</span>
							</div>
							<div className="flex-1 overflow-y-auto custom-scrollbar p-2">
								<AssetDropzone />
							</div>
						</Panel>

						<div>
							<button
								onClick={toggleSidebar}
								className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
								title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
							>
								{isSidebarCollapsed ? (
									<PanelLeftOpen className="h-3.5 w-3.5" />
								) : (
									<PanelLeftClose className="h-3.5 w-3.5" />
								)}
							</button>
						</div>

						<Separator className="w-0.5 bg-black/40 hover:bg-blue-500/20 transition-colors cursor-col-resize" />

						{/* Center: Viewer + Timeline */}
						<Panel defaultSize={80}>
							<Group orientation="vertical">
								{/* Viewer */}
								<Panel defaultSize={60} minSize={25}>
									<div className="flex h-full flex-col overflow-hidden bg-[#0e0e10]">
										<div className="flex flex-1 items-center justify-center p-4">
											<div className="relative h-full w-full overflow-hidden border border-zinc-800/50 bg-black">
												{isRenderedMode ? (
													<>
														{/* Final rendered video (with captions, music, transitions baked in) */}
														<video
															ref={renderedVideoRef}
															src={renderUrl!}
															className="absolute inset-0 h-full w-full object-contain"
															style={{ zIndex: 2 }}
															playsInline
															preload="auto"
														/>
														{/* Rendered mode badge */}
														<div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-emerald-600/60 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">
															<div className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
															<span className="text-[8px] font-medium text-white">
																Final Render
															</span>
														</div>
													</>
												) : (
													<>
														{/* Video A */}
														<video
															ref={videoARef}
															className="absolute inset-0 h-full w-full object-contain"
															style={{
																zIndex: activeSlot.current === "A" ? 2 : 1,
																opacity: transitionState.active
																	? activeSlot.current === "A"
																		? 1 - transitionState.progress
																		: transitionState.progress
																	: activeSlot.current === "A"
																		? 1
																		: 0,
															}}
															playsInline
															preload="metadata"
														/>
														{/* Video B */}
														<video
															ref={videoBRef}
															className="absolute inset-0 h-full w-full object-contain"
															style={{
																zIndex: activeSlot.current === "B" ? 2 : 1,
																opacity: transitionState.active
																	? activeSlot.current === "B"
																		? 1 - transitionState.progress
																		: transitionState.progress
																	: activeSlot.current === "B"
																		? 1
																		: 0,
															}}
															playsInline
															preload="metadata"
														/>

														{/* Fade-to-black / fade-to-white overlay */}
														{transitionState.active &&
															(transitionState.type === "fade-to-black" ||
																transitionState.type === "fade-to-white") && (
																<div
																	className="absolute inset-0 z-10 pointer-events-none"
																	style={{
																		background:
																			transitionState.type === "fade-to-black"
																				? "black"
																				: "white",
																		opacity:
																			transitionState.progress < 0.5
																				? transitionState.progress * 2
																				: 2 - transitionState.progress * 2,
																	}}
																/>
															)}

														{/* Wipe overlay (left/right) */}
														{transitionState.active &&
															(transitionState.type === "wipe-left" ||
																transitionState.type === "wipe-right") && (
																<div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
																	<div
																		className="absolute inset-0"
																		style={{
																			background: "black",
																			opacity: 0.08,
																			clipPath:
																				transitionState.type === "wipe-right"
																					? `inset(0 ${(1 - transitionState.progress) * 100}% 0 0)`
																					: `inset(0 0 0 ${(1 - transitionState.progress) * 100}%)`,
																		}}
																	/>
																</div>
															)}

														{/* Transition label */}
														{transitionState.active && (
															<div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">
																<div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
																<span className="text-[8px] font-medium text-zinc-300 capitalize">
																	{transitionState.type.replace(/-/g, " ")}
																</span>
															</div>
														)}

														{playbackState === "playing" &&
															!transitionState.active && (
																<div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">
																	<div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
																	<span className="text-[8px] font-medium text-zinc-300">
																		PLAY
																	</span>
																</div>
															)}
													</>
												)}
											</div>
										</div>
									</div>
								</Panel>

								<Separator className="h-0.5 bg-black/40 hover:bg-blue-500/20 transition-colors cursor-row-resize" />

								{/* Timeline */}
								<Panel defaultSize={40} minSize={20}>
									<div className="h-full flex flex-col bg-[#121215]">
										<div className="flex h-7 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3">
											<div className="flex items-center gap-2">
												<Layout className="h-3 w-3 text-zinc-500" />
												<span className="text-[10px] font-medium text-zinc-400">
													Timeline
												</span>
											</div>
											<span className="text-[9px] font-mono text-zinc-600">
												{FPS} FPS
											</span>
										</div>
										<div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
											<TimelineEditor onSeek={handleSeekTo} />
										</div>
									</div>
								</Panel>
							</Group>
						</Panel>
					</Group>
				</div>

				{/* Right: AI Chat Panel */}
				{isChatOpen && (
					<div
						className="w-[340px] shrink-0 border-l border-zinc-800"
						style={{ animation: "slideInRight 0.15s ease-out" }}
					>
						<ChatPanel onClose={() => setChatOpen(false)} />
					</div>
				)}
			</main>
		</div>
	);
}
