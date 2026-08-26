import React from 'react';
import { 
  Sparkles, 
  Terminal, 
  Dices, 
  Volume2, 
  VolumeX, 
  HelpCircle
} from 'lucide-react';
import { GameType } from '../types.ts';
import { sound } from '../utils/audio.ts';

interface NavbarProps {
  activeGame: GameType;
  onSelectGame: (game: GameType) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenHelp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeGame,
  onSelectGame,
  isMuted,
  onToggleMute,
  onOpenHelp
}) => {
  const tabs: { id: GameType; label: string; icon: React.ReactNode; activeBorder: string; activeGlow: string }[] = [
    {
      id: 'tictactoe',
      label: '3D TIC-TAC-TOE',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      activeBorder: 'border-cyan-500/50 bg-cyan-500/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)]',
      activeGlow: 'text-cyan-400'
    },
    {
      id: 'matrix',
      label: 'MATRIX RAIN',
      icon: <Terminal className="w-3.5 h-3.5" />,
      activeBorder: 'border-emerald-500/50 bg-emerald-500/10 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]',
      activeGlow: 'text-emerald-400'
    },
    {
      id: 'ludo',
      label: '3D LUDO',
      icon: <Dices className="w-3.5 h-3.5" />,
      activeBorder: 'border-amber-500/50 bg-amber-500/10 text-white shadow-[0_0_15px_rgba(245,158,11,0.35)]',
      activeGlow: 'text-amber-400'
    }
  ];

  return (
    <nav className="h-16 border-b border-white/10 bg-black/60 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 z-30 sticky top-0">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 via-emerald-500 to-indigo-600 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center flex-shrink-0">
          <div className="w-2.5 h-2.5 bg-white rounded-sm shadow-[0_0_6px_#fff]"></div>
        </div>
        <div className="flex flex-col hidden sm:flex">
          <span className="text-white font-bold tracking-tight text-sm sm:text-base uppercase">
            PolySphere <span className="text-cyan-400 font-extrabold">Studio</span>
          </span>
          <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase hidden md:inline">
            3D WebGL Game Suite
          </span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
        {tabs.map(t => {
          const isActive = activeGame === t.id;
          return (
            <button
              key={t.id}
              id={`nav-tab-${t.id}`}
              onClick={() => {
                sound.playClickSound();
                onSelectGame(t.id);
              }}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-semibold tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 border flex-shrink-0 cursor-pointer ${
                isActive
                  ? `${t.activeBorder}`
                  : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Controls & System Status */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Audio Mute Toggle */}
        <button
          id="audio-toggle-btn"
          onClick={onToggleMute}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
            isMuted
              ? 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
              : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
          }`}
          title={isMuted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Rules & Help Modal */}
        <button
          id="help-modal-trigger-btn"
          onClick={onOpenHelp}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center cursor-pointer"
          title="Game Rules & AI Studio Guide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};

