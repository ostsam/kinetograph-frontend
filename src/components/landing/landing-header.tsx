"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Film, Menu, X } from "lucide-react";

const navLinks = [
	{ href: "#features", label: "Features" },
	{ href: "#workflow", label: "Workflow" },
	{ href: "#swarm", label: "Engine" },
];

export function LandingHeader() {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<header className="landing-appear sticky top-4 z-30 rounded-lg border border-white/[0.06] bg-[#111114]/90 backdrop-blur-xl">
			<div className="flex items-center justify-between gap-4 px-5 py-3">
				<div className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-black">
						<Film className="h-4 w-4 fill-current" />
					</div>
					<span className="text-[13px] font-bold tracking-[0.08em] text-zinc-100">
						KINETOGRAPH
					</span>
				</div>

				<nav className="hidden items-center gap-8 md:flex">
					{navLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-[13px] font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
						>
							{link.label}
						</a>
					))}
				</nav>

				<div className="flex items-center gap-2">
					<Link
						href="/editor"
						className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-bold text-black transition-opacity duration-200 hover:opacity-90"
					>
						Open Editor
						<ArrowRight className="h-3.5 w-3.5" />
					</Link>
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:text-zinc-200 md:hidden"
						onClick={() => setMobileOpen((prev) => !prev)}
						aria-label={mobileOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileOpen}
					>
						{mobileOpen ? (
							<X className="h-4 w-4" />
						) : (
							<Menu className="h-4 w-4" />
						)}
					</button>
				</div>
			</div>

			{/* Mobile nav dropdown */}
			{mobileOpen && (
				<nav className="border-t border-white/[0.06] px-5 py-3 md:hidden">
					<ul className="flex flex-col gap-1">
						{navLinks.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									onClick={() => setMobileOpen(false)}
									className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-white/[0.04] hover:text-zinc-200"
								>
									{link.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			)}
		</header>
	);
}
