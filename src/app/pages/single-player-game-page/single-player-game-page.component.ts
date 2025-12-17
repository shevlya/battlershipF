import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // ДОБАВЬТЕ ЭТОТ ИМПОРТ
import { ComputerGameService, ShipPlacementDto, ComputerGameStartRequest } from '../../services/computer-game.service';
import { Subscription } from 'rxjs';

// Интерфейс для состояния игры против компьютера
interface SinglePlayerGameState {
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

@Component({
  selector: 'app-single-player-field',
  templateUrl: './single-player-field.component.html',
  styleUrls: ['./single-player-field.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SinglePlayerFieldComponent implements OnChanges, OnInit, OnDestroy {
  // Публичные свойства, используемые в шаблоне
  @Input() gameId: number = 0;
  @Input() playerName: string = 'Игрок';
  @Input() playerShips: ShipPlacementDto[] = [];
  @Input() playerId: number = 1;

  isGameStarted = false;
  isLoading = false;
  errorMessage = '';
  showSurrenderPopup = false;
  showPausePopup = false;

  playerShotsCount = 0;
  playerHitsCount = 0;
  computerShotsCount = 0;
  computerHitsCount = 0;

  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  placementStrategy: string = 'RANDOM';

  @Input() gameState: SinglePlayerGameState = {
    playerField: [],
    computerField: [],
    playerHits: [],
    computerHits: [],
    playerShips: 10,
    computerShips: 10,
    isPlayerTurn: false,
    gameStatus: 'WAITING'
  };

  @Output() cellSelected = new EventEmitter<{ row: number; col: number }>();
  @Output() gameAction = new EventEmitter<{ type: string; data?: any }>();
  @Output() onGameStarted = new EventEmitter<any>();

  private subscriptions: Subscription[] = [];

  // ДОБАВЬТЕ Router В КОНСТРУКТОР
  constructor(
    private computerGameService: ComputerGameService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('=== SINGLE PLAYER FIELD INIT ===');
    this.initializeEmptyFields();

    // Попробовать получить конфигурацию из state роутера
    const navigation = (this.router as any).getCurrentNavigation?.();
    if (navigation?.extras?.state) {
      const gameConfig = navigation.extras.state['gameConfig'];
      console.log('Game config from router state:', gameConfig);

      if (gameConfig && gameConfig.gameId && gameConfig.gameId > 0) {
        this.gameId = gameConfig.gameId;
        this.playerId = gameConfig.playerId;
        this.playerShips = gameConfig.ships || [];
        console.log('✅ Loaded from router state');
      }
    }

    // Если не загрузилось, пробуем localStorage
    if (!this.gameId || this.gameId === 0) {
      const savedConfig = localStorage.getItem('currentGameConfig');
      if (savedConfig) {
        try {
          const gameConfig = JSON.parse(savedConfig);
          console.log('Game config from localStorage:', gameConfig);

          if (gameConfig && gameConfig.gameId && gameConfig.gameId > 0) {
            this.gameId = gameConfig.gameId;
            this.playerId = gameConfig.playerId;
            this.playerShips = gameConfig.ships || [];
            console.log('✅ Loaded from localStorage');
          }
        } catch (e) {
          console.error('Error parsing localStorage config:', e);
        }
      }
    }

    console.log('Final values:', {
      gameId: this.gameId,
      playerId: this.playerId,
      playerShipsCount: this.playerShips?.length
    });

    if (this.gameId && this.gameId > 0) {
      console.log('Loading game state for gameId:', this.gameId);
      this.loadGameState();
    } else {
      console.error('❌ ERROR: No valid gameId found!');
      this.errorMessage = 'Игра не найдена. Вернитесь и создайте игру заново.';

      // Показать ошибку пользователю
      setTimeout(() => {
        alert('Игра не найдена. Создайте новую игру.');
        this.router.navigate(['/placement']);
      }, 1000);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameState'] && !changes['gameState'].firstChange) {
      this.updateStats();
    }

    if (changes['gameId'] && this.gameId && this.gameId > 0) {
      this.loadGameState();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeEmptyFields() {
    if (!this.gameState.playerField.length) {
      this.gameState.playerField = this.createEmptyField();
    }
    if (!this.gameState.computerField.length) {
      this.gameState.computerField = this.createEmptyField();
    }
    if (!this.gameState.playerHits.length) {
      this.gameState.playerHits = this.createEmptyHitsField();
    }
    if (!this.gameState.computerHits.length) {
      this.gameState.computerHits = this.createEmptyHitsField();
    }
  }

  private loadGameState() {
    if (this.gameId) {
      this.isLoading = true;
      this.computerGameService.getGameState(this.gameId).subscribe({
        next: (response: any) => {
          this.updateGameStateFromResponse(response);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Failed to load game state:', error);
          this.errorMessage = 'Не удалось загрузить состояние игры';
          this.isLoading = false;
        }
      });
    }
  }

  private updateGameStateFromResponse(response: any) {
    this.gameState = {
      playerField: this.convertBoardFormat(response.playerBoard, true),
      computerField: this.convertBoardFormat(response.computerBoard, false),
      playerHits: this.extractHits(response.playerBoard),
      computerHits: this.extractHits(response.computerBoard),
      playerShips: this.countRemainingShips(response.playerBoard),
      computerShips: this.countRemainingShips(response.computerBoard),
      isPlayerTurn: response.playerTurn,
      gameStatus: response.status,
      lastMoveTime: response.lastMoveTime
    };

    this.updateStats();
    this.isGameStarted = this.gameState.gameStatus === 'ACTIVE';
  }

  // Геттеры для шаблона
  get isYourTurn(): boolean {
    return this.gameState?.isPlayerTurn ?? false;
  }

  get myShipsCount(): number {
    return this.gameState?.playerShips ?? 10;
  }

  get opponentShipsCount(): number {
    return this.gameState?.computerShips ?? 10;
  }

  get myField(): string[][] {
    return this.gameState?.playerField || this.createEmptyField();
  }

  get opponentField(): string[][] {
    return this.gameState?.computerField || this.createEmptyField();
  }

  get myHits(): boolean[][] {
    return this.gameState?.playerHits || this.createEmptyHitsField();
  }

  get opponentHits(): boolean[][] {
    return this.gameState?.computerHits || this.createEmptyHitsField();
  }

  // Методы для шаблона
  isShipSunk(row: number, col: number, isMyField: boolean): boolean {
    const field = isMyField ? this.myField : this.opponentField;
    const hits = isMyField ? this.myHits : this.opponentHits;

    if (!field[row]?.[col] || field[row][col] !== 'HIT') {
      return false;
    }

    return this.checkShipSunk(row, col, field, hits);
  }

  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn || !this.isGameStarted) {
      return;
    }

    if (this.opponentHits[row][col]) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.computerGameService.makeShot(this.gameId, row, col).subscribe({
      next: (response) => {
        this.handleShotResponse(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Shot error:', error);
        this.errorMessage = error.error?.message || 'Ошибка при выполнении выстрела';
        this.isLoading = false;
      }
    });
  }

  startGame(): void {
    console.log('=== START GAME BUTTON CLICKED ===');
    console.log('Current gameId:', this.gameId);
    console.log('Player ID:', this.playerId);
    console.log('Player ships:', this.playerShips);

    if (!this.gameId || this.gameId === 0) {
      this.errorMessage = 'Ошибка: ID игры не найден';
      console.error('ERROR: gameId is 0 or invalid');
      return;
    }

    if (!this.playerShips || this.playerShips.length === 0) {
      this.errorMessage = 'Ошибка: корабли не размещены';
      console.error('ERROR: No ships');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const request: ComputerGameStartRequest = {
      placementStrategy: this.placementStrategy,
      playerShips: this.playerShips
    };

    console.log('Sending setup request for game:', this.gameId);

    this.computerGameService.setupGame(this.gameId, request).subscribe({
      next: (response: any) => {
        console.log('Setup game response:', response);

        // Подписываемся на WebSocket
        this.computerGameService.subscribeToGame(this.gameId);

        // Загружаем состояние игры
        this.loadGameState();

        this.isGameStarted = true;
        this.isLoading = false;

        console.log('✅ Game started successfully!');

        this.onGameStarted.emit({
          gameId: this.gameId,
          gameState: this.gameState
        });
      },
      error: (error) => {
        console.error('Setup game error:', error);
        this.errorMessage = error.error?.message || 'Ошибка при настройке игры';
        this.isLoading = false;
      }
    });
  }

  restartGame(): void {
    this.gameId = 0;
    this.isGameStarted = false;
    this.gameState = {
      playerField: this.createEmptyField(),
      computerField: this.createEmptyField(),
      playerHits: this.createEmptyHitsField(),
      computerHits: this.createEmptyHitsField(),
      playerShips: 10,
      computerShips: 10,
      isPlayerTurn: false,
      gameStatus: 'WAITING'
    };
    this.playerShotsCount = 0;
    this.playerHitsCount = 0;
    this.computerShotsCount = 0;
    this.computerHitsCount = 0;
    this.errorMessage = '';

    // Очищаем localStorage
    localStorage.removeItem('currentGameConfig');

    // Навигация обратно к размещению кораблей
    this.router.navigate(['/placement']);

    this.gameAction.emit({ type: 'RESTART' });
  }

  surrender(): void {
    this.showSurrenderPopup = true;
  }

  confirmSurrender(): void {
    if (this.gameId) {
      this.computerGameService.surrender(this.gameId).subscribe({
        next: () => {
          this.gameState.gameStatus = 'COMPLETED';
          this.showSurrenderPopup = false;
          this.gameAction.emit({ type: 'SURRENDER' });

          // Перенаправляем в лобби после сдачи
          setTimeout(() => {
            this.router.navigate(['/lobby']);
          }, 2000);
        },
        error: (error) => {
          console.error('Surrender error:', error);
          this.errorMessage = 'Ошибка при сдаче';
        }
      });
    }
  }

  cancelSurrender(): void {
    this.showSurrenderPopup = false;
  }

  pauseGame(): void {
    this.showPausePopup = true;
    this.gameAction.emit({ type: 'PAUSE' });
  }

  resumeGame(): void {
    this.showPausePopup = false;
    this.gameAction.emit({ type: 'RESUME' });
  }

  // Вспомогательные методы
  private handleShotResponse(response: any) {
    console.log('=== SHOT RESPONSE DEBUG ===');
    console.log('Hit:', response.hit);
    console.log('Message:', response.message);
    console.log('Game over:', response.gameOver);
    console.log('Computer shot:', response.computerRow, response.computerCol);
    console.log('Computer hit:', response.computerHit);
    console.log('Computer sunk:', response.computerSunk);

    if (response.hit) {
      this.gameState.computerField[response.row][response.col] = 'HIT';
    } else {
      this.gameState.computerField[response.row][response.col] = 'MISS';
    }
    this.gameState.computerHits[response.row][response.col] = true;

    this.playerShotsCount++;
    if (response.hit) {
      this.playerHitsCount++;
    }

    if (response.computerRow !== undefined && response.computerCol !== undefined) {
      if (response.computerHit) {
        this.gameState.playerField[response.computerRow][response.computerCol] = 'HIT';
      } else {
        this.gameState.playerField[response.computerRow][response.computerCol] = 'MISS';
      }
      this.gameState.playerHits[response.computerRow][response.computerCol] = true;

      this.computerShotsCount++;
      if (response.computerHit) {
        this.computerHitsCount++;
      }
    }

    if (response.playerShipsRemaining !== undefined) {
      this.gameState.playerShips = response.playerShipsRemaining;
    }
    if (response.computerShipsRemaining !== undefined) {
      this.gameState.computerShips = response.computerShipsRemaining;
    }

    this.gameState.isPlayerTurn = response.playerTurn;

    if (response.gameOver) {
      this.gameState.gameStatus = 'COMPLETED';
      this.showGameOverMessage(response.message || 'Игра завершена!');
    }

    this.updateStats();
  }

  private showGameOverMessage(message: string) {
    const result = confirm(`${message}\n\nХотите начать новую игру?`);
    if (result) {
      this.restartGame();
    }
  }

  private checkShipSunk(row: number, col: number, field: string[][], hits: boolean[][]): boolean {
    const directions = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
    ];

    const visited = new Set<string>();
    let isSunk = true;

    const checkCell = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (visited.has(key) || !this.isValidPosition(r, c)) return;
      visited.add(key);

      if (field[r]?.[c] === 'SHIP' || field[r]?.[c] === 'HIT') {
        if (field[r][c] === 'SHIP') {
          isSunk = false;
          return;
        }

        if (field[r][c] === 'HIT') {
          for (const dir of directions) {
            checkCell(r + dir.r, c + dir.c);
          }
        }
      }
    };

    checkCell(row, col);
    return isSunk;
  }

  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 10 && col >= 0 && col < 10;
  }

  private updateStats(): void {
    this.playerShotsCount = 0;
    this.playerHitsCount = 0;
    this.computerShotsCount = 0;
    this.computerHitsCount = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (this.opponentHits[i][j]) {
          this.playerShotsCount++;
          if (this.opponentField[i][j] === 'HIT') {
            this.playerHitsCount++;
          }
        }

        if (this.myHits[i][j]) {
          this.computerShotsCount++;
          if (this.myField[i][j] === 'HIT') {
            this.computerHitsCount++;
          }
        }
      }
    }
  }

  private createEmptyField(): string[][] {
    return Array(10).fill(null).map(() => Array(10).fill('EMPTY'));
  }

  private createEmptyHitsField(): boolean[][] {
    return Array(10).fill(null).map(() => Array(10).fill(false));
  }

  private convertBoardFormat(board: string[][], showShips: boolean): string[][] {
    const converted: string[][] = [];

    for (let i = 0; i < 10; i++) {
      converted[i] = [];
      for (let j = 0; j < 10; j++) {
        const cell = board[i]?.[j] || 'EMPTY';

        if (!showShips && cell === 'SHIP') {
          converted[i][j] = 'EMPTY';
        } else {
          converted[i][j] = cell;
        }
      }
    }

    return converted;
  }

  private extractHits(board: string[][]): boolean[][] {
    const hits: boolean[][] = [];

    for (let i = 0; i < 10; i++) {
      hits[i] = [];
      for (let j = 0; j < 10; j++) {
        const cell = board[i]?.[j] || 'EMPTY';
        hits[i][j] = cell === 'HIT' || cell === 'MISS';
      }
    }

    return hits;
  }

  private countRemainingShips(board: string[][]): number {
    const visited: boolean[][] = Array(10).fill(null).map(() => Array(10).fill(false));
    let shipCount = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (board[i][j] === 'SHIP' && !visited[i][j]) {
          this.markShip(i, j, board, visited);
          shipCount++;
        }
      }
    }

    return shipCount;
  }

  private markShip(row: number, col: number, board: string[][], visited: boolean[][]) {
    const directions = [
      { r: 1, c: 0 }, { r: -1, c: 0 }, { r: 0, c: 1 }, { r: 0, c: -1 }
    ];

    const stack = [[row, col]];

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;

      if (r < 0 || r >= 10 || c < 0 || c >= 10 || visited[r][c] || board[r][c] !== 'SHIP') {
        continue;
      }

      visited[r][c] = true;

      for (const dir of directions) {
        stack.push([r + dir.r, c + dir.c]);
      }
    }
  }
}
