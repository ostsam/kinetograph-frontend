import { create } from 'zustand';
import { 
  Phase, 
  RawAsset, 
  PaperEdit, 
  PipelineStatus, 
  PipelineError,
  PaperEditClip
} from '@/types/kinetograph';

interface KinetographState {
  // Core State
  phase: Phase;
  assets: RawAsset[];
  paperEdit: PaperEdit | null;
  pipelineStatus: PipelineStatus | null;
  errors: PipelineError[];
  
  // UI State
  selectedClipId: string | null;
  playheadMs: number;
  
  // Actions
  setPhase: (phase: Phase) => void;
  setAssets: (assets: RawAsset[]) => void;
  setPaperEdit: (paperEdit: PaperEdit | null) => void;
  setPipelineStatus: (status: PipelineStatus | null) => void;
  addError: (error: PipelineError) => void;
  clearErrors: () => void;
  
  // Timeline Actions (Optimistic)
  updateClip: (clipId: string, updates: Partial<PaperEditClip>) => void;
  reorderClips: (clipIds: string[]) => void;
  deleteClip: (clipId: string) => void;
  
  // Player Actions
  setPlayhead: (ms: number) => void;
  setSelectedClip: (clipId: string | null) => void;
}

export const useKinetographStore = create<KinetographState>((set) => ({
  phase: Phase.IDLE,
  assets: [],
  paperEdit: null,
  pipelineStatus: null,
  errors: [],
  selectedClipId: null,
  playheadMs: 0,

  setPhase: (phase) => set({ phase }),
  setAssets: (assets) => set({ assets }),
  setPaperEdit: (paperEdit) => set({ paperEdit }),
  setPipelineStatus: (status) => set({ pipelineStatus: status, phase: status?.phase ?? Phase.IDLE }),
  addError: (error) => set((state) => ({ errors: [...state.errors, error] })),
  clearErrors: () => set({ errors: [] }),

  updateClip: (clipId, updates) => set((state) => {
    if (!state.paperEdit) return state;
    const newClips = state.paperEdit.clips.map((clip) => 
      clip.clip_id === clipId ? { ...clip, ...updates } : clip
    );
    return { 
      paperEdit: { ...state.paperEdit, clips: newClips }
    };
  }),

  reorderClips: (clipIds) => set((state) => {
    if (!state.paperEdit) return state;
    const clipMap = new Map(state.paperEdit.clips.map(c => [c.clip_id, c]));
    const newClips = clipIds.map(id => clipMap.get(id)).filter((c): c is PaperEditClip => !!c);
    return {
      paperEdit: { ...state.paperEdit, clips: newClips }
    };
  }),

  deleteClip: (clipId) => set((state) => {
    if (!state.paperEdit) return state;
    const newClips = state.paperEdit.clips.filter(c => c.clip_id !== clipId);
    return {
      paperEdit: { ...state.paperEdit, clips: newClips }
    };
  }),

  setPlayhead: (ms) => set({ playheadMs: ms }),
  setSelectedClip: (clipId) => set({ selectedClipId: clipId }),
}));
