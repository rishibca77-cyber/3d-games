import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { 
  Play, 
  RotateCcw, 
  Flame, 
  Sparkles, 
  Sliders, 
  Eye, 
  Trophy, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  Zap,
  Volume2
} from 'lucide-react';
import { MatrixCubeState, MatrixGameState, MatrixTheme } from '../../types.ts';
import { sound } from '../../utils/audio.ts';

// 4x4 Grid dimension settings
const GRID_SIZE = 4;
const CUBE_SPACING = 1.45;
const CUBE_SIZE = 1.05;

// Theme color mappings
const THEME_CONFIGS: Record<MatrixTheme, {
  name: string;
  primary: number;
  glow: number;
  bgHex: string;
  charColor: string;
  rainColor: number;
  tailColor: number;
}> = {
  matrix_green: {
    name: 'Matrix Emerald',
    primary: 0x10b981,
    glow: 0x34d399,
    bgHex: '#050505',
    charColor: '#10b981',
    rainColor: 0x10b981,
    tailColor: 0x064e3b
  },
  cyber_cyan: {
    name: 'Cyber Ice',
    primary: 0x06b6d4,
    glow: 0x22d3ee,
    bgHex: '#050505',
    charColor: '#06b6d4',
    rainColor: 0x06b6d4,
    tailColor: 0x164e63
  },
  neon_purple: {
    name: 'Synth Rose',
    primary: 0xf43f5e,
    glow: 0xfb7185,
    bgHex: '#050505',
    charColor: '#f43f5e',
    rainColor: 0xf43f5e,
    tailColor: 0x881337
  },
  solar_amber: {
    name: 'Solar Amber',
    primary: 0xf59e0b,
    glow: 0xfbbf24,
    bgHex: '#050505',
    charColor: '#f59e0b',
    rainColor: 0xf59e0b,
    tailColor: 0x78350f
  }
};

// Generates canvas texture for Japanese Katakana & Hex Matrix Rain Drops with Custom User Values & Multiplication
function createMatrixTexture(colorHex: string, customCode: string = '', multiplier: number = 1): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, 128, 512);

  const defaultChars = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ1234567890ABCDEF';
  
  // Parse if user provided numeric value
  const numVal = parseFloat(customCode.trim());
  const isNumeric = !isNaN(numVal) && customCode.trim().length > 0;
  
  const streamLines: string[] = [];
  const cleanCode = customCode.trim();

  for (let i = 0; i < 14; i++) {
    if (cleanCode.length > 0) {
      if (isNumeric) {
        // Multiply value exponentially or arithmetically through the stream
        const stepMultiplier = Math.pow(Math.max(1, multiplier), (i % 4));
        const valAtStep = (numVal * stepMultiplier).toFixed(0);
        streamLines.push(`${valAtStep}`);
      } else {
        // Text / String multiplied repetitions with cyber hex prefix
        if (i % 3 === 0) {
          streamLines.push(cleanCode.slice(0, 6).toUpperCase());
        } else if (i % 3 === 1) {
          streamLines.push(`${cleanCode.slice(0, 4)}*${multiplier}`);
        } else {
          streamLines.push(defaultChars[Math.floor(Math.random() * defaultChars.length)]);
        }
      }
    } else {
      streamLines.push(defaultChars[Math.floor(Math.random() * defaultChars.length)]);
    }
  }

  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i < 14; i++) {
    const text = streamLines[i];
    const y = 36 + i * 35;
    const alpha = Math.max(0.12, 1 - (i / 14));
    
    if (i === 0) {
      // Head of the rain stream (bright white-glow)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = colorHex;
      ctx.shadowBlur = 14;
    } else {
      ctx.fillStyle = colorHex;
      ctx.shadowBlur = 4;
    }
    ctx.globalAlpha = alpha;
    ctx.fillText(text, 64, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const MatrixGame3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Matrix Game State
  const [gameState, setGameState] = useState<MatrixGameState>({
    level: 1,
    score: 0,
    highScore: parseInt(localStorage.getItem('matrix_high_score') || '0', 10),
    sequence: [],
    playerIndex: 0,
    isPlayingSequence: false,
    status: 'idle',
    speed: 700,
    theme: 'matrix_green',
    rainSpeed: 1.0,
    rainDensity: 120
  });

  const gameStateRef = useRef<MatrixGameState>(gameState);
  gameStateRef.current = gameState;

  // Custom User Multiplier Rain State
  const [customValue, setCustomValue] = useState<string>('NEXUS');
  const [multiplier, setMultiplier] = useState<number>(2);
  const [isSurgeActive, setIsSurgeActive] = useState<boolean>(false);

  // Rain Cascade & Multiplier Feedback State
  interface CascadeFeedback {
    scoreEarned: number;
    totalMultiplier: number;
    seqMultiplier: number;
    streamMultiplier: number;
    clickedValue: number;
    cellIndex: number;
    cascadeCount: number;
    timestamp: number;
  }

  const [lastCascade, setLastCascade] = useState<CascadeFeedback | null>(null);
  const [cascadingCells, setCascadingCells] = useState<number[]>([]);
  const [activeCube, setActiveCube] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [isVisualizerMode, setIsVisualizerMode] = useState<boolean>(false);
  const isVisualizerModeRef = useRef<boolean>(false);
  isVisualizerModeRef.current = isVisualizerMode;

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const cubeMeshesRef = useRef<THREE.Mesh[]>([]);
  const rainStreamsRef = useRef<THREE.Sprite[]>([]);
  const gridGroupRef = useRef<THREE.Group | null>(null);
  const pointLightsRef = useRef<THREE.PointLight[]>([]);

  // Refresh Rain Textures with custom user multiplied values
  const refreshRainWithCustomMultiplier = useCallback((code: string, mult: number, themeKey: MatrixTheme) => {
    const config = THEME_CONFIGS[themeKey];
    const newTex = createMatrixTexture(config.charColor, code, mult);
    rainStreamsRef.current.forEach(sprite => {
      (sprite.material as THREE.SpriteMaterial).map = newTex;
      (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
    });
  }, []);

  // Orbit state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraOrbitRef = useRef({ theta: 0, phi: Math.PI / 3.4, radius: 9.5 });

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
      theta: 0,
      phi: Math.PI / 3.4,
      radius: 9.5,
      duration: 1,
      ease: 'power2.out',
      onUpdate: updateCamera
    });
  };

  // Trigger Rain-like Cascade to downstream and adjacent cells
  const triggerRainCascade = useCallback((
    sourceIndex: number,
    isUser: boolean = true,
    isError: boolean = false
  ): number => {
    const r0 = Math.floor(sourceIndex / 4);
    const c0 = sourceIndex % 4;

    const theme = THEME_CONFIGS[gameStateRef.current.theme];
    const targetEmissive = isError ? 0xff1144 : theme.glow;
    const targetColor = isError ? 0xff0033 : theme.primary;

    const affectedIndices: number[] = [];

    for (let i = 0; i < 16; i++) {
      if (i === sourceIndex) continue;
      const r = Math.floor(i / 4);
      const c = i % 4;

      const dr = r - r0;
      const dc = Math.abs(c - c0);

      // Rain bias: downward travel (dr > 0) has fastest propagation and widest reach
      let rainDist = 999;
      if (dr > 0) {
        // Downstream falling stream + cone
        rainDist = dr * 0.85 + dc * 0.52;
      } else if (dr === 0) {
        // Same row lateral splash
        rainDist = 0.8 + dc * 0.72;
      } else {
        // Upstream back-ripple
        rainDist = Math.abs(dr) * 1.5 + dc * 0.88;
      }

      if (rainDist <= 3.8) {
        affectedIndices.push(i);
        const delayMs = Math.round(rainDist * 52);
        const intensity = Math.max(0.18, 1 - (rainDist / 4.2));
        const mesh = cubeMeshesRef.current[i];

        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;

          // Cascade bounce & dip
          gsap.killTweensOf(mesh.position);
          gsap.killTweensOf(mesh.rotation);

          gsap.to(mesh.position, {
            y: (dr > 0 ? -0.22 : 0.22) * intensity,
            duration: 0.14,
            delay: delayMs / 1000,
            yoyo: true,
            repeat: 1,
            ease: 'sine.inOut'
          });

          gsap.to(mesh.rotation, {
            x: 0.25 * intensity * (dr >= 0 ? 1 : -1),
            z: (c - c0) * 0.18 * intensity,
            duration: 0.18,
            delay: delayMs / 1000,
            yoyo: true,
            repeat: 1,
            ease: 'power1.out',
            onComplete: () => {
              mesh.rotation.set(0, 0, 0);
            }
          });

          // Cascading glow pulse
          gsap.to(mat, {
            emissiveIntensity: 2.0 * intensity,
            duration: 0.14,
            delay: delayMs / 1000,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
            onStart: () => {
              mat.emissive.setHex(targetEmissive);
              mat.color.setHex(targetColor);
              if (!isError) {
                sound.playRainDropletHarmonic(i, 0, intensity);
              }
            },
            onComplete: () => {
              mat.emissive.setHex(0x0a1a12);
              mat.emissiveIntensity = 0.2;
              mat.color.setHex(0x112218);
            }
          });
        }
      }
    }

    setCascadingCells(affectedIndices);
    setTimeout(() => {
      setCascadingCells([]);
    }, 480);

    return affectedIndices.length;
  }, []);

  // Light up a 3D Cube with 360° flip animation and sound note + optional cascade
  const animateCubeActivation = (
    index: number,
    isUser: boolean = false,
    isError: boolean = false,
    triggerCascade: boolean = true
  ) => {
    const mesh = cubeMeshesRef.current[index];
    if (!mesh) return;

    setActiveCube(index);
    sound.playMatrixNote(index, isError);

    if (triggerCascade) {
      triggerRainCascade(index, isUser, isError);
    }

    const theme = THEME_CONFIGS[gameStateRef.current.theme];
    const targetEmissive = isError ? 0xff1144 : theme.glow;
    const targetColor = isError ? 0xff0033 : theme.primary;

    const mat = mesh.material as THREE.MeshStandardMaterial;

    // Pulse & Flash
    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    gsap.killTweensOf(mat);

    // Dynamic lift & flip animation
    gsap.to(mesh.position, {
      y: 0.8,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out'
    });

    gsap.to(mesh.rotation, {
      x: isUser ? Math.PI * 2 : -Math.PI * 2,
      y: isUser ? Math.PI : -Math.PI,
      duration: 0.45,
      ease: 'back.out(1.5)',
      onComplete: () => {
        mesh.rotation.set(0, 0, 0);
      }
    });

    gsap.to(mat, {
      emissiveIntensity: 3.2,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
      onStart: () => {
        mat.emissive.setHex(targetEmissive);
        mat.color.setHex(targetColor);
      },
      onComplete: () => {
        mat.emissive.setHex(0x0a1a12);
        mat.emissiveIntensity = 0.2;
        mat.color.setHex(0x112218);
        setActiveCube(null);
      }
    });
  };

  // Play Sequence
  const playSequence = (seq: number[]) => {
    setGameState(prev => ({
      ...prev,
      isPlayingSequence: true,
      status: 'showing',
      playerIndex: 0
    }));

    seq.forEach((cubeIdx, step) => {
      setTimeout(() => {
        animateCubeActivation(cubeIdx, false, false, true);

        if (step === seq.length - 1) {
          setTimeout(() => {
            setGameState(prev => ({
              ...prev,
              isPlayingSequence: false,
              status: 'input'
            }));
          }, 600);
        }
      }, (step + 1) * gameStateRef.current.speed);
    });
  };

  // Start New Game
  const startNewGame = () => {
    sound.playClickSound();
    const firstCube = Math.floor(Math.random() * 16);
    const newSeq = [firstCube];

    setGameState(prev => ({
      ...prev,
      level: 1,
      score: 0,
      sequence: newSeq,
      playerIndex: 0,
      status: 'showing',
      speed: 650
    }));
    setStreak(0);
    setLastCascade(null);

    setTimeout(() => {
      playSequence(newSeq);
    }, 400);
  };

  // Handle Player clicking a cube with Rain Cascade & Multiplier Calculation
  const handleCubeClick = (index: number) => {
    const current = gameStateRef.current;
    if (current.status !== 'input' || current.isPlayingSequence) {
      if (isVisualizerModeRef.current) {
        animateCubeActivation(index, true, false, true);
      }
      return;
    }

    const expectedCube = current.sequence[current.playerIndex];

    if (index === expectedCube) {
      // Correct click! Trigger Rain Cascade & Multiplier Effect
      const cascadeReach = triggerRainCascade(index, true, false);
      animateCubeActivation(index, true, false, false);

      // Value Multiplier Calculation:
      // Clicked Value (1-16) scaled by Sequence Length & User Stream Multiplier
      const clickedVal = index + 1;
      const seqLength = current.sequence.length;
      const stepNumber = current.playerIndex + 1;

      // Sequence length exponential multiplier factor
      const seqMultiplier = Number((1 + (seqLength - 1) * 0.75).toFixed(2));
      const stepBonusFactor = 1 + (stepNumber / seqLength) * 0.5;
      const totalClickMultiplier = Number((seqMultiplier * multiplier * stepBonusFactor).toFixed(1));

      const earnedClickScore = Math.round(clickedVal * 18 * totalClickMultiplier * (1 + streak * 0.15));
      const newScoreAfterClick = current.score + earnedClickScore;
      const newHighScore = Math.max(current.highScore, newScoreAfterClick);
      localStorage.setItem('matrix_high_score', newHighScore.toString());

      setLastCascade({
        scoreEarned: earnedClickScore,
        totalMultiplier: totalClickMultiplier,
        seqMultiplier,
        streamMultiplier: multiplier,
        clickedValue: clickedVal,
        cellIndex: index,
        cascadeCount: cascadeReach,
        timestamp: Date.now()
      });

      const nextIndex = current.playerIndex + 1;

      if (nextIndex === current.sequence.length) {
        // Level Completed! Sequence Full Decrypt Bonus
        const nextLevel = current.level + 1;
        const sequenceBonusMultiplier = Number((seqMultiplier * 1.5 * multiplier).toFixed(1));
        const completionBonus = Math.round(seqLength * 150 * sequenceBonusMultiplier + streak * 50);
        const finalRoundScore = newScoreAfterClick + completionBonus;
        const finalHighScore = Math.max(newHighScore, finalRoundScore);
        localStorage.setItem('matrix_high_score', finalHighScore.toString());

        setStreak(prev => prev + 1);

        // Confetti burst on milestone
        if (nextLevel % 2 === 0) {
          confetti({ particleCount: 55, spread: 65, origin: { y: 0.6 } });
        }

        // Add next random cube to sequence
        const nextRandomCube = Math.floor(Math.random() * 16);
        const updatedSequence = [...current.sequence, nextRandomCube];

        setGameState(prev => ({
          ...prev,
          level: nextLevel,
          score: finalRoundScore,
          highScore: finalHighScore,
          sequence: updatedSequence,
          status: 'success',
          speed: Math.max(260, prev.speed - 30)
        }));

        setTimeout(() => {
          playSequence(updatedSequence);
        }, 950);
      } else {
        setGameState(prev => ({
          ...prev,
          score: newScoreAfterClick,
          highScore: newHighScore,
          playerIndex: nextIndex
        }));
      }
    } else {
      // Wrong Click - Glitch Game Over
      triggerRainCascade(index, true, true);
      animateCubeActivation(index, true, true, false);
      setStreak(0);
      setLastCascade(null);
      setGameState(prev => ({
        ...prev,
        status: 'gameover',
        isPlayingSequence: false
      }));
    }
  };

  // Theme switch handler
  const switchTheme = (newTheme: MatrixTheme) => {
    sound.playClickSound();
    setGameState(prev => ({ ...prev, theme: newTheme }));
    refreshRainWithCustomMultiplier(customValue, multiplier, newTheme);

    const config = THEME_CONFIGS[newTheme];
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(config.bgHex);
      if (sceneRef.current.fog) {
        sceneRef.current.fog.color = new THREE.Color(config.bgHex);
      }
    }
  };

  // Custom Value change handler
  const handleCustomValueChange = (val: string) => {
    setCustomValue(val);
    refreshRainWithCustomMultiplier(val, multiplier, gameState.theme);
  };

  // Multiplier switch handler
  const handleMultiplierChange = (mult: number) => {
    sound.playClickSound();
    setMultiplier(mult);
    refreshRainWithCustomMultiplier(customValue, mult, gameState.theme);
  };

  // Rain Multiplier Surge Burst
  const triggerRainSurge = () => {
    sound.playLaserSound();
    setIsSurgeActive(true);
    confetti({ particleCount: 40, spread: 45, origin: { y: 0.7 } });

    // Accelerate rain sprites temporarily
    rainStreamsRef.current.forEach(sprite => {
      sprite.userData.speed *= 2.5;
    });

    setTimeout(() => {
      rainStreamsRef.current.forEach(sprite => {
        sprite.userData.speed /= 2.5;
      });
      setIsSurgeActive(false);
    }, 2000);
  };

  // Initialize Three.js Volumetric Rain & 4x4 Cube Matrix
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    const config = THEME_CONFIGS[gameState.theme];
    scene.background = new THREE.Color(config.bgHex);
    scene.fog = new THREE.FogExp2(new THREE.Color(config.bgHex).getHex(), 0.04);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCamera();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.4);
    topLight.position.set(0, 10, 5);
    scene.add(topLight);

    const pointLight = new THREE.PointLight(config.glow, 3.5, 20);
    pointLight.position.set(0, 4, 0);
    scene.add(pointLight);
    pointLightsRef.current = [pointLight];

    // 5. Build Volumetric 3D Matrix Rain
    const rainGroup = new THREE.Group();
    const rainSprites: THREE.Sprite[] = [];
    const rainTex = createMatrixTexture(config.charColor);
    const rainCount = gameState.rainDensity;

    for (let i = 0; i < rainCount; i++) {
      const spriteMat = new THREE.SpriteMaterial({
        map: rainTex,
        transparent: true,
        opacity: 0.3 + Math.random() * 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(spriteMat);

      // Random 3D spatial spread
      sprite.position.x = (Math.random() - 0.5) * 36;
      sprite.position.y = (Math.random() - 0.5) * 30;
      sprite.position.z = (Math.random() - 0.5) * 30 - 4;

      const scale = 1.8 + Math.random() * 2.2;
      sprite.scale.set(scale * 0.4, scale * 1.6, 1);
      sprite.userData = {
        speed: 0.08 + Math.random() * 0.14,
        resetY: 15 + Math.random() * 5,
        minY: -15
      };

      rainGroup.add(sprite);
      rainSprites.push(sprite);
    }
    rainStreamsRef.current = rainSprites;
    scene.add(rainGroup);

    // 6. Build 4x4 3D Matrix Cube Array
    const gridGroup = new THREE.Group();
    gridGroupRef.current = gridGroup;

    // Base Floating Cyber Platform
    const platformGeo = new THREE.BoxGeometry(6.6, 0.25, 6.6);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x08130d,
      roughness: 0.3,
      metalness: 0.8
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.4;
    gridGroup.add(platform);

    // Grid Rim Border Line
    const borderGeo = new THREE.BoxGeometry(6.7, 0.08, 6.7);
    const borderMat = new THREE.MeshBasicMaterial({ color: config.glow, wireframe: true });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.y = -0.26;
    gridGroup.add(border);

    // 16 3D Interactive Blocks
    const cubeMeshes: THREE.Mesh[] = [];
    const offset = ((GRID_SIZE - 1) * CUBE_SPACING) / 2;

    const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const index = r * GRID_SIZE + c;

        // Metallic digital glass cube
        const cubeMat = new THREE.MeshStandardMaterial({
          color: 0x112218,
          emissive: 0x0a1a12,
          emissiveIntensity: 0.2,
          roughness: 0.25,
          metalness: 0.85
        });

        const mesh = new THREE.Mesh(cubeGeo, cubeMat);
        mesh.position.set(
          c * CUBE_SPACING - offset,
          CUBE_SIZE / 2,
          r * CUBE_SPACING - offset
        );
        mesh.userData = { cubeIndex: index, row: r, col: c };

        // Add cyber wireframe overlay on each cube for holographic look
        const wireGeo = new THREE.EdgesGeometry(cubeGeo);
        const wireMat = new THREE.LineBasicMaterial({
          color: config.primary,
          transparent: true,
          opacity: 0.6
        });
        const wireframe = new THREE.LineSegments(wireGeo, wireMat);
        mesh.add(wireframe);

        gridGroup.add(mesh);
        cubeMeshes.push(mesh);
      }
    }
    cubeMeshesRef.current = cubeMeshes;
    scene.add(gridGroup);

    // 7. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Matrix Rain Falling movement
      rainSprites.forEach(sprite => {
        sprite.position.y -= sprite.userData.speed * gameState.rainSpeed;
        if (sprite.position.y < sprite.userData.minY) {
          sprite.position.y = sprite.userData.resetY;
        }
      });

      // Floating oscillation on matrix board
      if (gridGroup) {
        gridGroup.position.y = Math.sin(elapsedTime * 1.8) * 0.1;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 8. Event Listeners for Raycasting & Orbit
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDraggingRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      previousMousePositionRef.current = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - previousMousePositionRef.current.x;
      const deltaY = clientY - previousMousePositionRef.current.y;

      if ('buttons' in e && e.buttons === 1 || 'touches' in e) {
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          isDraggingRef.current = true;
          cameraOrbitRef.current.theta += deltaX * 0.008;
          cameraOrbitRef.current.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraOrbitRef.current.phi - deltaY * 0.008));
          updateCamera();
          previousMousePositionRef.current = { x: clientX, y: clientY };
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
        const intersects = raycasterRef.current.intersectObjects(cubeMeshesRef.current);

        if (intersects.length > 0) {
          const cubeIdx = intersects[0].object.userData.cubeIndex;
          if (cubeIdx !== undefined) {
            handleCubeClick(cubeIdx);
          }
        }
      }
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraOrbitRef.current.radius = Math.max(5.5, Math.min(16, cameraOrbitRef.current.radius + e.deltaY * 0.01));
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

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-transparent overflow-hidden select-none flex flex-col md:flex-row">
      {/* 3D Canvas */}
      <div 
        id="matrix-3d-canvas-container"
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
      >
        {/* Top Controls Overlay */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
          {/* Themes Palette */}
          <div className="flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-xl">
            {(Object.keys(THEME_CONFIGS) as MatrixTheme[]).map(thKey => (
              <button
                key={thKey}
                id={`matrix-theme-${thKey}`}
                onClick={() => switchTheme(thKey)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  gameState.theme === thKey
                    ? 'bg-emerald-500/20 text-white border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'text-white/50 hover:text-white border border-transparent'
                }`}
              >
                {THEME_CONFIGS[thKey].name}
              </button>
            ))}
          </div>

          <button
            id="matrix-camera-reset-btn"
            onClick={resetCamera}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black/60 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/70 hover:text-emerald-400 rounded-full text-xs font-medium transition-all shadow-xl"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>

        {/* Level / Status Top Banner */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Dynamic Sequence Multiplier Pill */}
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-3 py-2 rounded-xl shadow-xl font-mono">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] text-white/40 uppercase tracking-widest hidden sm:inline">Multiplier:</span>
            <span className="text-xs font-bold text-emerald-300">
              x{((1 + (Math.max(1, gameState.sequence.length) - 1) * 0.75) * multiplier).toFixed(1)}
            </span>
          </div>

          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-xl">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Stage:</span>
              <span className="text-sm font-bold text-emerald-400 font-mono tracking-wider">
                LVL {gameState.level}
              </span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Flame className="w-3.5 h-3.5" />
                {streak}x Streak
              </div>
            )}
          </div>
        </div>

        {/* Real-time Cascading Rain Multiplier Floating Toast */}
        {lastCascade && (Date.now() - lastCascade.timestamp < 3500) && (
          <div className="absolute bottom-16 sm:bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md border border-emerald-500/40 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] font-mono text-xs">
              <span className="text-emerald-400 font-bold text-sm">+{lastCascade.scoreEarned} PTS</span>
              <span className="text-white/30">•</span>
              <span className="text-white/80 text-[11px]">
                Node <span className="text-emerald-300 font-bold">#{lastCascade.cellIndex.toString(16).toUpperCase()}</span> (Val {lastCascade.clickedValue})
              </span>
              <span className="text-white/30">•</span>
              <span className="text-amber-300 font-bold text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {lastCascade.totalMultiplier}x Mult
              </span>
              <span className="text-[10px] text-emerald-400/80 hidden sm:inline">
                ({lastCascade.cascadeCount} Cascades)
              </span>
            </div>
          </div>
        )}

        {/* Orbit Hint */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-white/40 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
          <span className="text-emerald-400">CAM: ORBIT_FREE</span>
          <span>•</span>
          <span>SCROLL TO ZOOM</span>
          <span>•</span>
          <span>CLICK CUBES TO TRIGGER RAIN CASCADE</span>
        </div>
      </div>

      {/* Side Matrix HUD & Game Controls */}
      <div className="w-full md:w-80 bg-black/40 md:bg-black/30 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 p-6 flex flex-col justify-between z-20 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">
              Cipher Terminal
            </h3>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                The Matrix Grid
              </h2>
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-mono">
              Downstream cascading rain memory decoder with sequence-scaled score multiplication.
            </p>
          </div>

          {/* Stats Box */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest font-mono">
                Decryption Intel
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                BEST: {gameState.highScore}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">Current Score</div>
                <div className="text-xl font-bold text-emerald-400">{gameState.score}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">Sequence Multiplier</div>
                <div className="text-xl font-bold text-white">
                  {((1 + (Math.max(1, gameState.sequence.length) - 1) * 0.75) * multiplier).toFixed(1)}x
                </div>
              </div>
            </div>
          </div>

          {/* Interactive 4x4 Mini Pad */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest font-mono flex items-center gap-1.5">
                Sensor Matrix
                {cascadingCells.length > 0 && (
                  <span className="text-[9px] text-emerald-400 lowercase font-normal">
                    (rain ripple...)
                  </span>
                )}
              </h3>
              <span className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${
                gameState.status === 'showing'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                  : gameState.status === 'input'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                {gameState.status === 'showing' ? 'Scanning...' : gameState.status === 'input' ? 'Your Turn' : gameState.status}
              </span>
            </div>

            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <div className="grid grid-cols-4 gap-1.5 aspect-square max-w-[190px] mx-auto">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const isPrimaryActive = activeCube === idx;
                  const isCascade = cascadingCells.includes(idx);
                  return (
                    <button
                      key={idx}
                      id={`matrix-mini-cube-${idx}`}
                      disabled={gameState.isPlayingSequence && gameState.status === 'showing'}
                      onClick={() => handleCubeClick(idx)}
                      className={`aspect-square rounded-lg font-mono text-[10px] font-bold flex items-center justify-center transition-all ${
                        isPrimaryActive
                          ? 'bg-emerald-400 text-slate-950 scale-110 shadow-[0_0_14px_#34d399] z-10'
                          : isCascade
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 scale-105 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          : 'bg-white/5 border border-white/10 hover:border-emerald-500/50 text-white/40 hover:text-white'
                      }`}
                    >
                      {idx.toString(16).toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Value Multiplier & Rain Synthesizer */}
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Rain Multiplier
              </h3>
              <span className="text-[10px] text-white/40">{multiplier}x Stream Flow</span>
            </div>

            {/* User Custom Stream Code / Number input */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/40 block mb-1">
                Custom Rain Code / Value:
              </label>
              <input
                id="matrix-custom-code-input"
                type="text"
                value={customValue}
                onChange={(e) => handleCustomValueChange(e.target.value)}
                placeholder="e.g. NEXUS or 7 or 1010"
                className="w-full bg-black/50 border border-white/10 focus:border-emerald-500/60 rounded-lg px-3 py-1.5 text-xs text-emerald-300 placeholder:text-white/20 outline-none transition-all"
              />
            </div>

            {/* Multiplier Pills */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-white/40 block mb-1.5">
                Stream Multiplication Factor:
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 4, 8, 16].map(factor => (
                  <button
                    key={factor}
                    id={`matrix-multiplier-${factor}x`}
                    onClick={() => handleMultiplierChange(factor)}
                    className={`py-1 rounded-md text-[10px] font-bold transition-all ${
                      multiplier === factor
                        ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {factor}x
                  </button>
                ))}
              </div>
            </div>

            {/* Surge Cascade Button */}
            <button
              id="matrix-rain-surge-btn"
              onClick={triggerRainSurge}
              disabled={isSurgeActive}
              className={`w-full py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                isSurgeActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : 'bg-white/10 hover:bg-emerald-500/20 text-white/80 hover:text-emerald-300 border border-white/10'
              }`}
            >
              <Zap className="w-3 h-3" />
              {isSurgeActive ? 'Surge In Effect!' : 'Trigger Multiplier Rain Surge'}
            </button>
          </div>

          {/* Global Rank Badge matching Elegant Dark */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-white/10 text-center">
            <div className="text-xs text-emerald-300 font-medium mb-0.5">Neural Decoder Rank</div>
            <div className="text-2xl font-bold text-white tracking-tighter font-mono">
              {gameState.score > 0 ? `#${Math.max(1, 850 - Math.floor(gameState.score / 10))}` : '#1,842'}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
              Top 1% Memory Bandwidth
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 space-y-3">
          {gameState.status === 'gameover' && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-center text-xs font-mono font-bold animate-pulse">
              [ ACCESS DENIED - SEQUENCE BREACH ]
            </div>
          )}

          <button
            id="matrix-start-btn"
            onClick={startNewGame}
            disabled={gameState.isPlayingSequence}
            className="w-full py-3 bg-white text-black font-bold rounded-full text-xs tracking-[0.2em] uppercase shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {gameState.status === 'idle' ? (
              <>
                <Play className="w-3.5 h-3.5" />
                Initialize Sequence
              </>
            ) : gameState.status === 'gameover' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Re-attempt Breach
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Restart Matrix
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
