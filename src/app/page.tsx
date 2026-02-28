import { ClosingCTASection } from "@/components/landing/closing-cta-section";
import { FeatureAtlasSection } from "@/components/landing/feature-atlas-section";
import { HeroCommandSection } from "@/components/landing/hero-command-section";
import { LandingBackground } from "@/components/landing/landing-background";
import { LandingHeader } from "@/components/landing/landing-header";
import { ProofStripSection } from "@/components/landing/proof-strip-section";
import { SwarmMapSection } from "@/components/landing/swarm-map-section";
import { WorkflowSpineSection } from "@/components/landing/workflow-spine-section";

export default function Home() {
	return (
		<main className="relative min-h-screen overflow-hidden bg-[#0c0c0e] text-zinc-100">
			<LandingBackground />
			<div className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-8 lg:px-12">
				<LandingHeader />
				<HeroCommandSection />
				<ProofStripSection />
				<FeatureAtlasSection />
				<WorkflowSpineSection />
				<SwarmMapSection />
				<ClosingCTASection />
			</div>
		</main>
	);
}
