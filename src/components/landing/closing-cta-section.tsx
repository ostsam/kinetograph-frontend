import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ClosingCTASection() {
	return (
		<section className="landing-appear mt-28 sm:mt-32">
			<div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111114] px-6 py-16 text-center sm:px-12 sm:py-20">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(245,158,11,0.08),transparent)]" />

				<p className="text-xs font-medium uppercase tracking-widest text-amber-400/80">
					Start Editing
				</p>
				<h2 className="mx-auto mt-4 max-w-lg text-3xl font-bold tracking-tight text-white sm:text-4xl">
					Open your timeline and cut the first pass.
				</h2>
				<p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-zinc-400">
					From raw footage to finished master — one workspace, no context switching.
				</p>
				<div className="mt-8">
					<Link
						href="/editor"
						className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-bold text-black transition-opacity duration-200 hover:opacity-90"
					>
						Launch Editor
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</section>
	);
}
