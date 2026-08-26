import React from 'react';
import { X, Sparkles, Dices, Terminal, HelpCircle, Eye, ShieldCheck, Zap } from 'lucide-react';
import { GameType } from '../../types.ts';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGame: GameType;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, currentGame }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-indigo-600 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <div className="w-full h-full bg-[#0c0c0c] rounded-[11px] flex items-center justify-center text-cyan-400">
                <HelpCircle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight uppercase">Manual & Hologram Ops</h3>
              <p className="text-[11px] font-mono text-white/40">Interactive 3D Three.js Engine & Controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3D Global Controls */}
        <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-2">
          <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> 3D Camera Controls
          </h4>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/80">
            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
              <span className="font-bold text-white block text-[11px] mb-0.5">Left Click + Drag</span>
              <span className="text-white/40 text-[10px] font-mono">Orbit Camera</span>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
              <span className="font-bold text-white block text-[11px] mb-0.5">Mouse Scroll</span>
              <span className="text-white/40 text-[10px] font-mono">Smooth Zoom</span>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
              <span className="font-bold text-white block text-[11px] mb-0.5">Raycast Click</span>
              <span className="text-white/40 text-[10px] font-mono">Select 3D Objects</span>
            </div>
          </div>
        </div>

        {/* Game Specific Rules */}
        <div className="space-y-4 text-xs text-white/70">
          {currentGame === 'tictactoe' && (
            <div className="space-y-2">
              <h4 className="font-bold text-cyan-400 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 3D Tic-Tac-Toe Rules
              </h4>
              <ul className="space-y-1.5 list-disc list-inside text-white/70 leading-relaxed text-[11px]">
                <li>Click on any empty 3D cell tile on the floating grid to drop your piece.</li>
                <li><strong>Player X (Cyan)</strong>: 3D crossed bars drop with bounce physics.</li>
                <li><strong>Player O (Rose)</strong>: 3D polished torus with spin animation.</li>
                <li>Get 3 matching pieces in a row to fire the animated <strong>3D Neon Laser Beam</strong>.</li>
                <li>Supports <strong>PvP Local</strong> or playing against <strong>Casual & Master AI</strong> (Minimax).</li>
              </ul>
            </div>
          )}

          {currentGame === 'matrix' && (
            <div className="space-y-2">
              <h4 className="font-bold text-emerald-400 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" /> The Matrix (Rain & Memory Grid)
              </h4>
              <ul className="space-y-1.5 list-disc list-inside text-white/70 leading-relaxed text-[11px]">
                <li>Watch the 4x4 matrix cubes flash and rotate in a holographic sequence.</li>
                <li>Listen closely: each of the 16 cubes plays a distinct pentatonic synth tone.</li>
                <li>Repeat the sequence by clicking the exact 3D cubes in order.</li>
                <li>Each level increases the sequence length and tests your memory reflexes.</li>
                <li>Switch themes (Emerald, Cyber Ice, Synth Rose, Solar Amber) in real-time.</li>
              </ul>
            </div>
          )}

          {currentGame === 'ludo' && (
            <div className="space-y-2">
              <h4 className="font-bold text-amber-400 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Dices className="w-3.5 h-3.5" /> 3D Ludo Board Rules
              </h4>
              <ul className="space-y-1.5 list-disc list-inside text-white/70 leading-relaxed text-[11px]">
                <li><strong>Starting:</strong> Roll a <strong>6</strong> to release a pawn from your base yard to the start tile.</li>
                <li><strong>Hopping:</strong> Pawns jump in parabolic 3D arcs step-by-step along the 52 perimeter tiles.</li>
                <li><strong>Capturing:</strong> Land on an opponent on any non-safe tile to capture them and send them back to base!</li>
                <li><strong>Safe Spots:</strong> Tiles with Star markers are protected safe zones.</li>
                <li><strong>Bonus Turns:</strong> Rolling a 6, capturing an opponent, or reaching home grants an extra roll.</li>
                <li>Supports 2, 3, or 4 players with configurable Human and AI bot toggles.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white text-black font-bold text-xs tracking-[0.15em] uppercase rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            Got It! Return to Game
          </button>
        </div>
      </div>
    </div>
  );
};
