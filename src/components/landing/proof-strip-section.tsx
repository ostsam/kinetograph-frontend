const editKpis = [
	{
		value: "45m → 3m",
		unit: "",
		label: "Footage Condensed",
		note: "From ingest to approved paper edit",
	},
	{
		value: "6:12",
		unit: "min",
		label: "Time to First Cut",
		note: "Median for a single interview package",
	},
	{
		value: "2.1×",
		unit: "",
		label: "Faster Review Cycles",
		note: "Deterministic sequencing reduces reorder churn",
	},
	{
		value: "4",
		unit: "formats",
		label: "Delivery Formats",
		note: "Master, social cutdown, captions, timeline handoff",
	},
];

export function ProofStripSection() {
	return (
		<section className="mx-auto mt-20 max-w-4xl">
			<div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] lg:grid-cols-4">
				{editKpis.map((item, index) => (
					<article
						key={item.label}
						className="landing-appear bg-[#111114] px-6 py-6"
						style={{ animationDelay: `${500 + index * 80}ms` }}
					>
						<p className="tabular text-2xl font-bold tracking-tight text-white sm:text-3xl">
							{item.value}
							{item.unit && (
								<span className="ml-1 text-base font-medium text-zinc-500">
									{item.unit}
								</span>
							)}
						</p>
						<p className="mt-2 text-xs font-medium text-zinc-400">
							{item.label}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-zinc-600">
							{item.note}
						</p>
					</article>
				))}
			</div>
		</section>
	);
}
