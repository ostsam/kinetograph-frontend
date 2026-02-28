"use client";

import { useState } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI } from "@/lib/api";
import { Terminal, Loader2, Cpu } from "lucide-react";
import { Phase } from "@/types/kinetograph";

export function CreativePrompt() {
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const phase = useKinetographStore((s) => s.phase);
	const assets = useKinetographStore((s) => s.assets);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!prompt.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			await KinetographAPI.runPipeline({ prompt });
		} catch (err) {
			console.error("Failed to run pipeline:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isDisabled = assets.length === 0 || phase !== Phase.IDLE;

	return (
		<form
			onSubmit={handleSubmit}
			className="relative flex w-full flex-col bg-black/40 border border-zinc-800 rounded-sm overflow-hidden"
		>
			<div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
				<div className="flex items-center gap-2">
					<Terminal className="h-3 w-3 text-amber-500/70" />
					<span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
						Sequence Generator v1.0
					</span>
				</div>
				<div className="flex items-center gap-1">
					<div
						className={`h-1 w-1 rounded-full ${isDisabled ? "bg-zinc-700" : "bg-emerald-500 animate-pulse"}`}
					/>
					<span className="text-[8px] font-mono text-zinc-600 uppercase">
						{isDisabled ? "OFFLINE" : "ONLINE"}
					</span>
				</div>
			</div>

			<div className="p-2 flex flex-col gap-2">
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder={
						isDisabled
							? "INGEST ASSETS TO WAKE SWARM…"
							: "ENTER NARRATIVE BRIEF OR EDITING COMMANDS…"
					}
					disabled={isDisabled || isSubmitting}
					className="w-full resize-none bg-transparent text-[11px] font-mono tabular text-zinc-300 placeholder:text-zinc-700 focus:outline-none min-h-[80px] leading-relaxed uppercase"
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							handleSubmit(e);
						}
					}}
				/>

				<div className="flex items-center justify-between border-t border-zinc-800/50 pt-2">
					<span className="text-[8px] font-mono text-zinc-600">
						INPUT_BUFFER: {prompt.length}/2000_BYTES
					</span>

					<button
						type="submit"
						disabled={isDisabled || isSubmitting || !prompt.trim()}
						className={`
              flex items-center gap-2 rounded-sm px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all
              ${
								isDisabled || isSubmitting || !prompt.trim()
									? "bg-zinc-900 text-zinc-700 cursor-not-allowed border border-white/5"
									: "bg-amber-600 text-black hover:bg-amber-500 shadow-[0_0_10px_rgba(217,119,6,0.2)] active:scale-[0.98]"
							}
            `}
					>
						{isSubmitting ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Cpu className="h-3 w-3" />
						)}
						Execute Script
					</button>
				</div>
			</div>

			{isDisabled && assets.length > 0 && phase !== Phase.IDLE && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
					<div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-sm shadow-2xl">
						<Loader2 className="h-3 w-3 animate-spin text-amber-500" />
						<span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
							Agent Processing Sequence…
						</span>
					</div>
				</div>
			)}
		</form>
	);
}
