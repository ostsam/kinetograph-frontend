import Link from "next/link";
import { Bot } from "lucide-react";

export function ClosingCTASection() {
	return (
		<section className="landing-appear mt-16 rounded-sm border border-zinc-800 bg-gradient-to-r from-zinc-900/70 via-zinc-900/40 to-zinc-900/70 p-6 sm:p-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
						Ready to Build
					</p>
					<h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">
						Run your next edit in Kinetograph.
					</h2>
				</div>
				<Link
					href="/editor"
					className="inline-flex items-center justify-center gap-2 rounded-sm bg-amber-500 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-black transition-all hover:-translate-y-px hover:bg-amber-400"
				>
					Open Editor
					<Bot className="h-3.5 w-3.5" />
				</Link>
			</div>
		</section>
	);
}
