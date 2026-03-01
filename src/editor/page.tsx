"use client";

import { useEffect, useState, useRef } from "react";
import {
	Group,
	Panel,
	Separator,
	PanelImperativeHandle,
} from "react-resizable-panels";
import { useMontazhWS } from "@/hooks/use-montazh-ws";
import { useMontazhStore } from "@/store/use-montazh-store";
import { MontazhAPI } from "@/lib/api";
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
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRouter } from "next/navigation";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export default function EditorPage() {
	useMontazhWS();
	const router = useRouter();
	const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
	const leftPanelRef = useRef<PanelImperativeHandle>(null);

	const setAssets = useMontazhStore((s) => s.setAssets);
	const setPipelineStatus = useMontazhStore((s) => s.setPipelineStatus);
	const assets = useMontazhStore((s) => s.assets);
	const selectedAssetId = useMontazhStore((s) => s.selectedAssetId);
	const selectedAsset =
		assets.find((asset) => asset.id === selectedAssetId) ?? null;

	useEffect(() => {
		MontazhAPI.getAssets()
			.then((res) => setAssets(res.assets))
			.catch(() => undefined);

		MontazhAPI.getStatus()
			.then((res) => {
				setPipelineStatus(res);
				if (res.phase === "awaiting_approval" || res.phase === "scripted") {
					MontazhAPI.getPaperEdit().then(
						useMontazhStore.getState().setPaperEdit,
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
							Montazh
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
							00:00:00:00
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

									<div className="flex flex-1 items-center justify-center p-8 bg-gradient-to-b from-[#121215] to-[#0c0c0e]">
										{/* Cinematic Viewer Container */}
										<div className="relative h-full w-full overflow-hidden border border-zinc-800 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
											{selectedAsset ? (
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
											) : (
												<div className="absolute inset-0 flex items-center justify-center border-[20px] border-transparent">
													<MonitorPlay className="h-16 w-16 text-zinc-900 opacity-50" />
												</div>
											)}

											{/* Safe Areas */}
											<div className="absolute inset-0 border border-white/5 m-12 pointer-events-none" />
											<div className="absolute inset-x-0 top-1/2 h-px bg-white/5 pointer-events-none" />
											<div className="absolute inset-y-0 left-1/2 w-px bg-white/5 pointer-events-none" />

											{/* Bottom Viewer Toolbar */}
											<div className="absolute bottom-0 inset-x-0 h-8 bg-zinc-900/90 backdrop-blur-sm border-t border-white/5 flex items-center justify-between px-3 translate-y-full group-hover:translate-y-0 transition-transform">
												<div className="flex items-center gap-4">
													<span className="text-[10px] font-mono tabular text-zinc-400">
														{selectedAsset ? "FIT: HEIGHT" : "FIT: 42%"}
													</span>
													<span className="text-[10px] font-mono tabular text-zinc-400">
														{selectedAsset
															? `${selectedAsset.width}x${selectedAsset.height}`
															: "FULL"}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<Maximize2 className="h-3 w-3 text-zinc-500 cursor-pointer hover:text-white" />
												</div>
											</div>
										</div>
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
										<TimelineEditor />
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
