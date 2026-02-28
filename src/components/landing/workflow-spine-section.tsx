import { workflow } from "@/components/landing/landing-content";
import { Layers } from "lucide-react";

export function WorkflowSpineSection() {
	return (
		<section id="workflow" className="mt-16">
			<div className="relative overflow-hidden rounded-sm border border-zinc-800 bg-[#101017]/90 p-6 sm:p-7">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(59,130,246,0.08),transparent_35%)]" />
				<div className="mb-8 flex items-center gap-3">
					<div className="landing-glow flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900 text-amber-400">
						<Layers className="h-4 w-4" />
					</div>
					<div>
						<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
							Workflow
						</p>
						<h2 className="text-xl font-bold text-zinc-100 sm:text-2xl">
							A clear four-step path from ingest to delivery.
						</h2>
					</div>
				</div>

				<div className="relative">
					<div className="absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-amber-500/70 via-zinc-700/80 to-transparent md:left-1/2" />

					<div className="space-y-4">
						{workflow.map((item, index) => (
							<div
								key={item.step}
								className="landing-appear relative pl-12 md:pl-0"
								style={{ animationDelay: `${index * 130}ms` }}
							>
								<div className="landing-glow absolute left-[9px] top-4 h-3 w-3 rounded-full border border-zinc-900 bg-amber-400 md:left-1/2 md:-translate-x-1/2" />
								<div
									className={
										index % 2 === 0
											? "md:pr-[calc(50%+1.5rem)]"
											: "md:pl-[calc(50%+1.5rem)]"
									}
								>
									<article className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700">
										<p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300">
											Step {item.step}
										</p>
										<h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-zinc-100">
											{item.title}
										</h3>
										<p className="mt-1 text-sm text-zinc-400">{item.description}</p>
									</article>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
