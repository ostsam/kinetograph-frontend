"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
	Group,
	Panel,
	Separator,
	PanelImperativeHandle,
} from "react-resizable-panels";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { KinetographAPI } from "@/lib/api";
import { AssetDropzone } from "@/components/asset-dropzone";
import { TimelineEditor } from "@/components/timeline-editor";
import { ExportPanel } from "@/components/export-panel";
import {
	Film,
	MonitorPlay,
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

	const setAssets = useKinetographStore((s) => s.setAssets);
	const assets = useKinetographStore((s) => s.assets);

	const {
		videoRef,
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

	useEffect(() => {
		KinetographAPI.getAssets()
			.then((res) => setAssets(res.assets))
			.catch(() => undefined);
	}, [setAssets]);

	// Keyboard shortcuts
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;

			if (e.key === " ") { e.preventDefault(); togglePlayPause(); }
			else if (e.key === "Escape") { stop(); }
			// J/K/L shuttle
			else if (e.key === "j") { seekTo(Math.max(0, currentTimeDisplay - 5000)); }
			else if (e.key === "k") { togglePlayPause(); }
			else if (e.key === "l") { seekTo(currentTimeDisplay + 5000); }
			// Arrow keys: frame step
			else if (e.key === "ArrowLeft") {
				e.preventDefault();
				seekTo(Math.max(0, currentTimeDisplay - (e.shiftKey ? 1000 : 1000 / FPS)));
			}
			else if (e.key === "ArrowRight") {
				e.preventDefault();
				seekTo(currentTimeDisplay + (e.shiftKey ? 1000 : 1000 / FPS));
			}
			// Home / End
			else if (e.key === "Home") { seekTo(0); }
			else if (e.key === "End") { seekTo(totalDurationMs); }
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [togglePlayPause, stop, seekTo, currentTimeDisplay, totalDurationMs]);

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
			{showExportPanel && <ExportPanel onClose={() => setShowExportPanel(false)} />}

			{/* Top Bar */}
			<header className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#1a1a1e] px-3 z-30">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
						<Film className="h-3.5 w-3.5 text-blue-500" />
						<span className="text-[11px] font-semibold tracking-wide text-zinc-200">Editor</span>
					</div>

					<nav className="flex items-center gap-0.5 ml-2">
						{["File", "Edit", "View", "Clip", "Sequence", "Help"].map((item) => (
							<button
								key={item}
								onClick={() => handleMenuClick(item)}
								className={cn(
									"px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded transition-colors",
									item === "File" && showExportPanel && "bg-zinc-800 text-zinc-200",
								)}
							>
								{item}
							</button>
						))}
					</nav>
				</div>

				<div className="flex items-center gap-2">
					{/* Transport */}
					<div className="flex items-center gap-0.5 border-x border-zinc-800 px-2 h-9">
						<button onClick={() => seekTo(0)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors" title="Go to start (Home)">
							<SkipBack className="h-3 w-3" />
						</button>
						<button
							onClick={togglePlayPause}
							className={cn(
								"p-1 rounded transition-colors",
								playbackState === "playing"
									? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
									: "hover:bg-zinc-800 text-zinc-400 hover:text-white",
							)}
							title={playbackState === "playing" ? "Pause (K/Space)" : "Play (K/Space)"}
						>
							{playbackState === "playing" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
						</button>
						<button onClick={stop} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors" title="Stop (Esc)">
							<Square className="h-2.5 w-2.5" />
						</button>
						<button onClick={() => seekTo(totalDurationMs)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors" title="Go to end (End)">
							<SkipForward className="h-3 w-3" />
						</button>
					</div>

					{/* Timecode */}
					<div className="flex items-center gap-1.5 px-2">
						<span className="text-[11px] font-mono tabular text-blue-400/90">
							{formatTimecode(currentTimeDisplay)}
						</span>
						<span className="text-[9px] font-mono tabular text-zinc-600">
							/ {formatTimecode(totalDurationMs)}
						</span>
					</div>

					{/* Volume */}
					<div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
						<button
							onClick={() => setVolume(volume > 0 ? 0 : 1)}
							className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
						>
							{volume > 0 ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
						</button>
						<input
							type="range"
							min={0} max={1} step={0.05}
							value={volume}
							onChange={(e) => setVolume(Number(e.target.value))}
							className="w-14 h-1 accent-blue-500 cursor-pointer"
						/>
					</div>

					{/* Speed */}
					<select
						value={playbackRate}
						onChange={(e) => setPlaybackRate(Number(e.target.value))}
						className="bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400 px-1 py-0.5 cursor-pointer outline-none"
					>
						{PLAYBACK_RATES.map((r) => (
							<option key={r} value={r}>{r}×</option>
						))}
					</select>
				</div>
			</header>

			{/* Main workspace */}
			<main className="flex-1 flex overflow-hidden">
				<Group orientation="horizontal">
					{/* Left sidebar: Media bin */}
					<Panel
						panelRef={leftPanelRef}
						defaultSize={20}
						minSize={12}
						collapsible
						className={cn("flex flex-col border-r border-zinc-800 bg-[#121215]", isSidebarCollapsed && "hidden")}
					>
						<div className="flex items-center justify-between h-7 border-b border-zinc-800 bg-zinc-900/50 px-3">
							<div className="flex items-center gap-1.5">
								<FolderOpen className="h-3 w-3 text-zinc-500" />
								<span className="text-[10px] font-medium text-zinc-400">Media</span>
							</div>
							<span className="text-[9px] font-mono text-zinc-600">{assets.length}</span>
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
							{isSidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
						</button>
					</div>

					<Separator className="w-0.5 bg-black/40 hover:bg-blue-500/20 transition-colors cursor-col-resize" />

					{/* Right: Viewer + Timeline */}
					<Panel defaultSize={80}>
						<Group orientation="vertical">
							{/* Viewer */}
							<Panel defaultSize={60} minSize={25}>
								<div className="flex h-full flex-col overflow-hidden bg-[#0e0e10]">
									<div className="flex flex-1 items-center justify-center p-4">
										<div className="relative h-full w-full overflow-hidden border border-zinc-800/50 bg-black">
											<video
												ref={videoRef}
												className="absolute inset-0 h-full w-full object-contain"
												playsInline
												preload="metadata"
											/>

											{playbackState === "playing" && (
												<div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">
													<div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
													<span className="text-[8px] font-medium text-zinc-300">PLAY</span>
												</div>
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
											<span className="text-[10px] font-medium text-zinc-400">Timeline</span>
										</div>
										<span className="text-[9px] font-mono text-zinc-600">{FPS} FPS</span>
									</div>
									<div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
										<TimelineEditor onSeek={seekTo} />
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
