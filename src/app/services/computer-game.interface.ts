// Интерфейсы для работы с игрой против ИИ
export interface ShipPlacementDto {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}
export interface ComputerGameStartRequest {
  placementStrategy: string;
  playerShips: ShipPlacementDto[];
}
// Интерфейс для состояния игры против компьютера
export interface SinglePlayerGameState {
  playerField: string[][];
  computerField: string[][];
  playerHits: boolean[][];
  computerHits: boolean[][];
  playerShips: number;
  computerShips: number;
  isPlayerTurn: boolean;
  gameStatus: string;
  lastMoveTime?: string;
}
export interface ComputerGame {
  gameId: number;
  player1: any;
  player2: any;
  gameBoard1: any;
  gameBoard2: any;
  result: string;
  startDate: string;
  endDate: string;
  gameStatus: string;
  gameType: string;
}

export interface GameState {
  gameId: number;
  status: string;
  playerTurn: boolean;
  playerBoard: string[][];
  computerBoard: string[][];
  playerHits: number;
  playerMisses: number;
  computerHits: number;
  computerMisses: number;
  playerShipsRemaining: number;
  computerShipsRemaining: number;
}

export interface ShotRequest {
  row: number;
  col: number;
}

export interface ShotResponse {
  hit: boolean;
  message: string;
  sunk: boolean;
  sunkShipId?: number;
  gameOver: boolean;
  computerRow?: number;
  computerCol?: number;
  computerHit?: boolean;
  computerSunk?: boolean;
  computerSunkShipId?: number;
}

export interface GameType {
  SINGLEPLAYER: string;
  MULTIPLAYER: string;
}

export interface GameStatus {
  WAITING: string;
  ACTIVE: string;
  COMPLETED: string;
}
