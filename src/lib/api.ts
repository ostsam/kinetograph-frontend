import ky, { HTTPError } from "ky";
import {
	AssetsResponse,
	PipelineStatus,
	RunRequest,
	RunResponse,
	PaperEdit,
	ApprovalRequest,
	OutputResponse,
	MasterIndexResponse,
	UploadAssetResponse,
	PaperEditClip,
	AddClipRequest,
	AddClipResponse,
	DeleteClipResponse,
	ClipUpdateRequest,
} from "@/types/kinetograph";

const api = ky.create({
	prefixUrl: "/api",
	timeout: false,
});

export interface APIErrorDetails {
	status: number | null;
	detail: string;
	endpoint: string | null;
	method: string | null;
}

function extractErrorDetail(payload: unknown) {
	if (typeof payload === "string" && payload.trim()) {
		return payload.trim();
	}

	if (payload && typeof payload === "object" && "detail" in payload) {
		const detail = (payload as { detail?: unknown }).detail;
		if (typeof detail === "string" && detail.trim()) {
			return detail.trim();
		}
		if (detail && typeof detail === "object") {
			return JSON.stringify(detail);
		}
	}

	return null;
}

export async function normalizeAPIError(
	error: unknown,
	fallbackMessage = "Request failed. Please try again.",
): Promise<APIErrorDetails> {
	if (error instanceof HTTPError) {
		const response = error.response;
		let payload: unknown = null;
		try {
			payload = await response.clone().json();
		} catch {
			try {
				payload = await response.clone().text();
			} catch {
				payload = null;
			}
		}

		return {
			status: response.status,
			detail: extractErrorDetail(payload) ?? fallbackMessage,
			endpoint: error.request.url,
			method: error.request.method,
		};
	}

	if (error instanceof Error) {
		return {
			status: null,
			detail: error.message || fallbackMessage,
			endpoint: null,
			method: null,
		};
	}

	return {
		status: null,
		detail: fallbackMessage,
		endpoint: null,
		method: null,
	};
}

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
			.json<UploadAssetResponse>();
	},

	getStatus: () => api.get("pipeline/status").json<PipelineStatus>(),

	runPipeline: (request: RunRequest) =>
		api.post("pipeline/run", { json: request }).json<RunResponse>(),

	approvePipeline: (request: ApprovalRequest) =>
		api.post("pipeline/approve", { json: request }).json<RunResponse>(),

	getPaperEdit: () => api.get("paper-edit").json<PaperEdit>(),

	savePaperEdit: (paperEdit: PaperEdit) =>
		api.put("paper-edit", { json: paperEdit }).json<{ status: string }>(),

	addClip: (clip: AddClipRequest) =>
		api.post("paper-edit/clips", { json: clip }).json<AddClipResponse>(),

	updateClip: (
		clipId: string,
		updates: Partial<Omit<ClipUpdateRequest, "clip_id">>,
	) =>
		api
			.patch(`paper-edit/clips/${clipId}`, { json: { clip_id: clipId, ...updates } })
			.json<{ status: string; clip: PaperEditClip }>(),

	deleteClip: (clipId: string) =>
		api.delete(`paper-edit/clips/${clipId}`).json<DeleteClipResponse>(),

	reorderClips: (clipIds: string[]) =>
		api
			.post("paper-edit/reorder", { json: { clip_ids: clipIds } })
			.json<{ status: string; total_clips: number }>(),

	getMasterIndex: () => api.get("master-index").json<MasterIndexResponse>(),

	getOutputs: () => api.get("output").json<OutputResponse>(),
};
