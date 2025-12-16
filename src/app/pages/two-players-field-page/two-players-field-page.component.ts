// two-players-field-page.component.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComputerGameService, ShipPlacementDto, ComputerGameStartRequest, GameStateResponse } from '../../services/computer-game.service';
import { Subscription } from 'rxjs';

// Интерфейс для состояния игры
interface GameState {
  myField: string[][]; // Изменено с number[][] на string[][]
  opponentField: string[][]; // Изменено с number[][] на string[][]
  myHits: boolean[][];
  opponentHits: boolean[][];
  myShips: number;
  opponentShips: number;
  isMyTurn: boolean;
  gameStatus: string;
  lastMoveTime?: string;
}

@Component({
  selector: 'app-two-players-field-page',
  templateUrl: './two-players-field-page.component.html',
  styleUrls: ['./two-players-field-page.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class TwoPlayersFieldComponent implements OnChanges, OnInit, OnDestroy {
  @Input() gameId: number = 0; // Изменено с string на number
  @Input() myName: string = '';
  @Input() opponentName: string = '';
  @Input() playerId: number = 0; // Добавлено для идентификации игрока
  @Input() playerShips: ShipPlacementDto[] = []; // Добавлено для расстановки кораблей

  @Input() gameState: GameState = {
    myField: [],
    opponentField: [],
    myHits: [],
    opponentHits: [],
    myShips: 10,
    opponentShips: 10,
    isMyTurn: false,
    gameStatus: 'waiting'
  };

  @Output() cellSelected = new EventEmitter<{ row: number; col: number }>();
  @Output() gameAction = new EventEmitter<{ type: string; data?: any }>();
  @Output() onGameStarted = new EventEmitter<any>();

  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  showPausePopup = false;
  showDrawPopup = false;
  showDrawResponsePopup = false;
  showSurrenderPopup = false;

  myShotsCount = 0;
  myHitsCount = 0;
  computerShotsCount = 0;
  computerHitsCount = 0;

  // Добавленные свойства
  placementStrategy: string = 'RANDOM';
  isGameStarted = false;
  isLoading = false;
  errorMessage = '';

  private subscriptions: Subscription[] = [];

  constructor(private computerGameService: ComputerGameService) {}

  /**
  * Получить CSS класс для клетки
*/
  getCellClass(row: number, col: number, isMyField: boolean): string {
    const field = isMyField ? this.myField : this.opponentField;
    const cell = field[row]?.[col];

    if (!cell) return 'empty';

    switch (cell) {
      case 'SHIP':
        return isMyField ? 'ship' : 'empty';
      case 'HIT':
        return 'hit';
      case 'MISS':
        return 'miss';
      default:
        return 'empty';
    }
  }

  /**
   * Проверить, потоплен ли корабль
   */
  isShipSunk(row: number, col: number, isMyField: boolean): boolean {
    const field = isMyField ? this.myField : this.opponentField;
    const hits = isMyField ? this.myHits : this.opponentHits;

    if (!field[row]?.[col] || field[row][col] !== 'HIT' || !hits[row]?.[col]) {
      return false;
    }

    return this.checkShipSunk(row, col, field, hits);
  }
  /**
   * Проверить, что позиция находится в пределах поля
   */
  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 10 && col >= 0 && col < 10;
  }

  private checkShipSunk(row: number, col: number, field: string[][], hits: boolean[][]): boolean {
    const directions = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
    ];

    const checked = new Set<string>();
    let isSunk = true;

    const checkCell = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (checked.has(key) || !this.isValidPosition(r, c)) return;
      checked.add(key);

      if (field[r]?.[c] === 'SHIP' || field[r]?.[c] === 'HIT') {
        if (!hits[r]?.[c] || field[r][c] !== 'HIT') {
          isSunk = false;
          return;
        }

        for (const dir of directions) {
          const newRow = r + dir.r;
          const newCol = c + dir.c;
          if (this.isValidPosition(newRow, newCol)) {
            checkCell(newRow, newCol);
          }
        }
      }
    };

    checkCell(row, col);
    return isSunk;
  }

  /**
   * Начать новую игру
   */
  restartGame(): void {
    // Сбросить состояние игры
    this.gameId = 0;
    this.isGameStarted = false;
    this.gameState = {
      myField: this.createEmptyField(),
      opponentField: this.createEmptyField(),
      myHits: this.createEmptyHitsField(),
      opponentHits: this.createEmptyHitsField(),
      myShips: 10,
      opponentShips: 10,
      isMyTurn: false,
      gameStatus: 'waiting'
    };
    this.myShotsCount = 0;
    this.myHitsCount = 0;
    this.computerShotsCount = 0;
    this.computerHitsCount = 0;

    // Уведомить родительский компонент
    this.gameAction.emit({ type: 'RESTART' });
  }
  ngOnInit() {
    // Инициализация пустых полей при старте компонента
    if (!this.gameState.myField.length) {
      this.gameState.myField = this.createEmptyField();
    }
    if (!this.gameState.opponentField.length) {
      this.gameState.opponentField = this.createEmptyField();
    }
    if (!this.gameState.myHits.length) {
      this.gameState.myHits = this.createEmptyHitsField();
    }
    if (!this.gameState.opponentHits.length) {
      this.gameState.opponentHits = this.createEmptyHitsField();
    }

    // Подписка на WebSocket обновления
    this.subscribeToWebSocket();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameState'] && !changes['gameState'].firstChange) {
      this.updateStats();
    }

    if (changes['gameId'] && this.gameId) {
      this.loadGameState();
    }
  }

  ngOnDestroy() {
    // Отписка от всех подписок
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.computerGameService.disconnect();
  }

  private subscribeToWebSocket() {
    const sub = this.computerGameService.getGameStateUpdates().subscribe(
      (state) => {
        if (state) {
          this.updateGameState(state);
        }
      },
      (error) => {
        console.error('WebSocket error:', error);
        this.errorMessage = 'Ошибка соединения с сервером';
      }
    );
    this.subscriptions.push(sub);
  }

  private loadGameState() {
    if (this.gameId) {
      this.isLoading = true;
      this.computerGameService.getGameState(this.gameId).subscribe({
        next: (response: GameStateResponse) => {
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

  private updateGameStateFromResponse(response: GameStateResponse) {
    this.gameState = {
      myField: this.convertBoardFormat(response.playerBoard, true),
      opponentField: this.convertBoardFormat(response.computerBoard, false),
      myHits: this.extractHits(response.playerBoard),
      opponentHits: this.extractHits(response.computerBoard),
      myShips: this.countRemainingShips(response.playerBoard),
      opponentShips: this.countRemainingShips(response.computerBoard),
      isMyTurn: response.playerTurn,
      gameStatus: response.status,
      lastMoveTime: response.lastMoveTime
    };

    this.updateStats();
  }

  private convertBoardFormat(board: string[][], showShips: boolean): string[][] {
    // Конвертация формата сервера в формат клиента
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
        hits[i][j] = cell === 'HIT';
      }
    }

    return hits;
  }

  private countRemainingShips(board: string[][]): number {
    // Упрощенный подсчет - в реальном приложении нужна более сложная логика
    let shipCells = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (board[i][j] === 'SHIP') {
          shipCells++;
        }
      }
    }

    return Math.max(0, 10 - Math.floor(shipCells / 2)); // Примерная логика
  }

  get isYourTurn(): boolean {
    return this.gameState?.isMyTurn ?? false;
  }

  get myShipsCount(): number {
    return this.gameState?.myShips ?? 10;
  }

  get opponentShipsCount(): number {
    return this.gameState?.opponentShips ?? 10;
  }

  get myField(): string[][] {
    return this.gameState?.myField || this.createEmptyField();
  }

  get opponentField(): string[][] {
    return this.gameState?.opponentField || this.createEmptyField();
  }

  get myHits(): boolean[][] {
    return this.gameState?.myHits || this.createEmptyHitsField();
  }

  get opponentHits(): boolean[][] {
    return this.gameState?.opponentHits || this.createEmptyHitsField();
  }

  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn || !this.isGameStarted) {
      return;
    }

    if (this.opponentHits[row][col]) {
      return; // Уже стреляли в эту клетку
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Отправляем выстрел через REST
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

    // Или через WebSocket
    // this.computerGameService.sendShotViaWebSocket(this.gameId, row, col);
  }

  private handleShotResponse(response: any) {
    // Обновляем поле противника на основе результата выстрела
    if (response.hit) {
      this.gameState.opponentField[response.row][response.col] = 'HIT';
      this.gameState.opponentHits[response.row][response.col] = true;
    } else {
      this.gameState.opponentField[response.row][response.col] = 'MISS';
      this.gameState.opponentHits[response.row][response.col] = true;
    }

    // Обновляем статистику
    this.myShotsCount = response.playerShots || this.myShotsCount + 1;
    this.myHitsCount = response.playerHits || (response.hit ? this.myHitsCount + 1 : this.myHitsCount);

    // Обрабатываем ход компьютера
    if (response.computerRow !== undefined && response.computerCol !== undefined) {
      if (response.computerHit) {
        this.gameState.myField[response.computerRow][response.computerCol] = 'HIT';
        this.gameState.myHits[response.computerRow][response.computerCol] = true;
      } else {
        this.gameState.myField[response.computerRow][response.computerCol] = 'MISS';
        this.gameState.myHits[response.computerRow][response.computerCol] = true;
      }

      this.computerShotsCount = response.computerShots || this.computerShotsCount + 1;
      this.computerHitsCount = response.computerHits || (response.computerHit ? this.computerHitsCount + 1 : this.computerHitsCount);
    }

    // Обновляем количество кораблей
    this.gameState.myShips = response.playerShipsRemaining || this.gameState.myShips;
    this.gameState.opponentShips = response.computerShipsRemaining || this.gameState.opponentShips;

    // Обновляем очередь хода
    this.gameState.isMyTurn = !response.gameOver;

    // Проверяем окончание игры
    if (response.gameOver) {
      this.gameState.gameStatus = 'completed';
      this.showGameOverMessage(response.message);
    }

    this.updateStats();
  }

  private showGameOverMessage(message: string) {
    alert(message);
    // Или показать модальное окно с результатом
  }

  private updateGameState(state: any) {
    // Обновление состояния из WebSocket
    this.gameState = { ...this.gameState, ...state };
    this.updateStats();
  }

  private updateStats(): void {
    // Считаем выстрелы игрока
    this.myShotsCount = 0;
    this.myHitsCount = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (this.opponentHits[i][j]) {
          this.myShotsCount++;
          if (this.opponentField[i][j] === 'HIT') {
            this.myHitsCount++;
          }
        }
      }
    }

    // Считаем выстрелы компьютера
    this.computerShotsCount = 0;
    this.computerHitsCount = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
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

  // Управление игрой
  offerDraw(): void {
    this.showDrawPopup = true;
    this.gameAction.emit({ type: 'OFFER_DRAW' });
  }

  cancelDrawOffer(): void {
    this.showDrawPopup = false;
    this.gameAction.emit({ type: 'CANCEL_DRAW' });
  }

  closeDrawPopup(): void {
    this.showDrawPopup = false;
  }

  acceptDraw(): void {
    this.showDrawResponsePopup = false;
    this.gameAction.emit({ type: 'ACCEPT_DRAW' });
  }

  declineDraw(): void {
    this.showDrawResponsePopup = false;
    this.gameAction.emit({ type: 'DECLINE_DRAW' });
  }

  surrender(): void {
    this.showSurrenderPopup = true;
  }

  confirmSurrender(): void {
    this.computerGameService.surrender(this.gameId).subscribe({
      next: () => {
        this.gameState.gameStatus = 'completed';
        this.showSurrenderPopup = false;
        this.gameAction.emit({ type: 'SURRENDER' });
      },
      error: (error) => {
        console.error('Surrender error:', error);
        this.errorMessage = 'Ошибка при сдаче';
      }
    });
  }

  cancelSurrender(): void {
    this.showSurrenderPopup = false;
  }

  /**
   * Начать игру после размещения кораблей
   */
  startGame(): void {
    if (this.playerId && this.placementStrategy && this.playerShips.length > 0) {
      this.isLoading = true;
      this.errorMessage = '';

      const request: ComputerGameStartRequest = {
        placementStrategy: this.placementStrategy,
        playerShips: this.playerShips
      };

      console.log('Starting game with:', {
        playerId: this.playerId,
        request: request
      });

      // Шаг 1: Создаем игру (с пустыми досками)
      this.computerGameService.createGame(this.playerId, request).subscribe({
        next: (response: any) => {
          console.log('Game created response:', response);

          // Получаем gameId из ответа сервера
          // На сервере возвращается объект Game с полем gameId
          this.gameId = response.gameId || response.id || response;

          if (!this.gameId) {
            throw new Error('Не удалось получить ID игры');
          }

          console.log('Game ID:', this.gameId);

          // Шаг 2: Настраиваем игру (расставляем корабли)
          this.computerGameService.setupGame(this.gameId, request).subscribe({
            next: (setupResponse: any) => {
              console.log('Game setup completed:', setupResponse);

              // Шаг 3: Загружаем начальное состояние игры
              this.loadGameState();

              this.isGameStarted = true;
              this.gameState.gameStatus = 'ACTIVE';
              this.gameState.isMyTurn = true; // Игрок ходит первым
              this.isLoading = false;

              // Подписываемся на WebSocket обновления
              this.computerGameService.subscribeToGame(this.gameId);

              // Уведомляем родительский компонент
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
        },
        error: (error) => {
          console.error('Create game error:', error);
          this.errorMessage = error.error?.message || 'Ошибка при создании игры';
          this.isLoading = false;
        }
      });
    } else {
      this.errorMessage = 'Не все данные для начала игры заполнены';
    }
  }
}
