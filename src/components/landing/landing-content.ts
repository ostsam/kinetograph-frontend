import type { LucideIcon } from "lucide-react";
import {
	AudioLines,
	Clapperboard,
	FileText,
	Scissors,
	Sparkles,
	Upload,
} from "lucide-react";

export interface WalkthroughStage {
	step: string;
	phase: string;
	title: string;
	description: string;
	output: string;
	icon: LucideIcon;
}

export interface WorkflowStep {
	step: string;
	title: string;
	description: string;
}

export const projectWalkthrough: WalkthroughStage[] = [
	{
		step: "01",
		phase: "Ingest",
		title: "Drop rushes and sync transcripts",
		description:
			"Upload A-roll, B-roll, and interviews once. Montazh tags speakers, scenes, and shot intent so material is instantly searchable.",
		output: "Searchable bins + aligned transcript",
		icon: Upload,
	},
	{
		step: "02",
		phase: "Paper Edit",
		title: "Build a story-first assembly",
		description:
			"Generate a paper edit with clip picks, beat timing, and rationale. Reorder or trim before any final render budget is spent.",
		output: "Approved narrative sequence",
		icon: FileText,
	},
	{
		step: "03",
		phase: "Timeline",
		title: "Auto-assemble the first cut",
		description:
			"The approved sequence compiles into timeline tracks with transitions, pacing-safe handles, and deterministic ordering.",
		output: "Render-ready timeline",
		icon: Scissors,
	},
	{
		step: "04",
		phase: "Finish",
		title: "Master audio, graphics, and exports",
		description:
			"Run polish passes for loudness, titles, and format variants, then export your publish-ready master and cutdowns.",
		output: "Master + social deliverables",
		icon: AudioLines,
	},
];

export const deliveryFormats = [
	"4K 16:9 master",
	"9:16 social cutdown",
	"Caption package (.srt)",
	"Timeline handoff (.edl)",
];

export const workflow: WorkflowStep[] = [
	{
		step: "01",
		title: "Ingest footage",
		description: "Bring in camera cards, interviews, and select libraries.",
	},
	{
		step: "02",
		title: "Direct the narrative",
		description:
			"Define story beats, pacing, and audience outcome in one brief.",
	},
	{
		step: "03",
		title: "Approve the paper edit",
		description:
			"Validate clip order and story logic before assembly locks in.",
	},
	{
		step: "04",
		title: "Export masters",
		description: "Render final formats and handoff assets for publishing.",
	},
];

export const swarmAgents = [
	"Ingest Logger",
	"Story Producer",
	"Assembly Editor",
	"Motion Titler",
	"Audio Mixer",
	"Color Pass",
	"QC Checker",
	"Delivery Manager",
];

export const swarmCapabilityCards = [
	{
		title: "Story Intelligence",
		description: "Flags weak beats and pacing dips before review rounds begin.",
		icon: Sparkles,
	},
	{
		title: "Sequence Discipline",
		description:
			"Keeps clip decisions deterministic across revisions and exports.",
		icon: Clapperboard,
	},
];
