export interface GameState {
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED';
  currentPlayer: 'HUMAN' | 'COMPUTER';
  humanBoard: string[][];
  computerBoard: string[][];
  shipsPlaced: boolean;
  gameOver: boolean;
  winner: 'HUMAN' | 'COMPUTER' | null;
}

export interface GameResponse {
  id: number;
  state: GameState;
}

export interface ShipPlacement {
  placementMatrix: string[][];
}
