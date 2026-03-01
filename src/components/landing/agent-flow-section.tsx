"use client";
 
import { useEffect, useRef, useState } from "react";
import {
	motion,
	AnimatePresence,
	useInView,
} from "framer-motion";
import {
	Archive,
	PenTool,
	Clapperboard,
	Download,
	Film,
	Captions,
	AudioLines,
	PackageCheck,
	ArrowRight,
	RotateCcw,
	CheckCircle2,
	AlertTriangle,
	User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
 
/* ─── Agent definitions matching the real backend pipeline ─────────────────── */
 
interface Agent {
	id: string;
	name: string;
	role: string;
	icon: LucideIcon;
	color: string;          // Tailwind ring/border accent
	bgGlow: string;         // Radial glow for the active state
	description: string;
	output: string;
	apis?: string[];
}
 
const agents: Agent[] = [
	{
		id: "archivist",
		name: "Archivist",
		role: "Ingest & Index",
		icon: Archive,
		color: "amber",
		bgGlow: "rgba(245,158,11,0.12)",
		description:
			"Ingests raw footage, extracts audio, transcribes with ElevenLabs STT, and analyzes video segments with NVIDIA Nemotron VLM.",
		output: "Master Index",
		apis: ["ElevenLabs", "Nemotron"],
	},
	{
		id: "scripter",
		name: "Scripter",
		role: "Paper Edit",
		icon: PenTool,
		color: "sky",
		bgGlow: "rgba(56,189,248,0.12)",
		description:
			"Reads the master index and creative brief, then generates a structured Paper Edit — a JSON DAG of clips with beat timing.",
		output: "Paper Edit",
		apis: ["Mistral"],
	},
	{
		id: "producer",
		name: "Producer",
		role: "Human Gate",
		icon: User,
		color: "fuchsia",
		bgGlow: "rgba(232,121,249,0.12)",
		description:
			"Pauses the pipeline for human review. Editors can approve, modify clip order, or reject to re-script.",
		output: "Approved Edit",
	},
	{
		id: "synthesizer",
		name: "Synthesizer",
		role: "Stock Footage",
		icon: Download,
		color: "violet",
		bgGlow: "rgba(139,92,246,0.12)",
		description:
			"Identifies visual gaps in the approved edit and downloads matching stock footage from Pexels to fill them.",
		output: "Synth Assets",
		apis: ["Pexels"],
	},
	{
		id: "director",
		name: "Director",
		role: "Compositing",
		icon: Film,
		color: "orange",
		bgGlow: "rgba(249,115,22,0.12)",
		description:
			"Normalizes all clips, groups A-roll with B-roll overlays, and renders the composited timeline with crossfade transitions.",
		output: "Rendered Video",
		apis: ["MoviePy"],
	},
	{
		id: "captioner",
		name: "Captioner",
		role: "Subtitles",
		icon: Captions,
		color: "teal",
		bgGlow: "rgba(45,212,191,0.12)",
		description:
			"Generates TikTok-style word-by-word captions from ElevenLabs timestamps and burns them into the video via FFmpeg.",
		output: "Captioned Video",
		apis: ["FFmpeg"],
	},
	{
		id: "sound_engineer",
		name: "Sound Engineer",
		role: "Audio Master",
		icon: AudioLines,
		color: "emerald",
		bgGlow: "rgba(52,211,153,0.12)",
		description:
			"Removes noise, normalizes to −14 LUFS, fetches vibe-matched background music from Soundstripe, and mixes with speech ducking.",
		output: "Mastered Audio",
		apis: ["Soundstripe", "FFmpeg"],
	},
	{
		id: "export",
		name: "Export",
		role: "Delivery",
		icon: PackageCheck,
		color: "amber",
		bgGlow: "rgba(245,158,11,0.12)",
		description:
			"Builds OTIO timeline and exports .otio, .fcpxml, and the final mastered video — ready for NLE handoff or publishing.",
		output: "Master + Timeline",
	},
];
 
/* ─── Color map for Tailwind classes ──────────────────────────────────────── */
 
const colorMap: Record<string, { ring: string; bg: string; text: string; dot: string; glow: string }> = {
	amber:   { ring: "ring-amber-500/30",   bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400",   glow: "shadow-amber-500/20" },
	sky:     { ring: "ring-sky-400/30",      bg: "bg-sky-400/10",     text: "text-sky-400",     dot: "bg-sky-400",     glow: "shadow-sky-400/20" },
	fuchsia: { ring: "ring-fuchsia-400/30",  bg: "bg-fuchsia-400/10", text: "text-fuchsia-400", dot: "bg-fuchsia-400", glow: "shadow-fuchsia-400/20" },
	violet:  { ring: "ring-violet-400/30",   bg: "bg-violet-400/10",  text: "text-violet-400",  dot: "bg-violet-400",  glow: "shadow-violet-400/20" },
	orange:  { ring: "ring-orange-400/30",   bg: "bg-orange-400/10",  text: "text-orange-400",  dot: "bg-orange-400",  glow: "shadow-orange-400/20" },
	teal:    { ring: "ring-teal-400/30",     bg: "bg-teal-400/10",    text: "text-teal-400",    dot: "bg-teal-400",    glow: "shadow-teal-400/20" },
	emerald: { ring: "ring-emerald-400/30",  bg: "bg-emerald-400/10", text: "text-emerald-400", dot: "bg-emerald-400", glow: "shadow-emerald-400/20" },
};
 
/* ─── Timing ──────────────────────────────────────────────────────────────── */
 
const STEP_DURATION_MS = 2800;
const TOTAL_STEPS = agents.length;
const PAUSE_AFTER_COMPLETE_MS = 3000;
const CYCLE_MS = STEP_DURATION_MS * TOTAL_STEPS + PAUSE_AFTER_COMPLETE_MS;
 
/* ─── Data Packet Animation ───────────────────────────────────────────────── */
 
function DataPacket({ active, color }: { active: boolean; color: string }) {
	const c = colorMap[color] ?? colorMap.amber;
	if (!active) return null;
 
	return (
		<motion.div
			className={`absolute left-1/2 top-0 h-1.5 w-6 -translate-x-1/2 rounded-full ${c.dot} opacity-80`}
			initial={{ y: -4, opacity: 0, scaleX: 0.5 }}
			animate={{ y: 28, opacity: [0, 1, 1, 0], scaleX: [0.5, 1, 1, 0.5] }}
			transition={{ duration: 0.8, ease: "easeInOut" }}
		/>
	);
}
 
/* ─── Single Agent Node ───────────────────────────────────────────────────── */
 
function AgentNode({
	agent,
	index,
	activeIndex,
	completedSet,
}: {
	agent: Agent;
	index: number;
	activeIndex: number;
	completedSet: Set<number>;
}) {
	const c = colorMap[agent.color] ?? colorMap.amber;
	const isActive = index === activeIndex;
	const isCompleted = completedSet.has(index);
	const isPending = !isActive && !isCompleted;
	const isProducer = agent.id === "producer";
 
	return (
		<div className="relative flex flex-col items-center justify-end">
			{/* Connecting line to next node */}
			{index < agents.length - 1 && (
				<div className="absolute left-1/2 top-full z-0 h-8 w-px -translate-x-1/2 sm:left-full sm:top-1/2 sm:h-px sm:w-8 sm:-translate-x-0 sm:-translate-y-1/2">
					<div
						className={`h-full w-full transition-colors duration-500 ${
							isCompleted ? c.dot : "bg-zinc-800"
						}`}
					/>
					{/* Data packet animation */}
					<div className="relative">
						<AnimatePresence>
							{isActive && <DataPacket active color={agent.color} />}
						</AnimatePresence>
					</div>
				</div>
			)}
 
			{/* Agent card */}
			<motion.div
				className={`relative z-10 flex h-[130px] w-full flex-col items-center justify-center rounded-xl border p-3 sm:p-4 transition-all duration-500 ${
					isActive
						? `border-white/[0.12] ring-1 ${c.ring} bg-[#111114]`
						: isCompleted
							? "border-white/[0.08] bg-[#111114]"
							: "border-white/[0.04] bg-[#0d0e12]"
				}`}
				style={{
					boxShadow: isActive ? `0 0 40px ${agent.bgGlow}` : "none",
					transformOrigin: "center center",
				}}
				animate={{
					scale: isActive ? 1.05 : 1,
				}}
				transition={{ type: "spring", stiffness: 300, damping: 25 }}
			>
				{/* Icon */}
				<div
					className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-500 ${
						isActive
							? `${c.bg} ${c.text}`
							: isCompleted
								? `bg-zinc-800/50 ${c.text} opacity-70`
								: "bg-zinc-900/50 text-zinc-600"
					}`}
				>
					{isCompleted ? (
						<CheckCircle2 className="h-5 w-5" />
					) : (
						<agent.icon className="h-5 w-5" />
					)}
				</div>
 
				{/* Name */}
				<p
					className={`mt-2 text-[11px] font-bold uppercase tracking-wider transition-colors duration-500 ${
						isActive ? c.text : isCompleted ? "text-zinc-400" : "text-zinc-600"
					}`}
				>
					{agent.name}
				</p>
				<p
					className={`text-[9px] font-medium uppercase tracking-wider transition-colors duration-500 ${
						isActive ? "text-zinc-400" : "text-zinc-700"
					}`}
				>
					{agent.role}
				</p>
 
				{/* Human-in-the-loop badge */}
				{isProducer && (
					<div className="mt-1.5 flex items-center gap-1 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/5 px-2 py-0.5">
						<User className="h-2.5 w-2.5 text-fuchsia-400" aria-hidden="true" />
						<span className="text-[8px] font-semibold uppercase tracking-wider text-fuchsia-400">
							Human Gate
						</span>
					</div>
				)}
 
				{/* Active pulse ring */}
				{isActive && (
					<motion.div
						className={`absolute inset-0 rounded-xl ring-1 ${c.ring}`}
						animate={{ opacity: [0.5, 1, 0.5] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
					/>
				)}
			</motion.div>
		</div>
	);
}
 
/* ─── Detail Panel ────────────────────────────────────────────────────────── */
 
function DetailPanel({ agent }: { agent: Agent }) {
	const c = colorMap[agent.color] ?? colorMap.amber;
 
	return (
		<motion.div
			key={agent.id}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.35, ease: "easeOut" }}
			className="rounded-xl border border-white/[0.06] bg-[#111114] p-5 sm:p-6"
		>
			<div className="flex items-start gap-4">
				<div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
					<agent.icon className={`h-5 w-5 ${c.text}`} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h4 className="text-[15px] font-semibold text-zinc-100">
							{agent.name}
						</h4>
						<span className={`rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${c.text}`}>
							{agent.role}
						</span>
					</div>
					<p className="mt-2 text-sm leading-relaxed text-zinc-500">
						{agent.description}
					</p>
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
							Output
						</span>
						<span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
							{agent.output}
						</span>
						{agent.apis?.map((api) => (
							<span
								key={api}
								className={`rounded-md border ${c.ring} ${c.bg} px-2 py-0.5 text-[10px] font-semibold ${c.text}`}
							>
								{api}
							</span>
						))}
					</div>
				</div>
			</div>
 
			{/* Special: Producer rejection loop */}
			{agent.id === "producer" && (
				<div className="mt-4 flex items-center gap-2 rounded-lg border border-fuchsia-400/10 bg-fuchsia-400/5 px-3 py-2">
					<RotateCcw className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" aria-hidden="true" />
					<p className="text-[11px] leading-relaxed text-fuchsia-300/80">
						On rejection, loops back to the Scripter for a revised Paper Edit.
					</p>
				</div>
			)}
		</motion.div>
	);
}
 
/* ─── Progress Bar ────────────────────────────────────────────────────────── */
 
function ProgressBar({ activeIndex, total }: { activeIndex: number; total: number }) {
	const progress = ((activeIndex + 1) / total) * 100;
 
	return (
		<div className="flex items-center gap-3">
			<div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800/60">
				<motion.div
					className="h-full rounded-full bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400"
					animate={{ width: `${progress}%` }}
					transition={{ duration: 0.5, ease: "easeInOut" }}
				/>
			</div>
			<span className="tabular text-[11px] font-mono font-medium text-zinc-500">
				{activeIndex + 1}/{total}
			</span>
		</div>
	);
}
 
/* ─── Error Route Indicator ───────────────────────────────────────────────── */
 
function ErrorRouteIndicator() {
	return (
		<div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2">
			<AlertTriangle className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
			<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
				Error Handler
			</span>
			<ArrowRight className="h-3 w-3 text-zinc-700" aria-hidden="true" />
			<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
				Graceful Termination
			</span>
		</div>
	);
}
 
/* ─── Main Section Component ──────────────────────────────────────────────── */
 
export function AgentFlowSection() {
	const sectionRef = useRef<HTMLElement>(null);
	const isInView = useInView(sectionRef, { once: false, margin: "-100px" });
	const [activeIndex, setActiveIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
 
	// Start animation when section enters view
	useEffect(() => {
		if (isInView) {
			setIsPlaying(true);
		}
	}, [isInView]);
 
	// Auto-advance through agents
	useEffect(() => {
		if (!isPlaying) return;
 
		const interval = setInterval(() => {
			setActiveIndex((prev) => {
				if (prev >= TOTAL_STEPS - 1) {
					// Pause at the end, then restart
					setTimeout(() => setActiveIndex(0), PAUSE_AFTER_COMPLETE_MS);
					return prev;
				}
				return prev + 1;
			});
		}, STEP_DURATION_MS);
 
		return () => clearInterval(interval);
	}, [isPlaying]);
 
	const completedSet = new Set(
		Array.from({ length: activeIndex }, (_, i) => i),
	);
 
	return (
		<section ref={sectionRef} id="agent-flow" className="mt-28 sm:mt-32">
			{/* Header */}
			<div className="landing-appear mx-auto mb-12 max-w-2xl text-center">
				<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
					Agent Pipeline
				</p>
				<h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
					8 specialized agents, one autonomous pipeline.
				</h2>
				<p className="mt-4 text-base leading-relaxed text-zinc-400">
					From raw rushes to mastered delivery — each agent handles
					a distinct phase of post-production, passing state through
					a LangGraph orchestrator with conditional error routing.
				</p>
			</div>
 
			{/* Pipeline visualization */}
			<div className="landing-appear mx-auto max-w-5xl">
				<div className="rounded-xl border border-white/[0.06] bg-[#0d0e12] p-4 sm:p-6">
					{/* Progress bar */}
					<div className="mb-5">
						<ProgressBar activeIndex={activeIndex} total={TOTAL_STEPS} />
					</div>
 
					{/* Agent nodes — horizontal scroll on mobile, grid on desktop */}
					<div className="mb-6 overflow-x-auto px-2 py-3">
						<div className="flex items-end gap-2 sm:grid sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
							{agents.map((agent, index) => (
								<div key={agent.id} className="min-w-[100px] flex-shrink-0 self-end sm:min-w-0">
									<AgentNode
										agent={agent}
										index={index}
										activeIndex={activeIndex}
										completedSet={completedSet}
									/>
								</div>
							))}
						</div>
					</div>
 
					{/* Flow arrows overlay — desktop only */}
					<div className="mb-4 hidden items-center justify-center gap-1 sm:flex">
						{agents.map((agent, index) => {
							const c = colorMap[agent.color] ?? colorMap.amber;
							const isCompleted = completedSet.has(index);
							const isActive = index === activeIndex;
							return (
								<div key={`flow-${agent.id}`} className="flex items-center">
									<div
										className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
											isActive
												? c.dot
												: isCompleted
													? `${c.dot} opacity-50`
													: "bg-zinc-800"
										}`}
									/>
									{index < agents.length - 1 && (
										<div className="flex items-center">
											<div
												className={`h-px w-6 transition-colors duration-500 lg:w-10 ${
													isCompleted ? "bg-zinc-600" : "bg-zinc-800"
												}`}
											/>
											<ArrowRight
												className={`h-2.5 w-2.5 transition-colors duration-500 ${
													isCompleted ? "text-zinc-500" : "text-zinc-800"
												}`}
												aria-hidden="true"
											/>
										</div>
									)}
								</div>
							);
						})}
					</div>
 
					{/* Rejection loop indicator */}
					<div className="mb-4 flex items-center justify-center">
						<div className="flex items-center gap-1.5 rounded-full border border-white/[0.04] bg-white/[0.02] px-3 py-1">
							<RotateCcw className="h-3 w-3 text-fuchsia-400/60" aria-hidden="true" />
							<span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
								Producer → Scripter rejection loop
							</span>
						</div>
					</div>
 
					{/* Active agent detail */}
					<AnimatePresence mode="wait">
						<DetailPanel agent={agents[activeIndex]} />
					</AnimatePresence>
 
					{/* Error route */}
					<div className="mt-4">
						<ErrorRouteIndicator />
					</div>
				</div>
			</div>
		</section>
	);
}