"use client";

import {
	useEffect,
	useRef,
	useState,
	useCallback,
	type KeyboardEvent,
	type FormEvent,
} from "react";
import { useChatStore } from "@/store/use-chat-store";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
	Send,
	Sparkles,
	X,
	Check,
	Bot,
	User,
	AlertCircle,
	CheckCircle2,
	Film,
	Loader2,
	Download,
	Pencil,
} from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { PHASE_DESCRIPTIONS, NODE_TO_AGENT } from "@/types/chat";
import type { Phase, PaperEdit } from "@/types/kinetograph";

// ═══════════════════════════════════════════════════════════════════════════════
//  CHAT PANEL — Cursor-like AI interface for video creation
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatPanelProps {
	onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
	const messages = useChatStore((s) => s.messages);
	const isProcessing = useChatStore((s) => s.isProcessing);
	const agentActivity = useChatStore((s) => s.agentActivity);
	const pipelineActive = useChatStore((s) => s.pipelineActive);
	const addUserMessage = useChatStore((s) => s.addUserMessage);
	const addSystemMessage = useChatStore((s) => s.addSystemMessage);
	const setProcessing = useChatStore((s) => s.setProcessing);
	const setPipelineActive = useChatStore((s) => s.setPipelineActive);
	const setOpen = useChatStore((s) => s.setOpen);

	const phase = useKinetographStore((s) => s.phase);
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);

	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		const el = scrollRef.current;
		if (el) {
			requestAnimationFrame(() => {
				el.scrollTop = el.scrollHeight;
			});
		}
	}, [messages]);

	// Focus input on mount
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// ─── Send message handler ─────────────────────────────────────────

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isProcessing) return;

		setInput("");
		addUserMessage(text);

		// If pipeline is already complete, treat as an edit request
		if (phase === "complete" || (paperEdit && !pipelineActive)) {
			setProcessing(true);
			setPipelineActive(true);
			try {
				const res = await KinetographAPI.editPipeline({
					instruction: text,
				});
				addSystemMessage(res.message || "✏️ Edit submitted — processing...");
				// Pipeline runs in background — WS events will update UI and reset flags
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : "Edit request failed.";
				addSystemMessage(`❌ ${msg}`, "pipeline-error");
				setProcessing(false);
				setPipelineActive(false);
			}
			return;
		}

		// Otherwise, start a new pipeline run
		setProcessing(true);
		setPipelineActive(true);
		addSystemMessage(
			"🚀 Starting pipeline... I'll process your footage and keep you updated.",
		);

		try {
			const res = await KinetographAPI.runPipeline({
				prompt: text,
				project_name: text.slice(0, 30).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "untitled",
			});
			if (res.thread_id) {
				useChatStore.getState().setThreadId(res.thread_id);
			}
			// The WebSocket hook will handle pushing agent updates as messages
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Pipeline failed to start.";
			addSystemMessage(`❌ ${msg}`, "pipeline-error");
			setProcessing(false);
			setPipelineActive(false);
		}
	}, [input, isProcessing, phase, paperEdit, pipelineActive, addUserMessage, addSystemMessage, setProcessing, setPipelineActive, setPaperEdit]);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex h-full flex-col bg-[#111114] border-l border-zinc-800">
			{/* Header */}
			<div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-[#1a1a1e] px-3 shrink-0">
				<div className="flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5 text-purple-400" />
					<span className="text-[11px] font-semibold text-zinc-200">
						AI Assistant
					</span>
					{pipelineActive && (
						<span className="flex items-center gap-1 text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
							<span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
							Processing
						</span>
					)}
				</div>
				<button
					onClick={onClose}
					className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Agent Activity Bar */}
			{agentActivity?.isActive && (
				<div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/5 border-b border-purple-500/10 shrink-0">
					<Loader2 className="h-3 w-3 text-purple-400 animate-spin" />
					<span className="text-[10px] text-purple-300 truncate">
						{agentActivity.agent}: {agentActivity.description}
					</span>
				</div>
			)}

			{/* Messages */}
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3"
			>
				{messages.length === 0 && <WelcomeScreen />}
				{messages.map((msg) => (
					<MessageBubble key={msg.id} message={msg} />
				))}
			</div>

			{/* Input */}
			<div className="border-t border-zinc-800 p-2 shrink-0">
				<div className="relative flex items-end gap-1.5 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 focus-within:border-purple-500/50 transition-colors">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={
							pipelineActive
								? "Pipeline running... wait for completion or type to queue"
								: phase === "complete" || paperEdit
									? "Describe changes you want... (e.g., 'replace the music')"
									: "Describe the video you want to create..."
						}
						rows={1}
						className="flex-1 bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none resize-none max-h-24 leading-relaxed"
						style={{
							height: "auto",
							minHeight: "20px",
						}}
						onInput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = "auto";
							target.style.height = Math.min(target.scrollHeight, 96) + "px";
						}}
					/>
					<button
						onClick={handleSend}
						disabled={!input.trim() || isProcessing}
						className={cn(
							"p-1 rounded transition-colors shrink-0",
							input.trim() && !isProcessing
								? "text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
								: "text-zinc-700 cursor-not-allowed",
						)}
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				</div>
				<div className="flex items-center justify-between px-1 mt-1">
					<span className="text-[9px] text-zinc-600">
						{phase === "complete" || paperEdit
							? "Edit mode — describe changes to the timeline"
							: "Enter ↵ to send · Shift+Enter for new line"}
					</span>
					<span className="text-[9px] text-zinc-700">⌘L to toggle</span>
				</div>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WELCOME SCREEN — shown when no messages
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeScreen() {
	const setOpen = useChatStore((s) => s.setOpen);
	return (
		<div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 select-none">
			<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-3 border border-purple-500/10">
				<Sparkles className="h-5 w-5 text-purple-400" />
			</div>
			<h3 className="text-[13px] font-semibold text-zinc-200 mb-1">
				Kinetograph AI
			</h3>
			<p className="text-[11px] text-zinc-500 max-w-[240px] mb-5 leading-relaxed">
				Describe the video you want to create. I&apos;ll orchestrate 8 AI agents
				to turn your footage into a finished edit.
			</p>
			<div className="space-y-2 w-full max-w-[280px]">
				{[
					"Create a 60s highlight reel focusing on key insights",
					"Make a fast-paced edit with dramatic B-roll transitions",
					"Build a calm, interview-style edit with crossfades",
				].map((suggestion) => (
					<SuggestionButton key={suggestion} text={suggestion} />
				))}
			</div>
		</div>
	);
}

function SuggestionButton({ text }: { text: string }) {
	const addUserMessage = useChatStore((s) => s.addUserMessage);
	const addSystemMessage = useChatStore((s) => s.addSystemMessage);
	const setProcessing = useChatStore((s) => s.setProcessing);
	const setPipelineActive = useChatStore((s) => s.setPipelineActive);
	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);

	const handleClick = async () => {
		addUserMessage(text);
		setProcessing(true);
		setPipelineActive(true);
		addSystemMessage(
			"🚀 Starting pipeline... I'll process your footage and keep you updated.",
		);

		try {
			const res = await KinetographAPI.runPipeline({
				prompt: text,
				project_name: text.slice(0, 30).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "untitled",
			});
			if (res.thread_id) {
				useChatStore.getState().setThreadId(res.thread_id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Pipeline failed to start.";
			addSystemMessage(`❌ ${msg}`, "pipeline-error");
			setProcessing(false);
			setPipelineActive(false);
		}
	};

	return (
		<button
			onClick={handleClick}
			className="w-full text-left px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-purple-500/30 hover:bg-purple-500/5 text-[10px] text-zinc-400 hover:text-zinc-300 transition-all group"
		>
			<span className="text-purple-400 mr-1.5 group-hover:text-purple-300">
				→
			</span>
			{text}
		</button>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGE BUBBLE — renders a single chat message
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({ message }: { message: ChatMessage }) {
	switch (message.type) {
		case "text":
			return message.role === "user" ? (
				<UserMessage content={message.content} />
			) : (
				<AssistantMessage content={message.content} />
			);
		case "agent-update":
			return (
				<AgentUpdateMessage
					agent={message.agent || "Agent"}
					phase={message.phase}
					content={message.content}
				/>
			);
		case "approval-request":
			return <ApprovalRequestMessage message={message} />;
		case "approval-response":
			return <AssistantMessage content={message.content} />;
		case "pipeline-complete":
			return <PipelineCompleteMessage message={message} />;
		case "pipeline-error":
			return <ErrorMessage content={message.content} errors={message.errors} />;
		case "edit-request":
			return <UserMessage content={message.content} />;
		case "edit-response":
			return <AssistantMessage content={message.content} />;
		case "loading":
			return <LoadingMessage />;
		default:
			return <AssistantMessage content={message.content} />;
	}
}

// ─── User message ─────────────────────────────────────────────────────────────

function UserMessage({ content }: { content: string }) {
	return (
		<div className="flex justify-end">
			<div className="flex items-start gap-2 max-w-[85%]">
				<div className="bg-purple-600/20 border border-purple-500/20 rounded-xl rounded-tr-sm px-3 py-2">
					<p className="text-[11px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
						{content}
					</p>
				</div>
				<div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<User className="h-2.5 w-2.5 text-purple-400" />
				</div>
			</div>
		</div>
	);
}

// ─── Assistant message ────────────────────────────────────────────────────────

function AssistantMessage({ content }: { content: string }) {
	return (
		<div className="flex justify-start">
			<div className="flex items-start gap-2 max-w-[85%]">
				<div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<Bot className="h-2.5 w-2.5 text-blue-400" />
				</div>
				<div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl rounded-tl-sm px-3 py-2">
					<p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
						{content}
					</p>
				</div>
			</div>
		</div>
	);
}

// ─── Agent update message ─────────────────────────────────────────────────────

function AgentUpdateMessage({
	agent,
	phase,
	content,
}: {
	agent: string;
	phase?: Phase;
	content: string;
}) {
	const isComplete = phase?.toString().endsWith("ed") || phase === "complete";
	return (
		<div className="flex items-start gap-2 px-2">
			<div
				className={cn(
					"w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
					isComplete ? "bg-emerald-500/20" : "bg-amber-500/20",
				)}
			>
				{isComplete ? (
					<CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
				) : (
					<Loader2 className="h-2.5 w-2.5 text-amber-400 animate-spin" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] font-semibold text-zinc-400">
						{agent}
					</span>
					{phase && (
						<span className="text-[8px] text-zinc-600 bg-zinc-800 px-1 py-0.5 rounded">
							{phase}
						</span>
					)}
				</div>
				<p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">
					{content}
				</p>
			</div>
		</div>
	);
}

// ─── Approval request message ─────────────────────────────────────────────────

function ApprovalRequestMessage({ message }: { message: ChatMessage }) {
	const [isApproving, setIsApproving] = useState(false);
	const [showRejectInput, setShowRejectInput] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [decided, setDecided] = useState(false);

	const setPaperEdit = useKinetographStore((s) => s.setPaperEdit);
	const paperEdit = useKinetographStore((s) => s.paperEdit);
	const addSystemMessage = useChatStore((s) => s.addSystemMessage);
	const setProcessing = useChatStore((s) => s.setProcessing);
	const setPipelineActive = useChatStore((s) => s.setPipelineActive);

	const clips = message.paperEdit?.clips || [];

	const handleApprove = async () => {
		setIsApproving(true);
		setDecided(true);
		setProcessing(true);
		setPipelineActive(true);
		addSystemMessage("👍 Approving paper edit and continuing pipeline...");
		try {
			// Use the current paperEdit from store (user may have edited it in timeline)
			const editToApprove = paperEdit || message.paperEdit;
			await KinetographAPI.approvePipeline({
				action: "approve",
				paper_edit: editToApprove || undefined,
			});
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Approval failed.";
			addSystemMessage(`❌ ${msg}`, "pipeline-error");
			setProcessing(false);
			setPipelineActive(false);
		} finally {
			setIsApproving(false);
		}
	};

	const handleReject = async () => {
		if (!rejectReason.trim()) return;
		setIsApproving(true);
		setDecided(true);
		setProcessing(true);
		setPipelineActive(true);
		addSystemMessage(
			`🔄 Requesting revision: "${rejectReason}"`,
		);
		try {
			await KinetographAPI.approvePipeline({
				action: "reject",
				reason: rejectReason,
			});
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Rejection failed.";
			addSystemMessage(`❌ ${msg}`, "pipeline-error");
			setProcessing(false);
			setPipelineActive(false);
		} finally {
			setIsApproving(false);
			setShowRejectInput(false);
		}
	};

	return (
		<div className="flex justify-start">
			<div className="flex items-start gap-2 w-full max-w-[95%]">
				<div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<Film className="h-2.5 w-2.5 text-amber-400" />
				</div>
				<div className="flex-1 min-w-0 space-y-2">
					{/* Header */}
					<div className="bg-zinc-800/50 border border-amber-500/20 rounded-xl rounded-tl-sm px-3 py-2">
						<p className="text-[11px] text-zinc-300 leading-relaxed mb-2">
							{message.content}
						</p>

						{/* Clip list preview */}
						<div className="space-y-1 mb-2">
							<div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">
								{clips.length} clips ·{" "}
								{message.paperEdit?.title || "Paper Edit"}
							</div>
							<div className="max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
								{clips.slice(0, 8).map((clip, i) => (
									<div
										key={clip.clip_id}
										className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-900/50 text-[9px]"
									>
										<span className="text-zinc-600 w-4 text-right">
											{i + 1}.
										</span>
										<span
											className={cn(
												"px-1 py-0.5 rounded text-[8px] font-medium",
												clip.clip_type === "a-roll"
													? "bg-blue-500/20 text-blue-400"
													: clip.clip_type === "synth"
														? "bg-purple-500/20 text-purple-400"
														: "bg-emerald-500/20 text-emerald-400",
											)}
										>
											{clip.clip_type}
										</span>
										<span className="text-zinc-400 truncate flex-1">
											{clip.description}
										</span>
										<span className="text-zinc-600 tabular-nums">
											{((clip.out_ms - clip.in_ms) / 1000).toFixed(1)}s
										</span>
									</div>
								))}
								{clips.length > 8 && (
									<div className="text-[9px] text-zinc-600 text-center py-1">
										+ {clips.length - 8} more clips
									</div>
								)}
							</div>
						</div>

						{/* Action buttons */}
						{!decided && (
							<div className="flex items-center gap-2 pt-1 border-t border-zinc-700/30">
								<button
									onClick={handleApprove}
									disabled={isApproving}
									className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium transition-colors disabled:opacity-50"
								>
									<Check className="h-3 w-3" />
									Approve & Continue
								</button>
								<button
									onClick={() => setShowRejectInput(true)}
									disabled={isApproving}
									className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-[10px] font-medium transition-colors disabled:opacity-50"
								>
									<Pencil className="h-3 w-3" />
									Request Changes
								</button>
							</div>
						)}

						{decided && (
							<div className="flex items-center gap-1 pt-1 border-t border-zinc-700/30 text-[10px] text-zinc-600">
								<CheckCircle2 className="h-3 w-3" />
								Decision submitted
							</div>
						)}
					</div>

					{/* Reject reason input */}
					{showRejectInput && !decided && (
						<div className="flex items-end gap-1.5 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2 py-1.5">
							<input
								type="text"
								value={rejectReason}
								onChange={(e) => setRejectReason(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleReject();
									if (e.key === "Escape") setShowRejectInput(false);
								}}
								placeholder="Describe what changes you want..."
								autoFocus
								className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none"
							/>
							<button
								onClick={handleReject}
								disabled={!rejectReason.trim() || isApproving}
								className="p-1 rounded text-amber-400 hover:bg-amber-500/20 transition-colors disabled:text-zinc-700"
							>
								<Send className="h-3 w-3" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Pipeline complete message ────────────────────────────────────────────────

function PipelineCompleteMessage({ message }: { message: ChatMessage }) {
	return (
		<div className="flex justify-start">
			<div className="flex items-start gap-2 max-w-[90%]">
				<div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
				</div>
				<div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl rounded-tl-sm px-3 py-2 space-y-2">
					<p className="text-[11px] text-emerald-300 leading-relaxed">
						{message.content}
					</p>
					{message.renderPath && (
						<div className="flex items-center gap-2 text-[9px]">
							<a
								href={`/api/assets/stream?path=${encodeURIComponent(message.renderPath)}`}
								download
								className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
							>
								<Download className="h-2.5 w-2.5" />
								Download MP4
							</a>
							{message.timelinePath && (
							<a
								href={`/api/assets/stream?path=${encodeURIComponent(message.timelinePath)}`}
								download
								className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
							>
								<Download className="h-2.5 w-2.5" />
								Timeline
							</a>
							)}
						</div>
					)}
					<p className="text-[9px] text-zinc-500">
						You can now edit the timeline directly, or ask me to make changes.
					</p>
				</div>
			</div>
		</div>
	);
}

// ─── Error message ────────────────────────────────────────────────────────────

function ErrorMessage({
	content,
	errors,
}: {
	content: string;
	errors?: import("@/types/kinetograph").PipelineError[];
}) {
	return (
		<div className="flex justify-start">
			<div className="flex items-start gap-2 max-w-[85%]">
				<div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<AlertCircle className="h-2.5 w-2.5 text-red-400" />
				</div>
				<div className="bg-red-500/5 border border-red-500/20 rounded-xl rounded-tl-sm px-3 py-2">
					<p className="text-[11px] text-red-300 leading-relaxed">
						{content}
					</p>
					{errors && errors.length > 0 && (
						<div className="mt-1.5 space-y-1">
							{errors.map((err, i) => (
								<div
									key={i}
									className="text-[9px] text-red-400/70 bg-red-500/10 px-2 py-1 rounded"
								>
									<span className="font-medium">{err.agent}:</span>{" "}
									{err.message}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Loading message ──────────────────────────────────────────────────────────

function LoadingMessage() {
	return (
		<div className="flex justify-start">
			<div className="flex items-start gap-2">
				<div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
					<Bot className="h-2.5 w-2.5 text-blue-400" />
				</div>
				<div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl rounded-tl-sm px-3 py-2">
					<div className="flex items-center gap-1.5">
						<div className="flex gap-0.5">
							<span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
							<span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
							<span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
