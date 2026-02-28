import ky from "ky";
import {
	AssetsResponse,
	PipelineStatus,
	RunRequest,
	RunResponse,
	PaperEdit,
	ApprovalRequest,
	OutputResponse,
	MasterIndexResponse,
	RawAsset,
	PaperEditClip,
} from "@/types/kinetograph";

const api = ky.create({
	prefixUrl: "/api",
	timeout: false,
});

export const KinetographAPI = {
	getHealth: () =>
		api.get("health").json<{ status: string; version: string }>(),
	getConfig: () => api.get("config").json<Record<string, string | number>>(),

	getAssets: (type?: string) =>
		api
			.get("assets", { searchParams: type ? { asset_type: type } : {} })
			.json<AssetsResponse>(),

	uploadAsset: (file: File, type: "a-roll" | "b-roll" = "b-roll") => {
		const formData = new FormData();
		formData.append("file", file);
		return api
			.post("assets/upload", {
				searchParams: { asset_type: type },
				body: formData,
			})
			.json<RawAsset>();
	},

	getStatus: () => api.get("pipeline/status").json<PipelineStatus>(),

	runPipeline: (request: RunRequest) =>
		api.post("pipeline/run", { json: request }).json<RunResponse>(),

	approvePipeline: (request: ApprovalRequest) =>
		api.post("pipeline/approve", { json: request }).json<RunResponse>(),

	getPaperEdit: () => api.get("paper-edit").json<PaperEdit>(),

	savePaperEdit: (paperEdit: PaperEdit) =>
		api.put("paper-edit", { json: paperEdit }).json<{ status: string }>(),

	updateClip: (clipId: string, updates: Partial<PaperEditClip>) =>
		api
			.patch(`paper-edit/clips/${clipId}`, { json: updates })
			.json<{ status: string; clip: PaperEditClip }>(),

	reorderClips: (clipIds: string[]) =>
		api
			.post("paper-edit/reorder", { json: { clip_ids: clipIds } })
			.json<{ status: string; total_clips: number }>(),

	getMasterIndex: () => api.get("master-index").json<MasterIndexResponse>(),

	getOutputs: () => api.get("output").json<OutputResponse>(),
};
