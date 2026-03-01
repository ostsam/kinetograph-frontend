"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import type { PaperEditClip } from "@/types/kinetograph";

export type PlaybackState = "idle" | "playing" | "paused";

function resolveClipUrl(
	clip: PaperEditClip,
	assets: { file_name: string; file_path: string; stream_url: string }[],
): string | null {
	const match =
		assets.find((a) => a.file_name === clip.source_file) ??
		assets.find((a) => a.file_path === clip.source_file);
	if (match) return match.stream_url;
	if (clip.source_file.startsWith("/")) {
		return `/api/assets/stream?path=${encodeURIComponent(clip.source_file)}`;
	}
	return null;
}

function resolvePlayheadToClip(
	playheadMs: number,
	clips: PaperEditClip[],
): { clip: PaperEditClip; offsetMs: number; clipIndex: number } | null {
	let cursor = 0;
	for (let i = 0; i < clips.length; i++) {
		const dur = clips[i].out_ms - clips[i].in_ms;
		if (playheadMs < cursor + dur) {
			return {
				clip: clips[i],
				offsetMs: clips[i].in_ms + (playheadMs - cursor),
				clipIndex: i,
			};
		}
		cursor += dur;
	}
	return null;
}

export function useVideoPlayer() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const rafRef = useRef<number>(0);
	const activeClipIdRef = useRef<string | null>(null);
	const isPlayingRef = useRef(false);
	const clipsRef = useRef<PaperEditClip[]>([]);

	const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
	const [currentTimeDisplay, setCurrentTimeDisplay] = useState(0);
	const [volume, setVolumeState] = useState(1);
	const [playbackRate, setPlaybackRateState] = useState(1);

	const assets = useKinetographStore((s) => s.assets);
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const selectedClipId = useKinetographStore((s) => s.selectedClipId);
	const setPlayhead = useKinetographStore((s) => s.setPlayhead);
	const setSelectedClip = useKinetographStore((s) => s.setSelectedClip);

	const clips = paperEdit?.clips ?? [];

	useEffect(() => {
		clipsRef.current = clips;
	}, [clips]);

	const totalDurationMs = clips.reduce(
		(sum, c) => sum + (c.out_ms - c.in_ms),
		0,
	);

	const loadClipSource = useCallback(
		(video: HTMLVideoElement, clip: PaperEditClip, seekOffsetMs: number): Promise<boolean> => {
			return new Promise((resolve) => {
				const url = resolveClipUrl(clip, assets);
				if (!url) {
					resolve(false);
					return;
				}
				if (activeClipIdRef.current !== clip.clip_id) {
					activeClipIdRef.current = clip.clip_id;
					const onReady = () => {
						video.removeEventListener("canplay", onReady);
						video.removeEventListener("error", onErr);
						video.currentTime = seekOffsetMs / 1000;
						resolve(true);
					};
					const onErr = () => {
						video.removeEventListener("canplay", onReady);
						video.removeEventListener("error", onErr);
						resolve(false);
					};
					video.addEventListener("canplay", onReady);
					video.addEventListener("error", onErr);
					video.src = url;
					video.load();
				} else {
					video.currentTime = seekOffsetMs / 1000;
					resolve(true);
				}
			});
		},
		[assets],
	);

	const seekToClip = useCallback(
		(clipId: string) => {
			const video = videoRef.current;
			if (!video || clips.length === 0) return;
			let offset = 0;
			for (const c of clips) {
				if (c.clip_id === clipId) break;
				offset += c.out_ms - c.in_ms;
			}
			const target = resolvePlayheadToClip(offset, clips);
			if (!target) return;
			loadClipSource(video, target.clip, target.offsetMs);
			setPlayhead(offset);
			setCurrentTimeDisplay(offset);
		},
		[clips, loadClipSource, setPlayhead],
	);

	useEffect(() => {
		if (selectedClipId) seekToClip(selectedClipId);
	}, [selectedClipId, seekToClip]);

	const tickPlayhead = useCallback(() => {
		const video = videoRef.current;
		if (!video || video.paused) {
			isPlayingRef.current = false;
			return;
		}

		const currentClips = clipsRef.current;
		let clipStartMs = 0;
		for (const c of currentClips) {
			if (c.clip_id === activeClipIdRef.current) break;
			clipStartMs += c.out_ms - c.in_ms;
		}
		const activeClip = currentClips.find(
			(c) => c.clip_id === activeClipIdRef.current,
		);
		if (!activeClip) return;

		const currentVideoMs = video.currentTime * 1000;
		const seqMs = clipStartMs + (currentVideoMs - activeClip.in_ms);
		setPlayhead(seqMs);
		setCurrentTimeDisplay(seqMs);

		if (currentVideoMs >= activeClip.out_ms - 16) {
			const idx = currentClips.findIndex(
				(c) => c.clip_id === activeClipIdRef.current,
			);
			const nextClip = currentClips[idx + 1];
			if (nextClip) {
				const url = resolveClipUrl(nextClip, assets);
				if (url) {
					activeClipIdRef.current = nextClip.clip_id;
					setSelectedClip(nextClip.clip_id);
					const onReady = () => {
						video.removeEventListener("canplay", onReady);
						video.currentTime = nextClip.in_ms / 1000;
						video.play().catch(() => {});
					};
					video.addEventListener("canplay", onReady);
					video.src = url;
					video.load();
				}
			} else {
				video.pause();
				isPlayingRef.current = false;
				setPlaybackState("paused");
			}
		}

		if (isPlayingRef.current) {
			rafRef.current = requestAnimationFrame(tickPlayhead);
		}
	}, [assets, setPlayhead, setSelectedClip]);

	const play = useCallback(async () => {
		const video = videoRef.current;
		if (!video || clips.length === 0) return;

		const currentMs = useKinetographStore.getState().playheadMs;
		const target = resolvePlayheadToClip(currentMs, clips);

		if (!target) {
			const first = clips[0];
			const ok = await loadClipSource(video, first, first.in_ms);
			if (!ok) return;
			setSelectedClip(first.clip_id);
			setPlayhead(0);
			setCurrentTimeDisplay(0);
		} else {
			const ok = await loadClipSource(video, target.clip, target.offsetMs);
			if (!ok) return;
			setSelectedClip(target.clip.clip_id);
		}

		video.volume = volume;
		video.playbackRate = playbackRate;
		try {
			await video.play();
			isPlayingRef.current = true;
			setPlaybackState("playing");
			rafRef.current = requestAnimationFrame(tickPlayhead);
		} catch {
			/* autoplay blocked */
		}
	}, [clips, loadClipSource, tickPlayhead, setSelectedClip, setPlayhead, volume, playbackRate]);

	const pause = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		video.pause();
		isPlayingRef.current = false;
		setPlaybackState("paused");
		cancelAnimationFrame(rafRef.current);
	}, []);

	const stop = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		video.pause();
		isPlayingRef.current = false;
		setPlaybackState("idle");
		cancelAnimationFrame(rafRef.current);
		setPlayhead(0);
		setCurrentTimeDisplay(0);
		activeClipIdRef.current = null;
	}, [setPlayhead]);

	const togglePlayPause = useCallback(() => {
		if (playbackState === "playing") pause();
		else play();
	}, [playbackState, play, pause]);

	const seekTo = useCallback(
		async (ms: number) => {
			const video = videoRef.current;
			if (!video || clips.length === 0) return;
			const clamped = Math.max(0, Math.min(ms, totalDurationMs));
			const target = resolvePlayheadToClip(clamped, clips);
			if (!target) return;
			const ok = await loadClipSource(video, target.clip, target.offsetMs);
			if (!ok) return;
			setSelectedClip(target.clip.clip_id);
			setPlayhead(clamped);
			setCurrentTimeDisplay(clamped);
			if (isPlayingRef.current) {
				video.volume = volume;
				video.playbackRate = playbackRate;
				video.play().catch(() => {});
			}
		},
		[clips, totalDurationMs, loadClipSource, setPlayhead, setSelectedClip, volume, playbackRate],
	);

	const setVolume = useCallback((v: number) => {
		setVolumeState(v);
		if (videoRef.current) videoRef.current.volume = v;
	}, []);

	const setPlaybackRate = useCallback((rate: number) => {
		setPlaybackRateState(rate);
		if (videoRef.current) videoRef.current.playbackRate = rate;
	}, []);

	useEffect(() => {
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	return {
		videoRef,
		playbackState,
		currentTimeDisplay,
		totalDurationMs,
		volume,
		playbackRate,
		play,
		pause,
		stop,
		togglePlayPause,
		seekTo,
		seekToClip,
		setVolume,
		setPlaybackRate,
	};
}
