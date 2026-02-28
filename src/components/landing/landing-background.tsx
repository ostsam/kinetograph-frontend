export function LandingBackground() {
	return (
		<>
			<div className="landing-bg-shift pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-5%,rgba(245,158,11,0.2),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(59,130,246,0.14),transparent_26%),radial-gradient(circle_at_40%_100%,rgba(245,158,11,0.08),transparent_36%)]" />
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(113,113,122,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,113,122,0.08)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/40 to-transparent" />
			<div className="landing-scan pointer-events-none absolute -left-1/3 top-[28rem] h-px w-1/2 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
		</>
	);
}
