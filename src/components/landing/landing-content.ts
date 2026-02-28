import type { LucideIcon } from "lucide-react";
import {
	Download,
	Film,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

export interface FeatureCard {
	eyebrow: string;
	title: string;
	description: string;
	icon: LucideIcon;
}

export interface WorkflowStep {
	step: string;
	title: string;
	description: string;
}

export const featureCards: FeatureCard[] = [
	{
		eyebrow: "Ingest + Index",
		title: "Turn raw footage into searchable story material",
		description:
			"Drop A-roll and B-roll once. Kinetograph maps speech and visuals so every usable moment is ready for edit decisions.",
		icon: Film,
	},
	{
		eyebrow: "Narrative Engine",
		title: "Generate a first cut from a single creative brief",
		description:
			"The system drafts a structured paper edit with clear clip choices, pacing intent, and narrative flow before rendering starts.",
		icon: Sparkles,
	},
	{
		eyebrow: "Human Control",
		title: "Approve the story before execution",
		description:
			"Review the sequence, reorder clips, remove weak shots, and greenlight only when the cut reflects your editorial intent.",
		icon: ShieldCheck,
	},
	{
		eyebrow: "Autonomous Finish",
		title: "Deliver polished outputs in minutes",
		description:
			"After approval, Kinetograph handles synthesis, assembly, audio mastering, and final export without manual busywork.",
		icon: Download,
	},
];

export const workflow: WorkflowStep[] = [
	{
		step: "01",
		title: "Drop media",
		description: "Bring in your interview footage, scenes, and supporting B-roll.",
	},
	{
		step: "02",
		title: "Write the brief",
		description: "Describe the pace, tone, and outcome you want in plain language.",
	},
	{
		step: "03",
		title: "Approve the sequence",
		description: "Refine the paper edit and confirm the narrative direction.",
	},
	{
		step: "04",
		title: "Ship the final cut",
		description: "Export a production-ready video plus timeline artifacts.",
	},
];

export const swarmAgents = [
	"Archivist",
	"Scripter",
	"Producer",
	"Synthesizer",
	"Director",
	"Motion Grapher",
	"Sound Engineer",
	"QA Lead",
];
