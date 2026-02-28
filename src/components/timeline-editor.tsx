'use client';

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
import { CheckCircle2, AlertCircle, Play, Save, Trash2, Undo2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function TimelineEditor() {
  const paperEdit = useKinetographStore((s) => s.paperEdit);
  const reorderClips = useKinetographStore((s) => s.reorderClips);
  const selectedClipId = useKinetographStore((s) => s.selectedClipId);
  const setSelectedClip = useKinetographStore((s) => s.setSelectedClip);
  const deleteClip = useKinetographStore((s) => s.deleteClip);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!paperEdit) return null;

  const handleDragEnd = (event: DragEndEvent) => {
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
    await KinetographAPI.approvePipeline({ action: 'approve', paper_edit: paperEdit });
  };

  const selectedClip = paperEdit.clips.find(c => c.clip_id === selectedClipId);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 🎬 Sequence Info & Primary Actions */}
      <div className="flex items-end justify-between border-b border-zinc-800 pb-2">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Sequence Metadata</span>
          <div className="flex items-center gap-4">
             <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">{paperEdit.title}</h2>
             <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500/60 bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded-sm">
                <span className="opacity-50">DUR:</span>
                <span className="tabular">{(paperEdit.total_duration_ms / 1000).toFixed(3)}s</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
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
      </div>

      {/* 🎬 The Track View */}
      <div className="relative w-full rounded-sm border border-zinc-800 bg-zinc-950/50 p-0 overflow-x-auto custom-scrollbar group/timeline">
        {/* Time Ruler */}
        <div className="flex h-6 items-center border-b border-zinc-800 bg-zinc-900/30 px-2 min-w-max">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex flex-col items-start w-[100px] shrink-0 border-l border-zinc-800/50 pl-1">
              <span className="text-[8px] font-mono tabular text-zinc-600">00:0{Math.floor(i/2)}:{i%2 === 0 ? '00' : '15'}:00</span>
            </div>
          ))}
        </div>

        {/* Playhead Marker */}
        <div className="absolute left-[40px] top-0 bottom-0 w-px bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] z-30 pointer-events-none">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-amber-500 rotate-45 -translate-y-1/2 border border-black/20" />
        </div>

        <div className="p-4 pt-6 min-w-max relative">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-center gap-[1px] min-w-max bg-zinc-900/20 p-1 rounded-sm border border-white/5">
              <SortableContext 
                items={paperEdit.clips.map(c => c.clip_id)}
                strategy={horizontalListSortingStrategy}
              >
                {paperEdit.clips.map((clip) => (
                  <TimelineClip
                    key={clip.clip_id}
                    clip={clip}
                    isSelected={selectedClipId === clip.clip_id}
                    onClick={() => setSelectedClip(clip.clip_id)}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </div>

      {/* 🎬 Clip Inspector (The "Human" Control Board) */}
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

            {/* Hardware Branding Touch */}
            <div className="absolute top-0 right-0 p-1 opacity-5">
               <AlertCircle className="h-20 w-20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
