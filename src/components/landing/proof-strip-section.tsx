const proofStrip = [
	{ label: "Prompt to Cut", value: "Minutes, not days" },
	{ label: "Creative Input", value: "One concise brief" },
	{ label: "Control Model", value: "Human-in-the-loop approval" },
];

export function ProofStripSection() {
	return (
		<section className="mt-9 grid gap-3 sm:grid-cols-3">
			{proofStrip.map((item, index) => (
				<div
					key={item.label}
					className="landing-appear relative overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/35 px-4 py-4 transition-all hover:-translate-y-px hover:border-zinc-700"
					style={{ animationDelay: `${120 + index * 90}ms` }}
				>
					<div className="pointer-events-none absolute right-0 top-0 h-10 w-10 border-l border-b border-zinc-800/80" />
					<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
						{item.label}
					</p>
					<p className="mt-2 text-sm font-semibold text-zinc-200">{item.value}</p>
				</div>
			))}
		</section>
	);
}
