import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { 
  Play, 
  RotateCcw, 
  User, 
  Bot, 
  Trophy, 
  Dices, 
  Eye, 
  Sparkles, 
  Shield, 
  HelpCircle,
  Users,
  ChevronRight
} from 'lucide-react';
import { LudoColor, LudoPlayer, LudoToken, LudoGameState, PlayerType } from '../../types.ts';
import { 
  COLOR_PROPERTIES, 
  COLOR_START_INDEX, 
  SAFE_TRACK_INDICES, 
  TRACK_GRID_COORDS, 
  HOME_COLUMNS, 
  BASE_SLOT_POSITIONS, 
  getTokenWorldPosition,
  gridToWorld,
  TILE_SIZE 
} from './ludoConstants.ts';
import { sound } from '../../utils/audio.ts';

const ALL_COLORS: LudoColor[] = ['red', 'blue', 'yellow', 'green'];

// Dice face rotations (Euler angles to face number up on Top (+Y))
const DICE_ROTATIONS: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 0, y: 0, z: 0 },
  6: { x: Math.PI, y: 0, z: 0 },
  2: { x: -Math.PI / 2, y: 0, z: 0 },
  5: { x: Math.PI / 2, y: 0, z: 0 },
  3: { x: 0, y: 0, z: Math.PI / 2 },
  4: { x: 0, y: 0, z: -Math.PI / 2 }
};

export const LudoGame3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Ludo State
  const [gameState, setGameState] = useState<LudoGameState>(() => {
    const initialPlayers: Record<LudoColor, LudoPlayer> = {
      red: {
        id: 'red',
        name: 'Crimson Red',
        color: 'red',
        hex: COLOR_PROPERTIES.red.hex,
        type: 'human',
        tokens: [0, 1, 2, 3].map(id => ({
          id,
          color: 'red',
          step: -1,
          position: { x: 0, y: 0, z: 0 },
          isHome: false,
          isBase: true
        })),
        hasWon: false
      },
      blue: {
        id: 'blue',
        name: 'Azure Blue',
        color: 'blue',
        hex: COLOR_PROPERTIES.blue.hex,
        type: 'ai',
        tokens: [0, 1, 2, 3].map(id => ({
          id,
          color: 'blue',
          step: -1,
          position: { x: 0, y: 0, z: 0 },
          isHome: false,
          isBase: true
        })),
        hasWon: false
      },
      yellow: {
        id: 'yellow',
        name: 'Amber Gold',
        color: 'yellow',
        hex: COLOR_PROPERTIES.yellow.hex,
        type: 'ai',
        tokens: [0, 1, 2, 3].map(id => ({
          id,
          color: 'yellow',
          step: -1,
          position: { x: 0, y: 0, z: 0 },
          isHome: false,
          isBase: true
        })),
        hasWon: false
      },
      green: {
        id: 'green',
        name: 'Emerald Green',
        color: 'green',
        hex: COLOR_PROPERTIES.green.hex,
        type: 'ai',
        tokens: [0, 1, 2, 3].map(id => ({
          id,
          color: 'green',
          step: -1,
          position: { x: 0, y: 0, z: 0 },
          isHome: false,
          isBase: true
        })),
        hasWon: false
      }
    };

    return {
      players: initialPlayers,
      activeColorOrder: ['red', 'blue', 'yellow', 'green'],
      currentTurnIndex: 0,
      diceValue: null,
      isRolling: false,
      hasRolled: false,
      movableTokenIds: [],
      consecutiveSixes: 0,
      winners: [],
      gameStatus: 'playing',
      selectedPlayerCount: 4,
      lastMessage: "Welcome to 3D Ludo! Click 'Roll Dice' to start.",
      isAiMoving: false
    };
  });

  const gameStateRef = useRef<LudoGameState>(gameState);
  gameStateRef.current = gameState;

  // Three.js Scene References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // 3D Mesh caches
  const tokenMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const diceMeshRef = useRef<THREE.Group | null>(null);
  const haloIndicatorsRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Orbit controls state
  const isDraggingRef = useRef(false);
  const previousMousePosRef = useRef({ x: 0, y: 0 });
  const cameraOrbitRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.4, radius: 18.5 });

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraOrbitRef.current;
    cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

  const resetCamera = () => {
    gsap.to(cameraOrbitRef.current, {
      theta: Math.PI / 4,
      phi: Math.PI / 3.4,
      radius: 18.5,
      duration: 1,
      ease: 'power2.out',
      onUpdate: updateCamera
    });
  };

  const topViewCamera = () => {
    gsap.to(cameraOrbitRef.current, {
      theta: 0,
      phi: 0.05,
      radius: 16.5,
      duration: 1,
      ease: 'power2.out',
      onUpdate: updateCamera
    });
  };

  // Check which tokens are valid to move with current dice roll
  const getMovableTokens = (color: LudoColor, dice: number, players: Record<LudoColor, LudoPlayer>): number[] => {
    const tokens = players[color].tokens;
    const movable: number[] = [];

    tokens.forEach(tok => {
      if (tok.isHome) return; // Already finished

      if (tok.step === -1) {
        // In base yard: can only move if dice is 6
        if (dice === 6) movable.push(tok.id);
      } else {
        // On board: can move if step + dice <= 56
        if (tok.step + dice <= 56) {
          movable.push(tok.id);
        }
      }
    });

    return movable;
  };

  // Perform Parabolic Hop Animation across tiles with dynamic lean, squash & stretch
  const animateTokenMove = (
    color: LudoColor,
    tokenId: number,
    startStep: number,
    targetStep: number,
    onFinish: () => void
  ) => {
    const key = `${color}-${tokenId}`;
    const tokenGroup = tokenMeshesRef.current.get(key);
    if (!tokenGroup) {
      onFinish();
      return;
    }

    // Kill any active idle bobs or tweens
    gsap.killTweensOf(tokenGroup.position);
    gsap.killTweensOf(tokenGroup.rotation);
    gsap.killTweensOf(tokenGroup.scale);

    // If released from base (step -1 -> 0)
    if (startStep === -1) {
      const [endX, endY, endZ] = getTokenWorldPosition(color, tokenId, 0);
      sound.playPawnSpawnSound();

      // Launch out of base yard in a high graceful parabolic leap
      gsap.to(tokenGroup.position, {
        x: endX,
        z: endZ,
        duration: 0.42,
        ease: 'power2.out'
      });

      gsap.to(tokenGroup.rotation, {
        y: tokenGroup.rotation.y + Math.PI * 2,
        duration: 0.42,
        ease: 'power1.out'
      });

      // Jump apex & landing
      gsap.to(tokenGroup.position, {
        y: endY + 1.3,
        duration: 0.21,
        yoyo: true,
        repeat: 1,
        ease: 'sine.out',
        onComplete: () => {
          tokenGroup.position.set(endX, endY, endZ);
          // Touchdown squash and recovery
          gsap.to(tokenGroup.scale, {
            x: 1.16,
            z: 1.16,
            y: 0.82,
            duration: 0.08,
            yoyo: true,
            repeat: 1,
            ease: 'sine.out',
            onComplete: () => {
              tokenGroup.scale.set(1, 1, 1);
              tokenGroup.rotation.set(0, 0, 0);
              onFinish();
            }
          });
        }
      });
      return;
    }

    // Step-by-step parabolic hops along the board track / home column
    const stepsCount = targetStep - startStep;
    let currentStep = startStep;
    let hopIndex = 0;

    const hopNext = (remaining: number) => {
      if (remaining <= 0) {
        if (targetStep === 56) {
          sound.playPawnHomeSound();
          // Victory 360 spin
          gsap.to(tokenGroup.rotation, {
            y: tokenGroup.rotation.y + Math.PI * 4,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => {
              tokenGroup.rotation.set(0, 0, 0);
              onFinish();
            }
          });
        } else {
          onFinish();
        }
        return;
      }

      currentStep += 1;
      hopIndex += 1;
      const fromX = tokenGroup.position.x;
      const fromY = tokenGroup.position.y;
      const fromZ = tokenGroup.position.z;
      const [nextX, nextY, nextZ] = getTokenWorldPosition(color, tokenId, currentStep);

      const dx = nextX - fromX;
      const dz = nextZ - fromZ;

      sound.playPawnHopSound(hopIndex);

      // Forward lean / bank in jump direction
      const tiltX = Math.max(-0.25, Math.min(0.25, -dz * 0.4));
      const tiltZ = Math.max(-0.25, Math.min(0.25, dx * 0.4));

      gsap.to(tokenGroup.rotation, {
        x: tiltX,
        z: tiltZ,
        duration: 0.07,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut'
      });

      // Horizontal linear transition
      gsap.to(tokenGroup.position, {
        x: nextX,
        z: nextZ,
        duration: 0.16,
        ease: 'linear'
      });

      // Vertical parabolic hop curve
      const peakY = Math.max(fromY, nextY) + 0.85;
      gsap.to(tokenGroup.position, {
        y: peakY,
        duration: 0.08,
        ease: 'power1.out',
        onComplete: () => {
          gsap.to(tokenGroup.position, {
            y: nextY,
            duration: 0.08,
            ease: 'power1.in',
            onComplete: () => {
              // Landing tap and slight squash
              tokenGroup.position.set(nextX, nextY, nextZ);
              gsap.to(tokenGroup.scale, {
                x: 1.12,
                z: 1.12,
                y: 0.88,
                duration: 0.04,
                yoyo: true,
                repeat: 1,
                ease: 'sine.out',
                onComplete: () => {
                  tokenGroup.scale.set(1, 1, 1);
                  tokenGroup.rotation.set(0, 0, 0);
                  hopNext(remaining - 1);
                }
              });
            }
          });
        }
      });
    };

    hopNext(stepsCount);
  };

  // Move Token Logic (Captures, Home, Extra turns)
  const executeTokenMove = (color: LudoColor, tokenId: number) => {
    const current = gameStateRef.current;
    const dice = current.diceValue;
    if (dice === null || !current.hasRolled || current.isAiMoving) return;

    const player = current.players[color];
    const token = player.tokens[tokenId];
    const oldStep = token.step;
    const newStep = oldStep === -1 ? 0 : oldStep + dice;

    // Set AI moving lock if active
    if (player.type === 'ai') {
      setGameState(prev => ({ ...prev, isAiMoving: true }));
    }

    animateTokenMove(color, tokenId, oldStep, newStep, () => {
      const latest = gameStateRef.current;
      // 1. Update token state
      const updatedPlayers: Record<LudoColor, LudoPlayer> = {
        ...latest.players,
        [color]: {
          ...latest.players[color],
          tokens: latest.players[color].tokens.map((t, idx) => {
            if (idx === tokenId) {
              return {
                ...t,
                step: newStep,
                isBase: newStep === -1,
                isHome: newStep === 56
              };
            }
            return t;
          })
        }
      };

      let gotExtraTurn = dice === 6;
      let captureOccurred = false;

      // 2. Check for captures on standard track (step 0..50)
      if (newStep >= 0 && newStep <= 50) {
        const myStart = COLOR_START_INDEX[color];
        const myTrackIndex = (myStart + newStep) % 52;
        const isSafeSpot = SAFE_TRACK_INDICES.includes(myTrackIndex);

        if (!isSafeSpot) {
          // Check other players' tokens
          latest.activeColorOrder.forEach(otherColor => {
            if (otherColor === color) return;
            const otherTokens = [...updatedPlayers[otherColor].tokens];
            let tokenCaptured = false;

            otherTokens.forEach((otherTok, oIdx) => {
              if (otherTok.step >= 0 && otherTok.step <= 50) {
                const otherStart = COLOR_START_INDEX[otherColor];
                const otherTrackIdx = (otherStart + otherTok.step) % 52;

                if (otherTrackIdx === myTrackIndex) {
                  // CAPTURE!
                  captureOccurred = true;
                  gotExtraTurn = true;
                  tokenCaptured = true;
                  sound.playCaptureSound();

                  otherTokens[oIdx] = {
                    ...otherTok,
                    step: -1,
                    isBase: true
                  };

                  // Animate captured token back to base with high parabolic spin
                  const [baseX, baseY, baseZ] = BASE_SLOT_POSITIONS[otherColor][otherTok.id];
                  const enemyMesh = tokenMeshesRef.current.get(`${otherColor}-${otherTok.id}`);
                  if (enemyMesh) {
                    gsap.killTweensOf(enemyMesh.position);
                    gsap.killTweensOf(enemyMesh.rotation);
                    gsap.killTweensOf(enemyMesh.scale);

                    gsap.to(enemyMesh.position, {
                      x: baseX,
                      z: baseZ,
                      duration: 0.55,
                      ease: 'power2.inOut'
                    });

                    gsap.to(enemyMesh.rotation, {
                      y: enemyMesh.rotation.y + Math.PI * 4,
                      duration: 0.55,
                      ease: 'power1.out'
                    });

                    gsap.to(enemyMesh.position, {
                      y: baseY + 3.0,
                      duration: 0.27,
                      yoyo: true,
                      repeat: 1,
                      ease: 'sine.out',
                      onComplete: () => {
                        enemyMesh.position.set(baseX, baseY, baseZ);
                        enemyMesh.rotation.set(0, 0, 0);
                        gsap.to(enemyMesh.scale, {
                          x: 1.2,
                          z: 1.2,
                          y: 0.8,
                          duration: 0.08,
                          yoyo: true,
                          repeat: 1,
                          ease: 'back.out(2)'
                        });
                      }
                    });
                  }
                }
              }
            });

            if (tokenCaptured) {
              updatedPlayers[otherColor] = {
                ...updatedPlayers[otherColor],
                tokens: otherTokens
              };
            }
          });
        }
      }

      // 3. Check if Token reached Home Center (step 56)
      if (newStep === 56) {
        gotExtraTurn = true;
        sound.playWinSound();
        confetti({ particleCount: 40, spread: 60 });
      }

      // 4. Check if Player won the entire game (all 4 tokens home)
      const allHome = updatedPlayers[color].tokens.every(t => t.step === 56);
      let updatedWinners = [...latest.winners];

      if (allHome && !updatedPlayers[color].hasWon) {
        updatedPlayers[color] = {
          ...updatedPlayers[color],
          hasWon: true,
          rank: updatedWinners.length + 1
        };
        updatedWinners.push(color);
        confetti({ particleCount: 120, spread: 90 });
      }

      // 5. Advance turn or grant extra turn
      let nextTurnIndex = latest.currentTurnIndex;
      if (!gotExtraTurn) {
        let attempts = 0;
        do {
          nextTurnIndex = (nextTurnIndex + 1) % latest.activeColorOrder.length;
          attempts++;
        } while (
          updatedPlayers[latest.activeColorOrder[nextTurnIndex]].hasWon &&
          attempts < latest.activeColorOrder.length
        );
      }

      const nextColor = latest.activeColorOrder[nextTurnIndex];
      const nextPlayer = updatedPlayers[nextColor];

      let msg = '';
      if (captureOccurred) {
        msg = `💥 ${player.name} captured an opponent! Bonus roll awarded!`;
      } else if (newStep === 56) {
        msg = `⭐ ${player.name} moved a token into Home! Bonus roll!`;
      } else if (gotExtraTurn) {
        msg = `🎲 Rolled a 6! ${player.name} gets another roll!`;
      } else {
        msg = `${nextPlayer.name}'s turn to roll.`;
      }

      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTurnIndex: nextTurnIndex,
        diceValue: null,
        hasRolled: false,
        movableTokenIds: [],
        winners: updatedWinners,
        lastMessage: msg,
        isAiMoving: false,
        isRolling: false
      }));

      // Trigger AI turn if next player is AI
      if (nextPlayer.type === 'ai' && !nextPlayer.hasWon) {
        setTimeout(() => {
          triggerAiTurn(nextColor, updatedPlayers, nextTurnIndex);
        }, 600);
      }
    });
  };

  // Roll 3D Dice with realistic tumbling rotation & bounce
  const rollDice = () => {
    const current = gameStateRef.current;
    if (current.hasRolled || current.isRolling || current.isAiMoving) return;

    sound.playDiceRollSound();
    const rolledNumber = Math.floor(Math.random() * 6) + 1;
    const currentColor = current.activeColorOrder[current.currentTurnIndex];

    setGameState(prev => ({
      ...prev,
      isRolling: true,
      diceValue: rolledNumber
    }));

    // Animate 3D Dice Tumbling
    if (diceMeshRef.current) {
      const dice = diceMeshRef.current;
      const targetRot = DICE_ROTATIONS[rolledNumber];

      // Jump in air
      gsap.to(dice.position, {
        y: 2.4,
        duration: 0.25,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });

      // Wild rotational spin + settle exactly on rolled face
      const spinExtraX = (Math.floor(Math.random() * 3) + 2) * Math.PI * 2;
      const spinExtraY = (Math.floor(Math.random() * 3) + 2) * Math.PI * 2;
      const spinExtraZ = (Math.floor(Math.random() * 3) + 2) * Math.PI * 2;

      gsap.to(dice.rotation, {
        x: targetRot.x + spinExtraX,
        y: targetRot.y + spinExtraY,
        z: targetRot.z + spinExtraZ,
        duration: 0.6,
        ease: 'power3.out',
        onComplete: () => {
          dice.rotation.set(targetRot.x, targetRot.y, targetRot.z);

          const latest = gameStateRef.current;
          // Find movable tokens
          const movable = getMovableTokens(currentColor, rolledNumber, latest.players);

          if (movable.length === 0) {
            // No moves possible -> pass turn cleanly
            setTimeout(() => {
              const stateNow = gameStateRef.current;
              let nextTurn = (stateNow.currentTurnIndex + 1) % stateNow.activeColorOrder.length;
              let attempts = 0;
              while (
                stateNow.players[stateNow.activeColorOrder[nextTurn]].hasWon &&
                attempts < stateNow.activeColorOrder.length
              ) {
                nextTurn = (nextTurn + 1) % stateNow.activeColorOrder.length;
                attempts++;
              }
              const nextColor = stateNow.activeColorOrder[nextTurn];
              const nextPlayer = stateNow.players[nextColor];

              setGameState(prev => ({
                ...prev,
                isRolling: false,
                hasRolled: false,
                diceValue: null,
                currentTurnIndex: nextTurn,
                movableTokenIds: [],
                isAiMoving: false,
                lastMessage: `No moves available for ${rolledNumber}. ${nextPlayer.name}'s turn.`
              }));

              if (nextPlayer.type === 'ai' && !nextPlayer.hasWon) {
                setTimeout(() => {
                  triggerAiTurn(nextColor, stateNow.players, nextTurn);
                }, 600);
              }
            }, 700);
          } else {
            setGameState(prev => ({
              ...prev,
              isRolling: false,
              hasRolled: true,
              movableTokenIds: movable,
              lastMessage: `Rolled a ${rolledNumber}! Click glowing pawn in 3D or HUD button below.`
            }));

            // If auto-move for AI
            const currentPlayer = latest.players[currentColor];
            if (currentPlayer.type === 'ai') {
              setTimeout(() => {
                pickBestAiMove(currentColor, rolledNumber, movable, latest.players);
              }, 500);
            }
          }
        }
      });
    }
  };

  // AI Turn Orchestrator
  const triggerAiTurn = (
    color: LudoColor,
    currentPlayers: Record<LudoColor, LudoPlayer>,
    turnIdx: number
  ) => {
    const current = gameStateRef.current;
    if (current.isRolling) return;

    sound.playDiceRollSound();
    const rolledNumber = Math.floor(Math.random() * 6) + 1;

    setGameState(prev => ({
      ...prev,
      isRolling: true,
      diceValue: rolledNumber
    }));

    if (diceMeshRef.current) {
      const dice = diceMeshRef.current;
      const targetRot = DICE_ROTATIONS[rolledNumber];

      gsap.to(dice.position, {
        y: 2.4,
        duration: 0.25,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });

      gsap.to(dice.rotation, {
        x: targetRot.x + Math.PI * 4,
        y: targetRot.y + Math.PI * 4,
        z: targetRot.z + Math.PI * 4,
        duration: 0.55,
        ease: 'power3.out',
        onComplete: () => {
          dice.rotation.set(targetRot.x, targetRot.y, targetRot.z);
          const stateNow = gameStateRef.current;
          const movable = getMovableTokens(color, rolledNumber, stateNow.players);

          if (movable.length === 0) {
            setTimeout(() => {
              const s = gameStateRef.current;
              let nextTurn = (turnIdx + 1) % s.activeColorOrder.length;
              let attempts = 0;
              while (s.players[s.activeColorOrder[nextTurn]].hasWon && attempts < s.activeColorOrder.length) {
                nextTurn = (nextTurn + 1) % s.activeColorOrder.length;
                attempts++;
              }
              const nextColor = s.activeColorOrder[nextTurn];
              const nextPlayer = s.players[nextColor];

              setGameState(prev => ({
                ...prev,
                isRolling: false,
                hasRolled: false,
                diceValue: null,
                currentTurnIndex: nextTurn,
                movableTokenIds: [],
                isAiMoving: false,
                lastMessage: `${color.toUpperCase()} rolled ${rolledNumber} (no moves). ${nextPlayer.name}'s turn.`
              }));

              if (nextPlayer.type === 'ai' && !nextPlayer.hasWon) {
                setTimeout(() => {
                  triggerAiTurn(nextColor, s.players, nextTurn);
                }, 600);
              }
            }, 600);
          } else {
            setGameState(prev => ({
              ...prev,
              isRolling: false,
              hasRolled: true,
              movableTokenIds: movable
            }));

            setTimeout(() => {
              pickBestAiMove(color, rolledNumber, movable, stateNow.players);
            }, 450);
          }
        }
      });
    }
  };

  // Force Rescue / Unstick Turn Handlers
  const forceUnstickTurn = () => {
    sound.playClickSound();
    const s = gameStateRef.current;
    let nextTurn = (s.currentTurnIndex + 1) % s.activeColorOrder.length;
    let attempts = 0;
    while (s.players[s.activeColorOrder[nextTurn]].hasWon && attempts < s.activeColorOrder.length) {
      nextTurn = (nextTurn + 1) % s.activeColorOrder.length;
      attempts++;
    }
    const nextColor = s.activeColorOrder[nextTurn];
    const nextPlayer = s.players[nextColor];

    setGameState(prev => ({
      ...prev,
      isRolling: false,
      hasRolled: false,
      isAiMoving: false,
      diceValue: null,
      currentTurnIndex: nextTurn,
      movableTokenIds: [],
      lastMessage: `Turn skipped/rescued. ${nextPlayer.name}'s turn.`
    }));

    if (nextPlayer.type === 'ai' && !nextPlayer.hasWon) {
      setTimeout(() => {
        triggerAiTurn(nextColor, s.players, nextTurn);
      }, 600);
    }
  };

  // Smart AI Move Decision Algorithm
  const pickBestAiMove = (
    color: LudoColor,
    dice: number,
    movable: number[],
    players: Record<LudoColor, LudoPlayer>
  ) => {
    let bestTokenId = movable[0];
    let bestScore = -100;

    const myTokens = players[color].tokens;
    const myStart = COLOR_START_INDEX[color];

    for (const id of movable) {
      const tok = myTokens[id];
      let score = 0;

      // 1. Spawning out of base on 6 is high priority
      if (tok.step === -1 && dice === 6) {
        score += 80;
      } else {
        const nextStep = tok.step + dice;

        // 2. Finishing token in home
        if (nextStep === 56) {
          score += 100;
        }

        // 3. Capturing opponent
        if (nextStep >= 0 && nextStep <= 50) {
          const trackIdx = (myStart + nextStep) % 52;
          if (!SAFE_TRACK_INDICES.includes(trackIdx)) {
            // check if opponent exists
            let canCapture = false;
            ALL_COLORS.forEach(c => {
              if (c !== color) {
                players[c].tokens.forEach(ot => {
                  if (ot.step >= 0 && ot.step <= 50) {
                    const otIdx = (COLOR_START_INDEX[c] + ot.step) % 52;
                    if (otIdx === trackIdx) canCapture = true;
                  }
                });
              }
            });
            if (canCapture) score += 90;
          }
        }

        // 4. Moving closer to home
        score += nextStep;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTokenId = id;
      }
    }

    executeTokenMove(color, bestTokenId);
  };

  // Setup Player Count & Types
  const configureGame = (count: 2 | 3 | 4) => {
    sound.playClickSound();
    const activeColors: LudoColor[] = 
      count === 2 ? ['red', 'yellow'] :
      count === 3 ? ['red', 'blue', 'yellow'] :
      ['red', 'blue', 'yellow', 'green'];

    setGameState(prev => {
      const updatedPlayers = { ...prev.players };
      ALL_COLORS.forEach(c => {
        updatedPlayers[c].tokens = [0, 1, 2, 3].map(id => ({
          id,
          color: c,
          step: -1,
          position: { x: 0, y: 0, z: 0 },
          isHome: false,
          isBase: true
        }));
        updatedPlayers[c].hasWon = false;
        updatedPlayers[c].rank = undefined;
      });

      return {
        ...prev,
        players: updatedPlayers,
        selectedPlayerCount: count,
        activeColorOrder: activeColors,
        currentTurnIndex: 0,
        diceValue: null,
        isRolling: false,
        hasRolled: false,
        movableTokenIds: [],
        winners: [],
        lastMessage: `Game restarted with ${count} players. Red goes first!`
      };
    });

    // Reset 3D tokens to base positions
    ALL_COLORS.forEach(color => {
      [0, 1, 2, 3].forEach(id => {
        const mesh = tokenMeshesRef.current.get(`${color}-${id}`);
        if (mesh) {
          gsap.killTweensOf(mesh.position);
          gsap.killTweensOf(mesh.rotation);
          gsap.killTweensOf(mesh.scale);
          const [bx, by, bz] = BASE_SLOT_POSITIONS[color][id];
          mesh.position.set(bx, by, bz);
          mesh.rotation.set(0, 0, 0);
          mesh.scale.set(1, 1, 1);
        }
      });
    });
  };

  // Toggle Human / AI for a player
  const togglePlayerType = (color: LudoColor) => {
    sound.playClickSound();
    setGameState(prev => {
      const updated = { ...prev.players };
      updated[color] = {
        ...updated[color],
        type: updated[color].type === 'human' ? 'ai' : 'human'
      };
      return { ...prev, players: updated };
    });
  };

  // Initialize Three.js 3D Ludo Environment
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.02);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCamera();

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    scene.add(dirLight);

    // Colored Accent Pointlights around board corners
    const redLight = new THREE.PointLight(0xef4444, 2, 12);
    redLight.position.set(-6, 3, -6);
    scene.add(redLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 2, 12);
    blueLight.position.set(-6, 3, 6);
    scene.add(blueLight);

    const yellowLight = new THREE.PointLight(0xf59e0b, 2, 12);
    yellowLight.position.set(6, 3, 6);
    scene.add(yellowLight);

    const greenLight = new THREE.PointLight(0x10b981, 2, 12);
    greenLight.position.set(6, 3, -6);
    scene.add(greenLight);

    // 4. Build 3D Ludo Board Structure
    const boardGroup = new THREE.Group();

    // Main Board Wooden/Cyber Platform
    const boardWidth = 15 * TILE_SIZE + 0.6;
    const boardGeo = new THREE.BoxGeometry(boardWidth, 0.5, boardWidth);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x182030,
      roughness: 0.35,
      metalness: 0.6
    });
    const mainBoard = new THREE.Mesh(boardGeo, boardMat);
    mainBoard.position.y = -0.25;
    mainBoard.receiveShadow = true;
    boardGroup.add(mainBoard);

    // Outer golden/metallic border
    const borderGeo = new THREE.BoxGeometry(boardWidth + 0.3, 0.2, boardWidth + 0.3);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.2
    });
    const outerBorder = new THREE.Mesh(borderGeo, borderMat);
    outerBorder.position.y = -0.35;
    boardGroup.add(outerBorder);

    // Build 4 Corner Quadrant Bases
    const baseGeo = new THREE.BoxGeometry(6 * TILE_SIZE - 0.1, 0.1, 6 * TILE_SIZE - 0.1);
    const baseOffsets: Record<LudoColor, [number, number]> = {
      red: [-4.5 * TILE_SIZE, -4.5 * TILE_SIZE],
      blue: [-4.5 * TILE_SIZE, 4.5 * TILE_SIZE],
      yellow: [4.5 * TILE_SIZE, 4.5 * TILE_SIZE],
      green: [4.5 * TILE_SIZE, -4.5 * TILE_SIZE]
    };

    ALL_COLORS.forEach(c => {
      const bMat = new THREE.MeshStandardMaterial({
        color: COLOR_PROPERTIES[c].colorHex,
        roughness: 0.3,
        metalness: 0.5
      });
      const bMesh = new THREE.Mesh(baseGeo, bMat);
      const [ox, oz] = baseOffsets[c];
      bMesh.position.set(ox, 0.05, oz);
      bMesh.receiveShadow = true;
      boardGroup.add(bMesh);

      // Inner white tray
      const innerTrayGeo = new THREE.BoxGeometry(4 * TILE_SIZE, 0.12, 4 * TILE_SIZE);
      const innerTrayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      const innerTray = new THREE.Mesh(innerTrayGeo, innerTrayMat);
      innerTray.position.set(ox, 0.08, oz);
      boardGroup.add(innerTray);

      // 4 Base Token Slot pockets
      BASE_SLOT_POSITIONS[c].forEach(slotPos => {
        const slotGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24);
        const slotMat = new THREE.MeshStandardMaterial({
          color: COLOR_PROPERTIES[c].colorHex,
          emissive: COLOR_PROPERTIES[c].emissiveHex,
          emissiveIntensity: 0.3
        });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(slotPos[0], 0.14, slotPos[2]);
        boardGroup.add(slot);
      });
    });

    // Build 52 Perimeter Track Tiles
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE - 0.06, 0.08, TILE_SIZE - 0.06);

    TRACK_GRID_COORDS.forEach(([col, row], idx) => {
      const isSafe = SAFE_TRACK_INDICES.includes(idx);
      const isRedStart = idx === 0;
      const isBlueStart = idx === 13;
      const isYellowStart = idx === 26;
      const isGreenStart = idx === 39;

      let tileColor = 0x223048;
      let emissive = 0x000000;

      if (isRedStart) { tileColor = 0xef4444; emissive = 0x7f1d1d; }
      else if (isBlueStart) { tileColor = 0x3b82f6; emissive = 0x1e3a8a; }
      else if (isYellowStart) { tileColor = 0xf59e0b; emissive = 0x78350f; }
      else if (isGreenStart) { tileColor = 0x10b981; emissive = 0x064e3b; }
      else if (isSafe) { tileColor = 0x38bdf8; emissive = 0x0369a1; }

      const tMat = new THREE.MeshStandardMaterial({
        color: tileColor,
        emissive,
        emissiveIntensity: isSafe || isRedStart || isBlueStart || isYellowStart || isGreenStart ? 0.3 : 0,
        roughness: 0.4,
        metalness: 0.4
      });

      const tMesh = new THREE.Mesh(tileGeo, tMat);
      const [wx, wy, wz] = gridToWorld(col, row, 0.05);
      tMesh.position.set(wx, wy, wz);
      tMesh.receiveShadow = true;
      boardGroup.add(tMesh);

      // Add Star/Shield marker on safe spots
      if (isSafe) {
        const starGeo = new THREE.ConeGeometry(0.18, 0.08, 5);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const star = new THREE.Mesh(starGeo, starMat);
        star.rotation.x = Math.PI / 2;
        star.position.set(wx, 0.1, wz);
        boardGroup.add(star);
      }
    });

    // Build 4 Home Colored Runways
    ALL_COLORS.forEach(c => {
      HOME_COLUMNS[c].forEach(([col, row], stepIdx) => {
        const [hx, hy, hz] = gridToWorld(col, row, 0.05);
        const hcMat = new THREE.MeshStandardMaterial({
          color: COLOR_PROPERTIES[c].colorHex,
          emissive: COLOR_PROPERTIES[c].emissiveHex,
          emissiveIntensity: 0.4
        });
        const hcMesh = new THREE.Mesh(tileGeo, hcMat);
        hcMesh.position.set(hx, hy + stepIdx * 0.02, hz);
        boardGroup.add(hcMesh);
      });
    });

    // Build Victory Center Pyramid
    const pyramidGeo = new THREE.ConeGeometry(1.4, 0.6, 4);
    const pyramidMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });
    const centerPyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
    centerPyramid.position.set(0, 0.35, 0);
    centerPyramid.rotation.y = Math.PI / 4;
    boardGroup.add(centerPyramid);

    scene.add(boardGroup);

    // 5. Build 3D Pawns / Tokens (4 colors x 4 tokens = 16 pawns)
    const tokenMap = new Map<string, THREE.Group>();
    const haloMap = new Map<string, THREE.Mesh>();

    ALL_COLORS.forEach(c => {
      [0, 1, 2, 3].forEach(id => {
        const pawnGroup = new THREE.Group();
        const [bx, by, bz] = BASE_SLOT_POSITIONS[c][id];
        pawnGroup.position.set(bx, by, bz);
        pawnGroup.userData = { color: c, tokenId: id };

        // Pawn Base Pedestal
        const pedGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.15, 20);
        const pawnMat = new THREE.MeshStandardMaterial({
          color: COLOR_PROPERTIES[c].colorHex,
          emissive: COLOR_PROPERTIES[c].emissiveHex,
          emissiveIntensity: 0.4,
          roughness: 0.2,
          metalness: 0.85
        });
        const pedestal = new THREE.Mesh(pedGeo, pawnMat);
        pedestal.position.y = 0.08;
        pedestal.castShadow = true;

        // Pawn Body (Cone/Tapered Stem)
        const bodyGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.45, 20);
        const body = new THREE.Mesh(bodyGeo, pawnMat);
        body.position.y = 0.35;
        body.castShadow = true;

        // Pawn Head (Polished Glossy Sphere)
        const headGeo = new THREE.SphereGeometry(0.18, 20, 20);
        const head = new THREE.Mesh(headGeo, pawnMat);
        head.position.y = 0.65;
        head.castShadow = true;

        // Crown Ring Indicator
        const crownGeo = new THREE.TorusGeometry(0.19, 0.03, 12, 24);
        const crownMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.rotation.x = Math.PI / 2;
        crown.position.y = 0.58;

        pawnGroup.add(pedestal, body, head, crown);

        // Movable Halo Indicator (hidden by default)
        const haloGeo = new THREE.RingGeometry(0.35, 0.48, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x39ff14,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.0
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.02;
        pawnGroup.add(halo);

        scene.add(pawnGroup);
        tokenMap.set(`${c}-${id}`, pawnGroup);
        haloMap.set(`${c}-${id}`, halo);
      });
    });

    tokenMeshesRef.current = tokenMap;
    haloIndicatorsRef.current = haloMap;

    // 6. Build 3D Rolling Dice
    const diceGroup = new THREE.Group();
    diceGroup.position.set(0, 0.8, 0); // Position above center pyramid

    // Rounded Cube Dice
    const diceGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const diceMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.1,
      bumpScale: 0.05
    });

    const diceBox = new THREE.Mesh(diceGeo, diceMat);
    diceBox.castShadow = true;
    diceGroup.add(diceBox);

    // Create Pip Dots for Dice Faces (1 to 6)
    const pipGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const pipMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    const addPip = (x: number, y: number, z: number) => {
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(x, y, z);
      diceGroup.add(pip);
    };

    // Face 1 (+Y Top): 1 center dot
    addPip(0, 0.46, 0);

    // Face 6 (-Y Bottom): 6 dots
    [-0.22, 0.22].forEach(dx => {
      [-0.26, 0, 0.26].forEach(dz => {
        addPip(dx, -0.46, dz);
      });
    });

    // Face 2 (+Z Front): 2 dots
    addPip(-0.2, 0.2, 0.46);
    addPip(0.2, -0.2, 0.46);

    // Face 5 (-Z Back): 5 dots
    addPip(-0.22, 0.22, -0.46);
    addPip(0.22, 0.22, -0.46);
    addPip(0, 0, -0.46);
    addPip(-0.22, -0.22, -0.46);
    addPip(0.22, -0.22, -0.46);

    // Face 3 (+X Right): 3 dots
    addPip(0.46, 0.22, -0.22);
    addPip(0.46, 0, 0);
    addPip(0.46, -0.22, 0.22);

    // Face 4 (-X Left): 4 dots
    addPip(-0.46, 0.22, -0.22);
    addPip(-0.46, 0.22, 0.22);
    addPip(-0.46, -0.22, -0.22);
    addPip(-0.46, -0.22, 0.22);

    scene.add(diceGroup);
    diceMeshRef.current = diceGroup;

    // 7. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle float animation on dice
      if (diceMeshRef.current && !gameState.isRolling) {
        diceMeshRef.current.position.y = 0.85 + Math.sin(elapsedTime * 2.5) * 0.08;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 8. Raycast & Orbit Click Handlers
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDraggingRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      previousMousePosRef.current = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - previousMousePosRef.current.x;
      const deltaY = clientY - previousMousePosRef.current.y;

      if ('buttons' in e && e.buttons === 1 || 'touches' in e) {
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          isDraggingRef.current = true;
          cameraOrbitRef.current.theta += deltaX * 0.007;
          cameraOrbitRef.current.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, cameraOrbitRef.current.phi - deltaY * 0.007));
          updateCamera();
          previousMousePosRef.current = { x: clientX, y: clientY };
        }
      }

      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerUp = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;

        mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);

        // Check if user clicked 3D Dice
        if (diceMeshRef.current) {
          const diceHits = raycasterRef.current.intersectObjects(diceMeshRef.current.children, true);
          if (diceHits.length > 0) {
            rollDice();
            return;
          }
        }

        // Check if user clicked any 3D Pawn
        const pawnObjects: THREE.Object3D[] = [];
        tokenMap.forEach(group => {
          pawnObjects.push(...group.children);
        });

        const hits = raycasterRef.current.intersectObjects(pawnObjects, true);
        if (hits.length > 0) {
          let hitParent: THREE.Object3D | null = hits[0].object;
          while (hitParent && !hitParent.userData?.color && hitParent.parent) {
            hitParent = hitParent.parent;
          }

          if (hitParent && hitParent.userData?.color) {
            const { color, tokenId } = hitParent.userData;
            const current = gameStateRef.current;
            const currentColor = current.activeColorOrder[current.currentTurnIndex];
            if (color === currentColor && current.movableTokenIds.includes(tokenId)) {
              executeTokenMove(color, tokenId);
            }
          }
        }
      }
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraOrbitRef.current.radius = Math.max(10, Math.min(28, cameraOrbitRef.current.radius + e.deltaY * 0.012));
      updateCamera();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });
    dom.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  // Update Glowing Halos on Movable Tokens
  useEffect(() => {
    const currentColor = gameState.activeColorOrder[gameState.currentTurnIndex];

    haloIndicatorsRef.current.forEach((halo, key) => {
      const [c, idStr] = key.split('-') as [LudoColor, string];
      const id = parseInt(idStr, 10);
      const isMovable = c === currentColor && gameState.movableTokenIds.includes(id);

      gsap.to((halo.material as THREE.MeshBasicMaterial), {
        opacity: isMovable ? 0.95 : 0.0,
        duration: 0.25
      });

      // Subtle bounce hop on token if movable
      const tokenGroup = tokenMeshesRef.current.get(key);
      if (tokenGroup) {
        gsap.killTweensOf(tokenGroup.position);
        gsap.killTweensOf(tokenGroup.scale);
        gsap.killTweensOf(tokenGroup.rotation);

        const tok = gameState.players[c]?.tokens[id];
        if (tok) {
          const [baseX, baseY, baseZ] = getTokenWorldPosition(c, id, tok.step);
          if (isMovable) {
            tokenGroup.position.set(baseX, baseY, baseZ);
            gsap.to(tokenGroup.position, {
              y: baseY + 0.25,
              duration: 0.35,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut'
            });
            gsap.to(tokenGroup.scale, {
              x: 1.08,
              z: 1.08,
              duration: 0.35,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut'
            });
          } else {
            gsap.to(tokenGroup.position, {
              x: baseX,
              y: baseY,
              z: baseZ,
              duration: 0.2,
              ease: 'power1.out'
            });
            gsap.to(tokenGroup.scale, {
              x: 1,
              y: 1,
              z: 1,
              duration: 0.2,
              ease: 'power1.out'
            });
            gsap.to(tokenGroup.rotation, {
              x: 0,
              y: 0,
              z: 0,
              duration: 0.2
            });
          }
        }
      }
    });
  }, [gameState.movableTokenIds, gameState.currentTurnIndex, gameState.players]);

  const currentColor = gameState.activeColorOrder[gameState.currentTurnIndex];
  const activePlayer = gameState.players[currentColor];

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-transparent overflow-hidden select-none flex flex-col md:flex-row">
      {/* 3D Canvas */}
      <div 
        id="ludo-3d-canvas-container"
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
      >
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
          {/* Player Count Select */}
          <div className="flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-xl">
            {([2, 3, 4] as const).map(count => (
              <button
                key={count}
                id={`ludo-players-${count}`}
                onClick={() => configureGame(count)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  gameState.selectedPlayerCount === count
                    ? 'bg-amber-500/20 text-white border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'text-white/50 hover:text-white border border-transparent'
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>

          <button
            id="ludo-camera-reset-btn"
            onClick={resetCamera}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black/60 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/70 hover:text-amber-400 rounded-full text-xs font-medium transition-all shadow-xl"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D View</span>
          </button>

          <button
            id="ludo-top-view-btn"
            onClick={topViewCamera}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black/60 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/70 hover:text-amber-400 rounded-full text-xs font-medium transition-all shadow-xl"
          >
            Top View
          </button>
        </div>

        {/* Current Turn Badge */}
        <div className="absolute top-4 right-4 z-20">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Turn:</span>
              <span 
                className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono flex items-center gap-1.5 ${COLOR_PROPERTIES[currentColor].bgTailwind}/20 ${COLOR_PROPERTIES[currentColor].textTailwind} border ${COLOR_PROPERTIES[currentColor].borderTailwind}/40 shadow-sm`}
              >
                <span className={`w-2 h-2 rounded-full ${COLOR_PROPERTIES[currentColor].bgTailwind} animate-pulse`} />
                {activePlayer.name} ({activePlayer.type.toUpperCase()})
              </span>
            </div>
            {gameState.isRolling && (
              <span className="text-xs text-amber-400 font-mono font-medium animate-pulse">Rolling...</span>
            )}
          </div>
        </div>

        {/* Bottom Orbit Guidance */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-white/40 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
          <span className="text-amber-400">CAM: ORBIT_3D</span>
          <span>•</span>
          <span>CLICK 3D DICE TO ROLL</span>
          <span>•</span>
          <span>CLICK HIGHLIGHTED PAWNS</span>
        </div>
      </div>

      {/* Side Ludo Controller HUD */}
      <div className="w-full md:w-80 bg-black/40 md:bg-black/30 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 p-6 flex flex-col justify-between z-20 overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">
              Arena Controller
            </h3>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Dices className="w-4 h-4 text-amber-400" />
                3D Ludo Arena
              </h2>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              3D board physics with parabolic hopping pawns and rolling dice.
            </p>
          </div>

          {/* Dice & Turn Control Box */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest font-mono">
                Dice Action
              </span>
              {gameState.diceValue && (
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  ROLL: {gameState.diceValue}
                </span>
              )}
            </div>

            {/* Giant Dice Display Button */}
            <button
              id="ludo-roll-dice-btn"
              disabled={gameState.hasRolled || gameState.isRolling || activePlayer.type === 'ai'}
              onClick={rollDice}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all text-xs tracking-wider uppercase font-mono ${
                activePlayer.type === 'ai'
                  ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                  : gameState.hasRolled
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-white text-black font-bold shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
              }`}
            >
              <Dices className={`w-4 h-4 ${gameState.isRolling ? 'animate-spin' : ''}`} />
              <span>
                {gameState.isRolling 
                  ? 'Rolling Dice...' 
                  : gameState.hasRolled 
                  ? `Rolled [ ${gameState.diceValue} ] - Pick Pawn` 
                  : activePlayer.type === 'ai'
                  ? 'AI Player Thinking...'
                  : 'Roll 3D Dice'}
              </span>
            </button>

            {/* Movable Pawn Direct Selectors (for human turns) */}
            {gameState.hasRolled && activePlayer.type === 'human' && gameState.movableTokenIds.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Movable Pawns (Click 3D or Button):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {gameState.movableTokenIds.map(tokId => {
                    const tok = activePlayer.tokens[tokId];
                    return (
                      <button
                        key={tokId}
                        id={`ludo-pick-pawn-${tokId}`}
                        onClick={() => executeTokenMove(currentColor, tokId)}
                        className="py-2 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-xs font-bold text-amber-300 flex items-center justify-between transition-all font-mono shadow-[0_0_10px_rgba(245,158,11,0.2)] cursor-pointer"
                      >
                        <span>Pawn #{tokId + 1}</span>
                        <span className="text-[9px] text-white/60">
                          {tok.step === -1 ? 'Deploy ➔ 0' : `Hop +${gameState.diceValue}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Message Log */}
            <div className="p-3 bg-black/40 rounded-lg text-xs text-white/70 border border-white/5 leading-relaxed font-mono text-[11px]">
              {gameState.lastMessage}
            </div>
          </div>

          {/* Players Roster & AI Toggles */}
          <div>
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center justify-between font-mono">
              <span>Squad & Progress</span>
              <span className="text-[10px] text-white/40">Home/Total</span>
            </div>

            <div className="space-y-2">
              {gameState.activeColorOrder.map(c => {
                const p = gameState.players[c];
                const homeCount = p.tokens.filter(t => t.step === 56).length;
                const isCurrent = c === currentColor;

                return (
                  <div
                    key={c}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isCurrent
                        ? `bg-white/10 border-white/25 shadow-lg`
                        : 'bg-white/5 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${COLOR_PROPERTIES[c].bgTailwind} shadow-sm`} />
                      <span className="text-xs font-semibold text-white">{p.name}</span>
                      {p.rank && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                          #{p.rank}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-white/60">
                        {homeCount}/4
                      </span>
                      <button
                        id={`ludo-toggle-ai-${c}`}
                        onClick={() => togglePlayerType(c)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                          p.type === 'human'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}
                        title="Toggle between Human and AI"
                      >
                        {p.type === 'human' ? '👤 Human' : '🤖 AI'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global Rank Badge matching Elegant Dark */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-white/10 text-center">
            <div className="text-xs text-amber-300 font-medium mb-0.5">Grandmaster Rank</div>
            <div className="text-2xl font-bold text-white tracking-tighter font-mono">
              #412
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
              Top 0.8% Global Ludo Tacticians
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 space-y-2">
          <button
            id="ludo-unstick-btn"
            onClick={forceUnstickTurn}
            className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono font-bold rounded-full border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Unstick / Pass Turn
          </button>

          <button
            id="ludo-restart-btn"
            onClick={() => configureGame(gameState.selectedPlayerCount)}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-mono font-bold rounded-full border border-white/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart Ludo Board
          </button>
        </div>
      </div>
    </div>
  );
};
