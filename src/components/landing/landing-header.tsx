import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";

export function LandingHeader() {
	return (
		<header className="landing-appear sticky top-4 z-30 rounded-sm border border-zinc-800 bg-[#111116]/95 px-4 py-3 backdrop-blur-sm">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<div className="landing-glow flex h-6 w-6 items-center justify-center rounded-sm bg-amber-500 text-black">
						<Film className="h-3.5 w-3.5 fill-current" />
					</div>
					<div className="flex items-baseline gap-2">
						<span className="text-xs font-bold tracking-[0.22em] text-zinc-100">
							KINETOGRAPH
						</span>
					</div>
				</div>

				<nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:flex">
					<a href="#features" className="transition-colors hover:text-zinc-100">
						Features
					</a>
					<a href="#workflow" className="transition-colors hover:text-zinc-100">
						Workflow
					</a>
					<a href="#swarm" className="transition-colors hover:text-zinc-100">
						Swarm
					</a>
				</nav>

				<div className="flex items-center gap-3">
					<div className="hidden items-center gap-2 border-x border-zinc-800 px-3 py-1 md:flex">
						<div className="landing-glow h-1.5 w-1.5 rounded-full bg-emerald-400" />
						<span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500">
							System Ready
						</span>
					</div>
					<Link
						href="/editor"
						className="inline-flex items-center gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300 transition-all hover:-translate-y-px hover:bg-amber-500/20"
					>
						Enter Editor
						<ArrowRight className="h-3 w-3" />
					</Link>
				</div>
			</div>
		</header>
	);
}
