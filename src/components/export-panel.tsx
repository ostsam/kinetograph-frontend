"use client";

import { KinetographAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { OutputFile } from "@/types/kinetograph";
import { AnimatePresence, motion } from "framer-motion";
import {
	Download,
	FileVideo,
	FileText,
	FileType,
	Loader2,
	RefreshCw,
	X,
	AlertCircle,
	HardDrive,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ExportPanelProps {
	onClose: () => void;
}

const FILE_ICON: Record<string, React.ElementType> = {
	video: FileVideo,
	fcpxml: FileText,
	srt: FileType,
	vtt: FileType,
	captions: FileType,
};

function iconForFile(f: OutputFile) {
	for (const [key, Icon] of Object.entries(FILE_ICON)) {
		if (f.type?.includes(key) || f.file_name?.includes(key)) return Icon;
	}
	return HardDrive;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ExportPanel({ onClose }: ExportPanelProps) {
	const [files, setFiles] = useState<OutputFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchOutputs = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await KinetographAPI.getOutputs();
			setFiles(res.files ?? []);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch outputs",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchOutputs();
	}, [fetchOutputs]);

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
				onClick={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
			>
				<motion.div
					initial={{ opacity: 0, y: 24, scale: 0.96 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 24, scale: 0.96 }}
					transition={{ type: "spring", damping: 26, stiffness: 300 }}
					className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
				>
					{/* Header */}
					<div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
						<div className="flex items-center gap-2">
							<Download className="h-4 w-4 text-amber-500" />
							<h2 className="text-sm font-semibold text-zinc-100">
								Export &amp; Download
							</h2>
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={fetchOutputs}
								disabled={loading}
								className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-40"
								title="Refresh"
							>
								<RefreshCw
									className={cn("h-3.5 w-3.5", loading && "animate-spin")}
								/>
							</button>
							<button
								type="button"
								onClick={onClose}
								className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* Body */}
					<div className="max-h-80 overflow-y-auto px-5 py-4">
						{loading && (
							<div className="flex flex-col items-center gap-2 py-8 text-zinc-500">
								<Loader2 className="h-5 w-5 animate-spin" />
								<span className="text-xs">Loading outputs…</span>
							</div>
						)}

						{error && !loading && (
							<div className="flex flex-col items-center gap-2 py-8 text-red-400">
								<AlertCircle className="h-5 w-5" />
								<span className="text-xs text-center">{error}</span>
								<button
									type="button"
									onClick={fetchOutputs}
									className="mt-1 rounded bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
								>
									Retry
								</button>
							</div>
						)}

						{!loading && !error && files.length === 0 && (
							<div className="flex flex-col items-center gap-2 py-8 text-zinc-500">
								<HardDrive className="h-5 w-5" />
								<span className="text-xs">No outputs yet.</span>
								<span className="text-[10px] text-zinc-600">
									Run the pipeline to generate exports.
								</span>
							</div>
						)}

						{!loading && !error && files.length > 0 && (
							<ul className="space-y-2">
								{files.map((file) => {
									const Icon = iconForFile(file);
									return (
										<li
											key={file.file_name}
											className="group flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/40 px-3 py-2.5 transition-colors hover:border-zinc-700"
										>
											<div className="flex items-center gap-3 min-w-0">
												<Icon className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
												<div className="min-w-0">
													<p className="truncate text-xs font-medium text-zinc-200">
														{file.file_name}
													</p>
													<p className="text-[10px] text-zinc-500">
														{file.type} · {formatBytes(file.size_bytes)}
													</p>
												</div>
											</div>

											<a
												href={file.download_url}
												download={file.file_name}
												className="ml-3 shrink-0 rounded bg-amber-600/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500 uppercase tracking-wider hover:bg-amber-600/20 transition-colors"
											>
												Download
											</a>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					{/* Footer */}
					{!loading && files.length > 0 && (
						<div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between">
							<span className="text-[10px] text-zinc-500">
								{files.length} {files.length === 1 ? "file" : "files"} ·{" "}
								{formatBytes(
									files.reduce((acc, f) => acc + (f.size_bytes || 0), 0),
								)}
							</span>
							<a
								href={files.length === 1 ? files[0].download_url : undefined}
								download
								onClick={(e) => {
									if (files.length > 1) {
										e.preventDefault();
										// Download all files sequentially
										for (const f of files) {
											const a = document.createElement("a");
											a.href = f.download_url;
											a.download = f.file_name;
											a.click();
										}
									}
								}}
								className="rounded bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-black uppercase tracking-wider hover:bg-amber-500 transition-colors cursor-pointer"
							>
								Download All
							</a>
						</div>
					)}
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}
