import { useEffect, useRef, useCallback, useState } from "react";
import { useMontazhStore } from "@/store/use-montazh-store";
import { useChatStore } from "@/store/use-chat-store";
import { WSEvent, Phase } from "@/types/montazh";
import { PHASE_DESCRIPTIONS, NODE_TO_AGENT } from "@/types/chat";
import { MontazhAPI } from "@/lib/api";

export function useMontazhWS() {
	const ws = useRef<WebSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const setPhase = useMontazhStore((s) => s.setPhase);
	const addError = useMontazhStore((s) => s.addError);
	const setPaperEdit = useMontazhStore((s) => s.setPaperEdit);
	const setAssets = useMontazhStore((s) => s.setAssets);
	const setRenderUrl = useMontazhStore((s) => s.setRenderUrl);

	const connectRef = useRef<() => void>(() => {});

	const connect = useCallback(() => {
		// Close any existing connection first to prevent duplicate sockets
		if (ws.current) {
			ws.current.onclose = null; // prevent recursive reconnect
			ws.current.close();
			ws.current = null;
		}

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = process.env.NEXT_PUBLIC_WS_HOST || "localhost:8080";
		const socket = new WebSocket(`${protocol}//${host}/ws`);

		socket.onopen = () => setIsConnected(true);
		socket.onclose = () => {
			setIsConnected(false);
			console.log("WS Disconnected. Reconnecting...");
			setTimeout(() => connectRef.current(), 3000);
		};

		socket.onmessage = (event) => {
			try {
				const data: WSEvent = JSON.parse(event.data);
				const chat = useChatStore.getState();

				switch (data.type) {
					case "connected":
						setPhase(data.phase);
						// On reconnect, clear stale spinner state if pipeline isn't running
						if (
							data.phase === Phase.IDLE ||
							data.phase === Phase.COMPLETE ||
							data.phase === Phase.ERROR
						) {
							chat.setAgentActivity(null);
							chat.setProcessing(false);
							chat.setPipelineActive(false);
						}
						break;

					case "pipeline_started":
						chat.removeLoadingMessages();
						chat.setThreadId(data.thread_id);
						setRenderUrl(null);
						chat.addSystemMessage(
							`🔗 Pipeline session started (${data.thread_id.slice(0, 8)}...)`,
						);
						break;

					case "phase_update": {
						const phaseErrors = data.errors ?? [];
						const isRecoverableProducerRevision =
							data.node === "producer" &&
							data.phase === Phase.ERROR &&
							phaseErrors.length > 0 &&
							phaseErrors.every((err) => err.recoverable);

						// A producer "error" with only recoverable errors is used as a
						// revision feedback signal, not a fatal pipeline error.
						if (!isRecoverableProducerRevision) {
							setPhase(data.phase);
						}
						if (!isRecoverableProducerRevision && phaseErrors.length > 0) {
							phaseErrors.forEach(addError);
						}

						// renderUrl is only cleared on pipeline_started (new full run).
						// Edit pipelines keep the current render visible until pipeline_complete replaces it.

						const agentName = NODE_TO_AGENT[data.node] || data.node;
						const description =
							PHASE_DESCRIPTIONS[data.phase as Phase] ||
							`${agentName} → ${data.phase}`;

						// Update agent activity indicator
						const phaseStr = data.phase.toString();
						const isCompleted =
							phaseStr.endsWith("ed") ||
							data.phase === Phase.COMPLETE ||
							data.phase === Phase.ERROR ||
							data.phase === Phase.AWAITING_APPROVAL;

						if (isCompleted) {
							// Phase finished — clear the spinner immediately
							chat.setAgentActivity(null);
						} else {
							chat.setAgentActivity({
								agent: agentName,
								phase: data.phase as Phase,
								description,
								startedAt: Date.now(),
								isActive: true,
							});
						}

						// Only add chat messages for COMPLETED phases.
						// In-progress phases are shown via the Agent Activity Bar,
						// so we don't create duplicate spinning messages in the chat.
						chat.removeLoadingMessages();
						if (isCompleted && !isRecoverableProducerRevision) {
							chat.addAgentUpdate(agentName, data.phase as Phase, description);
						}

						// Handle errors in phase updates
						if (phaseErrors.length > 0 && !isRecoverableProducerRevision) {
							chat.addPipelineError(
								phaseErrors,
								`⚠️ ${agentName} encountered errors.`,
							);
						}

						// Fetch paper edit when scripted or rendered.
						// AWAITING_APPROVAL is handled by the 'awaiting_approval' event (includes payload).
						// RENDERED is included so the Director's transition metadata
						// (crossfade markers) gets picked up by the timeline.
						if (
							data.phase === Phase.SCRIPTED ||
							data.phase === Phase.RENDERED
						) {
							MontazhAPI.getPaperEdit()
								.then((pe) => {
									setPaperEdit(pe);
								})
								.catch(() => {});
						}

						// Pipeline complete (handled by pipeline_complete event — just update UI state here)
						if (data.phase === Phase.COMPLETE) {
							chat.setProcessing(false);
							chat.setPipelineActive(false);
							chat.setAgentActivity(null);
						}

						// Pipeline error
						if (data.phase === Phase.ERROR && !isRecoverableProducerRevision) {
							chat.setProcessing(false);
							chat.setPipelineActive(false);
							chat.setAgentActivity(null);
						}

						break;
					}

					case "awaiting_approval":
						setPhase(Phase.AWAITING_APPROVAL);
						setPaperEdit(data.paper_edit);

						// Push approval request into chat
						useChatStore.getState().removeLoadingMessages();
						useChatStore.getState().setAgentActivity(null);
						useChatStore.getState().addApprovalRequest(data.paper_edit);
						break;

					case "pipeline_complete": {
						setPhase(data.phase || Phase.COMPLETE);
						const chatComplete = useChatStore.getState();
						chatComplete.setProcessing(false);
						chatComplete.setPipelineActive(false);
						chatComplete.setAgentActivity(null);
						chatComplete.removeLoadingMessages();

						// Re-fetch assets (synth clips may have been added)
						MontazhAPI.getAssets()
							.then((res) => setAssets(res.assets))
							.catch(() => {});

						// Fetch latest paper edit
						MontazhAPI.getPaperEdit()
							.then((pe) => setPaperEdit(pe))
							.catch(() => {});

						// Fetch output files — pick the best (most processed) MP4
						MontazhAPI.getOutputs()
							.then((out) => {
								const mp4s = out.files.filter((f) => f.type === "mp4");
								const bestMp4 =
									mp4s.find((f) => f.file_name.includes("_mastered")) ||
									mp4s.find((f) => f.file_name.includes("_captioned")) ||
									mp4s[mp4s.length - 1];
								const timeline = out.files.find((f) => f.type === "otio");

								// Set the rendered video URL for the viewer
								if (bestMp4) {
									setRenderUrl(
										`/api/assets/stream?path=${encodeURIComponent(bestMp4.file_path)}`,
									);
								}

								chatComplete.addPipelineComplete(
									bestMp4?.file_path || data.render_path,
									timeline?.file_path || data.timeline_path,
								);
							})
							.catch(() => {
								chatComplete.addPipelineComplete(
									data.render_path,
									data.timeline_path,
								);
							});
						break;
					}

					case "pong":
						break;
				}
			} catch (err) {
				console.error("WS parse error:", err);
			}
		};

		ws.current = socket;
	}, [setPhase, addError, setPaperEdit, setAssets, setRenderUrl]);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	useEffect(() => {
		connect();
		return () => ws.current?.close();
	}, [connect]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (ws.current?.readyState === WebSocket.OPEN) {
				ws.current.send(JSON.stringify({ type: "ping" }));
			}
		}, 20000);
		return () => clearInterval(interval);
	}, []);

	// Safety timeout: auto-clear spinner if stuck for >3 minutes
	useEffect(() => {
		const interval = setInterval(() => {
			const {
				agentActivity,
				setAgentActivity,
				setProcessing,
				setPipelineActive,
			} = useChatStore.getState();
			if (agentActivity?.isActive && agentActivity.startedAt) {
				const elapsed = Date.now() - agentActivity.startedAt;
				if (elapsed > 3 * 60 * 1000) {
					console.warn("Agent activity stuck for >3min, auto-clearing spinner");
					setAgentActivity(null);
					setProcessing(false);
					setPipelineActive(false);
				}
			}
		}, 10000);
		return () => clearInterval(interval);
	}, []);

	return { isConnected };
}
