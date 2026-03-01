import {
	PaperEditClip,
	TimelineSegment,
	SegmentAnchor,
	SegmentBrollItem,
} from "@/types/kinetograph";

const PRELUDE_SEGMENT_ID = "segment-prelude";

export function isARollClip(clip: PaperEditClip | SegmentAnchor) {
	return !!clip && clip.clip_type === "a-roll";
}

export function isBrollClip(clip: PaperEditClip | SegmentBrollItem) {
	return clip.clip_type === "b-roll" || clip.clip_type === "synth";
}

function createPreludeSegment(): TimelineSegment {
	return { id: PRELUDE_SEGMENT_ID, anchor: null, bRolls: [] };
}

export function buildTimelineSegments(clips: PaperEditClip[]): TimelineSegment[] {
	const segments: TimelineSegment[] = [];
	let currentSegment: TimelineSegment | null = null;

	for (const clip of clips) {
		if (clip.clip_type === "a-roll") {
			currentSegment = {
				id: `segment-${clip.clip_id}`,
				anchor: clip,
				bRolls: [],
			};
			segments.push(currentSegment);
			continue;
		}

		if (!currentSegment) {
			if (segments.length === 0 || segments[0].anchor !== null) {
				segments.push(createPreludeSegment());
			}
			segments[0].bRolls.push(clip);
			continue;
		}

		currentSegment.bRolls.push(clip);
	}

	return segments;
}

export function flattenSegmentsToClips(segments: TimelineSegment[]): PaperEditClip[] {
	const flattened: PaperEditClip[] = [];

	for (const segment of segments) {
		if (segment.anchor) {
			flattened.push(segment.anchor);
		}
		flattened.push(...segment.bRolls);
	}

	return flattened;
}

export function flattenSegmentsToClipIds(segments: TimelineSegment[]): string[] {
	return flattenSegmentsToClips(segments).map((clip) => clip.clip_id);
}

export function findSegmentIndexByClipId(
	segments: TimelineSegment[],
	clipId: string,
) {
	return segments.findIndex(
		(segment) =>
			segment.anchor?.clip_id === clipId ||
			segment.bRolls.some((clip) => clip.clip_id === clipId),
	);
}

export function findBrollPosition(
	segments: TimelineSegment[],
	clipId: string,
): { segmentIndex: number; clipIndex: number } | null {
	for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
		const clipIndex = segments[segmentIndex].bRolls.findIndex(
			(clip) => clip.clip_id === clipId,
		);
		if (clipIndex >= 0) {
			return { segmentIndex, clipIndex };
		}
	}
	return null;
}

export function cloneSegments(segments: TimelineSegment[]): TimelineSegment[] {
	return segments.map((segment) => ({
		id: segment.id,
		anchor: segment.anchor ? { ...segment.anchor } : null,
		bRolls: segment.bRolls.map((clip) => ({ ...clip })),
	}));
}
