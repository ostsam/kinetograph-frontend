"use client";

import { useState, useMemo } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI } from "@/lib/api";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";

export function CreativePrompt() {
	const [prompt, setPrompt] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const assets = useKinetographStore((s) => s.assets);
	const paperEdit = useKinetographStore((s) => s.paperEdit);

	const hasArollOnTimeline = useMemo(() => {
		if (!paperEdit?.clips) return false;
		return paperEdit.clips.some((c) => c.clip_type === "a-roll");
	}, [paperEdit]);

	const hasArollAssets = useMemo(() => assets.some((a) => a.asset_type === "a-roll"), [assets]);
	const hasBrollAssets = useMemo(() => assets.some((a) => a.asset_type === "b-roll" || a.asset_type === "b-roll-synth"), [assets]);

	const handleSubmit = async () => {
		if (!prompt.trim()) return;
		if (!hasArollOnTimeline && !hasArollAssets) return;
		setIsRunning(true);
		try {
			await KinetographAPI.runPipeline({
				prompt: prompt.trim(),
			});
		} catch {
			// Pipeline errors are handled via WS
		} finally {
			setIsRunning(false);
		}
	};

	// Warning states
	const showNoAroll = assets.length > 0 && !hasArollAssets;
	const showNoBroll = assets.length > 0 && hasArollAssets && !hasBrollAssets;
	const showAddToTimeline = hasArollAssets && !hasArollOnTimeline && paperEdit !== null;

	return (
		<div className="flex flex-col gap-2">
			<div className="relative">
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder="Describe your edit — e.g. 'Create a 60s highlight reel with upbeat transitions'"
					rows={3}
					disabled={isRunning}
					className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-600/40 resize-none disabled:opacity-50"
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							handleSubmit();
						}
					}}
				/>
			</div>

			{/* Warnings */}
			{showNoAroll && (
				<div className="flex items-start gap-2 px-2 py-1.5 rounded bg-amber-500/5 border border-amber-600/20">
					<AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
					<p className="text-[9px] text-amber-400/80 leading-relaxed">
						<span className="font-semibold">No A-Roll marked.</span> Click the type badge on your assets to mark primary footage as <span className="text-emerald-400">a-roll</span> before generating.
					</p>
				</div>
			)}
			{showNoBroll && (
				<div className="flex items-start gap-2 px-2 py-1.5 rounded bg-blue-500/5 border border-blue-600/20">
					<AlertTriangle className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
					<p className="text-[9px] text-blue-300/80 leading-relaxed">
						<span className="font-semibold">No B-Roll found.</span> Import supplementary footage for cutaways and overlays.
					</p>
				</div>
			)}
			{showAddToTimeline && (
				<div className="flex items-start gap-2 px-2 py-1.5 rounded bg-amber-500/5 border border-amber-600/20">
					<AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
					<p className="text-[9px] text-amber-400/80 leading-relaxed">
						<span className="font-semibold">A-Roll not on timeline.</span> Drag your A-Roll clips to the V1 track, or select them and drag to the timeline.
					</p>
				</div>
			)}

			<button
				onClick={handleSubmit}
				disabled={isRunning || !prompt.trim() || (assets.length > 0 && !hasArollAssets)}
				className="flex items-center justify-center gap-1.5 w-full bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-30 disabled:hover:bg-amber-600/20 px-3 py-2 rounded border border-amber-600/30 text-[10px] font-semibold text-amber-300 transition-colors"
			>
				{isRunning ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" />
						Running…
					</>
				) : (
					<>
						<Sparkles className="h-3 w-3" />
						Generate Edit
						<span className="text-[8px] font-normal text-amber-500/60 ml-1">⌘↵</span>
					</>
				)}
			</button>
		</div>
	);
}
