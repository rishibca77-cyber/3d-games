import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameType } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { TicTacToe3D } from './components/TicTacToe/TicTacToe3D.tsx';
import { MatrixGame3D } from './components/Matrix/MatrixGame3D.tsx';
import { LudoGame3D } from './components/Ludo/LudoGame3D.tsx';
import { HelpModal } from './components/Common/HelpModal.tsx';
import { ParticleBackground } from './components/Common/ParticleBackground.tsx';
import { sound } from './utils/audio.ts';

export default function App() {
  const [activeGame, setActiveGame] = useState<GameType>('tictactoe');
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  const handleToggleMute = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  return (
    <div className="w-full h-screen bg-[#050505] text-slate-200 flex flex-col font-sans overflow-hidden">
      {/* Top HUD Navigation Bar */}
      <Navbar
        activeGame={activeGame}
        onSelectGame={setActiveGame}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main 3D Canvas / AI Studio Area with Elegant Dark Background */}
      <main className="flex-1 w-full h-[calc(100vh-4rem)] relative overflow-hidden bg-[#050505] bg-[radial-gradient(circle_at_center,_#111111_0%,_#050505_100%)]">
        {/* Dynamic 3D Three.js Audio-Reactive & Interactive Particle Field */}
        <ParticleBackground />

        {/* Subtle dot matrix grid overlay from theme */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none z-0" 
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '36px 36px'
          }}
        />

        <AnimatePresence mode="wait">
          {activeGame === 'tictactoe' && (
            <motion.div
              key="tictactoe"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full h-full relative z-10"
            >
              <TicTacToe3D />
            </motion.div>
          )}

          {activeGame === 'matrix' && (
            <motion.div
              key="matrix"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full h-full relative z-10"
            >
              <MatrixGame3D />
            </motion.div>
          )}

          {activeGame === 'ludo' && (
            <motion.div
              key="ludo"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full h-full relative z-10"
            >
              <LudoGame3D />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Rules & 3D Controls Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        currentGame={activeGame}
      />
    </div>
  );
}

