'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  horizontalListSortingStrategy 
} from '@dnd-kit/sortable';
import { useKinetographStore } from '@/store/use-kinetograph-store';
import { TimelineClip } from './timeline-clip';
import { KinetographAPI } from '@/lib/api';
import { CheckCircle2, AlertCircle, Play, Save, Trash2, Undo2, XCircle, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FPS = 30;
const BASE_PIXELS_PER_SECOND = 14;
const MIN_ZOOM_LEVEL = 0.25;
const MAX_ZOOM_LEVEL = 6;
const MIN_LABEL_SPACING_PX = 90;
const MIN_TIMELINE_SECONDS = 60;
const TRAILING_PADDING_SECONDS = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTimecode(ms: number) {
  const totalFrames = Math.max(0, Math.floor((ms / 1000) * FPS));
  const frames = totalFrames % FPS;
  const totalSeconds = Math.floor(totalFrames / FPS);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function getTickStepSeconds(pxPerSecond: number) {
  const options = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return options.find((seconds) => seconds * pxPerSecond >= MIN_LABEL_SPACING_PX) ?? options[options.length - 1];
}

interface TimeRulerProps {
  timelineWidthPx: number;
  pxPerSecond: number;
  tickStepSeconds: number;
}

function TimeRuler({ timelineWidthPx, pxPerSecond, tickStepSeconds }: TimeRulerProps) {
  const ticks = useMemo(() => {
    const totalSeconds = timelineWidthPx / pxPerSecond;
    const count = Math.floor(totalSeconds / tickStepSeconds) + 1;
    return Array.from({ length: count }, (_, index) => index * tickStepSeconds);
  }, [pxPerSecond, tickStepSeconds, timelineWidthPx]);

  return (
    <div
      className="relative h-6 border-b border-zinc-800 bg-zinc-900/30 min-w-full"
      style={{ width: `${timelineWidthPx}px` }}
    >
      {ticks.map((seconds) => {
        const leftPx = seconds * pxPerSecond;
        return (
          <div
            key={seconds}
            className="absolute top-0 bottom-0 border-l border-zinc-800/50 pl-1"
            style={{ left: `${leftPx}px` }}
          >
            <span className="text-[8px] font-mono tabular text-zinc-600">
              {formatTimecode(seconds * 1000)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TimelineEditor() {
  const paperEdit = useKinetographStore((s) => s.paperEdit);
  const reorderClips = useKinetographStore((s) => s.reorderClips);
  const addAssetToTimeline = useKinetographStore((s) => s.addAssetToTimeline);
  const selectedClipId = useKinetographStore((s) => s.selectedClipId);
  const setSelectedClip = useKinetographStore((s) => s.setSelectedClip);
  const deleteClip = useKinetographStore((s) => s.deleteClip);
  const [isAssetDropActive, setIsAssetDropActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const trackViewportRef = useRef<HTMLDivElement>(null);
  const [trackViewportWidth, setTrackViewportWidth] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!paperEdit) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = paperEdit.clips.findIndex((c) => c.clip_id === active.id);
      const newIndex = paperEdit.clips.findIndex((c) => c.clip_id === over.id);
      
      const newClips = arrayMove(paperEdit.clips, oldIndex, newIndex);
      const newIds = newClips.map(c => c.clip_id);
      
      reorderClips(newIds);
      KinetographAPI.reorderClips(newIds).catch(err => console.error('Sync failed:', err));
    }
  };

  const handleApprove = async () => {
    if (!paperEdit) return;
    await KinetographAPI.approvePipeline({ action: 'approve', paper_edit: paperEdit });
  };

  const applyZoom = useCallback((nextZoomLevel: number, focusClientX?: number) => {
    const clampedZoom = clamp(nextZoomLevel, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    if (clampedZoom === zoomLevel) return;

    const viewport = trackViewportRef.current;
    if (!viewport) {
      setZoomLevel(clampedZoom);
      return;
    }

    const previousPixelsPerSecond = BASE_PIXELS_PER_SECOND * zoomLevel;
    const viewportRect = viewport.getBoundingClientRect();
    const focusX = focusClientX !== undefined ? focusClientX - viewportRect.left : viewport.clientWidth / 2;
    const focusTimeSeconds = (viewport.scrollLeft + focusX) / previousPixelsPerSecond;

    setZoomLevel(clampedZoom);
    requestAnimationFrame(() => {
      const nextPixelsPerSecond = BASE_PIXELS_PER_SECOND * clampedZoom;
      const nextScrollLeft = Math.max(0, focusTimeSeconds * nextPixelsPerSecond - focusX);
      viewport.scrollLeft = nextScrollLeft;
    });
  }, [zoomLevel]);

  const zoomIn = useCallback(() => {
    applyZoom(zoomLevel * 1.25);
  }, [applyZoom, zoomLevel]);

  const zoomOut = useCallback(() => {
    applyZoom(zoomLevel / 1.25);
  }, [applyZoom, zoomLevel]);

  const handleAssetDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('application/x-kinetograph-asset-id')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsAssetDropActive(true);
  };

  const handleAssetDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsAssetDropActive(false);

    const assetId = event.dataTransfer.getData('application/x-kinetograph-asset-id');
    if (!assetId) return;

    const clipId = addAssetToTimeline(assetId);
    if (clipId) {
      setSelectedClip(clipId);
    }
  };

  const handleTrackWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    applyZoom(zoomLevel * zoomFactor, event.clientX);
  };

  useEffect(() => {
    const viewport = trackViewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setTrackViewportWidth(entry?.contentRect.width ?? 0);
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedClipId) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTextInput) return;

      event.preventDefault();
      deleteClip(selectedClipId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteClip, selectedClipId]);

  const sequenceDurationMs = useMemo(() => {
    if (!paperEdit) return 0;
    return paperEdit.clips.reduce((total, clip) => total + (clip.out_ms - clip.in_ms), 0);
  }, [paperEdit]);

  const effectiveDurationMs = Math.max(paperEdit?.total_duration_ms ?? 0, sequenceDurationMs);
  const pxPerSecond = BASE_PIXELS_PER_SECOND * zoomLevel;

  const timelineDurationSeconds = useMemo(() => {
    const durationFromClips = effectiveDurationMs / 1000 + TRAILING_PADDING_SECONDS;
    const durationFromViewport = trackViewportWidth > 0 ? trackViewportWidth / pxPerSecond : 0;
    return Math.max(MIN_TIMELINE_SECONDS, durationFromClips, durationFromViewport);
  }, [effectiveDurationMs, pxPerSecond, trackViewportWidth]);

  const timelineWidthPx = Math.max(trackViewportWidth, Math.ceil(timelineDurationSeconds * pxPerSecond));
  const tickStepSeconds = getTickStepSeconds(pxPerSecond);

  const handleDeleteClip = useCallback((clipId: string) => {
    deleteClip(clipId);
  }, [deleteClip]);

  const removeSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    deleteClip(selectedClipId);
  }, [deleteClip, selectedClipId]);

  const selectedClip = paperEdit?.clips.find(c => c.clip_id === selectedClipId);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 🎬 Sequence Info & Primary Actions */}
      <div className="flex items-end justify-between border-b border-zinc-800 pb-2 h-12">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Sequence Metadata</span>
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">
               {paperEdit?.title || 'Untitled Sequence'}
             </h2>
             {paperEdit && (
               <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500/60 bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded-sm">
                  <span className="opacity-50">DUR:</span>
                  <span className="tabular">{(paperEdit.total_duration_ms / 1000).toFixed(3)}s</span>
               </div>
             )}
          </div>
        </div>
        
        {paperEdit && (
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 items-center gap-1 rounded-sm border border-zinc-800 bg-zinc-900/50 px-1">
              <button
                onClick={zoomOut}
                className="rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                disabled={zoomLevel <= MIN_ZOOM_LEVEL}
                title="Zoom Out Timeline"
              >
                <ZoomOut className="h-3 w-3" />
              </button>
              <span className="text-[10px] font-mono tabular text-zinc-400 px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="rounded-sm p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                disabled={zoomLevel >= MAX_ZOOM_LEVEL}
                title="Zoom In Timeline"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>
            {selectedClipId && (
              <button
                onClick={removeSelectedClip}
                className="flex h-7 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/50 px-3 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors uppercase"
              >
                <Trash2 className="h-3 w-3" />
                Delete Clip
              </button>
            )}
            <button className="flex h-7 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/50 px-3 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors uppercase">
              <Undo2 className="h-3 w-3" />
              Reset
            </button>
            <button 
              onClick={handleApprove}
              className="flex h-7 items-center gap-2 rounded-sm bg-amber-600 px-4 text-[10px] font-black text-black shadow-[0_2px_10px_rgba(217,119,6,0.2)] hover:bg-amber-500 active:scale-[0.98] transition-all uppercase tracking-wider"
            >
              <CheckCircle2 className="h-3 w-3" />
              Commit Sequence
            </button>
          </div>
        )}
      </div>

      {/* 🎬 The Track View */}
      <div
        ref={trackViewportRef}
        onDragOver={handleAssetDragOver}
        onDragEnter={handleAssetDragOver}
        onDragLeave={() => setIsAssetDropActive(false)}
        onDrop={handleAssetDrop}
        onWheel={handleTrackWheel}
        className={cn(
          "relative w-full rounded-sm border p-0 overflow-x-auto custom-scrollbar group/timeline min-h-[160px] transition-colors",
          isAssetDropActive
            ? "border-amber-500/60 bg-amber-500/5"
            : "border-zinc-800 bg-zinc-950/50"
        )}
      >
        <TimeRuler
          timelineWidthPx={timelineWidthPx}
          pxPerSecond={pxPerSecond}
          tickStepSeconds={tickStepSeconds}
        />

        {/* Playhead Marker */}
        <div className="absolute left-[40px] top-0 bottom-0 w-px bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] z-30 pointer-events-none">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-amber-500 rotate-45 -translate-y-1/2 border border-black/20" />
        </div>

        <div className="p-4 pt-6 relative flex flex-col gap-1 min-w-full" style={{ width: `${timelineWidthPx}px` }}>
          {paperEdit ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center gap-[1px] bg-zinc-900/20 p-1 rounded-sm border border-white/5 min-w-full">
                <SortableContext 
                  items={paperEdit.clips.map(c => c.clip_id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {paperEdit.clips.map((clip) => (
                    <TimelineClip
                      key={clip.clip_id}
                      clip={clip}
                      isSelected={selectedClipId === clip.clip_id}
                      pxPerSecond={pxPerSecond}
                      onClick={() => setSelectedClip(clip.clip_id)}
                      onDelete={() => handleDeleteClip(clip.clip_id)}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          ) : (
            <div className="flex h-20 w-full items-center justify-center rounded-sm border border-dashed border-zinc-800 bg-zinc-900/10">
              <div className="flex items-center gap-3 text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest italic">
                  Drag assets here to build a local sequence draft...
                </span>
              </div>
            </div>
          )}
          
          {/* Empty Audio/Video Tracks for "Rigidity" */}
          <div className="h-12 w-full border border-zinc-900/50 bg-zinc-900/10 rounded-sm flex items-center px-4">
             <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">A1 — MASTER AUDIO</span>
          </div>
        </div>
      </div>

      {/* 🎬 Clip Inspector */}
      <AnimatePresence>
        {selectedClipId && selectedClip && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="rounded-sm border border-zinc-800 bg-[#16161a] p-4 shadow-2xl overflow-hidden relative"
          >
            {/* Header / ID */}
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-1.5 rounded-sm">
                  <Play className="h-3 w-3 text-amber-500 fill-current" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-100">
                  Clip Detail: <span className="text-zinc-500 font-mono">{selectedClipId}</span>
                </h3>
              </div>
              <button 
                onClick={() => setSelectedClip(null)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-8">
              <div className="col-span-2 flex flex-col gap-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Narrative Intent</label>
                <textarea 
                  className="bg-black/40 border border-zinc-800 rounded-sm p-2 text-xs text-zinc-300 min-h-[60px] focus:border-amber-500/50 outline-none transition-colors"
                  defaultValue={selectedClip.description}
                />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Transition</label>
                  <div className="flex gap-[1px] bg-zinc-800 p-0.5 rounded-sm overflow-hidden">
                    <button className={cn("flex-1 py-1 text-[9px] font-bold rounded-sm transition-all uppercase", selectedClip.transition === 'cut' ? "bg-zinc-600 text-white" : "hover:bg-zinc-700 text-zinc-500")}>Cut</button>
                    <button className={cn("flex-1 py-1 text-[9px] font-bold rounded-sm transition-all uppercase", selectedClip.transition === 'crossfade' ? "bg-zinc-600 text-white" : "hover:bg-zinc-700 text-zinc-500")}>Cross</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end items-end gap-2">
                <button 
                   onClick={() => deleteClip(selectedClipId)}
                   className="flex items-center gap-2 text-zinc-600 hover:text-red-500 transition-colors text-[10px] font-bold uppercase"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove Clip
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-sm bg-zinc-100 px-4 py-2 text-[10px] font-black text-black hover:bg-white transition-all uppercase tracking-wider">
                  <Save className="h-3 w-3" />
                  Apply Edits
                </button>
              </div>
            </div>

            <div className="absolute top-0 right-0 p-1 opacity-5">
               <AlertCircle className="h-20 w-20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
