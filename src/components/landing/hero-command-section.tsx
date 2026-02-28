"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Workflow } from "lucide-react";

const livePhases = [
	"Ingesting",
	"Scripting",
	"Awaiting Approval",
	"Rendering",
	"Mastering",
];

const PHASE_DURATION_MS = 1000;
const LOOP_PAUSE_MS = 0;
const RUN_DURATION_MS = livePhases.length * PHASE_DURATION_MS;
const TOTAL_CYCLE_MS = RUN_DURATION_MS + LOOP_PAUSE_MS;

export function HeroCommandSection() {
	const [elapsedCycleMs, setElapsedCycleMs] = useState(0);

	useEffect(() => {
		let raf = 0;
		const start = performance.now();

		const tick = (now: number) => {
			const elapsed = (now - start) % TOTAL_CYCLE_MS;
			setElapsedCycleMs(elapsed);
			raf = window.requestAnimationFrame(tick);
		};

		raf = window.requestAnimationFrame(tick);
		return () => window.cancelAnimationFrame(raf);
	}, []);

	const phaseState = useMemo(() => {
		if (elapsedCycleMs >= RUN_DURATION_MS) {
			return {
				activeIndex: -1,
				activeProgress: 1,
			};
		}

		const activeIndex = Math.floor(elapsedCycleMs / PHASE_DURATION_MS);
		const activePhaseElapsedMs = elapsedCycleMs % PHASE_DURATION_MS;
		return {
			activeIndex,
			activeProgress: activePhaseElapsedMs / PHASE_DURATION_MS,
		};
	}, [elapsedCycleMs]);

	return (
		<section className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
			<div className="landing-appear relative overflow-hidden rounded-sm border border-zinc-800 bg-gradient-to-br from-zinc-900/55 via-[#11131b] to-[#0d0e13] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.42)] sm:p-8">
				<div className="landing-float pointer-events-none absolute -right-10 top-8 h-36 w-36 rotate-12 border border-amber-400/25" />
				<div className="landing-energy pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-300/75 to-transparent" />
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_15%,rgba(245,158,11,0.12),transparent_38%)]" />

				<p className="landing-appear landing-appear-delay-1 mb-5 inline-flex items-center gap-2 rounded-sm border border-zinc-700/70 bg-zinc-900/75 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400">
					<Workflow className="h-3.5 w-3.5 text-amber-400" />
					Autonomous Post-Production Studio
				</p>

				<h1 className="landing-appear landing-appear-delay-2 max-w-3xl text-3xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
					From raw footage to final cut, without sacrificing editorial control.
				</h1>
				<p className="landing-appear landing-appear-delay-3 mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
					Kinetograph is built for teams that want studio-grade speed and
					structure. Upload footage, set the narrative brief, approve the
					sequence, and let the system orchestrate the full post pipeline.
				</p>

				<div className="landing-appear landing-appear-delay-4 mt-8 flex flex-wrap items-center gap-3">
					<Link
						href="/editor"
						className="inline-flex items-center gap-2 rounded-sm bg-amber-500 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-black transition-all hover:-translate-y-px hover:bg-amber-400"
					>
						Launch Workspace
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
					<a
						href="#workflow"
						className="inline-flex items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 transition-all hover:-translate-y-px hover:border-zinc-500 hover:text-zinc-100"
					>
						See Workflow
						<Clock3 className="h-3.5 w-3.5" />
					</a>
				</div>
			</div>

			<div className="landing-appear landing-appear-delay-2 relative rounded-sm border border-zinc-800 bg-[#101118] p-5">
				<div className="absolute inset-x-5 top-5 h-px bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
				<div className="flex items-center justify-between border-b border-zinc-800 pb-3">
					<div>
						<p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
							Command Deck
						</p>
						<p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-200">
							Swarm Execution State
						</p>
					</div>
					<div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-amber-300">
						LIVE
					</div>
				</div>

				<div className="mt-4 space-y-2">
					{livePhases.map((phase, index) => (
						<div
							key={phase}
							className="landing-appear group flex items-center gap-3 rounded-sm border border-zinc-800/80 bg-zinc-900/45 px-3 py-2.5"
							style={{ animationDelay: `${250 + index * 80}ms` }}
						>
							<div
								className={`h-2 w-2 rounded-full ${
									index === phaseState.activeIndex
										? "landing-glow bg-amber-400"
										: index < phaseState.activeIndex ||
											  phaseState.activeIndex === -1
											? "bg-amber-400/65"
											: "bg-zinc-700"
								}`}
							/>
							<span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
								{phase}
							</span>
							<div className="ml-auto h-1.5 w-16 rounded-full bg-zinc-800">
								<div
									className="h-full rounded-full bg-amber-400/80 transition-[width] duration-75 ease-linear"
									style={{
										width: `${Math.round(
											(index < phaseState.activeIndex ||
											phaseState.activeIndex === -1
												? 1
												: index === phaseState.activeIndex
													? phaseState.activeProgress
													: 0) * 100,
										)}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="mt-5 rounded-sm border border-zinc-800 bg-black/35 p-4">
					<p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
						Human Checkpoint
					</p>
					<p className="mt-2 text-xs leading-relaxed text-zinc-300">
						Execution pauses at the paper edit so your team can validate story
						choices before any final render is committed.
					</p>
				</div>
			</div>
		</section>
	);
}
