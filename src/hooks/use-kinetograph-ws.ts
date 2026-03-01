import { useEffect, useRef, useCallback, useState } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { useChatStore } from "@/store/use-chat-store";
import { WSEvent, Phase } from "@/types/kinetograph";
import { PHASE_DESCRIPTIONS, NODE_TO_AGENT } from "@/types/chat";
import { KinetographAPI } from "@/lib/api";

export function useKinetographWS() {
	const ws = useRef<WebSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const setPhase = useKinetographStore((s) => s.setPhase);
	const addError = useKinetographStore((s) => s.addError);
	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);
	const setAssets = useKinetographStore((s) => s.setAssets);
	const setRenderUrl = useKinetographStore((s) => s.setRenderUrl);

	const connectRef = useRef<() => void>(() => {});

	const connect = useCallback(() => {
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
						setPhase(data.phase);
						if (data.errors) data.errors.forEach(addError);

						// renderUrl is only cleared on pipeline_started (new full run).
						// Edit pipelines keep the current render visible until pipeline_complete replaces it.

						const agentName = NODE_TO_AGENT[data.node] || data.node;
						const description =
							PHASE_DESCRIPTIONS[data.phase as Phase] ||
							`${agentName} → ${data.phase}`;

						// Update agent activity indicator
						const isActive = !data.phase.toString().endsWith("ed") &&
							data.phase !== Phase.COMPLETE &&
							data.phase !== Phase.ERROR &&
							data.phase !== Phase.AWAITING_APPROVAL;

						chat.setAgentActivity({
							agent: agentName,
							phase: data.phase as Phase,
							description,
							startedAt: Date.now(),
							isActive,
						});

						// Add agent update chat message
						chat.removeLoadingMessages();
						chat.addAgentUpdate(agentName, data.phase as Phase, description);

						// Handle errors in phase updates
						if (data.errors && data.errors.length > 0) {
							chat.addPipelineError(
								data.errors,
								`⚠️ ${agentName} encountered errors.`,
							);
						}

						// Fetch paper edit when scripted/awaiting approval
						if (
							data.phase === Phase.SCRIPTED ||
							data.phase === Phase.AWAITING_APPROVAL
						) {
							KinetographAPI.getPaperEdit().then((pe) => {
								setPaperEdit(pe);
							}).catch(() => {});
						}

						// Pipeline complete (handled by pipeline_complete event — just update UI state here)
						if (data.phase === Phase.COMPLETE) {
							chat.setProcessing(false);
							chat.setPipelineActive(false);
							chat.setAgentActivity(null);
						}

						// Pipeline error
						if (data.phase === Phase.ERROR) {
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
						KinetographAPI.getAssets()
							.then((res) => setAssets(res.assets))
							.catch(() => {});

						// Fetch latest paper edit
						KinetographAPI.getPaperEdit()
							.then((pe) => setPaperEdit(pe))
							.catch(() => {});

						// Fetch output files — pick the best (most processed) MP4
						KinetographAPI.getOutputs().then((out) => {
							const mp4s = out.files.filter((f) => f.type === "mp4");
							const bestMp4 =
								mp4s.find((f) => f.file_name.includes("_mastered")) ||
								mp4s.find((f) => f.file_name.includes("_captioned")) ||
								mp4s[mp4s.length - 1];
							const timeline = out.files.find(
								(f) => f.type === "fcpxml" || f.type === "otio",
							);

							// Set the rendered video URL for the viewer
							if (bestMp4) {
								setRenderUrl(`/api/assets/stream?path=${encodeURIComponent(bestMp4.file_path)}`);
							}

							chatComplete.addPipelineComplete(
								bestMp4?.file_path || data.render_path,
								timeline?.file_path || data.timeline_path,
							);
						}).catch(() => {
							chatComplete.addPipelineComplete(data.render_path, data.timeline_path);
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

	return { isConnected };
}
