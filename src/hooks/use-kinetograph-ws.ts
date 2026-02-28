import { useEffect, useRef, useCallback, useState } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { WSEvent, Phase } from "@/types/kinetograph";
import { KinetographAPI } from "@/lib/api";

export function useKinetographWS() {
	const ws = useRef<WebSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const setPhase = useKinetographStore((s) => s.setPhase);
	const addError = useKinetographStore((s) => s.addError);
	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);

	const connectRef = useRef<() => void>(() => {});

	const connect = useCallback(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = process.env.NEXT_PUBLIC_WS_HOST || "localhost:3000";
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
				switch (data.type) {
					case "connected":
						setPhase(data.phase);
						break;
					case "phase_update":
						setPhase(data.phase);
						if (data.errors) data.errors.forEach(addError);
						if (
							data.phase === Phase.SCRIPTED ||
							data.phase === Phase.AWAITING_APPROVAL
						) {
							KinetographAPI.getPaperEdit().then(setPaperEdit);
						}
						break;
					case "awaiting_approval":
						setPhase(Phase.AWAITING_APPROVAL);
						setPaperEdit(data.paper_edit);
						break;
					case "pong":
						break;
				}
			} catch (err) {
				console.error("WS parse error:", err);
			}
		};

		ws.current = socket;
	}, [setPhase, addError, setPaperEdit]);

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
