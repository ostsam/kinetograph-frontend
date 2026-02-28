import { CheckCircle2 } from "lucide-react";
import { swarmAgents } from "@/components/landing/landing-content";

const outcomes = [
	"Structured paper edits for fast review cycles",
	"Render-ready timeline logic with deterministic sequencing",
	"Final video export ready for publication or handoff",
];

export function SwarmMapSection() {
	return (
		<section id="swarm" className="mt-16 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
			<div className="landing-appear relative overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/35 p-6">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(245,158,11,0.08),transparent_45%)]" />
				<div className="landing-energy pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-zinc-700/70 to-transparent" />

				<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
					Hollywood Swarm
				</p>
				<h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
					8 specialized agents working as one coordinated edit team.
				</h2>
				<p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
					Each agent handles a specific stage in the pipeline so output quality
					is consistent, and your team can focus on narrative choices instead of
					repetitive execution.
				</p>

				<div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{swarmAgents.map((agent, index) => (
						<div
							key={agent}
							className="landing-reveal rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-300"
							style={{ animationDelay: `${index * 70}ms` }}
						>
							{agent}
						</div>
					))}
				</div>
			</div>

			<div className="landing-appear landing-appear-delay-2 rounded-sm border border-zinc-800 bg-[#101017] p-6">
				<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
					Outcome
				</p>
				<h3 className="mt-2 text-xl font-bold text-zinc-100">
					Professional deliverables with less manual overhead.
				</h3>
				<ul className="mt-4 space-y-3">
					{outcomes.map((item) => (
						<li
							key={item}
							className="flex items-start gap-2.5 text-sm text-zinc-300"
						>
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
