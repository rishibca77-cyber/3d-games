import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { 
  RotateCcw, 
  Sparkles, 
  User, 
  Bot, 
  Trophy, 
  HelpCircle, 
  Eye, 
  Swords, 
  Volume2, 
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { TTTPlayer, TTTBoard, TTTGameMode, TTTState } from '../../types.ts';
import { sound } from '../../utils/audio.ts';

const WINNING_COMBOS: [number, number, number][] = [
  // Rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonals
  [0, 4, 8],
  [2, 4, 6]
];

// 3D coordinates for cell indices 0-8 in a centered 3x3 grid (spacing: 2.2 units)
const CELL_SPACING = 2.2;
const CELL_POSITIONS: [number, number, number][] = [
  [-CELL_SPACING, 0, -CELL_SPACING], // 0: Top-Left
  [0, 0, -CELL_SPACING],             // 1: Top-Center
  [CELL_SPACING, 0, -CELL_SPACING],  // 2: Top-Right
  [-CELL_SPACING, 0, 0],             // 3: Mid-Left
  [0, 0, 0],                         // 4: Center
  [CELL_SPACING, 0, 0],              // 5: Mid-Right
  [-CELL_SPACING, 0, CELL_SPACING],  // 6: Bot-Left
  [0, 0, CELL_SPACING],              // 7: Bot-Center
  [CELL_SPACING, 0, CELL_SPACING],   // 8: Bot-Right
];

export const TicTacToe3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // React Game State
  const [gameState, setGameState] = useState<TTTState>({
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
    winningLine: null,
    score: { X: 0, O: 0, ties: 0 },
    gameMode: 'ai_hard',
    isAiThinking: false
  });

  const gameStateRef = useRef<TTTState>(gameState);
  gameStateRef.current = gameState;

  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // References to Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const cellMeshMapRef = useRef<THREE.Mesh[]>([]);
  const piecesGroupRef = useRef<THREE.Group | null>(null);
  const laserMeshRef = useRef<THREE.Mesh | null>(null);
  const laserLightRef = useRef<THREE.PointLight | null>(null);
  const gridPlatformRef = useRef<THREE.Group | null>(null);

  // Camera Orbit state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraOrbitRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3.2, radius: 10.5 });

  // Update camera based on orbit parameters
  const updateCameraTransform = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraOrbitRef.current;
    cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 0.2, 0);
  }, []);

  // Reset Camera View
  const resetCamera = () => {
    gsap.to(cameraOrbitRef.current, {
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
      radius: 10.5,
      duration: 1,
      ease: 'power2.out',
      onUpdate: updateCameraTransform
    });
  };

  // Minimax algorithm for Master AI
  const findBestMove = (board: TTTBoard): number => {
    const checkWin = (b: TTTBoard, player: TTTPlayer): boolean => {
      return WINNING_COMBOS.some(([a, bIdx, c]) => b[a] === player && b[bIdx] === player && b[c] === player);
    };

    const isFull = (b: TTTBoard): boolean => b.every(cell => cell !== null);

    const minimax = (b: TTTBoard, depth: number, isMax: boolean): number => {
      if (checkWin(b, 'O')) return 10 - depth;
      if (checkWin(b, 'X')) return depth - 10;
      if (isFull(b)) return 0;

      if (isMax) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
          if (b[i] === null) {
            b[i] = 'O';
            best = Math.max(best, minimax(b, depth + 1, false));
            b[i] = null;
          }
        }
        return best;
      } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
          if (b[i] === null) {
            b[i] = 'X';
            best = Math.min(best, minimax(b, depth + 1, true));
            b[i] = null;
          }
        }
        return best;
      }
    };

    let bestScore = -Infinity;
    let bestMove = -1;
    const availableMoves: number[] = [];

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        availableMoves.push(i);
        board[i] = 'O';
        const score = minimax(board, 0, false);
        board[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }

    if (bestMove === -1 && availableMoves.length > 0) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
    return bestMove;
  };

  // Spawn 3D 'X' Piece with bounce animation perfectly flush onto the cell tile
  const createXPiece = (position: [number, number, number]): THREE.Group => {
    const group = new THREE.Group();
    group.position.set(position[0], 3.2, position[2]); // Start in air

    const barGeo = new THREE.BoxGeometry(0.32, 0.28, 1.7);
    const xMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00a2ff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8
    });

    const bar1 = new THREE.Mesh(barGeo, xMat);
    bar1.rotation.y = Math.PI / 4;
    bar1.castShadow = true;

    const bar2 = new THREE.Mesh(barGeo, xMat);
    bar2.rotation.y = -Math.PI / 4;
    bar2.castShadow = true;

    // Glowing core indicator
    const sphereGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xc8ffff });
    const core = new THREE.Mesh(sphereGeo, sphereMat);

    group.add(bar1, bar2, core);

    // Drop cleanly onto the tile top surface (y = 0.18)
    gsap.to(group.position, {
      y: 0.18,
      duration: 0.55,
      ease: 'bounce.out'
    });

    gsap.fromTo(group.rotation, 
      { y: Math.PI * 2, x: Math.PI * 0.5 },
      { y: 0, x: 0, duration: 0.55, ease: 'power2.out' }
    );

    return group;
  };

  // Spawn 3D 'O' Piece with spin & drop animation flush on cell tile
  const createOPiece = (position: [number, number, number]): THREE.Group => {
    const group = new THREE.Group();
    group.position.set(position[0], 3.2, position[2]); // Start in air

    const torusGeo = new THREE.TorusGeometry(0.68, 0.16, 24, 48);
    const oMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      emissive: 0xff0055,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.85
    });

    const torus = new THREE.Mesh(torusGeo, oMat);
    torus.rotation.x = Math.PI / 2; // Flat on the plane
    torus.castShadow = true;

    // Outer subtle energy ring
    const ringGeo = new THREE.RingGeometry(0.8, 0.9, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff44aa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.02;

    group.add(torus, ring);

    // Drop cleanly onto tile top surface (y = 0.16)
    gsap.to(group.position, {
      y: 0.16,
      duration: 0.55,
      ease: 'back.out(1.6)'
    });

    gsap.fromTo(group.rotation,
      { y: Math.PI * 3, z: Math.PI },
      { y: 0, z: 0, duration: 0.65, ease: 'power2.out' }
    );

    return group;
  };

  // Render Winning 3D Neon Laser Beam
  const renderWinningLaser = (combo: [number, number, number]) => {
    const platform = gridPlatformRef.current;
    if (!platform) return;

    // Remove previous laser if any
    if (laserMeshRef.current) {
      platform.remove(laserMeshRef.current);
      laserMeshRef.current = null;
    }
    if (laserLightRef.current) {
      platform.remove(laserLightRef.current);
      laserLightRef.current = null;
    }

    const startPos = new THREE.Vector3(...CELL_POSITIONS[combo[0]]);
    const endPos = new THREE.Vector3(...CELL_POSITIONS[combo[2]]);
    const centerPos = new THREE.Vector3(...CELL_POSITIONS[combo[1]]);

    // Add extra overhang so the beam extends slightly beyond cells
    const direction = endPos.clone().sub(startPos).normalize();
    const length = startPos.distanceTo(endPos) + 1.8;

    const laserGeo = new THREE.CylinderGeometry(0.12, 0.12, length, 16);
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x39ff14,
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.1
    });

    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.copy(centerPos);
    laser.position.y = 0.22;

    // Orient cylinder along the vector between start and end
    const upVector = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, direction);
    laser.setRotationFromQuaternion(quaternion);

    // Add pulsing neon point light at center
    const laserLight = new THREE.PointLight(0x39ff14, 5, 8);
    laserLight.position.copy(laser.position);

    platform.add(laser);
    platform.add(laserLight);

    laserMeshRef.current = laser;
    laserLightRef.current = laserLight;

    // GSAP Pulse Laser Animation
    gsap.fromTo(laser.scale,
      { x: 0.1, y: 0.05, z: 0.1 },
      { x: 1.2, y: 1.0, z: 1.2, duration: 0.45, ease: 'power3.out' }
    );

    gsap.to(laserMat, {
      emissiveIntensity: 6.0,
      repeat: -1,
      yoyo: true,
      duration: 0.35
    });

    sound.playLaserSound();
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Handle cell click from 3D Raycaster or UI
  const handleCellClick = (index: number) => {
    const current = gameStateRef.current;
    if (current.board[index] || current.winner || current.isAiThinking) return;

    const newBoard = [...current.board];
    const player = current.currentPlayer;
    newBoard[index] = player;

    // Spawn 3D Piece in scene
    if (piecesGroupRef.current) {
      const piece = player === 'X' 
        ? createXPiece(CELL_POSITIONS[index])
        : createOPiece(CELL_POSITIONS[index]);
      piecesGroupRef.current.add(piece);
    }

    sound.playPlacementSound(player);

    // Check for Win or Draw
    let winCombo: [number, number, number] | null = null;
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        winCombo = combo;
        break;
      }
    }

    if (winCombo) {
      renderWinningLaser(winCombo);
      sound.playWinSound();
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        winner: player,
        winningLine: winCombo,
        score: {
          ...prev.score,
          [player]: prev.score[player] + 1
        }
      }));
      return;
    }

    const isDraw = newBoard.every(cell => cell !== null);
    if (isDraw) {
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        winner: 'draw',
        score: {
          ...prev.score,
          ties: prev.score.ties + 1
        }
      }));
      return;
    }

    const nextPlayer: TTTPlayer = player === 'X' ? 'O' : 'X';

    // Check if AI turn is triggered
    if (current.gameMode !== 'pvp' && nextPlayer === 'O') {
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        currentPlayer: 'O',
        isAiThinking: true
      }));

      // AI Move delay for natural feel
      setTimeout(() => {
        const latestState = gameStateRef.current;
        let aiMove = -1;
        if (latestState.gameMode === 'ai_easy') {
          const available = newBoard.map((c, i) => c === null ? i : null).filter((i): i is number => i !== null);
          aiMove = available[Math.floor(Math.random() * available.length)];
        } else {
          aiMove = findBestMove(newBoard);
        }

        if (aiMove !== -1) {
          const aiBoard = [...newBoard];
          aiBoard[aiMove] = 'O';

          if (piecesGroupRef.current) {
            const piece = createOPiece(CELL_POSITIONS[aiMove]);
            piecesGroupRef.current.add(piece);
          }
          sound.playPlacementSound('O');

          // Check AI win
          let aiWinCombo: [number, number, number] | null = null;
          for (const combo of WINNING_COMBOS) {
            const [a, b, c] = combo;
            if (aiBoard[a] && aiBoard[a] === aiBoard[b] && aiBoard[a] === aiBoard[c]) {
              aiWinCombo = combo;
              break;
            }
          }

          if (aiWinCombo) {
            renderWinningLaser(aiWinCombo);
            sound.playWinSound();
            setGameState(prev => ({
              ...prev,
              board: aiBoard,
              currentPlayer: 'X',
              winner: 'O',
              winningLine: aiWinCombo,
              isAiThinking: false,
              score: {
                ...prev.score,
                O: prev.score.O + 1
              }
            }));
          } else if (aiBoard.every(c => c !== null)) {
            setGameState(prev => ({
              ...prev,
              board: aiBoard,
              currentPlayer: 'X',
              winner: 'draw',
              isAiThinking: false,
              score: {
                ...prev.score,
                ties: prev.score.ties + 1
              }
            }));
          } else {
            setGameState(prev => ({
              ...prev,
              board: aiBoard,
              currentPlayer: 'X',
              isAiThinking: false
            }));
          }
        }
      }, 500);

    } else {
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        currentPlayer: nextPlayer
      }));
    }
  };

  // Reset Board Round
  const resetRound = () => {
    sound.playClickSound();

    // Clear 3D pieces
    if (piecesGroupRef.current) {
      while (piecesGroupRef.current.children.length > 0) {
        piecesGroupRef.current.remove(piecesGroupRef.current.children[0]);
      }
    }

    // Remove winning laser
    if (laserMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(laserMeshRef.current);
      laserMeshRef.current = null;
    }
    if (laserLightRef.current && sceneRef.current) {
      sceneRef.current.remove(laserLightRef.current);
      laserLightRef.current = null;
    }

    setGameState(prev => ({
      ...prev,
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      winningLine: null,
      isAiThinking: false
    }));
  };

  // Reset Entire Game (including scores)
  const resetFullGame = () => {
    resetRound();
    setGameState(prev => ({
      ...prev,
      score: { X: 0, O: 0, ties: 0 }
    }));
  };

  // Set Game Mode
  const setMode = (mode: TTTGameMode) => {
    sound.playClickSound();
    resetRound();
    setGameState(prev => ({
      ...prev,
      gameMode: mode,
      score: { X: 0, O: 0, ties: 0 }
    }));
  };

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.035);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraTransform();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainDirectional = new THREE.DirectionalLight(0xffffff, 1.6);
    mainDirectional.position.set(6, 12, 8);
    mainDirectional.castShadow = true;
    mainDirectional.shadow.mapSize.width = 2048;
    mainDirectional.shadow.mapSize.height = 2048;
    scene.add(mainDirectional);

    // Cyan rim accent
    const cyanLight = new THREE.PointLight(0x00f3ff, 2.5, 15);
    cyanLight.position.set(-6, 4, -4);
    scene.add(cyanLight);

    // Magenta accent
    const magentaLight = new THREE.PointLight(0xff0077, 2.5, 15);
    magentaLight.position.set(6, 4, 4);
    scene.add(magentaLight);

    // 5. 3D Floating Cyber Platform
    const platformGroup = new THREE.Group();
    gridPlatformRef.current = platformGroup;

    // Base podium
    const baseGeo = new THREE.CylinderGeometry(4.8, 5.2, 0.4, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.85,
      roughness: 0.25
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.25;
    base.receiveShadow = true;
    platformGroup.add(base);

    // Glowing rim ring
    const ringGeo = new THREE.TorusGeometry(4.9, 0.08, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 1.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.05;
    platformGroup.add(ring);

    // Glowing 3x3 Grid Lines
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x1f293d,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.3
    });

    const gridBarH1 = new THREE.Mesh(new THREE.BoxGeometry(CELL_SPACING * 3, 0.12, 0.12), gridMat);
    gridBarH1.position.set(0, 0.05, -CELL_SPACING * 0.5);
    gridBarH1.castShadow = true;

    const gridBarH2 = new THREE.Mesh(new THREE.BoxGeometry(CELL_SPACING * 3, 0.12, 0.12), gridMat);
    gridBarH2.position.set(0, 0.05, CELL_SPACING * 0.5);
    gridBarH2.castShadow = true;

    const gridBarV1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, CELL_SPACING * 3), gridMat);
    gridBarV1.position.set(-CELL_SPACING * 0.5, 0.05, 0);
    gridBarV1.castShadow = true;

    const gridBarV2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, CELL_SPACING * 3), gridMat);
    gridBarV2.position.set(CELL_SPACING * 0.5, 0.05, 0);
    gridBarV2.castShadow = true;

    platformGroup.add(gridBarH1, gridBarH2, gridBarV1, gridBarV2);

    // 9 Interactive Glass Cell Tiles for Raycasting
    const cellMeshes: THREE.Mesh[] = [];
    const cellTileGeo = new THREE.BoxGeometry(1.9, 0.1, 1.9);

    CELL_POSITIONS.forEach((pos, idx) => {
      const cellTileMat = new THREE.MeshStandardMaterial({
        color: 0x161e2e,
        roughness: 0.4,
        metalness: 0.5,
        transparent: true,
        opacity: 0.8
      });
      const cellMesh = new THREE.Mesh(cellTileGeo, cellTileMat);
      cellMesh.position.set(pos[0], 0.0, pos[2]);
      cellMesh.receiveShadow = true;
      cellMesh.userData = { cellIndex: idx };
      platformGroup.add(cellMesh);
      cellMeshes.push(cellMesh);
    });
    cellMeshMapRef.current = cellMeshes;

    scene.add(platformGroup);

    // Pieces Group attached to floating platform so they move in perfect physical unison
    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    platformGroup.add(piecesGroup);

    // Background floating particle dust
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 200;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 30;
      dustPos[i + 1] = (Math.random() - 0.5) * 20;
      dustPos[i + 2] = (Math.random() - 0.5) * 30;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.1,
      transparent: true,
      opacity: 0.4
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // 6. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle float oscillation on platform
      if (platformGroup) {
        platformGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.08;
      }
      if (dust) {
        dust.rotation.y = elapsedTime * 0.03;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 7. Mouse & Touch Raycasting & Orbit Handlers
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

      // Check if user is dragging camera
      const deltaX = clientX - previousMousePositionRef.current.x;
      const deltaY = clientY - previousMousePositionRef.current.y;

      if ('buttons' in e && e.buttons === 1 || 'touches' in e) {
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          isDraggingRef.current = true;
          cameraOrbitRef.current.theta += deltaX * 0.008;
          cameraOrbitRef.current.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraOrbitRef.current.phi - deltaY * 0.008));
          updateCameraTransform();
          previousMousePositionRef.current = { x: clientX, y: clientY };
        }
      }

      // Update Normalized Device Coordinates for Raycasting
      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast against cell meshes
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(cellMeshMapRef.current);

      if (intersects.length > 0) {
        const hitIdx = intersects[0].object.userData.cellIndex;
        setHoveredCell(hitIdx);

        // Highlight hit cell tile
        cellMeshMapRef.current.forEach((mesh, idx) => {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (idx === hitIdx) {
            mat.emissive.setHex(0x00f3ff);
            mat.emissiveIntensity = 0.5;
            mat.color.setHex(0x223552);
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
            mat.color.setHex(0x161e2e);
          }
        });
      } else {
        setHoveredCell(null);
        cellMeshMapRef.current.forEach(mesh => {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          mat.color.setHex(0x161e2e);
        });
      }
    };

    const onPointerUp = (e: MouseEvent | TouchEvent) => {
      // If user wasn't dragging, treat as click
      if (!isDraggingRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;

        mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(cellMeshMapRef.current);

        if (intersects.length > 0) {
          const cellIndex = intersects[0].object.userData.cellIndex;
          handleCellClick(cellIndex);
        }
      }
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraOrbitRef.current.radius = Math.max(6, Math.min(18, cameraOrbitRef.current.radius + e.deltaY * 0.01));
      updateCameraTransform();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Handle Resize
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
      cancelAnimationFrame(animationFrameId);
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
      {/* 3D Canvas Mount */}
      <div 
        id="tictactoe-3d-canvas-container"
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
      >
        {/* Floating 3D HUD & Controls Overlay */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-xl">
            <button
              id="ttt-mode-ai-hard"
              onClick={() => setMode('ai_hard')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                gameState.gameMode === 'ai_hard'
                  ? 'bg-cyan-500/15 text-white border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-white/50 hover:text-white border border-transparent'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              Master AI
            </button>
            <button
              id="ttt-mode-ai-easy"
              onClick={() => setMode('ai_easy')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                gameState.gameMode === 'ai_easy'
                  ? 'bg-cyan-500/15 text-white border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-white/50 hover:text-white border border-transparent'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              Casual AI
            </button>
            <button
              id="ttt-mode-pvp"
              onClick={() => setMode('pvp')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                gameState.gameMode === 'pvp'
                  ? 'bg-cyan-500/15 text-white border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-white/50 hover:text-white border border-transparent'
              }`}
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              PvP Local
            </button>
          </div>

          {/* Camera Reset */}
          <button
            id="ttt-camera-reset-btn"
            onClick={resetCamera}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black/60 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/70 hover:text-white rounded-full text-xs font-medium transition-all shadow-xl"
            title="Reset 3D Orbit Camera"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>

        {/* Top Right Status Banner */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Turn:</span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono ${
                gameState.currentPlayer === 'X' 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
              }`}>
                {gameState.currentPlayer} {gameState.currentPlayer === 'X' ? 'CYAN' : 'ROSE'}
              </span>
            </div>
            {gameState.isAiThinking && (
              <span className="text-xs text-amber-400 animate-pulse font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> AI Thinking...
              </span>
            )}
          </div>
        </div>

        {/* Bottom Orbit Guidance */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider text-white/40 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
          <span className="text-cyan-400">CAM: ORBIT_FREE</span>
          <span>•</span>
          <span>SCROLL TO ZOOM</span>
          <span>•</span>
          <span>DIRECT 3D RAYCAST</span>
        </div>
      </div>

      {/* Side HUD Panel */}
      <div className="w-full md:w-80 bg-black/40 md:bg-black/30 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 p-6 flex flex-col justify-between z-20 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">
              Match Station
            </h3>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                3D Hologram Arena
              </h2>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Floating metallic grid with real-time raycasting and laser vector victory line.
            </p>
          </div>

          {/* Current Match Roster */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                Current Match
              </h3>
              <button 
                onClick={resetFullGame}
                className="text-[10px] uppercase font-mono tracking-wider text-white/40 hover:text-white/80 transition-colors"
              >
                Clear Stats
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Player X card */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-sm shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                    X
                  </div>
                  <div>
                    <div className="text-xs text-white font-semibold">Player One (Cyan)</div>
                    <div className="text-[10px] text-white/40 font-mono">
                      {gameState.currentPlayer === 'X' && !gameState.winner ? 'Taking Move...' : 'Ready'}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold text-white font-mono">{gameState.score.X}</div>
              </div>

              {/* Player O card */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold text-sm shadow-[0_0_10px_rgba(244,63,94,0.25)]">
                    O
                  </div>
                  <div>
                    <div className="text-xs text-white font-semibold">
                      {gameState.gameMode === 'pvp' ? 'Player Two' : 'Neural AI (Rose)'}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono">
                      {gameState.isAiThinking ? 'Calculating...' : gameState.currentPlayer === 'O' && !gameState.winner ? 'Active Turn' : 'Ready'}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold text-white font-mono">{gameState.score.O}</div>
              </div>

              {/* Ties count card */}
              <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/40 font-mono text-[11px]">Draws / Stalemate</span>
                <span className="font-mono text-white/70 font-bold">{gameState.score.ties}</span>
              </div>
            </div>
          </div>

          {/* 2D Mini Grid & Interactive Mirror */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
              Tactical Sensor Mirror
            </h3>
            <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
              <div className="grid grid-cols-3 gap-2 aspect-square max-w-[190px] mx-auto">
                {gameState.board.map((cell, idx) => (
                  <button
                    key={idx}
                    id={`ttt-mini-cell-${idx}`}
                    disabled={cell !== null || !!gameState.winner || gameState.isAiThinking}
                    onClick={() => handleCellClick(idx)}
                    className={`aspect-square rounded-lg font-black text-lg flex items-center justify-center transition-all ${
                      cell === 'X'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : cell === 'O'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : hoveredCell === idx
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/20'
                    }`}
                  >
                    {cell}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Global Rank Badge matching Elegant Dark */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/10 text-center">
            <div className="text-xs text-cyan-300 font-medium mb-0.5">Arena Mastery</div>
            <div className="text-2xl font-bold text-white tracking-tighter font-mono">
              {gameState.score.X > 0 ? `#${Math.max(1, 1000 - gameState.score.X * 42)}` : '#1,248'}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
              Top 2% Hologram Tacticians
            </div>
          </div>
        </div>

        {/* Bottom Actions & Winner Alert */}
        <div className="pt-4 space-y-3">
          {gameState.winner && (
            <div className={`p-3 rounded-xl text-center text-xs font-mono font-bold border transition-all animate-bounce ${
              gameState.winner === 'draw'
                ? 'bg-white/10 text-white border-white/20'
                : gameState.winner === 'X'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
            }`}>
              {gameState.winner === 'draw'
                ? "⚡ STALEMATE DRAW"
                : `🎉 PLAYER ${gameState.winner} VICTORY!`}
            </div>
          )}

          <button
            id="ttt-new-round-btn"
            onClick={resetRound}
            className="w-full py-3 bg-white text-black font-bold rounded-full text-xs tracking-[0.2em] uppercase shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {gameState.winner ? 'Play Next Round' : 'Reset Round'}
          </button>
        </div>
      </div>
    </div>
  );
};
