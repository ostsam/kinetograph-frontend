export function LandingBackground() {
	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.08),transparent)]" />
			<div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(113,113,122,0.04)_0px,rgba(113,113,122,0.04)_1px,transparent_1px,transparent_60px)] opacity-50" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0c0c0e] to-transparent" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c0c0e] to-transparent" />
		</>
	);
}
