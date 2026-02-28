'use client';

import { useKinetographStore } from '@/store/use-kinetograph-store';
import { AgentMap, Phase } from '@/types/kinetograph';
import { motion } from 'framer-motion';
import { AlertCircle, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PHASES = [
  Phase.INGESTING,
  Phase.SCRIPTING,
  Phase.AWAITING_APPROVAL,
  Phase.SYNTHESIZING,
  Phase.RENDERING,
  Phase.MASTERING,
  Phase.COMPLETE,
];

export function PipelineBanner() {
  const currentPhase = useKinetographStore((s) => s.phase);
  const currentAgent = AgentMap[currentPhase];

  return (
    <div className="flex h-12 w-full items-center justify-between border-b border-zinc-800 bg-[#16161a] px-4 shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className={cn(
              "h-3.5 w-3.5",
              currentPhase === Phase.IDLE ? "text-zinc-700" : "text-amber-500 fill-amber-500/20"
            )} />
            {currentPhase !== Phase.IDLE && currentPhase !== Phase.COMPLETE && (
              <div className="absolute inset-0 h-3.5 w-3.5 animate-ping bg-amber-500/40 rounded-full" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 leading-none mb-1">Active Swarm Node</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-200">
              {currentAgent || 'SYSTEM IDLE'}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-zinc-800" />

        <div className="flex items-center gap-2">
           <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">Status:</span>
           <span className={cn(
             "text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border tabular",
             currentPhase === Phase.ERROR ? "bg-red-500/10 border-red-500/20 text-red-500" :
             currentPhase === Phase.COMPLETE ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
             "bg-amber-500/5 border-amber-500/10 text-amber-500/80"
           )}>
             {currentPhase.replace('_', ' ')}…
           </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-sm border border-white/5">
        {PHASES.map((p, idx) => {
          const isActive = currentPhase === p;
          const isDone = PHASES.indexOf(currentPhase) > PHASES.indexOf(p);
          
          return (
            <div key={p} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-1.5 w-8 transition-all duration-500 rounded-[1px]",
                  isActive ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : 
                  isDone ? "bg-zinc-700" : "bg-zinc-900"
                )}
                title={p}
              />
              {idx < PHASES.length - 1 && (
                <div className="h-0.5 w-1 bg-zinc-800" />
              )}
            </div>
          );
        })}
      </div>

      {currentPhase === Phase.AWAITING_APPROVAL && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 bg-amber-600 px-3 h-12 -mr-4 text-black font-black text-[10px] uppercase tracking-tighter"
        >
          <AlertCircle className="h-3.5 w-3.5 fill-current" />
          Human Approval Required
        </motion.div>
      )}
    </div>
  );
}
