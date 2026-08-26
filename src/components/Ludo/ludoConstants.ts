import { LudoColor } from '../../types.ts';

// 15x15 Ludo Grid tile mapping
// Step unit for 3D coordinates
export const TILE_SIZE = 0.8;

// Convert grid (col: 0..14, row: 0..14) where center is (7,7) to 3D world (x, z)
export function gridToWorld(col: number, row: number, y: number = 0.2): [number, number, number] {
  const x = (col - 7) * TILE_SIZE;
  const z = (row - 7) * TILE_SIZE;
  return [x, y, z];
}

// 52 Main Track Tiles (Clockwise standard Ludo path starting from Red's entry)
// Red start: (1, 6) in standard coordinates
export const TRACK_GRID_COORDS: [number, number][] = [
  // 0-4: Red start straight going up
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // 5-10: Green corner top-left to top-right
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], // 11
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], // 12-17 (Green entry is index 13 at [1, 8])
  // 18-23: Green corner going down
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], // 24
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // 25-30 (Yellow entry is index 26 at [8, 13])
  // 31-36: Bottom-Right going right to left
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], // 37
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // 38-43 (Blue entry is index 39 at [13, 6])
  // 44-49: Bottom-Left going up
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], // 50
  [6, 0]  // 51
];

// Color start indices on the 52-tile track
export const COLOR_START_INDEX: Record<LudoColor, number> = {
  red: 0,       // Top-Left quadrant, begins at Top arm [6, 1]
  blue: 13,     // Bottom-Left quadrant, begins at Left arm [1, 8]
  yellow: 26,   // Bottom-Right quadrant, begins at Bottom arm [8, 13]
  green: 39     // Top-Right quadrant, begins at Right arm [13, 6]
};

// Safe spots (Stars on standard Ludo board):
// Red start (0), Tile 8, Blue start (13), Tile 21, Yellow start (26), Tile 34, Green start (39), Tile 47
export const SAFE_TRACK_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

// Home column grid coordinates (5 steps leading to center (7,7))
export const HOME_COLUMNS: Record<LudoColor, [number, number][]> = {
  red: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6] // Top arm going down
  ],
  blue: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7] // Left arm going right
  ],
  yellow: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8] // Bottom arm going up
  ],
  green: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7] // Right arm going left
  ]
};

// Base Yard Token Slot Positions in World coordinates
export const BASE_SLOT_POSITIONS: Record<LudoColor, [number, number, number][]> = {
  red: [
    [-3.8, 0.25, -3.8],
    [-2.4, 0.25, -3.8],
    [-3.8, 0.25, -2.4],
    [-2.4, 0.25, -2.4]
  ],
  blue: [
    [-3.8, 0.25, 2.4],
    [-2.4, 0.25, 2.4],
    [-3.8, 0.25, 3.8],
    [-2.4, 0.25, 3.8]
  ],
  yellow: [
    [2.4, 0.25, 2.4],
    [3.8, 0.25, 2.4],
    [2.4, 0.25, 3.8],
    [3.8, 0.25, 3.8]
  ],
  green: [
    [2.4, 0.25, -3.8],
    [3.8, 0.25, -3.8],
    [2.4, 0.25, -2.4],
    [3.8, 0.25, -2.4]
  ]
};

// Color styling constants
export const COLOR_PROPERTIES: Record<LudoColor, {
  name: string;
  hex: string;
  colorHex: number;
  emissiveHex: number;
  bgTailwind: string;
  borderTailwind: string;
  textTailwind: string;
}> = {
  red: {
    name: 'Crimson Red',
    hex: '#ef4444',
    colorHex: 0xef4444,
    emissiveHex: 0x7f1d1d,
    bgTailwind: 'bg-red-500',
    borderTailwind: 'border-red-500',
    textTailwind: 'text-red-400'
  },
  blue: {
    name: 'Azure Blue',
    hex: '#3b82f6',
    colorHex: 0x3b82f6,
    emissiveHex: 0x1e3a8a,
    bgTailwind: 'bg-blue-500',
    borderTailwind: 'border-blue-500',
    textTailwind: 'text-blue-400'
  },
  yellow: {
    name: 'Amber Gold',
    hex: '#f59e0b',
    colorHex: 0xf59e0b,
    emissiveHex: 0x78350f,
    bgTailwind: 'bg-amber-500',
    borderTailwind: 'border-amber-500',
    textTailwind: 'text-amber-400'
  },
  green: {
    name: 'Emerald Green',
    hex: '#10b981',
    colorHex: 0x10b981,
    emissiveHex: 0x064e3b,
    bgTailwind: 'bg-emerald-500',
    borderTailwind: 'border-emerald-500',
    textTailwind: 'text-emerald-400'
  }
};

// Cluster offset for multiple tokens sharing the same tile
export function getTokenClusterOffset(clusterIndex: number, totalInCluster: number): [number, number, number] {
  if (totalInCluster <= 1) return [0, 0, 0];
  if (totalInCluster === 2) {
    return clusterIndex === 0 ? [-0.14, 0, -0.14] : [0.14, 0, 0.14];
  }
  if (totalInCluster === 3) {
    const angle = (clusterIndex * (2 * Math.PI)) / 3;
    return [Math.cos(angle) * 0.17, 0, Math.sin(angle) * 0.17];
  }
  const angle = (clusterIndex * (2 * Math.PI)) / 4 + Math.PI / 4;
  return [Math.cos(angle) * 0.19, 0, Math.sin(angle) * 0.19];
}

// Compute 3D world position for a given token step
// step = -1: Base yard
// step = 0..50: Track
// step = 51..55: Home column
// step = 56: Center finished podium
export function getTokenWorldPosition(
  color: LudoColor, 
  tokenId: number, 
  step: number,
  clusterIndex: number = 0,
  clusterCount: number = 1
): [number, number, number] {
  if (step === -1) {
    return BASE_SLOT_POSITIONS[color][tokenId];
  }

  if (step >= 0 && step <= 50) {
    const startIdx = COLOR_START_INDEX[color];
    const trackIdx = (startIdx + step) % 52;
    const [col, row] = TRACK_GRID_COORDS[trackIdx];
    const [wx, wy, wz] = gridToWorld(col, row, 0.25);
    const [ox, , oz] = getTokenClusterOffset(clusterIndex, clusterCount);
    return [wx + ox, wy, wz + oz];
  }

  if (step >= 51 && step <= 55) {
    const homeStep = step - 51;
    const [col, row] = HOME_COLUMNS[color][homeStep];
    const yElevation = 0.25 + homeStep * 0.04;
    const [wx, , wz] = gridToWorld(col, row, yElevation);
    const [ox, , oz] = getTokenClusterOffset(clusterIndex, clusterCount);
    return [wx + ox, yElevation, wz + oz];
  }

  if (step === 56) {
    // Victory podium radial positions around center pyramid
    const podiumAngles: Record<LudoColor, number> = {
      red: -Math.PI * 0.75,
      blue: Math.PI * 0.75,
      yellow: Math.PI * 0.25,
      green: -Math.PI * 0.25
    };
    const baseAngle = podiumAngles[color];
    const subAngle = baseAngle + (tokenId - 1.5) * 0.35;
    const radius = 0.55;
    return [Math.cos(subAngle) * radius, 0.46, Math.sin(subAngle) * radius];
  }

  return [0, 0.6, 0];
}
