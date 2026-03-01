"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useKinetographStore } from "@/store/use-kinetograph-store";
import { KinetographAPI } from "@/lib/api";
import { createLocalAsset, isVideoFile } from "@/lib/local-asset";
import { Loader2, Plus, Film, FolderOpen, Trash2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AssetDropzone() {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [pendingDeleteAssetId, setPendingDeleteAssetId] = useState<string | null>(null);
	const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
	const [editingFileName, setEditingFileName] = useState("");
	const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const setAssets = useKinetographStore((s) => s.setAssets);
	const addAssets = useKinetographStore((s) => s.addAssets);
	const renameAsset = useKinetographStore((s) => s.renameAsset);
	const deleteAsset = useKinetographStore((s) => s.deleteAsset);
	const assets = useKinetographStore((s) => s.assets);
	const selectedAssetId = useKinetographStore((s) => s.selectedAssetId);
	const selectedClipId = useKinetographStore((s) => s.selectedClipId);
	const setSelectedAsset = useKinetographStore((s) => s.setSelectedAsset);
	const pendingDeleteAsset = assets.find((a) => a.id === pendingDeleteAssetId) ?? null;

	const filteredAssets = searchQuery.trim()
		? assets.filter((a) => a.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
		: assets;

	const handleUpload = useCallback(
		async (files: File[], assetType: "a-roll" | "b-roll") => {
			const videoFiles = files.filter(isVideoFile);
			if (videoFiles.length === 0) return;
			setIsUploading(true);
			try {
				for (const file of videoFiles) {
					await KinetographAPI.uploadAsset(file, assetType);
				}
				const updated = await KinetographAPI.getAssets();
				setAssets(updated.assets);
			} catch {
				const localAssets = await Promise.all(videoFiles.map((file) => createLocalAsset(file)));
				addAssets(localAssets);
			} finally {
				setIsUploading(false);
			}
		},
		[addAssets, setAssets],
	);

	const promptAndUpload = useCallback(
		(files: File[]) => {
			const videoFiles = files.filter(isVideoFile);
			if (videoFiles.length === 0) return;
			setPendingFiles(videoFiles);
		},
		[],
	);

	const requestDeleteAsset = useCallback((assetId: string) => {
		setPendingDeleteAssetId(assetId);
	}, []);

	const confirmDeleteAsset = useCallback(() => {
		if (!pendingDeleteAssetId) return;
		deleteAsset(pendingDeleteAssetId);
		setPendingDeleteAssetId(null);
	}, [deleteAsset, pendingDeleteAssetId]);

	const startRenameAsset = useCallback((assetId: string, fileName: string) => {
		setEditingAssetId(assetId);
		setEditingFileName(fileName);
	}, []);

	const commitRenameAsset = useCallback(
		(assetId: string) => {
			const next = editingFileName.trim();
			if (next) renameAsset(assetId, next);
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
			if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
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
			promptAndUpload(Array.from(e.dataTransfer.files));
		},
		[promptAndUpload],
	);

	return (
		<div className="flex flex-col h-full gap-3">
			{/* Toolbar */}
			<div className="flex items-center gap-2">
				<button
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded border border-zinc-700 text-[10px] font-medium transition-colors"
				>
					<Plus className="h-3 w-3" />
					Import
				</button>
				<button
					disabled={!selectedAssetId}
					onClick={() => selectedAssetId && requestDeleteAsset(selectedAssetId)}
					className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-zinc-700 text-[10px] font-medium transition-colors disabled:opacity-30 bg-zinc-800 hover:bg-zinc-700"
				>
					<Trash2 className="h-3 w-3" />
				</button>
				<input type="file" ref={fileInputRef} className="hidden" multiple accept="video/*"
					onChange={(e) => { promptAndUpload(Array.from(e.target.files || [])); e.target.value = ""; }} />
			</div>

			{/* Search */}
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
				<input
					type="text"
					placeholder="Filter media..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1.5 text-[10px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
				/>
			</div>

			{/* Asset list */}
			<div
				onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
				onDragLeave={() => setIsDragging(false)}
				onDrop={onDrop}
				className={`relative flex-1 rounded border transition-colors overflow-hidden flex flex-col
					${isDragging ? "border-blue-500/50 bg-blue-500/5" : "border-zinc-800 bg-zinc-950/50"}`}
			>
				<div className="flex-1 overflow-y-auto custom-scrollbar">
					<div className="flex flex-col">
						<AnimatePresence mode="popLayout">
							{filteredAssets.map((asset) => (
								<motion.div
									key={asset.id}
									layout
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									draggable={editingAssetId !== asset.id}
									onClick={() => setSelectedAsset(asset.id)}
									onDragStart={(event) => {
										const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
										setSelectedAsset(asset.id);
										dragEvent.dataTransfer.effectAllowed = "copy";
										dragEvent.dataTransfer.setData("application/x-kinetograph-asset-id", asset.id);
										dragEvent.dataTransfer.setData("text/plain", asset.file_name);
									}}
									className={`group relative flex items-center gap-2.5 px-2 py-1.5 cursor-pointer transition-colors border-b border-zinc-800/30 ${
										selectedAssetId === asset.id
											? "bg-blue-500/10"
											: "hover:bg-white/[0.03]"
									}`}
								>
									{/* Thumbnail */}
									<div className="relative flex h-10 w-16 shrink-0 items-center justify-center rounded bg-zinc-900 border border-zinc-800 overflow-hidden">
										{asset.thumbnail_url ? (
											<img
												src={asset.thumbnail_url}
												alt={asset.file_name}
												className="absolute inset-0 h-full w-full object-cover"
												draggable={false}
											/>
										) : (
											<Film className="h-4 w-4 text-zinc-700" />
										)}
										<div className="absolute bottom-0 inset-x-0 bg-black/70 text-[7px] text-zinc-400 font-mono text-center py-px">
											{(asset.duration_ms / 1000).toFixed(1)}s
										</div>
									</div>

									{/* Info */}
									<div className="min-w-0 flex-1 flex flex-col gap-0.5">
										{editingAssetId === asset.id ? (
											<input
												autoFocus
												value={editingFileName}
												onChange={(e) => setEditingFileName(e.target.value)}
												onClick={(e) => e.stopPropagation()}
												onBlur={() => commitRenameAsset(asset.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter") { e.preventDefault(); commitRenameAsset(asset.id); }
													if (e.key === "Escape") { setEditingAssetId(null); setEditingFileName(""); }
												}}
												className="w-full bg-black/50 border border-blue-500/40 rounded px-1 py-0.5 text-[10px] text-zinc-100 outline-none"
											/>
										) : (
											<p
												onDoubleClick={(e) => { e.stopPropagation(); startRenameAsset(asset.id, asset.file_name); }}
												className="truncate text-[10px] font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors"
											>
												{asset.file_name}
											</p>
										)}
										<div className="flex items-center gap-1.5 text-[8px] font-mono text-zinc-600">
											<span className={`px-1 rounded ${
												asset.asset_type === "a-roll"
													? "bg-emerald-500/15 text-emerald-400"
													: asset.asset_type === "b-roll-synth"
													? "bg-purple-500/15 text-purple-400"
													: "bg-blue-500/15 text-blue-400"
											}`}>
												{asset.asset_type === "b-roll-synth" ? "synth" : asset.asset_type}
											</span>
											<span>{asset.width}×{asset.height}</span>
											<span className="opacity-30">·</span>
											<span>{asset.fps}fps</span>
											<span className="opacity-30">·</span>
											<span className="uppercase">{asset.codec}</span>
										</div>
									</div>

									{isUploading && (
										<Loader2 className="h-3 w-3 animate-spin text-blue-500/40 shrink-0" />
									)}
								</motion.div>
							))}
						</AnimatePresence>

						{filteredAssets.length === 0 && !isUploading && (
							<div className="flex flex-col items-center justify-center h-32 text-center px-6">
								<FolderOpen className="h-6 w-6 text-zinc-800 mb-2" />
								<p className="text-[10px] text-zinc-600">
									{searchQuery ? "No matching media" : "Drop media files here to import"}
								</p>
							</div>
						)}
					</div>
				</div>

				{isUploading && (
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
						<Loader2 className="h-5 w-5 animate-spin text-blue-500" />
						<span className="text-[9px] font-medium text-zinc-400">Importing media…</span>
					</div>
				)}

				{pendingDeleteAsset && (
					<div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
						<div className="w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
							<h3 className="text-xs font-semibold text-zinc-200">Delete media?</h3>
							<p className="mt-1.5 text-[10px] text-zinc-400 leading-relaxed break-all">
								Remove <span className="text-zinc-200">{pendingDeleteAsset.file_name}</span> from the project.
							</p>
							<div className="mt-3 flex items-center justify-end gap-2">
								<button
									onClick={() => setPendingDeleteAssetId(null)}
									className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700"
								>
									Cancel
								</button>
								<button
									onClick={confirmDeleteAsset}
									className="rounded border border-red-800/50 bg-red-600/20 px-3 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-600/30"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Asset type picker — shown when user drops / imports files */}
				{pendingFiles && (
					<div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
						<div className="w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
							<h3 className="text-xs font-semibold text-zinc-200">Import as…</h3>
							<p className="mt-1.5 text-[10px] text-zinc-400 leading-relaxed">
								{pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} selected. Choose the media type:
							</p>
							<div className="mt-3 flex flex-col gap-2">
								<button
									onClick={() => { const f = pendingFiles; setPendingFiles(null); handleUpload(f, "a-roll"); }}
									className="w-full rounded border border-emerald-700/50 bg-emerald-600/10 px-3 py-2 text-left hover:bg-emerald-600/20 transition-colors"
								>
									<span className="text-[11px] font-semibold text-emerald-300">A-Roll</span>
									<span className="block text-[9px] text-zinc-500 mt-0.5">Primary footage — interviews, main content</span>
								</button>
								<button
									onClick={() => { const f = pendingFiles; setPendingFiles(null); handleUpload(f, "b-roll"); }}
									className="w-full rounded border border-blue-700/50 bg-blue-600/10 px-3 py-2 text-left hover:bg-blue-600/20 transition-colors"
								>
									<span className="text-[11px] font-semibold text-blue-300">B-Roll</span>
									<span className="block text-[9px] text-zinc-500 mt-0.5">Supplementary footage — cutaways, overlays</span>
								</button>
							</div>
							<div className="mt-2 flex justify-end">
								<button
									onClick={() => setPendingFiles(null)}
									className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Stats footer */}
			<div className="flex items-center justify-between text-[9px] font-mono text-zinc-600 px-1">
				<span>{assets.length} clip{assets.length !== 1 ? "s" : ""}</span>
				<span>{(assets.reduce((s, a) => s + a.duration_ms, 0) / 1000).toFixed(1)}s total</span>
			</div>
		</div>
	);
}
