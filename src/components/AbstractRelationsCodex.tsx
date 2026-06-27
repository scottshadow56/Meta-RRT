import React from 'react';
import { AbstractRelationMapping, DimensionCount } from '../types';
import { RefreshCw, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

interface AbstractRelationsCodexProps {
  dimension: DimensionCount;
  mapping: AbstractRelationMapping;
  onRegenerate: () => void;
}

export default function AbstractRelationsCodex({
  dimension,
  mapping,
  onRegenerate
}: AbstractRelationsCodexProps) {
  return (
    <div className="bg-theme-card border-2 border-amber-600/50 p-5 shadow-md rounded-none mb-6 animate-fadeIn text-xs">
      <div className="flex items-center justify-between border-b border-amber-600/35 pb-2.5 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <h3 className="font-mono font-bold text-theme-text text-sm uppercase tracking-wider">
            Abstract Relations Codex
          </h3>
        </div>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600 text-amber-300 font-mono text-[9px] font-bold uppercase transition-all rounded-none cursor-pointer select-none"
          title="Regenerate random nonsense words"
        >
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
          Rotate Labels
        </button>
      </div>

      <p className="text-[11px] text-theme-text/80 mb-3.5 leading-relaxed font-sans">
        Every standard direction label is translated into a random 3-letter nonsense word for this round.
        Below is the active <strong>{dimension}D Axis Map</strong>:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 font-mono">
        {/* Axis 0 */}
        <div className="p-2.5 bg-theme-bg/60 border border-theme-comp/35 flex flex-col justify-between">
          <span className="text-[8px] text-theme-text/50 uppercase font-black tracking-widest block mb-1">
            Axis 0 (Vertical)
          </span>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="font-extrabold text-theme-text">{mapping['0_pos']}</span>
            <span className="text-[10px] text-theme-text/60 font-serif italic">is opposite of</span>
            <span className="font-extrabold text-theme-text">{mapping['0_neg']}</span>
          </div>
          <span className="text-[8px] text-theme-text/40 block text-right mt-1">
            (Equivalent to North ⟷ South)
          </span>
        </div>

        {/* Axis 1 */}
        <div className="p-2.5 bg-theme-bg/60 border border-theme-comp/35 flex flex-col justify-between">
          <span className="text-[8px] text-theme-text/50 uppercase font-black tracking-widest block mb-1">
            Axis 1 (Horizontal)
          </span>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="font-extrabold text-theme-text">{mapping['1_pos']}</span>
            <span className="text-[10px] text-theme-text/60 font-serif italic">is opposite of</span>
            <span className="font-extrabold text-theme-text">{mapping['1_neg']}</span>
          </div>
          <span className="text-[8px] text-theme-text/40 block text-right mt-1">
            (Equivalent to East ⟷ West)
          </span>
        </div>

        {/* Axis 2 (3D/4D) */}
        {dimension >= 3 && (
          <div className="p-2.5 bg-theme-bg/60 border border-theme-comp/35 flex flex-col justify-between">
            <span className="text-[8px] text-theme-text/50 uppercase font-black tracking-widest block mb-1">
              Axis 2 (Depth)
            </span>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="font-extrabold text-theme-text">{mapping['2_pos']}</span>
              <span className="text-[10px] text-theme-text/60 font-serif italic">is opposite of</span>
              <span className="font-extrabold text-theme-text">{mapping['2_neg']}</span>
            </div>
            <span className="text-[8px] text-theme-text/40 block text-right mt-1">
              (Equivalent to Above ⟷ Below)
            </span>
          </div>
        )}

        {/* Axis 3 (4D) */}
        {dimension >= 4 && (
          <div className="p-2.5 bg-theme-bg/60 border border-theme-comp/35 flex flex-col justify-between">
            <span className="text-[8px] text-theme-text/50 uppercase font-black tracking-widest block mb-1">
              Axis 3 (Hyper-Depth)
            </span>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="font-extrabold text-theme-text">{mapping['3_pos']}</span>
              <span className="text-[10px] text-theme-text/60 font-serif italic">is opposite of</span>
              <span className="font-extrabold text-theme-text">{mapping['3_neg']}</span>
            </div>
            <span className="text-[8px] text-theme-text/40 block text-right mt-1">
              (Equivalent to After ⟷ Before)
            </span>
          </div>
        )}
      </div>

      <div className="bg-theme-bg/30 p-2.5 border border-amber-600/20 rounded-none flex gap-2 items-start">
        <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-mono font-bold uppercase text-[9px] text-theme-text tracking-wider block mb-0.5">Composite Relations</span>
          <p className="text-[10px] text-theme-text/80 font-sans">
            Multi-dimensional paths combine these primitives inside brackets. For instance,{' '}
            <code className="bg-theme-bg px-1 py-0.5 font-bold text-amber-300">[{mapping['0_pos']}-{mapping['1_pos']}]</code> represents the composite diagonal vector (Northeast).
          </p>
        </div>
      </div>
    </div>
  );
}
