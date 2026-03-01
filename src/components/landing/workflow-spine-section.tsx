import { workflow } from "@/components/landing/landing-content";

export function WorkflowSpineSection() {
	return (
		<section id="workflow" className="mt-28 sm:mt-32">
			<div className="landing-appear mx-auto mb-12 max-w-2xl text-center">
				<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
					Review Workflow
				</p>
				<h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
					Human checkpoints built into every cut.
				</h2>
				<p className="mt-4 text-base leading-relaxed text-zinc-400">
					Execution pauses at each stage so editors can review, reorder,
					and approve before the next step locks in.
				</p>
			</div>

			<div className="relative mx-auto max-w-2xl">
				{/* Vertical connecting line */}
				<div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-500/60 via-amber-500/20 to-transparent" />

				<div className="space-y-6">
					{workflow.map((item, index) => (
						<div
							key={item.step}
							className="landing-appear relative pl-12"
							style={{ animationDelay: `${index * 100}ms` }}
						>
							{/* Dot on the line */}
							<div className="absolute left-[11px] top-5 h-[9px] w-[9px] rounded-full border-2 border-[#0c0c0e] bg-amber-400" />

							<article className="rounded-xl border border-white/[0.06] bg-[#111114] p-5 transition-colors duration-200 hover:border-white/[0.12]">
								<div className="flex items-baseline gap-3">
									<span className="tabular text-sm font-bold text-amber-400/70">
										{item.step}
									</span>
									<h3 className="text-[15px] font-semibold text-zinc-100">
										{item.title}
									</h3>
								</div>
								<p className="mt-2 text-sm leading-relaxed text-zinc-500">
									{item.description}
								</p>
							</article>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
