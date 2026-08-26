export type GameType = 'tictactoe' | 'matrix' | 'ludo';

// =================== TIC TAC TOE TYPES ===================
export type TTTPlayer = 'X' | 'O';
export type TTTBoard = (TTTPlayer | null)[];
export type TTTGameMode = 'pvp' | 'ai_easy' | 'ai_hard';

export interface TTTState {
  board: TTTBoard;
  currentPlayer: TTTPlayer;
  winner: TTTPlayer | 'draw' | null;
  winningLine: [number, number, number] | null;
  score: {
    X: number;
    O: number;
    ties: number;
  };
  gameMode: TTTGameMode;
  isAiThinking: boolean;
}

// =================== MATRIX TYPES ===================
export interface MatrixCubeState {
  id: number; // 0 to 15 (4x4)
  row: number;
  col: number;
  isLit: boolean;
  colorType: 'idle' | 'sequence' | 'user' | 'success' | 'error';
}

export type MatrixTheme = 'matrix_green' | 'cyber_cyan' | 'neon_purple' | 'solar_amber';

export interface MatrixGameState {
  level: number;
  score: number;
  highScore: number;
  sequence: number[];
  playerIndex: number;
  isPlayingSequence: boolean;
  status: 'idle' | 'showing' | 'input' | 'success' | 'gameover';
  speed: number;
  theme: MatrixTheme;
  rainSpeed: number;
  rainDensity: number;
}

// =================== LUDO TYPES ===================
export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export type PlayerType = 'human' | 'ai';

export interface LudoPlayer {
  id: LudoColor;
  name: string;
  color: string;
  hex: string;
  type: PlayerType;
  tokens: LudoToken[];
  hasWon: boolean;
  rank?: number;
}

export interface LudoToken {
  id: number; // 0, 1, 2, 3
  color: LudoColor;
  step: number; // -1 = in yard/base, 0..50 = main track, 51..55 = home stretch, 56 = finished/home
  position: { x: number; y: number; z: number };
  isHome: boolean;
  isBase: boolean;
}

export interface LudoGameState {
  players: Record<LudoColor, LudoPlayer>;
  activeColorOrder: LudoColor[];
  currentTurnIndex: number;
  diceValue: number | null;
  isRolling: boolean;
  hasRolled: boolean;
  movableTokenIds: number[];
  consecutiveSixes: number;
  winners: LudoColor[];
  gameStatus: 'setup' | 'playing' | 'ended';
  selectedPlayerCount: 2 | 3 | 4;
  lastMessage: string;
  isAiMoving: boolean;
}
