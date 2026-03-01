import {
	swarmAgents,
	swarmCapabilityCards,
} from "@/components/landing/landing-content";
import { CheckCircle2 } from "lucide-react";

const outcomes = [
	"Story-approved paper edits with clip rationale",
	"Timeline assembly that stays consistent across revisions",
	"Publish-ready masters and cutdowns from one source sequence",
];

export function SwarmMapSection() {
	return (
		<section id="swarm" className="mt-28 sm:mt-32">
			<div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
				<div className="landing-appear overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114] p-6 sm:p-8">
					<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
						Editorial Engine
					</p>
					<h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
						Specialized agents handling repetitive post tasks in parallel.
					</h2>
					<p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
						Editors stay focused on story and pacing while the system handles
						ingest logging, sequence assembly, finishing passes, and delivery prep.
					</p>

					<div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{swarmAgents.map((agent, index) => (
							<div
								key={agent}
								className="landing-reveal rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
								style={{ animationDelay: `${index * 70}ms` }}
							>
								{agent}
							</div>
						))}
					</div>

					<div className="mt-5 grid gap-3 sm:grid-cols-2">
						{swarmCapabilityCards.map((item) => (
							<div
								key={item.title}
								className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
							>
								<div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-200">
									<item.icon className="h-4 w-4 text-amber-400" />
									{item.title}
								</div>
								<p className="mt-2 text-sm leading-relaxed text-zinc-500">
									{item.description}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="landing-appear landing-appear-delay-2 flex flex-col justify-center rounded-xl border border-white/[0.06] bg-[#111114] p-6 sm:p-8">
					<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
						What Editors Receive
					</p>
					<h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
						Production outputs, not abstract automation.
					</h3>
					<ul className="mt-6 space-y-4">
						{outcomes.map((item) => (
							<li
								key={item}
								className="flex items-start gap-3 text-[15px] leading-relaxed text-zinc-300"
							>
								<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
