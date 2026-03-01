"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
	Group,
	Panel,
	Separator,
	PanelImperativeHandle,
} from "react-resizable-panels";
import { useKinetographWS } from "@/hooks/use-kinetograph-ws";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { KinetographAPI } from "@/lib/api";
import { PipelineBanner } from "@/components/pipeline-banner";
import { AssetDropzone } from "@/components/asset-dropzone";
import { CreativePrompt } from "@/components/creative-prompt";
import { TimelineEditor } from "@/components/timeline-editor";
import {
	Film,
	MonitorPlay,
	Layers,
	Settings2,
	Maximize2,
	Clock,
	Layout,
	PanelLeftClose,
	PanelLeftOpen,
	Play,
	Pause,
	SkipBack,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRouter } from "next/navigation";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

function formatViewerTimecode(ms: number) {
	const totalFrames = Math.max(0, Math.floor((ms / 1000) * 30));
	const frames = totalFrames % 30;
	const totalSeconds = Math.floor(totalFrames / 30);
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export default function EditorPage() {
	useKinetographWS();
	const router = useRouter();
	const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
	const leftPanelRef = useRef<PanelImperativeHandle>(null);

	const setAssets = useKinetographStore((s) => s.setAssets);
	const setPipelineStatus = useKinetographStore((s) => s.setPipelineStatus);
	const assets = useKinetographStore((s) => s.assets);
	const selectedAssetId = useKinetographStore((s) => s.selectedAssetId);
	const selectedAsset =
		assets.find((asset) => asset.id === selectedAssetId) ?? null;

	// Video player for timeline playback (V1 with transitions)
	const player = useVideoPlayer();
	const v2Clips = useKinetographStore((s) => s.v2Clips);
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const hasTimeline = !!(paperEdit && paperEdit.clips.length > 0);

	const v2VideoRef = useRef<HTMLVideoElement>(null);
	const loadedV2SrcRef = useRef<string | null>(null);

	// Pick the first V2 clip to display as overlay
	const visibleV2Clip = v2Clips.length > 0 ? v2Clips[0] : null;

	// Resolve the stream URL for the visible overlay clip
	const v2StreamUrl = useMemo(() => {
		if (!visibleV2Clip) return null;
		const asset = assets.find((a) => a.id === visibleV2Clip.sourceAssetId);
		return asset?.stream_url ?? null;
	}, [visibleV2Clip, assets]);

	// Load V2 video source (video element is always mounted)
	useEffect(() => {
		const video = v2VideoRef.current;
		if (!video) return;

		if (!v2StreamUrl) {
			video.pause();
			video.removeAttribute("src");
			video.load();
			loadedV2SrcRef.current = null;
			return;
		}

		// Resolve to absolute to compare
		let fullUrl: string;
		try { fullUrl = new URL(v2StreamUrl, window.location.href).href; } catch { fullUrl = v2StreamUrl; }
		if (loadedV2SrcRef.current === fullUrl) return;
		loadedV2SrcRef.current = fullUrl;

		const seekTime = (visibleV2Clip?.inMs ?? 0) / 1000;
		video.src = v2StreamUrl;
		video.load();

		// Show the first frame immediately: play briefly then pause to decode
		const onCanPlay = () => {
			video.currentTime = seekTime;
			// Play+pause trick forces the browser to decode & render a frame
			video.play().then(() => {
				if (player.playbackState !== "playing") video.pause();
			}).catch(() => {});
		};
		video.addEventListener("canplay", onCanPlay, { once: true });

		return () => { video.removeEventListener("canplay", onCanPlay); };
	}, [v2StreamUrl, visibleV2Clip?.inMs, player.playbackState]);

	// Sync V2 play/pause with main player
	useEffect(() => {
		const video = v2VideoRef.current;
		if (!video || !v2StreamUrl || !video.src) return;
		if (player.playbackState === "playing") {
			video.play().catch(() => {});
		} else if (video.readyState >= 2) {
			video.pause();
		}
	}, [player.playbackState, v2StreamUrl]);

	// Seek handler that syncs both V1 and V2
	const handleSeek = useCallback(
		(ms: number) => {
			player.seekTo(ms);
			const video = v2VideoRef.current;
			if (!video || !video.src) return;
			const v2State = useKinetographStore.getState().v2Clips;
			for (const clip of v2State) {
				const clipEnd = clip.timelineStartMs + (clip.outMs - clip.inMs);
				if (ms >= clip.timelineStartMs && ms < clipEnd) {
					video.currentTime = (clip.inMs + (ms - clip.timelineStartMs)) / 1000;
					return;
				}
			}
		},
		[player],
	);

	useEffect(() => {
		KinetographAPI.getAssets()
			.then((res) => setAssets(res.assets))
			.catch(() => undefined);

		KinetographAPI.getStatus()
			.then((res) => {
				setPipelineStatus(res);
				if (res.phase === "awaiting_approval" || res.phase === "scripted") {
					KinetographAPI.getPaperEdit().then(
						useKinetographStore.getState().setPaperEdit,
					);
				}
			})
			.catch(() => undefined);
	}, [setAssets, setPipelineStatus]);

	const toggleSidebar = () => {
		const panel = leftPanelRef.current;
		if (panel) {
			if (isSidebarCollapsed) {
				panel.expand();
			} else {
				panel.collapse();
			}
			setSidebarCollapsed(!isSidebarCollapsed);
		}
	};

	return (
		<div className="flex h-screen w-full flex-col bg-[#0c0c0e] text-[#d1d1d1] overflow-hidden selection:bg-amber-500/30">
			{/* 🛠 Top Global Navigation Bar */}
			<header className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#16161a] px-3 z-30">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 group cursor-pointer">
						<div className="flex h-5 w-5 items-center justify-center rounded-sm bg-amber-600 text-black">
							<Film className="h-3.5 w-3.5 fill-current" />
						</div>
						<span
							className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-100 group-hover:text-amber-500 transition-colors"
							onClick={() => router.push("/")}
						>
							Kinetograph
						</span>
					</div>

					<nav className="flex items-center gap-1">
						{[
							"File",
							"Edit",
							"Clip",
							"Sequence",
							"Markers",
							"Window",
							"Help",
						].map((item) => (
							<button
								key={item}
								className="px-2 py-1 text-[11px] hover:bg-zinc-800 rounded-sm transition-colors active:bg-zinc-700"
							>
								{item}
							</button>
						))}
					</nav>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 border-x border-zinc-800 px-4 h-10">
						<Clock className="h-3 w-3 text-zinc-500" />
						<span className="text-[11px] font-mono tabular text-amber-500/80">
							{formatViewerTimecode(player.currentTimeDisplay)}
						</span>
					</div>
					<button className="p-1 hover:bg-zinc-800 rounded-sm">
						<Settings2 className="h-3.5 w-3.5 text-zinc-500" />
					</button>
				</div>
			</header>

			{/* 🛠 Resizable Docked Workspace */}
			<main className="flex-1 flex overflow-hidden">
				<Group orientation="horizontal">
					{/* Left Pane: Assets & Creative Prompt */}
					<Panel
						panelRef={leftPanelRef}
						defaultSize="320px"
						minSize="200px"
						collapsible
						className={cn(
							"flex flex-col border-r border-zinc-800 bg-[#121215]",
							isSidebarCollapsed && "hidden",
						)}
					>
						<div className="flex flex-row justify-between items-center h-8 gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3">
							<Layers className="h-3 w-3 text-zinc-500" />
							<span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
								Project Assets
							</span>
						</div>
						<div className="flex-1 overflow-y-auto custom-scrollbar p-3">
							<AssetDropzone />
						</div>

						<div className="border-t border-zinc-800 p-3 bg-zinc-900/20">
							<CreativePrompt />
						</div>
					</Panel>
					<div>
						<button
							onClick={toggleSidebar}
							className=" p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-amber-500 transition-colors"
							title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
						>
							{isSidebarCollapsed ? (
								<PanelLeftOpen className="h-3.5 w-3.5" />
							) : (
								<PanelLeftClose className="h-3.5 w-3.5" />
							)}
						</button>
					</div>

					<Separator className="w-1 bg-black/40 hover:bg-amber-500/20 transition-colors cursor-col-resize flex items-center justify-center group" />

					{/* Right Pane: Viewer & Timeline Stack */}
					<Panel defaultSize="100%">
						<Group orientation="vertical">
							{/* Top Section: Agent Status & Viewer */}
							<Panel defaultSize="60%" minSize="30%">
								<div className="flex h-full flex-col overflow-hidden">
									<PipelineBanner />

									<div className="flex flex-1 flex-col bg-gradient-to-b from-[#121215] to-[#0c0c0e]">
										{/* Cinematic Viewer Container */}
										<div className="relative flex-1 overflow-hidden border border-zinc-800 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] m-4 mb-0">
											{/* V1 Timeline Videos (dual elements for crossfade transitions) */}
											{hasTimeline && (
												<>
													<video
														ref={player.videoARef}
														className="absolute inset-0 h-full w-full object-contain"
														playsInline
														preload="metadata"
													/>
													<video
														ref={player.videoBRef}
														className="absolute inset-0 h-full w-full object-contain"
														playsInline
														preload="metadata"
													/>
												</>
											)}

											{/* V2 Overlay — always mounted, visibility controlled via CSS */}
											<div
												className={cn(
													"absolute overflow-hidden pointer-events-none z-10 border border-amber-500/30",
													visibleV2Clip ? "block" : "hidden",
												)}
												style={visibleV2Clip ? {
													left: `${visibleV2Clip.transform.x}%`,
													top: `${visibleV2Clip.transform.y}%`,
													width: `${visibleV2Clip.transform.width}%`,
													height: `${visibleV2Clip.transform.height}%`,
													opacity: visibleV2Clip.transform.opacity,
													borderRadius: `${visibleV2Clip.transform.borderRadius}px`,
												} : undefined}
											>
												<video
													ref={v2VideoRef}
													className="h-full w-full object-cover bg-zinc-800"
													playsInline
													muted
													preload="auto"
												/>
											</div>

											{/* Asset preview (when no timeline) */}
											{!hasTimeline && selectedAsset && (
												<div className="absolute inset-0 flex items-center justify-center">
													<video
														key={selectedAsset.id}
														src={selectedAsset.stream_url}
														className="h-full w-full object-contain"
														controls
														playsInline
														preload="metadata"
													/>
												</div>
											)}

											{/* Placeholder */}
											{!hasTimeline && !selectedAsset && (
												<div className="absolute inset-0 flex items-center justify-center">
													<MonitorPlay className="h-16 w-16 text-zinc-900 opacity-50" />
												</div>
											)}

											{/* Safe Areas */}
											<div className="absolute inset-0 border border-white/5 m-12 pointer-events-none" />
											<div className="absolute inset-x-0 top-1/2 h-px bg-white/5 pointer-events-none" />
											<div className="absolute inset-y-0 left-1/2 w-px bg-white/5 pointer-events-none" />
										</div>

										{/* Transport Controls */}
										{hasTimeline && (
											<div className="flex items-center justify-center gap-4 h-10 bg-zinc-900/50 border-t border-zinc-800 mx-4">
												<button
													onClick={player.stop}
													className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
													title="Stop"
												>
													<SkipBack className="h-3.5 w-3.5" />
												</button>
												<button
													onClick={player.togglePlayPause}
													className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
													title={player.playbackState === "playing" ? "Pause" : "Play"}
												>
													{player.playbackState === "playing" ? (
														<Pause className="h-4 w-4" />
													) : (
														<Play className="h-4 w-4 ml-0.5" />
													)}
												</button>
												<div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
													<span className="text-amber-500/80">{formatViewerTimecode(player.currentTimeDisplay)}</span>
													<span className="text-zinc-600">/</span>
													<span className="text-zinc-500">{formatViewerTimecode(player.totalDurationMs)}</span>
												</div>
											</div>
										)}
									</div>
								</div>
							</Panel>

							<Separator className="h-1 bg-black/40 hover:bg-amber-500/20 transition-colors cursor-row-resize flex items-center justify-center group" />

							{/* Bottom Section: Timeline Editor */}
							<Panel defaultSize="40%" minSize="20%">
								<div className="h-full flex flex-col bg-[#121215] shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)]">
									<div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3">
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-2">
												<Layout className="h-3 w-3 text-amber-500/60" />
												<span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
													Timeline: Main Sequence
												</span>
											</div>
											<div className="h-4 w-px bg-zinc-800" />
											<span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tight">
												30 FPS
											</span>
										</div>
										<div className="flex items-center gap-3">
											<button className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
												V1
											</button>
											<button className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
												V2
											</button>
											<button className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
												A1
											</button>
										</div>
									</div>

									<div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
										<TimelineEditor onSeek={handleSeek} />
									</div>
								</div>
							</Panel>
						</Group>
					</Panel>
				</Group>
			</main>
		</div>
	);
}
