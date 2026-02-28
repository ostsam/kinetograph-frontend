"use client";

import { PaperEditClip } from "@/types/kinetograph";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Type, Scissors, GripVertical, X } from "lucide-react";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface TimelineClipProps {
	clip: PaperEditClip;
	isSelected: boolean;
	pxPerSecond: number;
	onClick: () => void;
	onDelete: () => void;
}

export function TimelineClip({
	clip,
	isSelected,
	pxPerSecond,
	onClick,
	onDelete,
}: TimelineClipProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: clip.clip_id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const duration = Math.max(0, clip.out_ms - clip.in_ms);
	const width = Math.max(8, (duration / 1000) * pxPerSecond);

	return (
		<div
			ref={setNodeRef}
			style={{ ...style, width: `${width}px` }}
			onClick={onClick}
			className={cn(
				"relative flex h-20 shrink-0 flex-col border-r border-black/40 transition-all select-none group overflow-hidden",
				isSelected
					? "bg-amber-500/20 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.5)] z-10"
					: "bg-zinc-800/80 hover:bg-zinc-700/80",
				isDragging && "opacity-50 z-50",
				clip.clip_type === "synth" &&
					"bg-purple-900/20 border-l-2 border-l-purple-500",
				clip.clip_type === "a-roll" &&
					"bg-blue-900/20 border-l-2 border-l-blue-500",
			)}
		>
			<div
				{...attributes}
				{...listeners}
				className="flex h-5 items-center justify-between px-2 bg-black/20 border-b border-black/40 cursor-grab active:cursor-grabbing"
			>
				<div className="flex items-center gap-1.5">
					<GripVertical className="h-2.5 w-2.5 text-zinc-600" />
					<span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-400">
						{clip.clip_id} {" // "} {clip.clip_type}
					</span>
				</div>
				<div className="flex items-center gap-1">
					{clip.overlay_text && (
						<Type className="h-2.5 w-2.5 text-amber-500/70" />
					)}
					<button
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							onDelete();
						}}
						className="rounded-sm p-0.5 text-zinc-600 hover:bg-zinc-700/60 hover:text-red-400 transition-colors"
						title="Remove clip"
					>
						<X className="h-2.5 w-2.5" />
					</button>
				</div>
			</div>

			<div className="flex flex-1 flex-col p-2 overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent">
				<p className="truncate text-[10px] font-bold text-zinc-200 leading-tight mb-1 uppercase tracking-tight">
					{clip.description || clip.source_file}
				</p>

				<div className="mt-auto flex items-center justify-between text-[9px] font-mono tabular text-zinc-500">
					<div className="flex items-center gap-1">
						<span className={isSelected ? "text-amber-500/80" : ""}>
							{(clip.in_ms / 1000).toFixed(2)}s
						</span>
						<span className="opacity-20">|</span>
						<span>{(clip.out_ms / 1000).toFixed(2)}s</span>
					</div>
				</div>
			</div>

			<div
				className="absolute left-0 inset-y-5 w-1 bg-black/20 hover:bg-amber-500/50 cursor-ew-resize transition-colors"
				title="Trim In"
			/>
			<div
				className="absolute right-0 inset-y-5 w-1 bg-black/20 hover:bg-amber-500/50 cursor-ew-resize transition-colors"
				title="Trim Out"
			/>

			{clip.transition === "crossfade" && (
				<div className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 flex h-4 w-4 items-center justify-center bg-zinc-900 border border-zinc-700 rotate-45">
					<Scissors className="h-2 w-2 text-zinc-500 -rotate-45" />
				</div>
			)}

			{isSelected && (
				<div className="absolute inset-0 border border-amber-500/30 pointer-events-none" />
			)}
		</div>
	);
}
