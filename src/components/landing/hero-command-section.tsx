"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	Play,
	SkipBack,
	SkipForward,
} from "lucide-react";

const TIMELINE_SECONDS = 45;
const CYCLE_DURATION_MS = 8000;

const toneClasses = {
	amber: "border-amber-500/30 bg-amber-500/10 text-amber-300/90",
	sky: "border-sky-400/30 bg-sky-400/10 text-sky-300/90",
	violet: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300/90",
	emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300/90",
	zinc: "border-zinc-600/40 bg-zinc-600/10 text-zinc-400",
} as const;

type ClipTone = keyof typeof toneClasses;

interface TimelineClip {
	label: string;
	start: number;
	duration: number;
	tone: ClipTone;
}

interface TimelineRow {
	track: string;
	clips: TimelineClip[];
}

const timelineRows: TimelineRow[] = [
	{
		track: "V1",
		clips: [
			{ label: "INT-A", start: 0, duration: 12, tone: "amber" },
			{ label: "BROLL-CITY", start: 12, duration: 7, tone: "sky" },
			{ label: "INT-B", start: 19, duration: 11, tone: "amber" },
			{ label: "OUTRO", start: 30, duration: 15, tone: "zinc" },
		],
	},
	{
		track: "V2",
		clips: [
			{ label: "LOWER3RD", start: 3, duration: 8, tone: "violet" },
			{ label: "CALLOUT", start: 24, duration: 10, tone: "violet" },
		],
	},
	{
		track: "A1",
		clips: [
			{ label: "DIALOG", start: 0, duration: 35, tone: "emerald" },
		],
	},
	{
		track: "A2",
		clips: [
			{ label: "MUSIC-BED", start: 4, duration: 41, tone: "emerald" },
		],
	},
];

export function HeroCommandSection() {
	const [elapsedMs, setElapsedMs] = useState(0);

	useEffect(() => {
		let raf = 0;
		const start = performance.now();

		const tick = (now: number) => {
			setElapsedMs((now - start) % CYCLE_DURATION_MS);
			raf = window.requestAnimationFrame(tick);
		};

		raf = window.requestAnimationFrame(tick);
		return () => window.cancelAnimationFrame(raf);
	}, []);

	const playheadProgress = elapsedMs / CYCLE_DURATION_MS;
	const playheadSec = Math.round(playheadProgress * TIMELINE_SECONDS);
	const playheadFrames = Math.floor((elapsedMs / 40) % 25);
	const rulerTicks = useMemo(
		() => Array.from({ length: 10 }, (_, i) => i * 5),
		[],
	);

	return (
		<section className="mt-16 sm:mt-20">
			{/* Hero copy */}
			<div className="landing-appear mx-auto max-w-3xl text-center">
				<h1 className="landing-appear text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
					Autonomous post&#8209;production from rushes to master.
				</h1>
				<p className="landing-appear landing-appear-delay-1 mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
					AI agents handle ingest, paper edits, assembly, and delivery
					while you stay focused on story and pacing.
				</p>
				<div className="landing-appear landing-appear-delay-2 mt-8 flex flex-wrap items-center justify-center gap-3">
					<Link
						href="/editor"
						className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity duration-200 hover:opacity-90"
					>
						Open Timeline
						<ArrowRight className="h-4 w-4" />
					</Link>
					<a
						href="#features"
						className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors duration-200 hover:border-white/20 hover:text-white"
					>
						See How It Works
					</a>
				</div>
			</div>

			{/* Timeline mock — the hero visual */}
			<div className="landing-appear landing-appear-delay-3 mx-auto mt-14 max-w-4xl">
				<div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114] shadow-2xl shadow-black/50">
					{/* Toolbar */}
					<div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
						<div className="flex items-center gap-3">
							<div className="flex gap-1.5">
								<div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
								<div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
								<div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
							</div>
							<span className="text-xs font-medium text-zinc-500">
								Launch Spot v3 — Sequence
							</span>
						</div>
						<div className="tabular text-xs font-mono text-amber-400/80">
							00:00:{playheadSec.toString().padStart(2, "0")}:{playheadFrames.toString().padStart(2, "0")}
						</div>
					</div>

					{/* Preview area */}
					<div className="relative aspect-[2.35/1] overflow-hidden bg-[#0a0b0f]">
						<video
							className="absolute inset-0 h-full w-full object-cover"
							autoPlay
							loop
							muted
							playsInline
							preload="metadata"
							aria-label="Kinetograph timeline preview"
						>
							<source
								src="/5a18a6e6-015b-4652-b0f5-d6c479495235.mp4"
								type="video/mp4"
							/>
						</video>

						{/* Letterbox bars */}
						<div className="pointer-events-none absolute inset-x-0 top-0 h-[10%] bg-black/80" />
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10%] bg-black/80" />
						{/* Subtle safe-area frame */}
						<div className="pointer-events-none absolute inset-x-[5%] inset-y-[12%] border border-white/[0.03]" />
						{/* Transport controls */}
						<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/60 px-3 py-1.5 backdrop-blur-sm">
							<button
								type="button"
								className="text-zinc-500 transition-colors hover:text-zinc-300"
								aria-label="Skip backward"
							>
								<SkipBack className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-black transition-opacity hover:opacity-90"
								aria-label="Play"
							>
								<Play className="h-3 w-3 fill-current" />
							</button>
							<button
								type="button"
								className="text-zinc-500 transition-colors hover:text-zinc-300"
								aria-label="Skip forward"
							>
								<SkipForward className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* Timeline tracks */}
					<div className="relative border-t border-white/[0.06] bg-[#0d0e12] px-3 py-3">
						{/* Playhead — spans full height of ruler + tracks, offset by track label width (2rem) */}
						<div
							className="pointer-events-none absolute top-3 bottom-3 z-10 w-px bg-amber-400"
							style={{ left: `calc(0.75rem + 2rem + (100% - 0.75rem - 0.75rem - 2rem) * ${playheadProgress})` }}
						>
							<div
								className="absolute -top-1 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-amber-400"
							/>
						</div>

						{/* Ruler — aligned with track content area */}
						<div className="flex mb-2 h-5">
							<div className="w-8 shrink-0" />
							<div className="relative flex-1">
								{rulerTicks.map((tick) => (
									<div
										key={tick}
										className="absolute top-0 bottom-0"
										style={{ left: `${(tick / TIMELINE_SECONDS) * 100}%` }}
									>
										<div className="h-full w-px bg-zinc-800" />
										<span className="absolute left-1 top-0 text-[9px] font-mono tabular text-zinc-600">
											{tick.toString().padStart(2, "0")}s
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Tracks */}
						<div className="space-y-1">
							{timelineRows.map((row) => (
								<div
									key={row.track}
									className="relative flex h-9 items-center"
								>
									<div className="w-8 shrink-0 text-[10px] font-mono text-zinc-600">
										{row.track}
									</div>
									<div className="relative h-full flex-1 rounded bg-zinc-900/50">
										{row.clips.map((clip) => (
											<div
												key={`${row.track}-${clip.label}`}
												className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded px-2 text-[10px] font-medium border ${toneClasses[clip.tone]}`}
												style={{
													left: `${(clip.start / TIMELINE_SECONDS) * 100}%`,
													width: `${(clip.duration / TIMELINE_SECONDS) * 100}%`,
												}}
											>
												<span className="truncate">{clip.label}</span>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
