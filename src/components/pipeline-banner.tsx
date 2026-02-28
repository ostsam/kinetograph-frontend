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
    <div className="flex h-9 w-full items-center justify-between border-b border-zinc-800 bg-[#121215] px-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-4 w-4 items-center justify-center">
            <Zap className={cn(
              "h-3 w-3 z-10",
              currentPhase === Phase.IDLE ? "text-zinc-600" : "text-amber-500 fill-amber-500/20"
            )} />
            {currentPhase !== Phase.IDLE && currentPhase !== Phase.COMPLETE && (
              <div className="absolute inset-0 animate-pulse bg-amber-500/20 rounded-full" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-zinc-100 uppercase tracking-tight">
              {currentAgent || 'System Idle'}
            </span>
            <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest">
              — {currentPhase.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          {PHASES.map((p) => {
            const isActive = currentPhase === p;
            const isDone = PHASES.indexOf(currentPhase) > PHASES.indexOf(p);
            
            return (
              <div
                key={p}
                className={cn(
                  "h-1 w-4 rounded-[1px] transition-all duration-500",
                  isActive ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : 
                  isDone ? "bg-zinc-700" : "bg-zinc-800"
                )}
                title={p}
              />
            );
          })}
        </div>
      </div>

      {currentPhase === Phase.AWAITING_APPROVAL && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 bg-amber-600/10 border border-amber-600/20 px-2 py-0.5 rounded-sm text-amber-500 font-bold text-[9px] uppercase tracking-wider"
        >
          <AlertCircle className="h-3 w-3" />
          Approval Required
        </motion.div>
      )}
    </div>
  );
}
