"use client";

import { useState, useCallback, useRef } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI, normalizeAPIError } from "@/lib/api";
import { createLocalAsset, isVideoFile } from "@/lib/local-asset";
import { Loader2, Plus, Film, HardDrive, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const enableLocalMockIngest =
	process.env.NEXT_PUBLIC_ENABLE_LOCAL_MOCK_INGEST === "true";

export function AssetDropzone() {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const setAssets = useKinetographStore((s) => s.setAssets);
	const addAssets = useKinetographStore((s) => s.addAssets);
	const assets = useKinetographStore((s) => s.assets);
	const selectedAssetId = useKinetographStore((s) => s.selectedAssetId);
	const setSelectedAsset = useKinetographStore((s) => s.setSelectedAsset);

	const handleUpload = useCallback(
		async (files: File[]) => {
			const videoFiles = files.filter(isVideoFile);
			if (videoFiles.length === 0) return;

			setIsUploading(true);
			setUploadError(null);

			try {
				for (const file of videoFiles) {
					const type = file.name.toLowerCase().includes("interview")
						? "a-roll"
						: "b-roll";
					await KinetographAPI.uploadAsset(file, type);
				}

				const updated = await KinetographAPI.getAssets();
				setAssets(updated.assets);
			} catch (err) {
				if (enableLocalMockIngest) {
					const localAssets = await Promise.all(
						videoFiles.map((file) => createLocalAsset(file)),
					);
					addAssets(localAssets);
				} else {
					const normalized = await normalizeAPIError(
						err,
						"Upload failed. Backend ingest is required.",
					);
					setUploadError(normalized.detail);
				}
			} finally {
				setIsUploading(false);
			}
		},
		[addAssets, setAssets],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			handleUpload(Array.from(e.dataTransfer.files));
		},
		[handleUpload],
	);

	return (
		<div className="flex flex-col h-full gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-zinc-500">
					<HardDrive className="h-3 w-3" />
					<span className="text-[10px] font-bold uppercase tracking-widest tabular">
						{assets.length} ITEMS
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => fileInputRef.current?.click()}
						className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-sm border border-white/5 text-[9px] font-black uppercase tracking-tighter transition-colors active:bg-zinc-600"
					>
						<Plus className="h-3 w-3" />
						Import
					</button>
					<button
						disabled
						title="Asset delete is disabled until backend endpoint support is added."
						className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-white/5 text-[9px] font-black uppercase tracking-tighter transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-800"
					>
						<Ban className="h-3 w-3" />
						Delete Disabled
					</button>
				</div>
				<input
					type="file"
					ref={fileInputRef}
					className="hidden"
					multiple
					accept="video/*"
					onChange={(e) => {
						handleUpload(Array.from(e.target.files || []));
						e.target.value = "";
					}}
				/>
			</div>

			<div
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={onDrop}
				className={`
          relative flex-1 rounded-sm border transition-all duration-200 overflow-hidden flex flex-col
          ${isDragging ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-black/20"}
        `}
			>
				<div className="flex-1 overflow-y-auto custom-scrollbar">
					<div className="flex flex-col divide-y divide-zinc-800/50">
						<AnimatePresence mode="popLayout">
							{assets.map((asset) => (
								<motion.div
									key={asset.id}
									layout
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									draggable
									onClick={() => setSelectedAsset(asset.id)}
									onDragStart={(event) => {
										const dragEvent =
											event as unknown as React.DragEvent<HTMLDivElement>;
										setSelectedAsset(asset.id);
										dragEvent.dataTransfer.effectAllowed = "copy";
										dragEvent.dataTransfer.setData(
											"application/x-kinetograph-asset-id",
											asset.id,
										);
										dragEvent.dataTransfer.setData(
											"text/plain",
											asset.file_name,
										);
									}}
									className={`group relative flex items-center gap-3 p-2 cursor-pointer transition-colors ${
										selectedAssetId === asset.id
											? "bg-amber-500/10"
											: "hover:bg-white/[0.03]"
									}`}
								>
									<div className="relative flex h-10 w-16 shrink-0 items-center justify-center rounded-sm bg-zinc-900 border border-white/5 overflow-hidden">
										<Film className="h-4 w-4 text-zinc-700" />
										<div className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-zinc-500 font-mono text-center py-0.5 uppercase">
											{asset.asset_type.split("-")[0]}
										</div>
									</div>

									<div className="min-w-0 flex-1 flex flex-col gap-0.5">
										<p className="truncate text-[10px] font-bold text-zinc-300 uppercase tracking-tight leading-none group-hover:text-amber-500/80 transition-colors">
											{asset.file_name}
										</p>
										<div className="flex items-center gap-2 text-[8px] font-mono text-zinc-600 tabular">
											<span>{(asset.duration_ms / 1000).toFixed(2)}s</span>
											<span className="opacity-30">|</span>
											<span>{asset.fps} FPS</span>
											<span className="opacity-30">|</span>
											<span className="uppercase">{asset.codec}</span>
										</div>
									</div>

									{isUploading && (
										<Loader2 className="h-3 w-3 animate-spin text-amber-500/40" />
									)}
								</motion.div>
							))}
						</AnimatePresence>

						{assets.length === 0 && !isUploading && (
							<div className="flex flex-col items-center justify-center h-40 text-center px-6">
								<Film className="h-8 w-8 text-zinc-800 mb-3" />
								<p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">
									Bin Empty
									<br />
									<span className="font-normal lowercase opacity-50 italic">
										Drag media here to begin ingest
									</span>
								</p>
							</div>
						)}
					</div>
				</div>

				{uploadError && (
					<div className="border-t border-red-900/40 bg-red-950/30 px-3 py-2 text-[10px] text-red-200">
						{uploadError}
					</div>
				)}

				{isUploading && (
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
						<div className="h-1 w-24 bg-zinc-800 rounded-full overflow-hidden">
							<motion.div
								initial={{ x: "-100%" }}
								animate={{ x: "100%" }}
								transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
								className="h-full w-full bg-amber-500"
							/>
						</div>
						<span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
							Ingesting Payload…
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
