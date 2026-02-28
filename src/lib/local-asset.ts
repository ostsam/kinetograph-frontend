import { RawAsset } from "@/types/kinetograph";

const DEFAULT_DURATION_MS = 1000;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;

interface VideoMetadata {
	durationMs: number;
	width: number;
	height: number;
	hasAudio: boolean;
}

function createLocalId() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return `local-${crypto.randomUUID()}`;
	}
	return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferAssetType(fileName: string): RawAsset["asset_type"] {
	return fileName.toLowerCase().includes("interview") ? "a-roll" : "b-roll";
}

function inferCodec(file: File) {
	const [mime] = file.type.split(";");
	const codec = mime?.replace("video/", "").trim();
	return codec || "unknown";
}

function loadMetadata(streamUrl: string): Promise<VideoMetadata> {
	return new Promise((resolve) => {
		const video = document.createElement("video");
		video.preload = "metadata";
		video.src = streamUrl;

		const finish = (metadata: VideoMetadata) => {
			video.removeAttribute("src");
			video.load();
			resolve(metadata);
		};

		video.onloadedmetadata = () => {
			const mediaElement = video as HTMLVideoElement & {
				mozHasAudio?: boolean;
				webkitAudioDecodedByteCount?: number;
			};

			const durationSeconds = Number.isFinite(video.duration)
				? video.duration
				: 1;
			const hasAudio =
				mediaElement.mozHasAudio === true ||
				(typeof mediaElement.webkitAudioDecodedByteCount === "number" &&
					mediaElement.webkitAudioDecodedByteCount > 0);

			finish({
				durationMs: Math.max(
					DEFAULT_DURATION_MS,
					Math.round(durationSeconds * 1000),
				),
				width: video.videoWidth || DEFAULT_WIDTH,
				height: video.videoHeight || DEFAULT_HEIGHT,
				hasAudio,
			});
		};

		video.onerror = () => {
			finish({
				durationMs: DEFAULT_DURATION_MS,
				width: DEFAULT_WIDTH,
				height: DEFAULT_HEIGHT,
				hasAudio: true,
			});
		};
	});
}

export function isVideoFile(file: File) {
	return file.type.startsWith("video/");
}

export async function createLocalAsset(file: File): Promise<RawAsset> {
	const streamUrl = URL.createObjectURL(file);
	const metadata = await loadMetadata(streamUrl);

	return {
		id: createLocalId(),
		file_name: file.name,
		file_path: file.name,
		asset_type: inferAssetType(file.name),
		duration_ms: metadata.durationMs,
		width: metadata.width,
		height: metadata.height,
		fps: DEFAULT_FPS,
		has_audio: metadata.hasAudio,
		codec: inferCodec(file),
		thumbnail_url: "",
		waveform_url: null,
		stream_url: streamUrl,
	};
}
