"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI } from "@/lib/api";
import { createLocalAsset, isVideoFile } from "@/lib/local-asset";
import { Loader2, Plus, Film, HardDrive, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AssetDropzone() {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [pendingDeleteAssetId, setPendingDeleteAssetId] = useState<
		string | null
	>(null);
	const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
	const [editingFileName, setEditingFileName] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const setAssets = useKinetographStore((s) => s.setAssets);
	const addAssets = useKinetographStore((s) => s.addAssets);
	const renameAsset = useKinetographStore((s) => s.renameAsset);
	const deleteAsset = useKinetographStore((s) => s.deleteAsset);
	const assets = useKinetographStore((s) => s.assets);
	const selectedAssetId = useKinetographStore((s) => s.selectedAssetId);
	const selectedClipId = useKinetographStore((s) => s.selectedClipId);
	const setSelectedAsset = useKinetographStore((s) => s.setSelectedAsset);
	const pendingDeleteAsset =
		assets.find((asset) => asset.id === pendingDeleteAssetId) ?? null;

	const handleUpload = useCallback(
		async (files: File[]) => {
			const videoFiles = files.filter(isVideoFile);
			if (videoFiles.length === 0) return;

			setIsUploading(true);

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
				console.info(
					"API upload unavailable. Using local ingest simulation instead.",
					err,
				);
				const localAssets = await Promise.all(
					videoFiles.map((file) => createLocalAsset(file)),
				);
				addAssets(localAssets);
			} finally {
				setIsUploading(false);
			}
		},
		[addAssets, setAssets],
	);

	const requestDeleteAsset = useCallback((assetId: string) => {
		setPendingDeleteAssetId(assetId);
	}, []);

	const confirmDeleteAsset = useCallback(() => {
		if (!pendingDeleteAssetId) return;
		deleteAsset(pendingDeleteAssetId);
		setPendingDeleteAssetId(null);
		if (editingAssetId === pendingDeleteAssetId) {
			setEditingAssetId(null);
			setEditingFileName("");
		}
	}, [deleteAsset, editingAssetId, pendingDeleteAssetId]);

	const startRenameAsset = useCallback((assetId: string, fileName: string) => {
		setEditingAssetId(assetId);
		setEditingFileName(fileName);
	}, []);

	const cancelRenameAsset = useCallback(() => {
		setEditingAssetId(null);
		setEditingFileName("");
	}, []);

	const commitRenameAsset = useCallback(
		(assetId: string) => {
			const nextFileName = editingFileName.trim();
			if (nextFileName) {
				renameAsset(assetId, nextFileName);
			}
			setEditingAssetId(null);
			setEditingFileName("");
		},
		[editingFileName, renameAsset],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (selectedClipId) return;
			if (!selectedAssetId || editingAssetId || pendingDeleteAssetId) return;
			if (event.key !== "Delete" && event.key !== "Backspace") return;

			const target = event.target as HTMLElement | null;
			const isTextInput =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable;
			if (isTextInput) return;

			event.preventDefault();
			setPendingDeleteAssetId(selectedAssetId);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [editingAssetId, pendingDeleteAssetId, selectedAssetId, selectedClipId]);

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
				<button
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-sm border border-white/5 text-[9px] font-black uppercase tracking-tighter transition-colors active:bg-zinc-600"
				>
					<Plus className="h-3 w-3" />
					Import
				</button>
				<button
					disabled={!selectedAssetId}
					onClick={() => selectedAssetId && requestDeleteAsset(selectedAssetId)}
					className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-white/5 text-[9px] font-black uppercase tracking-tighter transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600"
				>
					<Trash2 className="h-3 w-3" />
					Delete
				</button>
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
									draggable={editingAssetId !== asset.id}
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
										{editingAssetId === asset.id ? (
											<input
												autoFocus
												value={editingFileName}
												onChange={(event) =>
													setEditingFileName(event.target.value)
												}
												onClick={(event) => event.stopPropagation()}
												onBlur={() => commitRenameAsset(asset.id)}
												onKeyDown={(event) => {
													if (event.key === "Enter") {
														event.preventDefault();
														commitRenameAsset(asset.id);
													}
													if (event.key === "Escape") {
														event.preventDefault();
														cancelRenameAsset();
													}
												}}
												className="w-full bg-black/50 border border-amber-500/40 rounded-sm px-1 py-0.5 text-[10px] font-bold text-zinc-100 uppercase tracking-tight leading-none outline-none"
											/>
										) : (
											<p
												onDoubleClick={(event) => {
													event.stopPropagation();
													startRenameAsset(asset.id, asset.file_name);
												}}
												className="truncate text-[10px] font-bold text-zinc-300 uppercase tracking-tight leading-none group-hover:text-amber-500/80 transition-colors"
											>
												{asset.file_name}
											</p>
										)}
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

				{pendingDeleteAsset && (
					<div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
						<div className="w-full max-w-xs rounded-sm border border-zinc-700 bg-[#16161a] p-4 shadow-2xl">
							<h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-200">
								Delete Selected Asset?
							</h3>
							<p className="mt-2 text-[10px] text-zinc-400 leading-relaxed break-all">
								This will remove{" "}
								<span className="text-zinc-200">
									{pendingDeleteAsset.file_name}
								</span>{" "}
								from the bin.
							</p>
							<div className="mt-4 flex items-center justify-end gap-2">
								<button
									onClick={() => setPendingDeleteAssetId(null)}
									className="rounded-sm border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800"
								>
									Cancel
								</button>
								<button
									onClick={confirmDeleteAsset}
									className="rounded-sm border border-red-800/50 bg-red-600/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-red-300 hover:bg-red-600/30"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
