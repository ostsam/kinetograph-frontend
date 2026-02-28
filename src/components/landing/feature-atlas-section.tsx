import { featureCards } from "@/components/landing/landing-content";

export function FeatureAtlasSection() {
	return (
		<section id="features" className="mt-16">
			<div className="mb-6 flex items-end justify-between gap-4">
				<div>
					<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
						What You Get
					</p>
					<h2 className="mt-2 max-w-4xl text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
						Professional post-production features, streamlined into one flow.
					</h2>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-6 md:grid-rows-2">
				{featureCards.map((feature, index) => (
					<article
						key={feature.title}
						className={[
							"landing-appear group relative overflow-hidden rounded-sm border border-zinc-800 bg-gradient-to-br from-zinc-900/65 to-zinc-950/80 p-5 transition-all hover:-translate-y-[2px] hover:border-zinc-700",
							index === 0 ? "md:col-span-4 md:row-span-2" : "md:col-span-2",
						].join(" ")}
						style={{ animationDelay: `${index * 100}ms` }}
					>
						<div className="landing-float pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full border border-zinc-700/50" />
						<div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.1),transparent_35%)] opacity-70" />

						<div className="flex items-start gap-4">
							<div className="landing-glow mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900 text-amber-400">
								<feature.icon className="h-4 w-4" />
							</div>
							<div>
								<p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
									{feature.eyebrow}
								</p>
								<h3 className="mt-1 text-base font-semibold text-zinc-100">
									{feature.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-zinc-400">
									{feature.description}
								</p>
							</div>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
