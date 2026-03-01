import {
	deliveryFormats,
	projectWalkthrough,
} from "@/components/landing/landing-content";
import { CheckCircle2 } from "lucide-react";

export function FeatureAtlasSection() {
	return (
		<section id="features" className="mt-28 sm:mt-32">
			<div className="landing-appear mb-12 max-w-2xl">
				<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
					How It Works
				</p>
				<h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
					One pipeline from rushes to final master.
				</h2>
				<p className="mt-4 text-base leading-relaxed text-zinc-400">
					No feature shopping. This is the exact path your footage
					takes — ingest, paper edit, assembly, then finished
					deliverables.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{projectWalkthrough.map((stage, index) => (
					<article
						key={stage.step}
						className="landing-appear group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114] p-6 transition-colors duration-200 hover:border-white/[0.12]"
						style={{ animationDelay: `${index * 120}ms` }}
					>
						<div className="mb-5 flex items-center justify-between">
							<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold tabular text-amber-400">
								{stage.step}
							</span>
							<stage.icon className="h-5 w-5 text-zinc-600 transition-colors duration-200 group-hover:text-zinc-400" />
						</div>

						<p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
							{stage.phase}
						</p>
						<h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-zinc-100">
							{stage.title}
						</h3>
						<p className="mt-3 text-sm leading-relaxed text-zinc-500">
							{stage.description}
						</p>

						<div className="mt-5 border-t border-white/[0.06] pt-4">
							<p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
								Output
							</p>
							<p className="mt-1 text-sm font-medium text-zinc-300">
								{stage.output}
							</p>
						</div>
					</article>
				))}
			</div>

			<div className="landing-appear landing-appear-delay-2 mt-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#111114] p-5 sm:p-6">
				<p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
					Delivery Pack
				</p>
				<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{deliveryFormats.map((format) => (
						<div
							key={format}
							className="flex items-center gap-2.5 text-sm text-zinc-300"
						>
							<CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
							<span>{format}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
